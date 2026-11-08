// Vercel serverless function: POST /api/ai-explain
// Takes a practice question + which "explain mode" the student picked, and asks a
// free OpenRouter model to answer. The OpenRouter API key lives only in the
// server environment (OPENROUTER_API_KEY on Vercel) and is never sent to the browser.

// Hand-picked free models to fall back on if the live catalog fetch below fails,
// or if the top live models are rate-limited / temporarily down. OpenRouter's
// free lineup rotates over time, so this list is a safety net, not the primary source.
// Plain instruct models (not "thinking"/reasoning models) are listed first since
// reasoning models are the ones most likely to leak their chain-of-thought into
// the visible answer.
const FALLBACK_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-235b-a22b:free",
];

// Model-name fragments associated with "thinking"/reasoning-style models, which are
// more prone to spilling their chain-of-thought into the response body. We don't
// exclude them outright (they're still useful fallbacks) but we try them last.
const REASONING_MODEL_HINTS = ["think", "reasoning", "r1", "qwq", "o1", "o3"];

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

// Free OpenRouter models are frequently rate-limited or slow, so instead of trying them
// one at a time we race a small batch in parallel and take the first good answer.
// Worst case: 3s catalog lookup + 2 waves x 12s = 27s, under the 30s maxDuration in vercel.json.
const WAVE_SIZE = 3;
const MAX_WAVES = 2;
const WAVE_TIMEOUT_MS = 12000;

export default async function handler(req, res) {
  // Diagnostic: open /api/ai-explain in a browser (GET) to see what's wrong. Never reveals the key.
  if (req.method === "GET") {
    const key = process.env.OPENROUTER_API_KEY;
    const report = { endpointDeployed: true, keySet: Boolean(key), keyValid: null, freeModelsFound: null, pinnedModel: process.env.OPENROUTER_MODEL || null };
    if (key) {
      try {
        const k = await fetch("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${key}` } });
        report.keyValid = k.ok;
        report.keyCheckStatus = k.status;
      } catch (e) {
        report.keyCheckError = e && e.message ? e.message : "request failed";
      }
      report.freeModelsFound = (await getModelCandidates(key)).length;
    } else {
      report.hint = "OPENROUTER_API_KEY is not set for this deployment. Add it in Vercel > Settings > Environment Variables (Production), then redeploy.";
    }
    res.status(200).json(report);
    return;
  }

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
    `You are a friendly, encouraging medical school tutor helping a student understand an MCQ ` +
    `they just practiced. ${MODE_INSTRUCTIONS[mode]}\n\n` +
    `Critical output rules: reply with ONLY the final explanation itself, and nothing else. ` +
    `Do not show your reasoning, planning, or thinking process. Do not include meta-commentary ` +
    `such as "Here's a thinking process", "Let me analyze this", numbered analysis steps, or ` +
    `any restatement of these instructions. Do not use <think> tags. Start your reply directly ` +
    `with the explanation itself, as if speaking straight to the student. Respond in plain text ` +
    `only - no markdown symbols like asterisks, hashes, or bullet dashes.`;

  const apiKeyHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": "https://modular-medico.vercel.app",
    "X-Title": "Modular Medico - AI Explain",
  };

  // Calls one model; resolves with the cleaned answer, or rejects with a short reason.
  const callModel = async (model, signal) => {
    const send = (withReasoning) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: apiKeyHeaders,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: mode === "mnemonic" ? 0.9 : 0.6,
          max_tokens: mode === "depth" ? 650 : 320,
          // Ask OpenRouter to strip chain-of-thought tokens so only the final answer comes back.
          ...(withReasoning ? { reasoning: { exclude: true } } : {}),
        }),
        signal,
      });

    let r = await send(true);
    if (r.status === 400) r = await send(false); // some providers reject the reasoning option
    if (!r.ok) {
      let detail = "";
      try {
        const e = await r.json();
        detail = e?.error?.metadata?.raw || e?.error?.message || "";
      } catch {
        /* no JSON body */
      }
      throw new Error(`${model}: HTTP ${r.status}${detail ? ` - ${String(detail).slice(0, 140)}` : ""}`);
    }

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    const text = raw ? cleanExplanation(raw) : "";
    if (!text) throw new Error(`${model}: empty response`);
    if (looksLikeLeakedReasoning(text)) throw new Error(`${model}: response looked like leaked reasoning`);
    return { answer: text, model };
  };

  // OPENROUTER_MODEL (optional env var) pins a preferred model, tried first. Useful if you
  // add credits and want a faster/more reliable paid model than the free pool.
  const pinned = (process.env.OPENROUTER_MODEL || "").trim();
  const candidates = await getModelCandidates(apiKey);
  const ordered = pinned ? [pinned, ...candidates.filter((m) => m !== pinned)] : candidates;

  const failures = [];
  for (let wave = 0; wave < MAX_WAVES; wave++) {
    const batch = ordered.slice(wave * WAVE_SIZE, (wave + 1) * WAVE_SIZE);
    if (batch.length === 0) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WAVE_TIMEOUT_MS);
    try {
      const winner = await Promise.any(
        batch.map((m) =>
          callModel(m, controller.signal).catch((e) => {
            failures.push(e && e.message ? e.message : `${m}: request failed`);
            throw e;
          })
        )
      );
      controller.abort(); // cancel the slower models in this wave
      res.status(200).json(winner);
      return;
    } catch {
      /* every model in this wave failed — try the next wave */
    } finally {
      clearTimeout(timer);
    }
  }

  const authProblem = failures.some((f) => /HTTP (401|403)/.test(f));
  const creditProblem = failures.some((f) => /HTTP 402/.test(f));
  const policyProblem = failures.some((f) => /data policy|no endpoints found/i.test(f));
  const message = policyProblem
    ? "OpenRouter blocked the free models because of your privacy settings. Open openrouter.ai/settings/privacy and enable the free-endpoints / model-training option, then try again."
    : authProblem
    ? "The OpenRouter API key was rejected (HTTP 401/403). Check OPENROUTER_API_KEY in Vercel and redeploy."
    : creditProblem
    ? "OpenRouter says this key has no credits for that model (HTTP 402). Try again or add credits."
    : "All free AI models are busy or rate-limited right now. Please try again in a moment.";
  res.status(502).json({ error: `${message} (${failures.slice(-3).join("; ") || "no models available"})` });
}

