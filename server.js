const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ===== CONFIG =====
const PORT = 80;
const DATA_FILE = '/data/tracker.json';
const HTML_FILE = path.join(__dirname, 'iron_county_daily_tracker.html');

// Auth credentials - change these!
const USERS = {
  'admin': hashPassword('IronCounty2026!'),
  // Add more users: 'username': hashPassword('password'),
};

const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const sessions = {}; // token -> {user, expires}
const SESSION_HOURS = 72;

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { user, expires: Date.now() + SESSION_HOURS * 3600000 };
  return token;
}

function validateSession(token) {
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() > s.expires) { delete sessions[token]; return null; }
  return s.user;
}

// ===== DATA PERSISTENCE =====
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) { console.error('Load error:', e.message); }
  return { parcels: null, coordCache: {}, notes: {}, updated: null };
}

function saveData(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) { console.error('Save error:', e.message); return false; }
}

// ===== LOGIN PAGE =====
const LOGIN_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Iron County Tracker</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'JetBrains Mono',monospace;background:#0a0f1a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.login-box{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:40px;width:380px;max-width:90vw}
h1{font-size:16px;font-weight:700;letter-spacing:.05em;background:linear-gradient(135deg,#f97316,#dc2626);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.sub{font-size:10px;color:#64748b;letter-spacing:.06em;margin-bottom:30px}
label{font-size:11px;color:#94a3b8;letter-spacing:.08em;display:block;margin-bottom:6px}
input{width:100%;padding:10px 14px;background:#0a0f1a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-family:inherit;font-size:13px;margin-bottom:18px;transition:border-color .2s}
input:focus{outline:none;border-color:#f97316}
button{width:100%;padding:12px;border:none;border-radius:6px;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff;font-family:inherit;font-size:13px;font-weight:700;letter-spacing:.04em;cursor:pointer;transition:all .2s}
button:hover{transform:translateY(-1px);filter:brightness(1.15)}
.error{color:#ef4444;font-size:11px;margin-bottom:14px;display:none}
</style></head><body>
<div class="login-box">
<h1>IRON COUNTY TAX SALE 2026</h1>
<div class="sub">DAILY TRACKER — LOGIN</div>
<div class="error" id="err">Invalid username or password</div>
<label>USERNAME</label>
<input type="text" id="user" autocomplete="username" autofocus>
<label>PASSWORD</label>
<input type="password" id="pass" autocomplete="current-password">
<button onclick="login()">LOGIN</button>
</div>
<script>
document.getElementById('pass').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
async function login(){
  const user=document.getElementById('user').value.trim();
  const pass=document.getElementById('pass').value;
  if(!user||!pass)return;
  const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user,pass})});
  if(res.ok){const d=await res.json();document.cookie='session='+d.token+';path=/;max-age='+(72*3600)+';SameSite=Strict';location.reload();}
  else{document.getElementById('err').style.display='block';}
}
</script></body></html>`;

// ===== SERVER =====
function getCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const c of cookies) {
    const [k, v] = c.trim().split('=');
    if (k === name) return v;
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve(body); }
    });
    req.on('error', reject);
  });
}

function send(res, code, data, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Login endpoint - no auth required
  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const hashed = hashPassword(body.pass || '');
    if (USERS[body.user] && USERS[body.user] === hashed) {
      const token = createSession(body.user);
      return send(res, 200, { token });
    }
    return send(res, 401, { error: 'Invalid credentials' });
  }

  // Logout
  if (url.pathname === '/api/logout') {
    const token = getCookie(req, 'session');
    if (token) delete sessions[token];
    return send(res, 200, { ok: true });
  }

  // Check auth for everything else
  const token = getCookie(req, 'session');
  const user = validateSession(token);

  if (!user) {
    // Serve login page
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, LOGIN_HTML, 'text/html');
    }
    return send(res, 401, { error: 'Not authenticated' });
  }

  // === AUTHENTICATED ROUTES ===

  // Serve the app
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      return send(res, 200, html, 'text/html');
    } catch (e) {
      return send(res, 500, 'App file not found');
    }
  }

  // Get data
  if (url.pathname === '/api/data' && req.method === 'GET') {
    return send(res, 200, loadData());
  }

  // Save data
  if (url.pathname === '/api/data' && req.method === 'POST') {
    const body = await readBody(req);
    body.updated = new Date().toISOString();
    body.updatedBy = user;
    if (saveData(body)) return send(res, 200, { ok: true });
    return send(res, 500, { error: 'Save failed' });
  }

  // Who am I
  if (url.pathname === '/api/me') {
    return send(res, 200, { user });
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`Iron County Tracker running on port ${PORT}`));
