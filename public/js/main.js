import { navigate, register } from './router.js';
import * as auth from './auth.js';
import * as store from './store.js';
import { initCommonUI } from './components.js';

import * as login from './pages/login.js';
import * as registerPage from './pages/register.js';
import * as dashboard from './pages/dashboard.js';
import * as profile from './pages/profile.js?v=20260918';
import * as diet from './pages/diet.js';
import * as gym from './pages/gym.js';
import * as schedule from './pages/schedule.js';
import * as progress from './pages/progress.js';
import * as reminders from './pages/reminders.js';
import * as settings from './pages/settings.js';


/* =========================================================
   REGISTER ALL PAGES
========================================================= */

register('login', login);
register('register', registerPage);
register('dashboard', dashboard);
register('profile', profile);
register('diet', diet);
register('gym', gym);
register('schedule', schedule);
register('progress', progress);
register('reminders', reminders);
register('settings', settings);


/* =========================================================
   COMMON UI
========================================================= */

function updateCommonUI() {

  const user = store.getUser();

  if (store.isAuthenticated() && user) {

    initCommonUI(user);

  } else {

    initCommonUI(null);

  }

}


/* =========================================================
   HASH CHANGE
========================================================= */

window.addEventListener(
  'hashchange',
  () => {

    navigate();
    updateCommonUI();

  }
);


/* =========================================================
   INITIALIZE APP
========================================================= */

async function init() {

  updateCommonUI();


  if (store.isAuthenticated()) {

    const result = await auth.me();


    if (!result.success) {

      store.clearAuth();

      window.location.hash = '#/login';

      return;

    }


    updateCommonUI();

  }


  navigate();

  updateCommonUI();

}


/* =========================================================
   START
========================================================= */

init();