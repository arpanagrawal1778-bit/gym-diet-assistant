import * as auth from '../auth.js';

export function render(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">

        <div class="auth-header">
          <div class="auth-logo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h1>Create Account</h1>
          <p>Start your personalized fitness journey today</p>
        </div>

        <form id="registerForm">

          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="John Doe"
              required
              autocomplete="name"
            >
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
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
              name="password"
              placeholder="At least 6 characters"
              minlength="6"
              required
              autocomplete="new-password"
            >
          </div>

          <div id="registerError" class="form-error"></div>

          <button
            type="submit"
            id="registerBtn"
            class="btn btn-primary"
            style="width: 100%;"
          >
            Create Account
          </button>

        </form>

        <div class="auth-footer">
          Already have an account?
          <a href="#/login">Sign In</a>
        </div>

      </div>
    </div>
  `;

  const form = container.querySelector('#registerForm');
  const button = container.querySelector('#registerBtn');
  const errorBox = container.querySelector('#registerError');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    errorBox.textContent = '';
    button.disabled = true;
    button.textContent = 'Creating account...';

    const name = container.querySelector('#name').value.trim();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;

    const result = await auth.register(
      name,
      email,
      password
    );

    if (result.success) {
      window.location.hash = '#/dashboard';
      return;
    }

    errorBox.textContent =
      result.error?.message ||
      'Unable to create account. Please try again.';

    button.disabled = false;
    button.textContent = 'Create Account';
  });
}

export function destroy() {
  // Nothing to clean up
}