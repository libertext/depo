/* ============================================================================
 *  SEO Article Writer — Secure Anthropic Proxy (SaaS-ready)
 * ----------------------------------------------------------------------------
 *  The owner's Anthropic API key stays on the server. Customers authenticate
 *  with an access token you hand out (one per subscriber). All prompt/IP logic
 *  lives here — the browser never sees your key or your prompts.
 *
 *  Env vars (see .env.example):
 *    ANTHROPIC_API_KEY   (required)  your Anthropic key — the billing account
 *    ACCESS_TOKENS       (optional)  comma-separated customer tokens; if empty
 *                                    the API is OPEN (dev only — never in prod)
 *    MODEL               (optional)  default model id
 *    ALLOWED_ORIGINS     (optional)  comma-separated CORS origins, or *
 *    RATE_LIMIT_PER_MIN  (optional)  requests/min per token (default 12)
 *    PORT                (optional)  default 3000
 * ==========================================================================*/

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

/* Zero-dependency .env loader (only fills vars that aren't already set). */
(function loadDotEnv() {
  try {
    const file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch { /* ignore */ }
})();

const app = express();
app.use(express.json({ limit: '1mb' }));

/* ----------------------------- configuration ---------------------------- */
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const DEFAULT_MODEL     = process.env.MODEL || 'claude-sonnet-4-6';
const RATE_LIMIT        = parseInt(process.env.RATE_LIMIT_PER_MIN || '12', 10);
const PORT              = parseInt(process.env.PORT || '3000', 10);

const ACCESS_TOKENS = (process.env.ACCESS_TOKENS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',').map(s => s.trim()).filter(Boolean);

// Models a customer is allowed to request (prevents abuse / cost surprises).
const ALLOWED_MODELS = new Set([
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
]);

/* -------------------------------- CORS ---------------------------------- */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Token');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

/* ---------------------------- rate limiting ----------------------------- */
const hits = new Map(); // key -> [timestamps]
function rateLimited(key) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const arr = (hits.get(key) || []).filter(t => t > windowStart);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > RATE_LIMIT;
}
// periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const windowStart = Date.now() - 60_000;
  for (const [k, arr] of hits) {
    const keep = arr.filter(t => t > windowStart);
    if (keep.length) hits.set(k, keep); else hits.delete(k);
  }
}, 120_000).unref?.();

/* --------------------------- access control ----------------------------- */
function auth(req, res, next) {
  // If no tokens configured, API is open (development mode).
  if (ACCESS_TOKENS.length === 0) { req.clientKey = req.ip; return next(); }

  const token = req.headers['x-access-token'] || '';
  if (!token || !ACCESS_TOKENS.includes(token)) {
    return res.status(401).json({ error: 'Geçersiz veya eksik erişim jetonu.' });
  }
  req.clientKey = token;
  next();
}

function limit(req, res, next) {
  if (rateLimited(req.clientKey)) {
    return res.status(429).json({ error: 'Çok fazla istek. Lütfen bir dakika bekleyin.' });
  }
  next();
}

