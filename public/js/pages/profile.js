import { api } from '../api.js';
import * as store from '../store.js';

import {
  escapeHtml,
  showLoading,
  showError,
  showToast,
  setButtonLoading
} from '../components.js';

let currentProfile = null;


/* =========================================================
   CONSTANTS
========================================================= */

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const ACTIVITY_LEVELS = [
  ['sedentary', 'Sedentary'],
  ['light', 'Lightly Active'],
  ['moderate', 'Moderately Active'],
  ['active', 'Active'],
  ['very_active', 'Very Active']
];

const FITNESS_GOALS = [
  ['cut', 'Cut'],
  ['bulk', 'Bulk'],
  ['maintain', 'Maintain'],
  ['recomp', 'Recomposition']
];

const DIET_PREFERENCES = [
  ['vegetarian', 'Vegetarian'],
  ['non_vegetarian', 'Non-Vegetarian']
];

const GYM_EXPERIENCE = [
  ['none', 'No Experience'],
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['advanced', 'Advanced']
];

const INJURY_CATEGORIES = [
  ['knee', 'Knee'],
  ['shoulder', 'Shoulder'],
  ['back', 'Back'],
  ['ankle', 'Ankle'],
  ['wrist', 'Wrist'],
  ['elbow', 'Elbow'],
  ['hip', 'Hip'],
  ['neck', 'Neck'],
  ['other', 'Other']
];


/* =========================================================
   HELPERS
========================================================= */

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeInjuries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(item => {
    if (typeof item === 'string') {
      return {
        category: 'other',
        detail: item
      };
    }

    return {
      category: item?.category || 'other',
      detail: item?.detail || ''
    };
  });
}

function optionList(items, selected) {
  return items
    .map(([value, label]) => `
      <option
        value="${value}"
        ${selected === value ? 'selected' : ''}
      >
        ${label}
      </option>
    `)
    .join('');
}


/* =========================================================
   ALLERGY RENDERING
========================================================= */

function renderAllergies(allergies) {
  if (!allergies.length) {
    return `
      <div class="tag-empty">
        No allergies added.
      </div>
    `;
  }

  return allergies
    .map(
      (allergy, index) => `
        <div class="tag-item">

          <span>
            ${escapeHtml(allergy)}
          </span>

          <button
            type="button"
            class="tag-remove"
            data-allergy-index="${index}"
          >
            ×
          </button>

        </div>
      `
    )
    .join('');
}


/* =========================================================
   INJURY RENDERING
========================================================= */

function renderInjuries(injuries) {
  if (!injuries.length) {
    return `
      <div class="tag-empty">
        No injuries or constraints added.
      </div>
    `;
  }

  return injuries
    .map(
      (injury, index) => `
        <div class="injury-item">

          <div>

            <strong>
              ${escapeHtml(
                injury.category
                  ? injury.category.charAt(0).toUpperCase() +
                    injury.category.slice(1)
                  : 'Other'
              )}
            </strong>

            ${
              injury.detail
                ? `
                  <span>
                    ${escapeHtml(injury.detail)}
                  </span>
                `
                : ''
            }

          </div>

          <button
            type="button"
            class="tag-remove"
            data-injury-index="${index}"
          >
            ×
          </button>

        </div>
      `
    )
    .join('');
}


/* =========================================================
   RENDER
========================================================= */

export async function render(container) {

  currentProfile = {};

  renderProfileForm(
    container,
    currentProfile
  );

  try {

    const result =
      await api.get('/profile');

    console.log(
      'PROFILE API RESULT:',
      JSON.stringify(result, null, 2)
    );

    if (
      result.success &&
      result.data
    ) {

      currentProfile =
        result.data;

      renderProfileForm(
        container,
        currentProfile
      );
    }

  } catch (error) {

    console.log(
      'Profile load skipped:',
      error
    );
  }
}


/* =========================================================
   PROFILE FORM
========================================================= */

