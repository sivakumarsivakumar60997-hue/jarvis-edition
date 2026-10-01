const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY || 'PASTE_YOUR_API_KEY_HERE';

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

const frontend = path.join(__dirname, '..', 'frontend');

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1000000) reject(new Error('Request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function callModel(model, prompt) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent?key=' + encodeURIComponent(API_KEY);

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: [{parts: [{text: prompt}]}]
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('No response text returned');
  return text;
}

async function ask(prompt) {
  const failures = [];

  for (const model of MODELS) {
    try {
      return {text: await callModel(model, prompt), model};
    } catch (e) {
      failures.push({model, error: e.message});
    }
  }

  const err = new Error('All fallback models failed');
  err.failures = failures;
  throw err;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/ask') {
      if (API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
        return json(res, 500, {
          error: 'Configure GEMINI_API_KEY on the server first.'
        });
      }

      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return json(res, 400, {error: 'Invalid JSON'});
      }

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) return json(res, 400, {error: 'Prompt is required'});

      try {
        const result = await ask(prompt);
        return json(res, 200, result);
      } catch (e) {
        return json(res, 502, {error: e.message, failures: e.failures || []});
      }
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const file = path.join(frontend, 'index.html');
      return fs.createReadStream(file).pipe(res);
    }

    if (req.method === 'GET' && /^\/(style|script)\.css?\.?$/.test(req.url)) {
      return res.writeHead(404).end();
    }

    const safe = req.url === '/style.css' ? 'style.css' :
                 req.url === '/script.js' ? 'script.js' : null;

    if (safe) {
      const file = path.join(frontend, safe);
      const type = safe.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.writeHead(200, {'Content-Type': type + '; charset=utf-8'});
      return fs.createReadStream(file).pipe(res);
    }

    res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('Not found');
  } catch (e) {
    json(res, 500, {error: 'Internal server error'});
  }
});

server.listen(PORT, () => {
  console.log(`J.A.R.V.I.S running at http://localhost:${PORT}`);
});
