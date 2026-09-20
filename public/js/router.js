import * as store from './store.js';

const pages = {};

const mainEl = () => document.getElementById('page');
const landingEl = () => document.getElementById('landingPage');
const appShellEl = () => document.getElementById('appShell');

export function register(name, module) {
  pages[name] = module;
}

let current = null;

/* =========================================================
   SHOW LANDING PAGE
========================================================= */

function showLandingPage() {
  const landing = landingEl();
  const appShell = appShellEl();

  if (landing) {
    landing.style.display = 'block';
  }

  if (appShell) {
    appShell.style.display = 'none';
  }

  const nav = document.getElementById('nav');

  if (nav) {
    nav.innerHTML = '';
  }

  if (current && typeof current.destroy === 'function') {
    current.destroy();
    current = null;
  }
}

/* =========================================================
   SHOW APPLICATION
========================================================= */

function showAppShell() {
  const landing = landingEl();
  const appShell = appShellEl();

  if (landing) {
    landing.style.display = 'none';
  }

  if (appShell) {
    appShell.style.display = 'flex';
  }
}

/* =========================================================
   NAVIGATE
========================================================= */

export function navigate(hash) {
  let path = (hash || location.hash || '')
    .replace(/^#/, '') || '/';

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  /* =========================================
     ROOT = LANDING PAGE
  ========================================= */

  if (path === '/') {
    showLandingPage();
    return;
  }

  const page = path.substring(1) || 'login';
  const mod = pages[page];

  /* =========================================
     PAGE DOES NOT EXIST
  ========================================= */

  if (!mod) {
    showAppShell();
    render404();
    return;
  }

  /* =========================================
     PROTECTED PAGES
  ========================================= */

  const protectedPages = [
    'dashboard',
    'profile',
    'diet',
    'gym',
    'schedule',
    'progress',
    'reminders',
    'settings'
  ];

  if (
    protectedPages.includes(page) &&
    !store.isAuthenticated()
  ) {
    window.location.hash = '#/login';
    return;
  }

  /* =========================================
     AUTH PAGES (LOGIN/REGISTER)
  ========================================= */

  const authPages = ['login', 'register'];

  if (
    authPages.includes(page) &&
    store.isAuthenticated()
  ) {
    window.location.hash = '#/dashboard';
    return;
  }

  /* =========================================
     SHOW APPLICATION
  ========================================= */

  showAppShell();

  /* Destroy previous page */
  if (current && typeof current.destroy === 'function') {
    current.destroy();
  }

  const container = mainEl();

  if (!container) {
    console.error('Page container #page not found.');
    return;
  }

  container.innerHTML = '';

  current = mod;

  /* =========================================
     RENDER PAGE
  ========================================= */

  if (typeof mod.render === 'function') {
    mod.render(container);
  } else {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Page not available</h2>
        <p>This page has not been implemented yet.</p>
      </div>
    `;
  }

  updateNav(path);

  window.scrollTo(0, 0);
}

/* =========================================================
   404
========================================================= */

function render404() {
  const container = mainEl();

  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>

      <button onclick="location.hash='#/dashboard'">
        Go to Dashboard
      </button>
    </div>
  `;
}

/* =========================================================
   NAVIGATION
========================================================= */

function updateNav(activePath) {
  const nav = document.getElementById('nav');

  if (!nav) return;

  if (!store.isAuthenticated()) {
    nav.innerHTML = '';
    return;
  }

  const icons = {
    dashboard:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',

    diet:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path><path d="M12 12v10"></path><path d="M8 22h8"></path><path d="M12 12c-4 0-6 2-6 5s2 5 6 5 6-2 6-5-2-5-6-5z"></path></svg>',

    gym:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11"></path><path d="M6.5 17.5h11"></path><path d="M6 20v-2a6 6 0 1 1 12 0v2"></path><path d="M6 4v2a6 6 0 1 0 12 0V4"></path></svg>',

    schedule:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',

    progress:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',

    profile:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',

    reminders:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',

    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a1.65 1.65 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a1.65 1.65 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
  };

  const links = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: icons.dashboard
    },
    {
      path: '/diet',
      label: 'Diet Plan',
      icon: icons.diet
    },
    {
      path: '/gym',
      label: 'Gym Plan',
      icon: icons.gym
    },
    {
      path: '/schedule',
      label: 'Schedule',
      icon: icons.schedule
    },
    {
      path: '/progress',
      label: 'Progress',
      icon: icons.progress
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: icons.profile
    },
    {
      path: '/reminders',
      label: 'Reminders',
      icon: icons.reminders
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: icons.settings
    }
  ];

  nav.innerHTML = links
    .map(
      (link) => `
        <a
          href="#${link.path}"
          class="nav-link ${
            activePath === link.path ? 'active' : ''
          }"
        >
          <span class="nav-icon">${link.icon}</span>
          <span>${link.label}</span>
        </a>
      `
    )
    .join('');
}