const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 🔥 ANALYZE VIRAL MOMENTS USING AI
 */
async function analyzeViralMoments({
  transcript,
  clipLength,
  clipCount,
}) {

  if (!Array.isArray(transcript) || transcript.length === 0) {
    throw new Error("Invalid transcript");
  }

  // 🔥 simplificar transcript (evitar payload gigante)
  const simplified = transcript.map((seg) => ({
    text: seg.text,
    start: seg.start,
    end: seg.end,
  }));

  const prompt = `
You are a viral content editor.

Your task:
- Analyze the transcript
- Select the BEST ${clipCount} viral moments
- Each clip MUST be around ${clipLength} seconds
- Clips must be engaging, emotional, or powerful
- Avoid boring or filler content

Rules:
- Return EXACT JSON
- No explanation
- No markdown
- Only array

Format:
[
  { "startTime": number, "endTime": number }
]

Transcript:
${JSON.stringify(simplified).slice(0, 12000)}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // rápido e barato
    messages: [
      {
        role: "system",
        content: "You are a viral clip generator.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
  });

  let content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty AI response");
  }

  // 🔥 limpar possíveis ```json
  content = content
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error("❌ AI PARSE ERROR:", content);
    throw new Error("Failed to parse AI response");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI returned invalid format");
  }

  console.log("✅ AI viral moments:", parsed);

  return parsed;
}

module.exports = {
  analyzeViralMoments,
};