/**
 * Strips common chain-of-thought wrappers a model might emit despite instructions
 * (e.g. <think>...</think> blocks some providers include inline in `content`).
 * If a closing think tag is found, everything up to and including it is dropped.
 */
function cleanExplanation(text) {
  let cleaned = text;
  const lastThinkClose = cleaned.toLowerCase().lastIndexOf("</think>");
  if (lastThinkClose !== -1) {
    cleaned = cleaned.slice(lastThinkClose + "</think>".length);
  }
  cleaned = cleaned.replace(/<\/?think[^>]*>/gi, "");
  return cleaned.trim();
}

/**
 * Heuristic check for a response that still looks like exposed reasoning rather
 * than a clean final answer (numbered meta-analysis steps, "thinking process"
 * preambles, etc.). If this trips, we treat the attempt as failed and move on
 * to the next model rather than showing raw reasoning to the student.
 */
function looksLikeLeakedReasoning(text) {
  const lower = text.toLowerCase();
  const startsWithMeta = /^(okay,?\s|here'?s\s(a|my)\s(thinking|thought)|let me think|let'?s think|first,?\s+i\s+need\s+to)/i.test(text.trim());
  if (startsWithMeta) return true;
  if (lower.includes("thinking process") || lower.includes("analyze user") || lower.includes("user request")) return true;
  // Numbered bold-header steps like "1. **Analyze...**" or "2. **Deconstruct...**"
  const numberedHeaders = text.match(/^\s*\d+\.\s+\*\*/gm);
  if (numberedHeaders && numberedHeaders.length >= 2) return true;
  return false;
}

/**
 * Builds the ordered list of free model IDs to attempt. Prefers models currently
 * marked $0 on OpenRouter's live catalog (since the free lineup rotates), and
 * falls back to a hand-picked list if that lookup fails for any reason. Plain
 * instruct models are tried before "thinking"/reasoning-style models.
 */
async function getModelCandidates(apiKey) {
  let ids = FALLBACK_FREE_MODELS;
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
        ids = Array.from(new Set([...liveFreeIds, ...FALLBACK_FREE_MODELS]));
      }
    }
  } catch {
    /* live catalog lookup failed — use the hand-picked fallback list */
  }

  const isReasoningModel = (id) => REASONING_MODEL_HINTS.some((hint) => id.toLowerCase().includes(hint));
  const plain = ids.filter((id) => !isReasoningModel(id));
  const reasoning = ids.filter(isReasoningModel);
  return [...plain, ...reasoning];
}
