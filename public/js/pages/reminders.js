import { api } from '../api.js';
import {
  escapeHtml,
  showLoading,
  showToast,
  setButtonLoading
} from '../components.js';

let reminderSettings = {
  meal_reminders: true,
  workout_reminders: true,
  weight_checkin_day: 'Mon',
  progress_photo_frequency: 'weekly',
  plan_expiry_warning_days: 2,
  reminder_time: '08:00'
};

const DEFAULT_SETTINGS = {
  meal_reminders: true,
  workout_reminders: true,
  weight_checkin_day: 'Mon',
  progress_photo_frequency: 'weekly',
  plan_expiry_warning_days: 2,
  reminder_time: '08:00'
};

export async function render(container) {
  showLoading(
    container,
    'Loading your reminder preferences...'
  );

  const result = await api.get('/reminders');

  if (result.success && result.data) {
    reminderSettings = {
      ...DEFAULT_SETTINGS,
      ...result.data
    };
  } else {
    reminderSettings = {
      ...DEFAULT_SETTINGS
    };
  }

  renderPage(container);
}

function renderPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Reminders</h1>
        <p>
          Choose how you want your fitness reminders to work.
        </p>
      </div>
    </div>


    <!-- =========================================
         DAILY REMINDERS
    ========================================== -->

    <section class="card reminder-card">

      <div class="card-header">
        <div>
          <h2>Daily Reminders</h2>

          <p>
            Keep important parts of your routine
            on your radar.
          </p>
        </div>
      </div>


      <div class="reminder-toggle-list">

        <label
          class="reminder-toggle-row"
          for="mealReminders"
        >

          <div class="reminder-toggle-info">

            <div class="reminder-icon">
              🍽️
            </div>

            <div>
              <strong>
                Meal Reminders
              </strong>

              <span>
                Get reminders for your planned meals.
              </span>
            </div>

          </div>


          <input
            type="checkbox"
            id="mealReminders"
            ${
              reminderSettings.meal_reminders
                ? 'checked'
                : ''
            }
          >

          <span
            class="toggle-slider"
          ></span>

        </label>


        <label
          class="reminder-toggle-row"
          for="workoutReminders"
        >

          <div class="reminder-toggle-info">

            <div class="reminder-icon">
              🏋️
            </div>

            <div>
              <strong>
                Workout Reminders
              </strong>

              <span>
                Get reminders about your scheduled workouts.
              </span>
            </div>

          </div>


          <input
            type="checkbox"
            id="workoutReminders"
            ${
              reminderSettings.workout_reminders
                ? 'checked'
                : ''
            }
          >

          <span
            class="toggle-slider"
          ></span>

        </label>

      </div>

    </section>


    <!-- =========================================
         REMINDER SCHEDULE
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Reminder Schedule
          </h2>

          <p>
            Set your preferred reminder timing.
          </p>

        </div>

      </div>


      <div class="grid grid-2">

        <div class="form-group">

          <label
            for="reminderTime"
          >
            Reminder Time
          </label>

          <input
            type="time"
            id="reminderTime"
            value="${escapeHtml(
              reminderSettings.reminder_time ||
              '08:00'
            )}"
          >

        </div>


        <div class="form-group">

          <label
            for="weightCheckinDay"
          >
            Weight Check-in Day
          </label>

          <select
            id="weightCheckinDay"
          >
            ${renderDayOptions(
              reminderSettings.weight_checkin_day
            )}
          </select>

        </div>


        <div class="form-group">

          <label
            for="photoFrequency"
          >
            Progress Photo Frequency
          </label>

          <select
            id="photoFrequency"
          >

            <option
              value="weekly"
              ${
                reminderSettings.progress_photo_frequency ===
                'weekly'
                  ? 'selected'
                  : ''
              }
            >
              Weekly
            </option>

            <option
              value="biweekly"
              ${
                reminderSettings.progress_photo_frequency ===
                'biweekly'
                  ? 'selected'
                  : ''
              }
            >
              Every 2 Weeks
            </option>

            <option
              value="monthly"
              ${
                reminderSettings.progress_photo_frequency ===
                'monthly'
                  ? 'selected'
                  : ''
              }
            >
              Monthly
            </option>

          </select>

        </div>


        <div class="form-group">

          <label
            for="expiryWarning"
          >
            Plan Expiry Warning
          </label>

          <select
            id="expiryWarning"
          >

            <option
              value="1"
              ${
                Number(
                  reminderSettings.plan_expiry_warning_days
                ) === 1
                  ? 'selected'
                  : ''
              }
            >
              1 day before
            </option>

            <option
              value="2"
              ${
                Number(
                  reminderSettings.plan_expiry_warning_days
                ) === 2
                  ? 'selected'
                  : ''
              }
            >
              2 days before
            </option>

            <option
              value="3"
              ${
                Number(
                  reminderSettings.plan_expiry_warning_days
                ) === 3
                  ? 'selected'
                  : ''
              }
            >
              3 days before
            </option>

            <option
              value="5"
              ${
                Number(
                  reminderSettings.plan_expiry_warning_days
                ) === 5
                  ? 'selected'
                  : ''
              }
            >
              5 days before
            </option>

            <option
              value="7"
              ${
                Number(
                  reminderSettings.plan_expiry_warning_days
                ) === 7
                  ? 'selected'
                  : ''
              }
            >
              7 days before
            </option>

          </select>

        </div>

      </div>

    </section>


    <!-- =========================================
         SAVE
    ========================================== -->

    <section class="card reminder-save-card">

      <div>

        <h2>
          Save Preferences
        </h2>

        <p>
          Your selected reminder preferences
          will be saved to your account.
        </p>

      </div>


      <div style="display: flex; gap: 1rem; align-items: center; justify-content: flex-start; margin-top: 1rem;">
        <button
          id="saveRemindersBtn"
          class="btn btn-primary"
        >
          Save Preferences
        </button>

        <button
          id="testEmailBtn"
          class="btn btn-secondary"
        >
          Send Test Email
        </button>
      </div>

    </section>


    <!-- =========================================
         NOTE
    ========================================== -->

    <div class="reminder-note">

      <span>✦</span>

      <p>
        Reminders are designed to help you stay
        consistent with the plans you've created
        in the app.
      </p>

    </div>
  `;


  document
    .getElementById(
      'saveRemindersBtn'
    )
    ?.addEventListener(
      'click',
      saveReminders
    );

  document
    .getElementById(
      'testEmailBtn'
    )
    ?.addEventListener(
      'click',
      sendTestEmail
    );
}


/* =========================================================
   DAY OPTIONS
========================================================= */

function renderDayOptions(
  selectedDay
) {
  const days = [
    ['Mon', 'Monday'],
    ['Tue', 'Tuesday'],
    ['Wed', 'Wednesday'],
    ['Thu', 'Thursday'],
    ['Fri', 'Friday'],
    ['Sat', 'Saturday'],
    ['Sun', 'Sunday']
  ];


  // Handle old values such as "Monday"
  const normalizedSelected =
    normalizeDayValue(
      selectedDay
    );


  return days
    .map(
      ([value, label]) => `
        <option
          value="${value}"
          ${
            normalizedSelected ===
            value
              ? 'selected'
              : ''
          }
        >
          ${label}
        </option>
      `
    )
    .join('');
}


function normalizeDayValue(
  value
) {
  const map = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
  };

  return map[value] || value || 'Mon';
}


/* =========================================================
   SAVE
========================================================= */

async function saveReminders() {
  const button =
    document.getElementById(
      'saveRemindersBtn'
    );


  if (!button) {
    return;
  }


  const mealCheckbox =
    document.getElementById(
      'mealReminders'
    );

  const workoutCheckbox =
    document.getElementById(
      'workoutReminders'
    );

  const weightDay =
    document.getElementById(
      'weightCheckinDay'
    );

  const photoFrequency =
    document.getElementById(
      'photoFrequency'
    );

  const expiryWarning =
    document.getElementById(
      'expiryWarning'
    );

  const reminderTime =
    document.getElementById(
      'reminderTime'
    );


  const settings = {
    meal_reminders:
      Boolean(
        mealCheckbox?.checked
      ),

    workout_reminders:
      Boolean(
        workoutCheckbox?.checked
      ),

    weight_checkin_day:
      weightDay?.value || 'Mon',

    progress_photo_frequency:
      photoFrequency?.value ||
      'weekly',

    plan_expiry_warning_days:
      Number(
        expiryWarning?.value || 2
      ),

    reminder_time:
      reminderTime?.value ||
      '08:00'
  };


  setButtonLoading(
    button,
    true,
    'Saving...'
  );


  const result =
    await api.put(
      '/reminders',
      settings
    );


  setButtonLoading(
    button,
    false,
    'Save Preferences'
  );


  if (!result.success) {

    showToast(
      result.error?.message ||
      'Could not save reminder preferences.',
      'error'
    );

    return;
  }


  reminderSettings = {
    ...reminderSettings,
    ...settings
  };


  showToast(
    'Reminder preferences saved successfully.',
    'success'
  );
}


/* =========================================================
   SEND TEST EMAIL
========================================================= */

async function sendTestEmail() {
  const button = document.getElementById('testEmailBtn');
  if (!button) return;

  setButtonLoading(button, true, 'Sending...');

  const result = await api.post('/reminders/test');

  setButtonLoading(button, false, 'Send Test Email');

  if (result.success) {
    showToast(result.message || 'Test email sent successfully', 'success');
  } else {
    showToast(result.error?.message || 'Failed to send test email', 'error');
  }
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {
  reminderSettings = {
    ...DEFAULT_SETTINGS
  };
}