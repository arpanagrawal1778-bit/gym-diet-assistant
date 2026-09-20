import * as store from './store.js';
import { api } from './api.js';
import { navigate } from './router.js';

async function register(name, email, password) {
  const res = await api.post(
    '/auth/signup',
    { name, email, password },
    { noRedirect: true }
  );

  if (!res.success) return res;

  store.setToken(res.data.token);
  store.setUser(res.data.user);

  return res;
}

async function login(email, password) {
  const res = await api.post(
    '/auth/login',
    { email, password },
    { noRedirect: true }
  );

  if (!res.success) return res;

  store.setToken(res.data.token);
  store.setUser(res.data.user);

  return res;
}

async function me() {
  const res = await api.get('/auth/me');

  if (res.success) {
    store.setUser(res.data);
  }

  return res;
}

function logout() {
  api.post('/auth/logout', {}, { noRedirect: true });
  store.clearAuth();
  window.location.hash = '#/login';
}

function requireAuth() {
  if (!store.isAuthenticated()) {
    window.location.hash = '#/login';
    return false;
  }

  return true;
}

export {
  register,
  login,
  logout,
  me,
  requireAuth,
  isAuth,
  getUser
};

function isAuth() {
  return store.isAuthenticated();
}

function getUser() {
  return store.getUser();
}