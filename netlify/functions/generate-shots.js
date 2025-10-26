// netlify/functions/generate-shots.js
export async function handler(event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  try {
    const { script } = JSON.parse(event.body || "{}");
    if (!script || script.trim().length < 10) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Please paste a longer script." }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing OPENAI_API_KEY on server." }) };
    }

    // Ask for strict JSON so the front-end can render a table easily
    const system = `You convert film scripts into concise, production-ready shot lists.
Respond ONLY with valid JSON matching this schema:
{
  "shots": [
    {
      "n": number,                // 1-based shot number
      "slugline": string,         // e.g., "INT. KITCHEN - NIGHT"
      "description": string,      // 1-2 sentences
      "angle": string,            // e.g., "WS", "MS", "CU", "OTS", "POV"
      "movement": string,         // e.g., "static", "push-in", "pan right"
      "location": string,
      "time_of_day": string,      // "DAY" / "NIGHT" / etc.
      "props": string[],          // main props
      "notes": string             // optional brief note
    }
  ]
}`;
    const user = `Script:\n${script}\n\nGenerate 8–15 shots (merge ultra-short beats). Keep it practical for a micro-crew.`;

    // Call OpenAI (Chat Completions for compatibility)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // or "gpt-4-turbo" if you prefer
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "OpenAI error", detail: err }) };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    // Ensure valid JSON
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { shots: [] }; }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify(parsed),
    };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Server error", detail: String(e) }) };
  }
}
