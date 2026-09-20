import * as store from './store.js';

const API_BASE = 'http://localhost:5000/api';

async function request(method, path, body = null, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = store.getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();

    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (response.status === 401) {
      store.clearAuth();

      if (!options.noRedirect) {
        window.location.hash = '#/login';
      }

      return {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Session expired. Please log in again.'
        }
      };
    }

    if (!response.ok) {
      return data || {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: 'Request failed.'
        }
      };
    }

    return data || {
      success: true,
      data: null
    };

  } catch (error) {
    console.error('API Error:', error);

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          'Cannot connect to the backend. Please check that the server is running.'
      }
    };
  }
}

export const api = {
  get(path, options = {}) {
    return request('GET', path, null, options);
  },

  post(path, body = {}, options = {}) {
    return request('POST', path, body, options);
  },

  put(path, body = {}, options = {}) {
    return request('PUT', path, body, options);
  },

  delete(path, options = {}) {
    return request('DELETE', path, null, options);
  }
};

export { API_BASE };