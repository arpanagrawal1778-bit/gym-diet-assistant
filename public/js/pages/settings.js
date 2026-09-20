// public/js/pages/settings.js

import * as auth from '../auth.js';
import * as store from '../store.js';

export function render(container) {
  const user = store.getUser() || {};

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p>Manage your account and app preferences.</p>
      </div>
    </div>

    <div class="settings-grid">

      <section class="card settings-card">
        <div class="card-header">
          <div>
            <h2>Account</h2>
            <p>Your account information.</p>
          </div>
        </div>

        <div class="settings-info">
          <div class="settings-row">
            <span class="settings-label">Name</span>
            <span class="settings-value">${escapeHtml(user.name || '—')}</span>
          </div>

          <div class="settings-row">
            <span class="settings-label">Email</span>
            <span class="settings-value">${escapeHtml(user.email || '—')}</span>
          </div>

          <div class="settings-row">
            <span class="settings-label">Account</span>
            <span class="settings-value">Active</span>
          </div>
        </div>
      </section>

      <section class="card settings-card">
        <div class="card-header">
          <div>
            <h2>Quick Settings</h2>
            <p>Access commonly used sections.</p>
          </div>
        </div>

        <div class="settings-actions">

          <a href="#/profile" class="settings-action">
            <div class="settings-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>

            <div>
              <strong>Edit Profile</strong>
              <span>Update your fitness and college information.</span>
            </div>

            <span class="settings-arrow">→</span>
          </a>

          <a href="#/reminders" class="settings-action">
            <div class="settings-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>

            <div>
              <strong>Reminders</strong>
              <span>Manage your reminder preferences.</span>
            </div>

            <span class="settings-arrow">→</span>
          </a>

          <a href="#/progress" class="settings-action">
            <div class="settings-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>

            <div>
              <strong>Progress</strong>
              <span>View your weight and activity progress.</span>
            </div>

            <span class="settings-arrow">→</span>
          </a>

        </div>
      </section>

      <section class="card settings-card danger-card">
        <div class="card-header">
          <div>
            <h2>Account Actions</h2>
            <p>Sign out from your current account.</p>
          </div>
        </div>

        <button id="logoutButton" class="btn btn-danger">
          Logout
        </button>
      </section>

    </div>
  `;

  const logoutButton = document.getElementById('logoutButton');

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      auth.logout();
    });
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function destroy() {}