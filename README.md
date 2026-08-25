# DocuChat — RAG-powered Document Q&A

A Retrieval-Augmented Generation (RAG) application that lets you upload any PDF or paste text and ask questions about it. Built with vanilla JavaScript, HTML, and CSS — no frameworks.

**Live Demo:** https://docuchatrag.vercel.app/

---

## What It Does

1. Upload a PDF or paste any text document
2. The app splits the document into overlapping chunks
3. Ask a question in natural language
4. The app finds the most relevant chunks using keyword-based scoring
5. Those chunks are sent to Gemini as context
6. Gemini answers strictly from your document — not from general knowledge

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| PDF Parsing | PDF.js (Mozilla) — runs in browser |
| Chunk Retrieval | Keyword scoring with TF-IDF style overlap — pure JS |
| LLM | Google Gemini 3.6 Flash API |
| Backend | Vercel Serverless Function (Node.js) |
| Deployment | Vercel |

---

## Architecture

```
Browser
  ├── PDF.js extracts text from uploaded PDF
  ├── Text is split into overlapping 200-word chunks
  ├── User question is scored against each chunk (keyword overlap)
  └── Top 3 chunks sent via POST to /api/chat

Vercel Serverless Function (/api/chat.js)
  ├── Receives question + context chunks
  ├── Builds a grounded prompt
  └── Calls Gemini API and returns the answer
```

The API key never touches the browser — it lives only in Vercel's environment variables.

---

## Why Keyword Scoring Instead of Vector Embeddings

Vector embeddings (semantic search) require loading a ~30MB ML model in the browser via WebAssembly, which adds latency and CDN reliability issues. Keyword-based scoring — counting meaningful word overlaps between the question and each chunk — is faster, fully offline, and sufficient for focused document Q&A where the user's question naturally shares vocabulary with the relevant passage.

---

## Project Structure

```
docuchatrag/
├── index.html        — UI structure
├── style.css         — dark theme, chat bubbles, layout
├── app.js            — PDF parsing, chunking, retrieval, fetch
├── api/
│   └── chat.js       — Vercel serverless function, Gemini call
├── vercel.json       — Vercel config
└── package.json      — Node.js project config
```

---

## Running Locally

1. Clone the repo
```bash
git clone https://github.com/shyam6767/docuchatrag.git
cd docuchatrag
```

2. Install Vercel CLI
```bash
npm install -g vercel
```

3. Create a `.env` file
```
GEMINI_API_KEY=your_key_here
```

Get a free API key at [aistudio.google.com](https://aistudio.google.com)

4. Run locally
```bash
vercel dev
```

Open `http://localhost:3000`

---

## Key Implementation Details

**Chunking with overlap** — the document is split into 200-word chunks with a 50-word overlap so context is never cut off at chunk boundaries.

**Grounded prompting** — Gemini is explicitly instructed to answer only from the provided context, preventing hallucination beyond the document.

**API key security** — the Gemini API key is stored as a Vercel environment variable and only accessed server-side in the serverless function. It is never exposed to the browser.

---

## Limitations

- Vector search would give better semantic retrieval for paraphrased questions
- No persistent storage — document is held in memory per session
- Large documents with many chunks may hit Vercel's free tier function timeout

---

## Author

Shyam — [github.com/shyam6767](https://github.com/shyam6767)