/* --------------------------- Anthropic call ----------------------------- */
async function callAnthropic({ system, tool, userMessage, model, maxTokens }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Sunucuda ANTHROPIC_API_KEY tanımlı değil.');
  }
  const chosen = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;

  const body = {
    model: chosen,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: userMessage }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try { const e = await res.json(); detail = e?.error?.message || JSON.stringify(e); }
    catch { detail = await res.text().catch(() => ''); }
    const err = new Error(detail.slice(0, 200) || `Anthropic ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const block = (data.content || []).find(b => b.type === 'tool_use' && b.name === tool.name);
  if (!block || !block.input) throw new Error('Model beklenen yanıtı döndürmedi.');
  return block.input;
}

/* ------------------------------ prompts --------------------------------- */
function articleSystemPrompt(language) {
  return `You are an expert SEO content editor who writes articles that rank on the first page of Google, engage the reader, and follow modern on-page SEO best practices.

WRITE THE ENTIRE ARTICLE AND ALL FIELDS IN THIS LANGUAGE: ${language}. Do not mix languages.

TASK: The user gives a topic, category, tone, target audience and length. Call the "write_seo_article" tool and return a complete article. Output nothing else.

seoTitle: 55-65 characters. Put the focus keyword near the front. Curiosity-driven and clickable.
metaDescription: 150-160 characters. Include the focus keyword. Promise a clear benefit and end with a soft call to action.
focusKeyword: a 2-4 word targeted search term.
content (Markdown):
- # H1, at least 3 ## H2 sections, ### H3 where useful.
- Use the focus keyword in the first 100 words.
- 2-4 paragraphs per H2, bulleted lists (- ), **bold** for emphasis.
- Natural keyword usage — never stuff. Include a conclusion with a CTA.
- Target length: short ~500 / medium ~900 / long ~1400 words.
lsiKeywords: 8-12 semantically related terms (1-4 words each) usable inside the article.
faq: 3-5 question/answer pairs targeting "People Also Ask" — concise, direct answers.
readabilityScore: integer 0-100 (short sentences + plain words = higher), judged for the output language.
readabilityLevel: "Kolay/Easy" (80+), "Orta/Medium" (50-79) or "İleri/Advanced" (0-49) — in the output language.
seoScore: 0-100 based on title/meta length, keyword usage, heading hierarchy and list usage.
seoTips: 3-5 actionable improvement tips, in the output language.
readingTimeMinutes: based on ~200 words/min.
articleSchema: a JSON-LD string combining an Article and an FAQPage (use @graph). Include headline, description, keywords, inLanguage, datePublished (today). Return only the JSON object, no <script> tag.

If reference/competitor content is supplied, cover the subtopics it addresses so the result is more comprehensive.

Only call the tool. Never add a preface or explanation.`;
}

const ARTICLE_TOOL = {
  name: 'write_seo_article',
  description: 'Return the SEO-optimized article with all fields.',
  input_schema: {
    type: 'object',
    properties: {
      seoTitle:           { type: 'string', description: 'SEO title, 55-65 characters.' },
      metaDescription:    { type: 'string', description: 'Meta description, 150-160 characters.' },
      focusKeyword:       { type: 'string', description: 'Focus keyword (2-4 words).' },
      readingTimeMinutes: { type: 'number', description: 'Estimated reading time in minutes.' },
      seoScore:           { type: 'number', description: 'SEO score 0-100.' },
      content:            { type: 'string', description: 'Article content in Markdown.' },
      seoTips:            { type: 'array', items: { type: 'string' }, description: '3-5 SEO tips.' },
      lsiKeywords:        { type: 'array', items: { type: 'string' }, description: '8-12 LSI keywords.' },
      faq: {
        type: 'array',
        description: '3-5 FAQ items.',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            answer:   { type: 'string' },
          },
          required: ['question', 'answer'],
        },
      },
      readabilityScore:   { type: 'number', description: 'Readability score 0-100.' },
      readabilityLevel:   { type: 'string', description: 'Easy / Medium / Advanced label.' },
      articleSchema:      { type: 'string', description: 'JSON-LD @graph (Article + FAQPage) string.' },
    },
    required: ['seoTitle', 'metaDescription', 'focusKeyword', 'readingTimeMinutes',
               'seoScore', 'content', 'seoTips', 'lsiKeywords', 'faq',
               'readabilityScore', 'readabilityLevel', 'articleSchema'],
  },
};

function topicsSystemPrompt(language) {
  return `You are an SEO content strategist.

TASK: The user gives a category (and optional niche). Call "suggest_seo_topics" and propose 6-8 article titles with high Google search potential.

WRITE EVERY TITLE IN THIS LANGUAGE: ${language}.

TITLE RULES:
- 5-12 words, clear and descriptive.
- Contain a long-tail keyword ("how to", "what is", "guide", "tips", "benefits", etc. — adapted to the language).
- Balance evergreen and timely topics.
- Every title covers a distinct angle; no repetition.
- Target a broad audience; avoid overly niche titles.

Only call the tool.`;
}

const TOPICS_TOOL = {
  name: 'suggest_seo_topics',
  description: 'Return article titles for the given category.',
  input_schema: {
    type: 'object',
    properties: {
      topics: {
        type: 'array',
        items: { type: 'string' },
        minItems: 6, maxItems: 8,
        description: '6-8 SEO-focused article titles.',
      },
    },
    required: ['topics'],
  },
};

/* ------------------------------- routes --------------------------------- */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    keyConfigured: Boolean(ANTHROPIC_API_KEY),
    authRequired: ACCESS_TOKENS.length > 0,
    defaultModel: DEFAULT_MODEL,
  });
});

app.post('/api/generate', auth, limit, async (req, res) => {
  try {
    const b = req.body || {};
    const topic = String(b.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'Konu başlığı gerekli.' });

    const language = String(b.language || 'Türkçe').slice(0, 40);
    const lengthMap = { short: '~500 words', medium: '~900 words', long: '~1400 words' };
    const lengthDesc = lengthMap[b.length] || '~900 words';

    let userMessage =
      `Topic: ${topic}\n` +
      `Category: ${String(b.category || 'General').slice(0, 60)}\n` +
      `Focus keyword: ${String(b.keyword || 'auto-detect').slice(0, 80)}\n` +
      `Tone: ${String(b.tone || 'informative').slice(0, 40)}\n` +
      `Target audience: ${String(b.audience || 'general readers').slice(0, 80)}\n` +
      `Length target: ${lengthDesc}\n` +
      `Output language: ${language}`;

    if (b.competitor && String(b.competitor).trim()) {
      userMessage += `\n\nReference / competitor content:\n${String(b.competitor).trim().slice(0, 1200)}`;
    }
    if (b.instructions && String(b.instructions).trim()) {
      userMessage += `\n\nExtra instructions:\n${String(b.instructions).trim().slice(0, 500)}`;
    }
    userMessage += '\n\nGenerate the full SEO article with these parameters.';

    const out = await callAnthropic({
      system: articleSystemPrompt(language),
      tool: ARTICLE_TOOL,
      userMessage,
      model: b.model,
      maxTokens: 8000,
    });
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Sunucu hatası.' });
  }
});

app.post('/api/topics', auth, limit, async (req, res) => {
  try {
    const b = req.body || {};
    const category = String(b.category || 'General').slice(0, 80);
    const language = String(b.language || 'Türkçe').slice(0, 40);
    const niche = b.niche ? ` (niche: ${String(b.niche).slice(0, 80)})` : '';

    const out = await callAnthropic({
      system: topicsSystemPrompt(language),
      tool: TOPICS_TOOL,
      userMessage: `Category: ${category}${niche}\n\nPropose 6-8 long-tail, high-search-potential article titles in ${language}.`,
      model: b.model,
      maxTokens: 1024,
    });
    res.json({ topics: Array.isArray(out.topics) ? out.topics : [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Sunucu hatası.' });
  }
});

/* --------------------------- static frontend ---------------------------- */
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`\n  SEO Article Writer running → http://localhost:${PORT}`);
  console.log(`  Anthropic key: ${ANTHROPIC_API_KEY ? 'configured ✓' : 'MISSING ✗'}`);
  console.log(`  Access tokens: ${ACCESS_TOKENS.length ? ACCESS_TOKENS.length + ' active' : 'OPEN (dev)'}`);
  console.log(`  Default model: ${DEFAULT_MODEL}\n`);
});
