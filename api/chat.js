export default async function handler(req, res) {
  console.log('METHOD:', req.method);
  console.log('BODY:', JSON.stringify(req.body));
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { question, context } = req.body;

  if (!question || !context) {
    res.status(400).json({ error: 'Missing question or context' });
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: 'Gemini API key not configured' });
    return;
  }

  const prompt = 'You are a helpful assistant. Answer the question using ONLY the context provided below. If the answer is not in the context, say I could not find that in the document.\n\nContext:\n' + context + '\n\nQuestion: ' + question + '\n\nAnswer:';
  console.log('CALLING GEMINI...');
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    console.log('GEMINI STATUS:', response.status);
    const data = await response.json();
    console.log('GEMINI DATA:', JSON.stringify(data).slice(0, 200));

    if (!data.candidates || !data.candidates[0]) {
      res.status(500).json({ error: 'No response from Gemini', raw: data });
      return;
    }

    const answer = data.candidates[0].content.parts[0].text;
    res.status(200).json({ answer: answer });

  } catch (error) {
    console.log('CATCH ERROR:', error.message);
    console.log('STACK:', error.stack);
    res.status(500).json({ error: error.message });
  }
}