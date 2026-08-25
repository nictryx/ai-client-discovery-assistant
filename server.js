import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BRIEFS_FILE = path.join(DATA_DIR, 'briefs.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "minimax/minimax-m2.7:free";


const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const file of [BRIEFS_FILE, AUDIT_FILE]) {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, '[]', 'utf8');
    }
  }
}

async function readJson(file) {
  await ensureDataFiles();
  const raw = await fs.readFile(file, 'utf8');
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

async function appendAudit(entry) {
  const audit = await readJson(AUDIT_FILE);
  audit.unshift({
    auditId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  await writeJson(AUDIT_FILE, audit);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
  });
}

function buildPrompt({ clientName, company, email, projectIdea }) {
  return `You are an AI Client Discovery Assistant for a technology company.

The technology company represents a general service provider that works with clients across different types of projects.

Your task is to analyze a raw project idea submitted by a potential client through the company's contact form.

Important rules:
- Do not create final requirements or final specifications.
- Do not invent missing details.
- If information is missing, list it as follow-up questions.
- Keep the output practical, clear, and useful for the company's internal team.
- The output should help the company prepare for the first discovery call.
- Do not estimate cost, timeline, or final scope.
- Keep the response concise and compact.
- Use short sentences and short bullet points.
- Limit each section to only the most important information.
- For "Missing Questions", include a maximum of 5 questions.
- For "Risk Flags", include a maximum of 4 risks.
- For "Short Internal Discovery Brief", use no more than 3 sentences.
- For "Human Review Note", use no more than 2 sentences.
- Avoid repeating information across sections.

Contact form metadata:
Client name: ${clientName || 'Not provided'}
Company: ${company || 'Not provided'}
Email: ${email || 'Not provided'}


Client project idea:
"${projectIdea}"


Return the output using this exact structure:
1. Client Problem
2. Relevant Service Category
3. Suggested Departments Involved from (Engineering, IT/Infrastructure, Product, Finance, Strategy, or Operations)
4. Missing Questions to Ask the Client
5. Risk Flags
6. Suggested Next Step
7. Short Internal Discovery Brief
8. Human Review Note`;

}

async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing. Add it before running a real API call.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Client Discovery Assistant Prototype'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a careful business analyst assistant. Produce concise, structured, practical outputs for internal review only.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1800
    })
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenRouter returned non-JSON response: ${raw.slice(0, 300)}`);
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || raw;
    throw new Error(`OpenRouter API error: ${message}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter response did not include generated content.');
  }

  return {
    content,
    model: data?.model || OPENROUTER_MODEL,
    usage: data?.usage || null
  };
}

