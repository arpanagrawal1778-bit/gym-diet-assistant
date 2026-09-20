import { login } from '../auth.js';
import { navigate } from '../router.js';

export function render(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-header">
          <div class="auth-logo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to continue to your fitness dashboard</p>
        </div>

        <form id="loginForm">

          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              required
              autocomplete="email"
            >
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            >
          </div>

          <div id="loginError" class="form-error"></div>

          <button type="submit" class="btn btn-primary" id="loginBtn" style="width: 100%;">
            Sign In
          </button>

        </form>

        <div class="auth-footer">
          Don't have an account?
          <a href="#/register">Create Account</a>
        </div>

      </div>
    </div>
  `;

  const form = container.querySelector('#loginForm');
  const button = container.querySelector('#loginBtn');
  const errorBox = container.querySelector('#loginError');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorBox.textContent = '';
    button.disabled = true;
    button.textContent = 'Signing in...';

    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
      return;
    }

    errorBox.textContent =
      result.error?.message || 'Sign in failed. Please try again.';

    button.disabled = false;
    button.textContent = 'Sign In';
  });
}