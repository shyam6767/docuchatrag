import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs';

// ─── STATE ───────────────────────────────────────────────────────────────────
let extractor = null;
let chunks = [];
let chunkEmbeddings = [];

// ─── DOM ELEMENTS ─────────────────────────────────────────────────────────────
const docInput      = document.getElementById('doc-input');
const loadBtn       = document.getElementById('load-btn');
const docStatus     = document.getElementById('doc-status');
const chatBox       = document.getElementById('chat-box');
const questionInput = document.getElementById('question-input');
const askBtn        = document.getElementById('ask-btn');
const pdfUpload     = document.getElementById('pdf-upload');

// ─── STEP 1: LOAD MODEL ON PAGE START ────────────────────────────────────────
async function loadModel() {
  docStatus.textContent = '⏳ Loading embedding model... (first load ~30 seconds)';
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  docStatus.textContent = '✅ Model ready. Paste text or upload a PDF, then click Load.';
}

// ─── STEP 2: EXTRACT TEXT FROM PDF ───────────────────────────────────────────
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

// ─── STEP 3: CHUNK THE DOCUMENT ──────────────────────────────────────────────
function chunkText(text, chunkSize = 200, overlap = 50) {
  const words = text.split(' ');
  const result = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      result.push(chunk);
    }
  }

  return result;
}

// ─── STEP 4: EMBED TEXT ───────────────────────────────────────────────────────
async function embedText(text) {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// ─── STEP 5: COSINE SIMILARITY ───────────────────────────────────────────────
function cosineSimilarity(a, b) {
  const dot  = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// ─── STEP 6: FIND TOP CHUNKS ─────────────────────────────────────────────────
function getTopChunks(questionEmbedding, topK = 3) {
  const scored = chunkEmbeddings.map((embedding, index) => ({
    index,
    score: cosineSimilarity(questionEmbedding, embedding)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(item => chunks[item.index]);
}

// ─── STEP 7: CALL VERCEL FUNCTION ────────────────────────────────────────────
async function askGemini(question, context) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context })
  });

  const data = await response.json();
  return data.answer;
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function addBubble(text, type) {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', type);
  bubble.textContent = text;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

// ─── PDF UPLOAD HANDLER ───────────────────────────────────────────────────────
pdfUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  docStatus.textContent = `⏳ Reading PDF: ${file.name}...`;

  const text = await extractTextFromPDF(file);
  docInput.value = text;

  docStatus.textContent = `✅ PDF loaded into text box. Click "Load Document" to embed it.`;
});

// ─── LOAD BUTTON CLICK ───────────────────────────────────────────────────────
loadBtn.addEventListener('click', async () => {
  const text = docInput.value.trim();

  if (!text) {
    docStatus.textContent = '⚠️ Please paste a document or upload a PDF first.';
    return;
  }

  docStatus.textContent = '⏳ Chunking and embedding document...';
  loadBtn.disabled = true;

  chunks = chunkText(text);
  chunkEmbeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    chunkEmbeddings.push(embedding);
    docStatus.textContent = `⏳ Embedding chunk ${i + 1} of ${chunks.length}...`;
  }

  docStatus.textContent = `✅ Done! ${chunks.length} chunks ready. Ask away.`;
  loadBtn.disabled = false;
});

// ─── ASK BUTTON CLICK ────────────────────────────────────────────────────────
askBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim();

  if (!question) return;
  if (chunkEmbeddings.length === 0) {
    addBubble('⚠️ Please load a document first.', 'bot');
    return;
  }

  addBubble(question, 'user');
  questionInput.value = '';

  const loadingBubble = addBubble('Thinking...', 'loading');

  const questionEmbedding = await embedText(question);
  const topChunks = getTopChunks(questionEmbedding);
  const context = topChunks.join('\n\n');

  const answer = await askGemini(question, context);

  loadingBubble.textContent = answer;
  loadingBubble.classList.remove('loading');
  loadingBubble.classList.add('bot');
});

// ─── ENTER KEY TO ASK ────────────────────────────────────────────────────────
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') askBtn.click();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadModel();