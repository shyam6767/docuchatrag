import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs';

// ── STATE ────────────────────────────────────────────────────────────────────
let chunks = [];

// ── DOM ELEMENTS ─────────────────────────────────────────────────────────────
const docInput      = document.getElementById('doc-input');
const loadBtn       = document.getElementById('load-btn');
const docStatus     = document.getElementById('doc-status');
const chatBox       = document.getElementById('chat-box');
const questionInput = document.getElementById('question-input');
const askBtn        = document.getElementById('ask-btn');
const pdfUpload     = document.getElementById('pdf-upload');

// ── STEP 1: EXTRACT TEXT FROM PDF ────────────────────────────────────────────
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

// ── STEP 2: CHUNK THE DOCUMENT ───────────────────────────────────────────────
function chunkText(text, chunkSize = 200, overlap = 50) {
  const words = text.split(/\s+/);
  const result = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) result.push(chunk);
  }
  return result;
}

// ── STEP 3: SCORE CHUNKS BY KEYWORD OVERLAP ──────────────────────────────────
function scoreChunk(chunk, question) {
  const normalize = str => str.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const questionWords = new Set(normalize(question).split(/\s+/).filter(w => w.length > 3));
  const chunkWords = normalize(chunk).split(/\s+/);
  let score = 0;
  for (const word of chunkWords) {
    if (questionWords.has(word)) score++;
  }
  return score;
}

function getTopChunks(question, topK = 3) {
  const scored = chunks.map((chunk, index) => ({
    index,
    score: scoreChunk(chunk, question)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(item => chunks[item.index]);
}

// ── STEP 4: CALL VERCEL FUNCTION ─────────────────────────────────────────────
async function askGemini(question, context) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.answer;
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function addBubble(text, type) {
  const bubble = document.createElement('div');
  bubble.classList.add('bubble', type);
  bubble.textContent = text;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
  return bubble;
}

// ── PDF UPLOAD ────────────────────────────────────────────────────────────────
pdfUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  docStatus.textContent = 'Reading PDF...';
  try {
    const text = await extractTextFromPDF(file);
    docInput.value = text;
    docStatus.textContent = 'PDF loaded. Click "Load Document" to continue.';
  } catch (err) {
    docStatus.textContent = 'Failed to read PDF. Try pasting text instead.';
  }
});

// ── LOAD BUTTON ───────────────────────────────────────────────────────────────
loadBtn.addEventListener('click', () => {
  const text = docInput.value.trim();
  if (!text) {
    docStatus.textContent = 'Paste a document or upload a PDF first.';
    return;
  }
  chunks = chunkText(text);
  docStatus.textContent = `Document loaded. ${chunks.length} chunks ready. Ask a question.`;
});

// ── ASK BUTTON ────────────────────────────────────────────────────────────────
askBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim();
  if (!question) return;
  if (chunks.length === 0) {
    addBubble('Load a document first.', 'bot');
    return;
  }

  addBubble(question, 'user');
  questionInput.value = '';

  const loadingBubble = addBubble('Thinking...', 'loading');

  try {
    const topChunks = getTopChunks(question);
    const context = topChunks.join('\n\n');
    const answer = await askGemini(question, context);
    loadingBubble.textContent = answer;
    loadingBubble.classList.remove('loading');
    loadingBubble.classList.add('bot');
  } catch (err) {
    loadingBubble.textContent = 'Something went wrong. Try again.';
    loadingBubble.classList.remove('loading');
    loadingBubble.classList.add('bot');
  }
});

// ── ENTER KEY ─────────────────────────────────────────────────────────────────
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') askBtn.click();
});

// ── INIT ──────────────────────────────────────────────────────────────────────
docStatus.textContent = 'Paste your document or upload a PDF, then click Load Document.';