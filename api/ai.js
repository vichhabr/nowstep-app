// netlify/functions/ai.js
// Uses OpenAI API — set OPENAI_API_KEY in Netlify environment variables

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: '[]' };
  }

  let prompt = '';
  let maxTokens = 1200;

  try {
    const body = JSON.parse(event.body || '{}');
    if (body.prompt) {
      prompt = body.prompt;
      maxTokens = body.maxTokens || 1200;
    } else {
      const category = body.category || 'general';
      const catLabel = category === 'all'
        ? 'career, immigration, money, mental clarity, and life decisions'
        : category;
      prompt = `You are a decision engine. Return STRICT JSON only.

Generate 8 high quality decisions for category: ${catLabel}.

Return a JSON array:
[
  {
    "situation": "short relatable situation (1 line)",
    "decision": "clear what to do (1 sentence)",
    "steps": ["step 1", "step 2", "step 3"],
    "why": "short reason this matters now"
  }
]

No explanation. No markdown. JSON array only.`;
    }
  } catch {
    return { statusCode: 400, headers, body: '[]' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    return { statusCode: 200, headers, body: '[]' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature: 0.8,
        messages: [
          { role: 'system', content: 'You are a decision clarity engine. Always respond with a valid JSON array only. No markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', response.status, await response.text());
      return { statusCode: 200, headers, body: '[]' };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '[]';
    content = content.replace(/```json|```/g, '').trim();

    // Unwrap if OpenAI returned { "decisions": [...] }
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return { statusCode: 200, headers, body: JSON.stringify(parsed) };
      }
      const arr = Object.values(parsed).find(v => Array.isArray(v));
      return { statusCode: 200, headers, body: arr ? JSON.stringify(arr) : '[]' };
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      return { statusCode: 200, headers, body: match ? match[0] : '[]' };
    }

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 200, headers, body: '[]' };
  }
};
