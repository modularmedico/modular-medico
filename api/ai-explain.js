// Vercel serverless function: POST /api/ai-explain
// Takes a practice question + which "explain mode" the student picked, and asks a
// free OpenRouter model to answer. The OpenRouter API key lives only in the
// server environment (OPENROUTER_API_KEY on Vercel) and is never sent to the browser.

// Hand-picked free models to fall back on if the live catalog fetch below fails,
// or if the top live models are rate-limited / temporarily down. OpenRouter's
// free lineup rotates over time, so this list is a safety net, not the primary source.
const FALLBACK_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "google/gemma-3-12b-it:free",
  "qwen/qwen3-235b-a22b:free",
  "openai/gpt-oss-20b:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

const MODE_INSTRUCTIONS = {
  simple:
    "Explain the correct answer to this medical question in very simple, plain words, " +
    "as if teaching a confused first-year student. Avoid jargon; define any medical term " +
    "you must use. Keep it short: 4-6 sentences.",
  analogy:
    "Explain the correct answer to this medical question using one clear, vivid real-world " +
    "analogy that makes the underlying mechanism easy to picture. Explicitly connect the " +
    "analogy back to the real medical concept at the end. Keep it short: 4-6 sentences.",
  mnemonic:
    "Create one or two short, memorable mnemonics (an acronym, acrostic, or memory phrase) " +
    "that help a medical student recall the key fact(s) needed to answer this question. " +
    "Spell out exactly what each letter or word in the mnemonic stands for. Keep it focused.",
  depth:
    "Give a thorough, in-depth explanation of this medical question: the correct answer, the " +
    "underlying mechanism or pathophysiology, why each other option is wrong, and any " +
    "clinically relevant exam pearls. Organize it into short plain-text sections aimed at a " +
    "medical student preparing for exams.",
};

const MAX_MODEL_ATTEMPTS = 3;
const PER_MODEL_TIMEOUT_MS = 9000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "The server is missing OPENROUTER_API_KEY. Add your OpenRouter key to the project's Environment Variables in Vercel, then redeploy.",
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { question, options, correctAnswer, userAnswer, explanation, mode } = body || {};

  if (!question || !mode || !MODE_INSTRUCTIONS[mode]) {
    res.status(400).json({ error: "Request must include a question and a valid mode." });
    return;
  }

  const optionsList = Array.isArray(options)
    ? options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join("\n")
    : "";

  const userPrompt = [
    `Question: ${question}`,
    optionsList && `Options:\n${optionsList}`,
    correctAnswer && `Correct answer: ${correctAnswer}`,
    userAnswer && userAnswer !== correctAnswer && `Student's chosen (incorrect) answer: ${userAnswer}`,
    explanation && `Existing brief explanation: ${explanation}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt =
    `You are a friendly, encouraging medical school tutor helping a student understand an ` +
    `MCQ they just practiced. ${MODE_INSTRUCTIONS[mode]} Respond in plain text only - do not ` +
    `use markdown symbols like asterisks, hashes, or bullet dashes.`;

  const modelsToTry = (await getModelCandidates(apiKey)).slice(0, MAX_MODEL_ATTEMPTS);

  let lastError = "Unknown error";
  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PER_MODEL_TIMEOUT_MS);

      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://modular-medico.vercel.app",
          "X-Title": "Modular Medico - AI Explain",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: mode === "mnemonic" ? 0.9 : 0.6,
          max_tokens: mode === "depth" ? 650 : 320,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!r.ok) {
        lastError = `${model}: HTTP ${r.status}`;
        continue; // try the next free model
      }

      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) {
        res.status(200).json({ answer: text, model });
        return;
      }
      lastError = `${model}: empty response`;
    } catch (err) {
      lastError = `${model}: ${err && err.message ? err.message : "request failed"}`;
    }
  }

  res.status(502).json({
    error: `All free AI models are busy or rate-limited right now. Please try again in a moment. (${lastError})`,
  });
}

/**
 * Builds the ordered list of free model IDs to attempt. Prefers models currently
 * marked $0 on OpenRouter's live catalog (since the free lineup rotates), and
 * falls back to a hand-picked list if that lookup fails for any reason.
 */
async function getModelCandidates(apiKey) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (r.ok) {
      const data = await r.json();
      const liveFreeIds = (data?.data || [])
        .filter((m) => m?.pricing?.prompt === "0" && m?.pricing?.completion === "0")
        .map((m) => m.id)
        .filter((id) => typeof id === "string" && id.endsWith(":free"));

      if (liveFreeIds.length > 0) {
        return Array.from(new Set([...liveFreeIds, ...FALLBACK_FREE_MODELS]));
      }
    }
  } catch {
    /* live catalog lookup failed — use the hand-picked fallback list below */
  }
  return FALLBACK_FREE_MODELS;
}
