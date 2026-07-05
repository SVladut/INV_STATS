/*
  Cloudflare Worker optional pentru autopush in GitHub.

  Variabile recomandate in Cloudflare Worker > Settings > Variables:
  - GITHUB_TOKEN = token GitHub cu acces la repo, salvat ca Secret
  - GITHUB_OWNER = user/organizatie GitHub, ex: vladut
  - GITHUB_REPO = numele repository-ului, ex: inventare-app
  - GITHUB_BRANCH = main
  - GITHUB_FILE_PATH = data/inventare.json
  - ALLOWED_ORIGIN = URL-ul GitHub Pages, ex: https://user.github.io

  Nu pune GITHUB_TOKEN in index.html/script.js.
*/

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsOrigin = allowedOrigin === '*' ? origin : allowedOrigin;

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/db') {
      return jsonResponse({ message: 'Endpoint disponibil: /db' }, 404, corsHeaders);
    }

    try {
      if (request.method === 'GET') {
        const file = await getGithubFile(env);
        return jsonResponse(file.json, 200, corsHeaders);
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        const safeBody = normalizeDatabase(body);
        const file = await getGithubFile(env);
        await updateGithubFile(env, safeBody, file.sha);
        return jsonResponse({ message: 'JSON actualizat in GitHub.', updatedAt: safeBody.updatedAt }, 200, corsHeaders);
      }

      return jsonResponse({ message: 'Metoda nepermisa.' }, 405, corsHeaders);
    } catch (error) {
      return jsonResponse({ message: error.message || 'Eroare Worker.' }, 500, corsHeaders);
    }
  }
};

function githubConfig(env) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  const filePath = env.GITHUB_FILE_PATH || 'data/inventare.json';
  const token = env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    throw new Error('Lipsesc GITHUB_OWNER, GITHUB_REPO sau GITHUB_TOKEN in Worker.');
  }

  return { owner, repo, branch, filePath, token };
}

async function getGithubFile(env) {
  const { owner, repo, branch, filePath, token } = githubConfig(env);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  const response = await fetch(apiUrl, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return { sha: null, json: emptyDatabase() };
  }

  if (!response.ok) {
    throw new Error(`GitHub GET a esuat: ${response.status}`);
  }

  const data = await response.json();
  const decoded = decodeBase64Utf8(data.content || 'e30=');
  const parsed = decoded.trim() ? JSON.parse(decoded) : emptyDatabase();

  return { sha: data.sha, json: normalizeDatabase(parsed) };
}

async function updateGithubFile(env, database, sha) {
  const { owner, repo, branch, filePath, token } = githubConfig(env);
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const content = encodeBase64Utf8(JSON.stringify(database, null, 2));

  const body = {
    message: `Update inventare ${new Date().toISOString()}`,
    content,
    branch
  };

  if (sha) body.sha = sha;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub PUT a esuat: ${response.status} ${text}`);
  }
}

function githubHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'inventare-github-pages-app'
  };
}

function normalizeDatabase(input) {
  const db = input && typeof input === 'object' ? input : emptyDatabase();
  const users = db.users && typeof db.users === 'object' ? db.users : {};

  Object.keys(users).forEach((username) => {
    if (!users[username] || typeof users[username] !== 'object') {
      users[username] = { username, createdAt: new Date().toISOString(), inventare: [] };
    }
    users[username].username = users[username].username || username;
    users[username].createdAt = users[username].createdAt || new Date().toISOString();
    users[username].inventare = Array.isArray(users[username].inventare)
      ? users[username].inventare.map(normalizeInventory)
      : [];
  });

  return {
    version: 4,
    updatedAt: new Date().toISOString(),
    users
  };
}

function normalizeInventory(item) {
  return {
    id: item.id || crypto.randomUUID(),
    data: item.data || new Date().toISOString().slice(0, 10),
    denumire: String(item.denumire || ''),
    suma: Number(item.suma || 0),
    orePlecatAcasa: Number(item.orePlecatAcasa || 0),
    sofer: item.sofer === 'da' ? 'da' : 'nu',
    deplasare: item.deplasare === 'da' ? 'da' : 'nu',
    achitat: Boolean(item.achitat),
    observatii: String(item.observatii || ''),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function emptyDatabase() {
  return {
    version: 4,
    updatedAt: new Date().toISOString(),
    users: {}
  };
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