async function handleAnalyze(req, res) {
  try {
    const body = await parseBody(req);
    const projectIdea = String(body.projectIdea || '').trim();

    if (!projectIdea || projectIdea.length < 20) {
      return sendJson(res, 400, { error: 'Please enter a project idea with at least 20 characters.' });
    }

    const input = {
      clientName: String(body.clientName || '').trim(),
      company: String(body.company || '').trim(),
      email: String(body.email || '').trim(),
      projectIdea
    };

    const prompt = buildPrompt(input);
    const ai = await callOpenRouter(prompt);

    const now = new Date().toISOString();
    const brief = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      reviewerStatus: 'Pending Review',
      modelProvider: 'OpenRouter',
      model: ai.model,
      input,
      generatedBrief: ai.content,
      usage: ai.usage
    };

    const briefs = await readJson(BRIEFS_FILE);
    briefs.unshift(brief);
    await writeJson(BRIEFS_FILE, briefs);

    await appendAudit({
      briefId: brief.id,
      event: 'BRIEF_GENERATED',
      reviewerStatus: brief.reviewerStatus,
      details: 'Generated and saved a new client discovery brief using an API call.'
    });

    return sendJson(res, 201, { brief });
  } catch (err) {
    await appendAudit({
      briefId: null,
      event: 'API_ERROR',
      details: err.message
    });
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleStatusUpdate(req, res, id) {
  try {
    const body = await parseBody(req);
    const allowed = ['Pending Review', 'In Review', 'Modified', 'Approved', 'Rejected'];
    const reviewerStatus = String(body.reviewerStatus || '').trim();
    const reviewerName = String(body.reviewerName || 'Reviewer').trim();

    if (!allowed.includes(reviewerStatus)) {
      return sendJson(res, 400, { error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const briefs = await readJson(BRIEFS_FILE);
    const index = briefs.findIndex(item => item.id === id);
    if (index === -1) return sendJson(res, 404, { error: 'Brief not found.' });

    const previousStatus = briefs[index].reviewerStatus;
    briefs[index].reviewerStatus = reviewerStatus;
    briefs[index].reviewerName = reviewerName;
    briefs[index].updatedAt = new Date().toISOString();
    await writeJson(BRIEFS_FILE, briefs);

    await appendAudit({
      briefId: id,
      event: 'REVIEWER_STATUS_UPDATED',
      previousStatus,
      reviewerStatus,
      reviewerName,
      details: `Status changed from ${previousStatus} to ${reviewerStatus}.`
    });

    return sendJson(res, 200, { brief: briefs[index] });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleBriefContentUpdate(req, res, id) {
  try {
    const body = await parseBody(req);
    const generatedBrief = String(body.generatedBrief || '').trim();
    const reviewerName = String(body.reviewerName || 'Reviewer').trim();

    if (generatedBrief.length < 20) {
      return sendJson(res, 400, { error: 'Edited brief is too short to save.' });
    }

    const briefs = await readJson(BRIEFS_FILE);
    const index = briefs.findIndex(item => item.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: 'Brief not found.' });
    }

    const previousStatus = briefs[index].reviewerStatus;
    briefs[index].generatedBrief = generatedBrief;
    briefs[index].reviewerName = reviewerName;
    briefs[index].reviewerStatus = 'Modified';
    briefs[index].updatedAt = new Date().toISOString();

    await writeJson(BRIEFS_FILE, briefs);

    await appendAudit({
      briefId: id,
      event: 'BRIEF_EDITED',
      reviewerName,
      previousStatus,
      reviewerStatus: 'Modified',
      details: 'Generated brief content was edited and saved by the reviewer.'
    });

    return sendJson(res, 200, { brief: briefs[index] });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleResetBriefs(req, res) {
  try {
    await writeJson(BRIEFS_FILE, []);
    await appendAudit({
      briefId: null,
      event: 'BRIEFS_RESET',
      details: 'All saved discovery briefs were cleared from local prototype storage.'
    });
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function handleResetAudit(req, res) {
  try {
    await writeJson(AUDIT_FILE, []);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

async function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  await ensureDataFiles();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, app: 'AI Client Discovery Assistant', model: OPENROUTER_MODEL });
  }
  if (req.method === 'GET' && pathname === '/api/briefs') {
    return sendJson(res, 200, { briefs: await readJson(BRIEFS_FILE) });
  }
  if (req.method === 'GET' && pathname === '/api/audit') {
    return sendJson(res, 200, { auditLog: await readJson(AUDIT_FILE) });
  }
  if (req.method === 'DELETE' && pathname === '/api/briefs') {
    return handleResetBriefs(req, res);
  }
  if (req.method === 'DELETE' && pathname === '/api/audit') {
    return handleResetAudit(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/analyze') {
    return handleAnalyze(req, res);
  }

  const contentMatch = pathname.match(/^\/api\/briefs\/([^/]+)\/content$/);
  if (req.method === 'PATCH' && contentMatch) {
    return handleBriefContentUpdate(req, res, contentMatch[1]);
  }

  const statusMatch = pathname.match(/^\/api\/briefs\/([^/]+)\/status$/);
  if (req.method === 'PATCH' && statusMatch) {
    return handleStatusUpdate(req, res, statusMatch[1]);
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`AI Client Discovery Assistant running at http://localhost:${PORT}`);
  console.log(`Model: ${OPENROUTER_MODEL}`);
});
