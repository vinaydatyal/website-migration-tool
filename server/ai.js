import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

/**
 * Helper to resolve Anthropic client from request header or environment variable
 */
function getAnthropicClient(req) {
  const apiKey = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

/**
 * GET /api/ai/status
 * Check whether Anthropic API is configured on server or if BYOK is required
 */
router.get('/status', (req, res) => {
  const hasServerKey = Boolean(process.env.ANTHROPIC_API_KEY);
  res.json({
    available: true,
    hasServerKey,
    defaultModel: 'claude-3-5-haiku-20241022'
  });
});

/**
 * POST /api/ai/suggest-mappings
 * Suggests the best destination for unmatched or low-confidence URLs
 */
router.post('/suggest-mappings', async (req, res) => {
  try {
    const anthropic = getAnthropicClient(req);
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'Anthropic API key required. Please set ANTHROPIC_API_KEY in server environment or provide via header.' 
      });
    }

    const { items, model = 'claude-3-5-haiku-20241022' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    // Limit batch size to 25 items per request for responsive latency
    const batch = items.slice(0, 25);

    const prompt = `You are an expert SEO Migration Director.
Your task is to analyze unmatched legacy source URLs and choose the single best target URL from a list of candidate pages for each source URL.
Preserve search intent (informational, commercial, navigational, transactional), keyword equity, and content topicality.

Evaluate each source URL against its candidate targets.
Input URLs and Candidates:
${JSON.stringify(batch, null, 2)}

Respond ONLY with a valid JSON object matching this schema:
{
  "suggestions": [
    {
      "sourceUrl": "exact source url",
      "targetUrl": "chosen candidate url (or null if none fit)",
      "confidence": number between 0 and 100,
      "reasoning": "one concise sentence explaining why this target satisfies the source search intent",
      "searchIntent": "Informational" | "Commercial" | "Transactional" | "Navigational"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      system: 'You are an advanced SEO migration system. Always output strictly valid JSON with no markdown formatting or backticks around the json.',
      messages: [{ role: 'user', content: prompt }]
    });

    const contentText = response.content?.[0]?.text?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(contentText);
    } catch {
      // Fallback cleanup if model wrapped response in code fences
      const cleaned = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json(parsed);
  } catch (error) {
    console.error('Claude suggest-mappings error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate mapping suggestions' });
  }
});

/**
 * POST /api/ai/analyze-parity
 * Analyzes SEO parity between a source URL and target URL, offering optimized meta tags
 */
router.post('/analyze-parity', async (req, res) => {
  try {
    const anthropic = getAnthropicClient(req);
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'Anthropic API key required. Please set ANTHROPIC_API_KEY in server environment or provide via header.' 
      });
    }

    const { source, target, model = 'claude-3-5-sonnet-20241022' } = req.body;
    if (!source || !target) {
      return res.status(400).json({ error: 'Both source and target page objects are required' });
    }

    const prompt = `You are a Senior SEO Consultant performing an SEO parity review during a website migration.
Evaluate the search intent, keyword preservation, and topical alignment between the legacy source page and the new staging target page.

Source Page:
- URL: ${source.url}
- Title: ${source.title || '(none)'}
- H1: ${source.h1 || '(none)'}
- Meta Description: ${source.metaDescription || '(none)'}

Target Page:
- URL: ${target.url}
- Title: ${target.title || '(none)'}
- H1: ${target.h1 || '(none)'}
- Meta Description: ${target.metaDescription || '(none)'}

Identify any lost target keywords, search intent mismatch, or branding gaps.
Provide an optimized Title tag and Meta Description that preserves legacy search rankings while fitting the new site.

Respond ONLY with a valid JSON object matching this schema:
{
  "intentPreserved": boolean,
  "confidenceScore": number,
  "keywordLoss": ["array of keywords or topics lost on target page"],
  "analysis": "1-2 sentence explanation of topical alignment",
  "suggestedTitle": "recommended SEO title tag (under 60 characters)",
  "suggestedDescription": "recommended meta description (between 120-155 characters)"
}`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      system: 'You are an advanced SEO parity auditor. Output strictly valid JSON without formatting backticks.',
      messages: [{ role: 'user', content: prompt }]
    });

    const contentText = response.content?.[0]?.text?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(contentText);
    } catch {
      const cleaned = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json(parsed);
  } catch (error) {
    console.error('Claude analyze-parity error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze SEO parity' });
  }
});

/**
 * POST /api/ai/validate-regex
 * Reviews redirect patterns for edge cases, loops, or precedence conflicts
 */
router.post('/validate-regex', async (req, res) => {
  try {
    const anthropic = getAnthropicClient(req);
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'Anthropic API key required. Please set ANTHROPIC_API_KEY in server environment or provide via header.' 
      });
    }

    const { patterns, model = 'claude-3-5-sonnet-20241022' } = req.body;
    if (!Array.isArray(patterns) || patterns.length === 0) {
      return res.status(400).json({ error: 'Patterns array is required' });
    }

    const prompt = `You are a Principal DevOps and Web Infrastructure Architect.
Analyze these regex redirect patterns planned for server deployment (Apache/Nginx/Cloudflare):
${JSON.stringify(patterns, null, 2)}

Review for:
1. Greedy regex overlaps that may catch unintended URLs.
2. Conflict order (specific patterns must precede general wildcards).
3. Potential circular redirect loops.
4. Clean optimization recommendations.

Respond ONLY with a valid JSON object matching this schema:
{
  "isValid": boolean,
  "warnings": ["array of potential risks or warnings"],
  "recommendations": ["array of actionable recommendations"],
  "recommendedOrder": [0, 1, 2] // indices of patterns in optimal execution order
}`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      system: 'You are an expert server redirect validator. Output strictly valid JSON with no markdown wrapping.',
      messages: [{ role: 'user', content: prompt }]
    });

    const contentText = response.content?.[0]?.text?.trim() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(contentText);
    } catch {
      const cleaned = contentText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    }

    res.json(parsed);
  } catch (error) {
    console.error('Claude validate-regex error:', error);
    res.status(500).json({ error: error.message || 'Failed to validate redirect patterns' });
  }
});

/**
 * POST /api/ai/copilot-chat
 * Interactive assistant for migration questions and troubleshooting
 */
router.post('/copilot-chat', async (req, res) => {
  try {
    const anthropic = getAnthropicClient(req);
    if (!anthropic) {
      return res.status(400).json({ 
        error: 'Anthropic API key required. Please set ANTHROPIC_API_KEY in server environment or provide via header.' 
      });
    }

    const { messages, context, model = 'claude-3-5-haiku-20241022' } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemPrompt = `You are the MigrateShield AI Migration Copilot, an elite technical SEO and website migration consultant.
You help digital marketing agencies and enterprise SEO teams plan, execute, and validate site migrations.
You understand 301 redirects, regex rewrite rules, canonical tags, Google Search Console traffic equity, and SEO parity.
Keep answers concise, technical, and immediately actionable.

Current Project Context:
${context ? JSON.stringify(context, null, 2) : 'No project data loaded yet.'}`;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    res.json({
      role: 'assistant',
      content: response.content?.[0]?.text || ''
    });
  } catch (error) {
    console.error('Claude copilot-chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to process copilot chat' });
  }
});

export default router;