function renderProfileForm(
  container,
  profile
) {

  const allergies =
    normalizeArray(
      profile.allergies
    );

  const injuries =
    normalizeInjuries(
      profile.injuries
    );

  const collegeDays =
    normalizeArray(
      profile.college_days
    );

  container.innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Your Profile
        </h1>

        <p>
          Keep your information updated so your plans stay personalized.
        </p>

      </div>

    </div>


    <form id="profileForm">


      <!-- ===================================================
           PERSONAL INFORMATION
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Personal Information
            </h2>

            <p>
              Basic information used for personalization.
            </p>

          </div>

        </div>


        <div class="grid grid-2">


          <div class="form-group">

            <label for="gender">
              Gender
            </label>

            <select
              id="gender"
              name="gender"
              required
            >

              <option value="">
                Select gender
              </option>

              <option
                value="male"
                ${profile.gender === 'male' ? 'selected' : ''}
              >
                Male
              </option>

              <option
                value="female"
                ${profile.gender === 'female' ? 'selected' : ''}
              >
                Female
              </option>

              <option
                value="other"
                ${profile.gender === 'other' ? 'selected' : ''}
              >
                Other
              </option>

            </select>

          </div>


          <div class="form-group">

            <label for="age">
              Age
            </label>

            <input
              type="number"
              id="age"
              name="age"
              min="13"
              max="100"
              value="${escapeHtml(
                profile.age || ''
              )}"
              required
            >

          </div>


          <div class="form-group">

            <label for="height">
              Height (cm)
            </label>

            <input
              type="number"
              id="height"
              name="height"
              min="100"
              max="250"
              step="0.1"
              value="${escapeHtml(
                profile.height || ''
              )}"
              required
            >

          </div>


          <div class="form-group">

            <label for="weight">
              Weight (kg)
            </label>

            <input
              type="number"
              id="weight"
              name="weight"
              min="30"
              max="300"
              step="0.1"
              value="${escapeHtml(
                profile.weight || ''
              )}"
              required
            >

          </div>

        </div>

      </section>


      <!-- ===================================================
           FITNESS
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Fitness Information
            </h2>

            <p>
              Tell the assistant about your current fitness preferences.
            </p>

          </div>

        </div>


        <div class="grid grid-2">


          <div class="form-group">

            <label for="activity_level">
              Activity Level
            </label>

            <select
              id="activity_level"
              name="activity_level"
              required
            >

              <option value="">
                Select activity level
              </option>

              ${optionList(
                ACTIVITY_LEVELS,
                profile.activity_level
              )}

            </select>

          </div>


          <div class="form-group">

            <label for="fitness_goal">
              Fitness Goal
            </label>

            <select
              id="fitness_goal"
              name="fitness_goal"
              required
            >

              <option value="">
                Select your goal
              </option>

              ${optionList(
                FITNESS_GOALS,
                profile.fitness_goal
              )}

            </select>

          </div>


          <div class="form-group">

            <label for="diet_preference">
              Diet Preference
            </label>

            <select
              id="diet_preference"
              name="diet_preference"
              required
            >

              <option value="">
                Select diet preference
              </option>

              ${optionList(
                DIET_PREFERENCES,
                profile.diet_preference
              )}

            </select>

          </div>


          <div
            class="form-group"
            style="grid-column: 1 / -1;"
          >

            <label for="target_body_description">
              Target / Fitness Description
            </label>

            <textarea
              id="target_body_description"
              name="target_body_description"
              placeholder="Describe your fitness target."
            >${escapeHtml(
              profile.target_body_description || ''
            )}</textarea>

          </div>

        </div>

      </section>


      <!-- ===================================================
           GYM EXPERIENCE
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Gym Experience
            </h2>

            <p>
              This helps determine an appropriate starting point.
            </p>

          </div>

        </div>


        <div class="grid grid-2">


          <div class="form-group">

            <label for="gym_experience_level">
              Experience Level
            </label>

            <select
              id="gym_experience_level"
              name="gym_experience_level"
              required
            >

              <option value="">
                Select experience
              </option>

              ${optionList(
                GYM_EXPERIENCE,
                profile.gym_experience_level
              )}

            </select>

          </div>


          <div class="form-group">

            <label for="gym_experience_note">
              Experience Notes
            </label>

            <input
              type="text"
              id="gym_experience_note"
              name="gym_experience_note"
              value="${escapeHtml(
                profile.gym_experience_note || ''
              )}"
              placeholder="Optional"
            >

          </div>

        </div>

      </section>


      <!-- ===================================================
           ALLERGIES
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Allergies
            </h2>

            <p>
              Add foods or ingredients your plan should avoid.
            </p>

          </div>

        </div>


        <div
          id="allergyList"
          class="tag-list"
        >

          ${renderAllergies(allergies)}

        </div>


        <div class="inline-input">

          <input
            type="text"
            id="allergyInput"
            placeholder="Enter an allergy"
          >

          <button
            type="button"
            id="addAllergyBtn"
            class="btn btn-primary"
          >
            Add
          </button>

        </div>

      </section>


      <!-- ===================================================
           INJURIES
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Injuries / Physical Constraints
            </h2>

            <p>
              Add relevant areas for safer workout recommendations.
            </p>

          </div>

        </div>


        <div
          id="injuryList"
          class="injury-list"
        >

          ${renderInjuries(injuries)}

        </div>


        <div class="injury-add-row">

          <select id="injuryCategory">

            <option value="">
              Select area
            </option>

            ${optionList(
              INJURY_CATEGORIES,
              ''
            )}

          </select>


          <input
            type="text"
            id="injuryDetail"
            placeholder="Short description"
          >


          <button
            type="button"
            id="addInjuryBtn"
            class="btn btn-primary"
          >
            Add
          </button>

        </div>

      </section>


      <!-- ===================================================
           COLLEGE SCHEDULE
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              College Schedule
            </h2>

            <p>
              Your schedule helps the assistant avoid conflicts.
            </p>

          </div>

        </div>


        <div class="grid grid-2">


          <div class="form-group">

            <label for="college_start_time">
              College Start Time
            </label>

            <input
              type="time"
              id="college_start_time"
              name="college_start_time"
              value="${escapeHtml(
                profile.college_start_time || ''
              )}"
              required
            >

          </div>


          <div class="form-group">

            <label for="college_end_time">
              College End Time
            </label>

            <input
              type="time"
              id="college_end_time"
              name="college_end_time"
              value="${escapeHtml(
                profile.college_end_time || ''
              )}"
              required
            >

          </div>

        </div>


        <div class="form-group">

          <label>
            College Days
          </label>


          <div class="checkbox-group">

            ${DAYS.map(day => {

              const shortDay =
                day.slice(0, 3);

              const checked =
                collegeDays.includes(day) ||
                collegeDays.includes(shortDay);

              return `

                <label class="checkbox-item">

                  <input
                    type="checkbox"
                    name="college_days"
                    value="${shortDay}"
                    ${checked ? 'checked' : ''}
                  >

                  <span>
                    ${day}
                  </span>

                </label>

              `;

            }).join('')}

          </div>

        </div>

      </section>


      <!-- ===================================================
           DIET INFORMATION
      ==================================================== -->

      <section class="card">

        <div class="card-header">

          <div>

            <h2>
              Diet Information
            </h2>

            <p>
              Set your monthly diet budget and reminder preferences.
            </p>

          </div>

        </div>


        <div class="form-group">

          <label for="monthly_diet_budget">
            Monthly Diet Budget
          </label>

          <input
            type="number"
            id="monthly_diet_budget"
            name="monthly_diet_budget"
            min="1"
            step="1"
            value="${escapeHtml(
              profile.monthly_diet_budget || ''
            )}"
            placeholder="Enter monthly budget"
            required
          >

        </div>


        <div class="form-group">

          <label>
            Reminder Preferences
          </label>

          <div class="checkbox-group">

            <label class="checkbox-item">

              <input
                type="checkbox"
                name="meal_reminders"
                value="true"
                ${
                  profile.meal_reminders === 0
                    ? ''
                    : 'checked'
                }
              >

              <span>
                Meal Reminders - Get notified for planned meals
              </span>

            </label>


            <label class="checkbox-item">

              <input
                type="checkbox"
                name="workout_reminders"
                value="true"
                ${
                  profile.workout_reminders === 0
                    ? ''
                    : 'checked'
                }
              >

              <span>
                Workout Reminders - Get notified for scheduled workouts
              </span>

            </label>

          </div>

        </div>

      </section>


      <!-- ===================================================
           SAVE
      ==================================================== -->

      <section class="card profile-save-card">

        <div>

          <h2>
            Save Changes
          </h2>

          <p>
            Your updated information will be used for personalized plans.
          </p>

        </div>


        <button
          type="submit"
          id="saveProfileBtn"
          class="btn btn-primary"
        >
          Save Profile
        </button>

        <a
          href="#/diet"
          id="viewDietPlanBtn"
          class="btn btn-secondary"
          style="display:none; margin-top:8px;"
        >
          → View Your Diet Plan
        </a>

      </section>


    </form>
  `;

  initializeForm(
    container,
    allergies,
    injuries
  );
}


/* =========================================================
   FORM INITIALIZATION
========================================================= */

function initializeForm(
  container,
  allergies,
  injuries
) {

  const form =
    document.getElementById(
      'profileForm'
    );

  const allergyInput =
    document.getElementById(
      'allergyInput'
    );

  const allergyList =
    document.getElementById(
      'allergyList'
    );

  const addAllergyBtn =
    document.getElementById(
      'addAllergyBtn'
    );

  const injuryCategory =
    document.getElementById(
      'injuryCategory'
    );

  const injuryDetail =
    document.getElementById(
      'injuryDetail'
    );

  const injuryList =
    document.getElementById(
      'injuryList'
    );

  const addInjuryBtn =
    document.getElementById(
      'addInjuryBtn'
    );


  function refreshAllergies() {

    allergyList.innerHTML =
      renderAllergies(
        allergies
      );

    allergyList
      .querySelectorAll(
        '[data-allergy-index]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const index =
              Number(
                button.dataset
                  .allergyIndex
              );

            allergies.splice(
              index,
              1
            );

            refreshAllergies();

          }
        );

      });

  }


  function addAllergy() {

    const value =
      allergyInput
        .value
        .trim();

    if (!value) {
      return;
    }

    const exists =
      allergies.some(
        item =>
          item.toLowerCase() ===
          value.toLowerCase()
      );

    if (!exists) {

      allergies.push(
        value
      );

    }

    allergyInput.value = '';

    refreshAllergies();

  }


  addAllergyBtn.addEventListener(
    'click',
    addAllergy
  );


  allergyInput.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {

        event.preventDefault();

        addAllergy();

      }

    }
  );


  function refreshInjuries() {

    injuryList.innerHTML =
      renderInjuries(
        injuries
      );

    injuryList
      .querySelectorAll(
        '[data-injury-index]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const index =
              Number(
                button.dataset
                  .injuryIndex
              );

            injuries.splice(
              index,
              1
            );

            refreshInjuries();

          }
        );

      });

  }


  function addInjury() {

    const category =
      injuryCategory.value;

    const detail =
      injuryDetail
        .value
        .trim();

    if (!category) {

      showToast(
        'Please select an injury area.',
        'warning'
      );

      return;
    }

    if (!detail) {

      showToast(
        'Please enter a short injury description.',
        'warning'
      );

      return;
    }

    injuries.push({
      category,
      detail
    });

    injuryCategory.value =
      '';

    injuryDetail.value =
      '';

    refreshInjuries();

  }


  addInjuryBtn.addEventListener(
    'click',
    addInjury
  );


  injuryDetail.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {

        event.preventDefault();

        addInjury();

      }

    }
  );


  refreshAllergies();

  refreshInjuries();


  form.addEventListener(
    'submit',
    event => {

      event.preventDefault();

      saveProfile(
        form,
        allergies,
        injuries
      );

    }
  );

}


/* =========================================================
   SAVE PROFILE
========================================================= */

async function saveProfile(
  form,
  allergies,
  injuries
) {

  const saveButton =
    document.getElementById(
      'saveProfileBtn'
    );

  const collegeDays = [
    ...form.querySelectorAll(
      'input[name="college_days"]:checked'
    )
  ].map(
    input => input.value
  );


  const payload = {

    gender:
      form.gender.value,

    age:
      Number(
        form.age.value
      ),

    height:
      Number(
        form.height.value
      ),

    weight:
      Number(
        form.weight.value
      ),

    activity_level:
      form.activity_level.value,

    fitness_goal:
      form.fitness_goal.value,

    diet_preference:
      form.diet_preference.value,

    target_body_description:
      form
        .target_body_description
        .value
        .trim(),

    monthly_diet_budget:
      Number(
        form.monthly_diet_budget.value
      ),

    college_start_time:
      form.college_start_time.value,

    college_end_time:
      form.college_end_time.value,

    college_days:
      collegeDays,

    allergies:
      allergies,

    injuries:
      injuries,

    gym_experience_level:
      form.gym_experience_level.value,

    gym_experience_note:
      form
        .gym_experience_note
        .value
        .trim(),

    meal_reminders:
      form.querySelector(
        'input[name="meal_reminders"]:checked'
      ) !== null,

    workout_reminders:
      form.querySelector(
        'input[name="workout_reminders"]:checked'
      ) !== null

  };


  /* =======================================================
     VALIDATION
  ======================================================= */

  if (!payload.gender) {

    showToast(
      'Please select your gender.',
      'warning'
    );

    return;
  }


  if (
    !payload.age ||
    payload.age < 13 ||
    payload.age > 100
  ) {

    showToast(
      'Please enter a valid age.',
      'warning'
    );

    return;
  }


  if (
    !payload.height ||
    payload.height < 100 ||
    payload.height > 250
  ) {

    showToast(
      'Please enter a valid height.',
      'warning'
    );

    return;
  }


  if (
    !payload.weight ||
    payload.weight < 30 ||
    payload.weight > 300
  ) {

    showToast(
      'Please enter a valid weight.',
      'warning'
    );

    return;
  }


  if (!payload.activity_level) {

    showToast(
      'Please select your activity level.',
      'warning'
    );

    return;
  }


  if (!payload.fitness_goal) {

    showToast(
      'Please select your fitness goal.',
      'warning'
    );

    return;
  }


  if (!payload.diet_preference) {

    showToast(
      'Please select your diet preference.',
      'warning'
    );

    return;
  }


  if (!payload.gym_experience_level) {

    showToast(
      'Please select your gym experience level.',
      'warning'
    );

    return;
  }


  if (!payload.college_start_time) {

    showToast(
      'Please enter your college start time.',
      'warning'
    );

    return;
  }


  if (!payload.college_end_time) {

    showToast(
      'Please enter your college end time.',
      'warning'
    );

    return;
  }


  if (
    payload.college_end_time <=
    payload.college_start_time
  ) {

    showToast(
      'College end time must be after college start time.',
      'warning'
    );

    return;
  }


  if (!payload.college_days.length) {

    showToast(
      'Please select at least one college day.',
      'warning'
    );

    return;
  }


  if (
    !payload.monthly_diet_budget ||
    payload.monthly_diet_budget <= 0
  ) {

    showToast(
      'Please enter your monthly diet budget.',
      'warning'
    );

    return;
  }


  /* =======================================================
     SAVE
  ======================================================= */

  setButtonLoading(
    saveButton,
    true,
    'Saving Profile...'
  );


  try {

    const hasExistingProfile =
      currentProfile &&
      typeof currentProfile === 'object' &&
      Object.keys(currentProfile).length > 0;


    let result;


    if (hasExistingProfile) {

      console.log(
        'Updating existing profile with PUT'
      );

      result =
        await api.put(
          '/profile',
          payload
        );

    } else {

      console.log(
        'Creating new profile with POST'
      );

      result =
        await api.post(
          '/profile',
          payload
        );

      if (
        !result.success &&
        (
          result.error?.code === 'NOT_FOUND' ||
          result.error?.code === 'HTTP_404' ||
          result.error?.code === 'METHOD_NOT_ALLOWED' ||
          result.error?.code === 'HTTP_405'
        )
      ) {

        console.log(
          'POST profile route unavailable. Trying PUT...'
        );

        result =
          await api.put(
            '/profile',
            payload
          );

      }

    }


    console.log(
      'PROFILE SAVE RESULT:',
      JSON.stringify(
        result,
        null,
        2
      )
    );


    if (!result.success) {

      console.error(
        'PROFILE SAVE FAILED:',
        JSON.stringify(
          result.error,
          null,
          2
        )
      );


      let message =
        result.error?.message ||
        'Unable to save your profile.';


      const fields =
        result.error?.fields;


      if (
        fields &&
        typeof fields === 'object'
      ) {

        const details =
          Object.entries(fields)
            .map(
              ([field, error]) =>
                `${field}: ${error}`
            )
            .join(' | ');


        if (details) {
          message = details;
        }

      }


      showToast(
        message,
        'error'
      );

      return;
    }


    /* =====================================================
       SUCCESS
    ===================================================== */

    currentProfile =
      result.data ||
      payload;


    const existingUser =
      store.getUser() || {};


    store.setUser({

      ...existingUser,

      ...(result.data?.user || {})

    });


    showToast(
      'Profile saved successfully.',
      'success'
    );


    const viewDietBtn =
      document.getElementById(
        'viewDietPlanBtn'
      );

    if (viewDietBtn) {
      viewDietBtn.style.display =
        'inline-flex';
    }


    setTimeout(() => {
      window.location.hash =
        '#/diet';
    }, 1500);


  } catch (error) {

    console.error(
      'PROFILE SAVE EXCEPTION:',
      error
    );


    showToast(
      'Something went wrong while saving your profile.',
      'error'
    );


  } finally {

    setButtonLoading(
      saveButton,
      false
    );

  }
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {
  currentProfile = null;
}