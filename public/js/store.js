const TOKEN_KEY = 'gym_token';
const USER_KEY = 'gym_user';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
function getUser() { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; }
function setUser(u) { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); }
function clearAuth() { setToken(null); setUser(null); }
function isAuthenticated() { return !!getToken(); }

export { getToken, setToken, getUser, setUser, clearAuth, isAuthenticated, TOKEN_KEY, USER_KEY };