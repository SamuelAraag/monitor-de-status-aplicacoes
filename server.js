const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const PUBLIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/style.css', 'style.css'],
  ['/script.js', 'script.js'],
  ['/assets/favicon.svg', 'assets/favicon.svg']
]);

const ALLOWED_APPS = new Map([
  ['taxplus-dfe', 'https://taxplus-dfe-stg.invent.app.br/'],
  ['taxplus-dfe-eventos', 'https://taxplus-dfe-eventos-stg.invent.app.br/']
]);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': CONTENT_TYPES['.json'],
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function serveStaticFile(reqPath, res) {
  const fileName = PUBLIC_FILES.get(reqPath);
  if (!fileName) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const absolutePath = path.join(ROOT_DIR, fileName);
    const data = await fs.readFile(absolutePath);
    const ext = path.extname(fileName);
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  } catch (error) {
    sendJson(res, 500, { error: 'Failed to read file', detail: String(error.message || error) });
  }
}

async function fetchStatus(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    });

    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store'
      });
    }

    const statusCode = response.status;
    if (statusCode === 404) {
      return { status: 'error', httpStatus: 404, label: '404' };
    }

    if (response.ok) {
      return { status: 'ok', httpStatus: statusCode, label: 'Ativo' };
    }

    return { status: 'error', httpStatus: statusCode, label: `Erro ${statusCode}` };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { status: 'error', httpStatus: null, label: 'Timeout' };
    }
    return { status: 'error', httpStatus: null, label: 'Falha de conexão' };
  } finally {
    clearTimeout(timeout);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === '/api/check') {
      const appId = requestUrl.searchParams.get('appId');
      if (!appId || !ALLOWED_APPS.has(appId)) {
        sendJson(res, 400, { error: 'appId inválido' });
        return;
      }

      const targetUrl = ALLOWED_APPS.get(appId);
      const check = await fetchStatus(targetUrl);
      sendJson(res, 200, {
        appId,
        url: targetUrl,
        ...check,
        checkedAt: new Date().toISOString()
      });
      return;
    }

    await serveStaticFile(requestUrl.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: 'Internal server error', detail: String(error.message || error) });
  }
});

server.listen(PORT, () => {
  console.log(`Monitor rodando em http://localhost:${PORT}`);
});
