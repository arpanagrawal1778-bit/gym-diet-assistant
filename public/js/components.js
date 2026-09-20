// public/js/components.js

function escapeHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showLoading(container, message = 'Loading...') {
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function showError(container, message = 'Something went wrong.') {
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state error-state">
      <div class="empty-state-icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" onclick="location.reload()">
        Try Again
      </button>
    </div>
  `;
}

let toastTimer = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');

  if (!toast) {
    console.log(message);
    return;
  }

  clearTimeout(toastTimer);

  toast.className = '';
  toast.classList.add('toast', type);
  toast.textContent = message;

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');

    setTimeout(() => {
      toast.className = '';
      toast.textContent = '';
    }, 250);
  }, 3000);
}

function setButtonLoading(button, loading = true, loadingText = 'Loading...') {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }

    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `
      <span class="button-spinner"></span>
      <span>${escapeHtml(loadingText)}</span>
    `;
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');

    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

function formatGoal(goal) {
  const goals = {
    cut: 'Cut',
    bulk: 'Bulk',
    maintain: 'Maintain',
    recomp: 'Body Recomposition'
  };

  if (!goal) return 'Not set';

  const normalized = String(goal).toLowerCase().trim();

  return goals[normalized] ||
    normalized
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
}

function formatDate(dateValue) {
  if (!dateValue) return '—';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(dateValue);
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(timeValue) {
  if (!timeValue) return '—';

  const value = String(timeValue);

  const match = value.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return escapeHtml(value);

  let hours = Number(match[1]);
  const minutes = match[2];

  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  return `${hours}:${minutes} ${period}`;
}

function capitalizeWords(value) {
  if (!value) return '';

  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getPageTitle() {
  const path = (location.hash || '#/dashboard')
    .replace(/^#/, '')
    .replace(/^\/+/, '');

  const titles = {
    dashboard: 'Dashboard',
    profile: 'Profile',
    diet: 'Diet Plan',
    gym: 'Gym Plan',
    schedule: 'Smart Schedule',
    progress: 'Progress',
    reminders: 'Reminders',
    settings: 'Settings'
  };

  return titles[path] || 'Gym & Diet Assistant';
}

function getInitials(user) {
  const name = user?.name || user?.email || 'U';

  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return parts[0]?.[0]?.toUpperCase() || 'U';
}

function initCommonUI(user = null) {
  const topNav = document.getElementById('topNav');
  const main = document.querySelector('.main');
  const topbar = document.querySelector('.topbar');
  const userCard = document.getElementById('userCard');
  const sidebar = document.getElementById('sidebar');

  // For unauthenticated users we hide the app shell elements
  if (!user) {
    if (sidebar) sidebar.style.display = 'none';
    if (topbar) topbar.style.display = 'none';
    if (main) {
      main.style.marginLeft = '0';
      main.style.width = '100%';
    }
    if (topbar) topbar.innerHTML = '';
    if (userCard) userCard.innerHTML = '';
    return;
  }

  // Authenticated state – restore layout and populate topbar and user card.
  if (sidebar) sidebar.style.display = '';
  if (topbar) topbar.style.display = '';
  if (main) {
    main.style.marginLeft = '';
    main.style.width = '';
  }
  const safeName = escapeHtml(user.name || 'User');
  const safeEmail = escapeHtml(user.email || '');

  if (topbar) {
    topbar.innerHTML = `
      <div class="topbar-title">
        <span class="topbar-page-title">${escapeHtml(getPageTitle())}</span>
      </div>
      <div class="topbar-user">
        <div class="topbar-user-info">
          <strong>${safeName}</strong>
          <span>Fitness Assistant</span>
        </div>
        <a href="#/profile" class="topbar-avatar" title="Open Profile">
          ${escapeHtml(getInitials(user))}
        </a>
      </div>
    `;
  }

  if (userCard) {
    userCard.innerHTML = `
      <a href="#/profile" class="user-card-link">
        <div class="user-avatar avatar">
          ${escapeHtml(getInitials(user))}
        </div>
        <div class="user-card-info">
          <strong>${safeName}</strong>
          <span>${safeEmail}</span>
        </div>
      </a>
    `;
  }
}

export {
  escapeHtml,
  showLoading,
  showError,
  showToast,
  setButtonLoading,
  formatGoal,
  formatDate,
  formatTime,
  capitalizeWords,
  initCommonUI
};