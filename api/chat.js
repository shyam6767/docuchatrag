export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, context } = req.body;

  if (!question || !context) {
    return res.status(400).json({ error: 'Missing question or context' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const prompt = `You are a helpful assistant. Answer the question using ONLY the context provided below. 
If the answer is not in the context, say "I couldn't find that in the document."

Context:
${context}

Question: ${question}

Answer:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));

    if (!data.candidates || !data.candidates[0]) {
      return res.status(500).json({ error: 'No candidates in Gemini response', raw: data });
    }

    const answer = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ answer });

  } catch (error) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ error: error.message });
  }
}