const allowedDomains = ['gmail.com', 'nmims.in'];
const allowedCities = ['Chandigarh', 'Panchkula', 'Zirakpur'];

/** Backend port — must match PORT in .env / server.js (default 3000). */
const API_PORT = '3000';

/**
 * Base URL for API calls. Empty string = same host/port as this page (best for login cookies).
 * If you open HTML as a file or from Live Server, requests go to http://localhost:API_PORT instead.
 */
function getApiBase() {
  const loc = window.location;
  if (loc.protocol === 'file:') {
    return `http://localhost:${API_PORT}`;
  }
  const port = loc.port || (loc.protocol === 'https:' ? '443' : '80');
  const onLocal = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (onLocal && String(port) === API_PORT) {
    return '';
  }
  if (onLocal) {
    return `http://localhost:${API_PORT}`;
  }
  return '';
}

/**
 * Call the Express API. Uses cookies for sessions — prefer opening the site at http://localhost:3000/
 */
async function api(path, options = {}) {
  const init = {
    credentials: 'include',
    ...options,
    headers: {
      ...options.headers
    }
  };
  const hasJsonBody = init.body && typeof init.body === 'object' && !(init.body instanceof FormData);
  if (hasJsonBody) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(init.body);
  }
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const hint =
      'Cannot reach the server. In a terminal run: npm start — then open http://localhost:' +
      API_PORT +
      '/register.html (do not double-click the HTML file).';
    throw new Error(err && err.message === 'Failed to fetch' ? hint : err.message || 'Network error');
  }
  const ct = res.headers.get('content-type');
  const data = ct && ct.includes('application/json') ? await res.json() : {};
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function showMessage(text, type = 'success') {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden', 'error', 'success');
  el.classList.add(type);
}

function fmtDate(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

function fmtTime(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'string') return val.length >= 5 ? val.slice(0, 5) : val;
  if (val instanceof Date) return val.toISOString().slice(11, 16);
  return String(val);
}