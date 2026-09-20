import { api } from '../api.js';

import {
  escapeHtml,
  showLoading,
  showToast,
  setButtonLoading
} from '../components.js';

let currentPlan = null;
let completedMeals = new Set();


/* =========================================================
   RENDER
========================================================= */

export async function render(container) {

  currentPlan = null;

  showLoading(
    container,
    'Loading your personalized diet plan...'
  );

  /* Backend route is mounted at /api/plans */
  const result = await api.get('/plans/diet');

  if (!result.success) {

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Diet Plan</h1>
          <p>Your personalized daily meal plan.</p>
        </div>
      </div>

      <div class="card">
        <div class="empty-state">

          <div class="diet-empty-icon">
            ✦
          </div>

          <h2>No Diet Plan Yet</h2>

          <p>
            ${escapeHtml(
              result.error?.message ||
              'Generate your personalized meal plan based on your profile, goals and preferences.'
            )}
          </p>

          <div style="
            display:flex;
            gap:12px;
            flex-wrap:wrap;
            justify-content:center;
            margin-top:24px;
          ">

            <button
              id="generateAIDietBtn"
              class="btn btn-primary"
            >
              ✦ Generate AI Diet Plan
            </button>

            <a
              href="#/profile"
              class="btn btn-secondary"
            >
              Edit Profile
            </a>

          </div>

        </div>
      </div>
    `;

    const generateBtn =
      container.querySelector('#generateAIDietBtn');

    if (generateBtn) {

      generateBtn.addEventListener(
        'click',
        async () => {
          await generateDietPlan(container);
        }
      );

    }

    return;
  }

  currentPlan = result.data;

  // Load today's completed meals before rendering
  await loadCompletedMeals();
    renderPlan(
    container,
    currentPlan
  );
}


/* =========================================================
   GENERATE DIET PLAN
========================================================= */

async function generateDietPlan(container) {

  const generateBtn =
    container.querySelector('#generateAIDietBtn');

  if (generateBtn) {

    generateBtn.disabled = true;

    generateBtn.innerHTML = `
      <span class="button-spinner"></span>
      Generating your plan...
    `;

  }

  try {

    /*
     * Backend route:
     * POST /api/plans/diet
     */
    const result =
      await api.post(
        '/plans/diet',
        {}
      );

    if (!result.success) {

      showToast(
        result.error?.message ||
        'Failed to generate your diet plan.',
        'error'
      );

      restoreGenerateButton(generateBtn);

      return;
    }

    currentPlan =
      result.data;

    showToast(
      'Your personalized diet plan is ready!',
      'success'
    );

    renderPlan(
      container,
      currentPlan
    );

  } catch (error) {

    console.error(
      'Diet generation failed:',
      error
    );

    showToast(
      'Something went wrong while generating your diet plan.',
      'error'
    );

    restoreGenerateButton(
      generateBtn
    );
  }
}

async function loadCompletedMeals() {
  completedMeals = new Set();

  try {
    const result = await api.get('/progress');

    if (!result.success) {
      return;
    }

    const logs = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.logs)
        ? result.data.logs
        : [];

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata'
    }).format(new Date());

    logs
      .filter(log => log.log_type === 'meal_compliance')
      .forEach(log => {
        try {
          const value = JSON.parse(log.value_json || '{}');

          if (
            value.completed === true &&
            value.completed_date === today &&
            value.meal_name
          ) {
            completedMeals.add(value.meal_name);
          }
        } catch (error) {
          console.warn('Could not parse meal completion log:', error);
        }
      });

  } catch (error) {
    console.error('Failed to load meal completion logs:', error);
  }
}

function restoreGenerateButton(button) {

  if (!button) return;

  button.disabled = false;

  button.innerHTML =
    '✦ Generate AI Diet Plan';
}


/* =========================================================
   RENDER PLAN
========================================================= */

function renderPlan(container, plan) {

  const data =
    normalizePlan(plan);

  container.innerHTML = `

    <div class="page-header">

      <div>

        <h1>
          Diet Plan
        </h1>

        <p>
          Personalized using your profile, fitness goal,
          calorie target and dietary preferences.
        </p>

      </div>

      <button
        id="regenerateDietBtn"
        class="btn btn-primary"
      >
        ✦ Regenerate Plan
      </button>

    </div>


    <!-- ===================================================
         STATS
    ==================================================== -->

    <section class="stats-grid diet-stats">

      <div class="stat-card">

        <div class="stat-label">
          Daily Calories
        </div>

        <div class="stat-value">
          ${
            data.calories !== ''
              ? `${escapeHtml(data.calories)} kcal`
              : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Protein
        </div>

        <div class="stat-value">
          ${
            data.protein !== ''
              ? `${escapeHtml(data.protein)} g`
              : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Carbs
        </div>

        <div class="stat-value">
          ${
            data.carbs !== ''
              ? `${escapeHtml(data.carbs)} g`
              : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Fats
        </div>

        <div class="stat-value">
          ${
            data.fats !== ''
              ? `${escapeHtml(data.fats)} g`
              : '—'
          }
        </div>

      </div>

    </section>


    <!-- ===================================================
         TODAY'S MEALS
    ==================================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Today's Meals
          </h2>

          <p>
            Your meals selected from the weekly personalized plan.
          </p>

        </div>

      </div>


      <div class="meal-grid">

        ${
          renderMeals(
            data.todayMeals
          )
        }

      </div>

    </section>


    <!-- ===================================================
         PLAN INFO
    ==================================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Plan Information
          </h2>

          <p>
            Details used to build your personalized plan.
          </p>

        </div>

      </div>


      <div class="dashboard-info-list">

        ${
          data.goal
            ? `
              <div class="dashboard-info-row">
                <span>Fitness Goal</span>
                <strong>
                  ${escapeHtml(data.goal)}
                </strong>
              </div>
            `
            : ''
        }


        ${
          data.dailyBudget !== ''
            ? `
              <div class="dashboard-info-row">
                <span>Estimated Daily Diet Budget</span>
                <strong>
                  ${escapeHtml(data.dailyBudget)}
                </strong>
              </div>
            `
            : ''
        }


        ${
          data.generatedVia
            ? `
              <div class="dashboard-info-row">
                <span>Generated Via</span>
                <strong>
                  ${escapeHtml(data.generatedVia)}
                </strong>
              </div>
            `
            : ''
        }

      </div>

    </section>


    ${
      data.notes
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Plan Notes
                </h2>

              </div>

            </div>

            <div class="diet-notes">
              ${escapeHtml(data.notes)}
            </div>

          </section>
        `
        : ''
    }

  `;
  container
  .querySelectorAll('.meal-complete-btn')
  .forEach(button => {

    button.addEventListener('click', async () => {

      const mealName =
        button.dataset.mealName;

      if (!mealName) return;

      setButtonLoading(
        button,
        true,
        'Saving...'
      );

      try {

        const result = await api.post(
          '/progress/meal-complete',
          {
            meal_name: mealName
          }
        );

        if (!result.success) {
          showToast(
            result.error?.message ||
            'Could not mark meal as completed.',
            'error'
          );

          setButtonLoading(
            button,
            false
          );

          return;
        }

        completedMeals.add(mealName);

        button.disabled = true;
        button.classList.add('completed');
        button.innerHTML = '✓ Completed today';

        showToast(
          'Meal marked as completed!',
          'success'
        );

      } catch (error) {

        console.error(
          'Meal completion failed:',
          error
        );

        showToast(
          'Could not mark meal as completed.',
          'error'
        );

        setButtonLoading(
          button,
          false
        );
      }
    });
  });

  const regenerateBtn =
    container.querySelector(
      '#regenerateDietBtn'
    );

  if (regenerateBtn) {

    regenerateBtn.addEventListener(
      'click',
      regeneratePlan
    );

  }
}


/* =========================================================
   NORMALIZE BACKEND PLAN
========================================================= */

function normalizePlan(plan) {

  const source =
    plan?.plan ||
    plan?.diet_plan ||
    plan ||
    {};


  /*
   * Backend returns:
   *
   * {
   *   weekly_plan: [
   *     {
   *       day: "Mon",
   *       meals: [...]
   *     }
   *   ]
   * }
   */

  const weeklyPlan =
    Array.isArray(source.weekly_plan)
      ? source.weekly_plan
      : [];


  const todayMeals =
    getTodayMeals(
      weeklyPlan
    );


  return {

    calories:
      source.calorie_target ??
      source.daily_calories ??
      source.calories ??
      '',

    protein:
      source.protein_grams ??
      source.protein ??
      '',

    carbs:
      source.carbs_grams ??
      source.carbs ??
      '',

    fats:
      source.fat_grams ??
      source.fats ??
      '',

    goal:
      source.fitness_goal ||
      source.goal ||
      '',

    dailyBudget:
      source.daily_budget ??
      '',

    generatedVia:
      formatGeneratedVia(
        source.generated_via
      ),

    todayMeals,

    weeklyPlan,

    notes:
      source.notes ||
      source.additional_notes ||
      source.instructions ||
      ''

  };
}


/* =========================================================
   GET TODAY'S MEALS
========================================================= */

function getTodayMeals(weeklyPlan) {

  if (
    !Array.isArray(weeklyPlan) ||
    weeklyPlan.length === 0
  ) {
    return [];
  }


  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];


  const shortNames = [
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat'
  ];


  const now =
    new Date();

  const fullDay =
    dayNames[now.getDay()];

  const shortDay =
    shortNames[now.getDay()];


  const todayEntry =
    weeklyPlan.find(item => {

      const value =
        String(
          item?.day || ''
        ).trim().toLowerCase();

      return (
        value === fullDay.toLowerCase() ||
        value === shortDay.toLowerCase()
      );

    });


  /*
   * If the AI uses an unexpected day name,
   * show the first day rather than a blank page.
   */

  const selectedDay =
    todayEntry ||
    weeklyPlan[0];


  return Array.isArray(
    selectedDay?.meals
  )
    ? selectedDay.meals
    : [];
}


/* =========================================================
   RENDER MEALS
========================================================= */

function renderMeals(meals) {

  if (
    !Array.isArray(meals) ||
    meals.length === 0
  ) {

    return `

      <div class="diet-empty">

        <div class="diet-empty-icon">
          ✦
        </div>

        <h3>
          No meals available
        </h3>

        <p>
          Regenerate your plan to create today's meals.
        </p>

      </div>

    `;
  }


  return meals
    .map(
      (meal, index) => {

        const title =
          meal.name ||
          `Meal ${index + 1}`;

          const isCompleted = completedMeals.has(title);


        const description =
          meal.description ||
          '';


        /*
         * Backend calls these "ingredients".
         * Older frontend code called them "foods".
         */
        const ingredients =
          Array.isArray(
            meal.ingredients
          )
            ? meal.ingredients
            : Array.isArray(
                meal.foods
              )
              ? meal.foods
              : [];


        const calories =
          meal.calories ??
          '';


        const protein =
          meal.protein_grams ??
          meal.protein ??
          '';


        const carbs =
          meal.carbs_grams ??
          meal.carbs ??
          '';


        const fats =
          meal.fat_grams ??
          meal.fats ??
          '';


        return `

          <article class="meal-card">

            <div class="meal-card-top">

              <div class="meal-icon">
                ${getMealIcon(
                  title,
                  index
                )}
              </div>


              <div class="meal-heading">

                <h3>
                  ${escapeHtml(title)}
                </h3>

                <span class="meal-time">
                  ${getMealLabel(index)}
                </span>

              </div>

            </div>


            ${
              description
                ? `
                  <p class="meal-description">
                    ${escapeHtml(description)}
                  </p>
                `
                : ''
            }


            ${
              ingredients.length
                ? `
                  <div class="meal-foods">

                    ${ingredients
                      .map(
                        ingredient => `
                          <div class="meal-food">

                            <span>•</span>

                            <span>
                              ${escapeHtml(
                                typeof ingredient === 'string'
                                  ? ingredient
                                  : ingredient?.name ||
                                    ingredient?.item ||
                                    JSON.stringify(
                                      ingredient
                                    )
                              )}
                            </span>

                          </div>
                        `
                      )
                      .join('')}

                  </div>
                `
                : ''
            }


            <div class="meal-macros">

              ${
                calories !== ''
                  ? `
                    <span>
                      <strong>
                        ${escapeHtml(calories)}
                      </strong>
                      kcal
                    </span>
                  `
                  : ''
              }


              ${
                protein !== ''
                  ? `
                    <span>
                      <strong>
                        ${escapeHtml(protein)}
                      </strong>
                      protein
                    </span>
                  `
                  : ''
              }


              ${
                carbs !== ''
                  ? `
                    <span>
                      <strong>
                        ${escapeHtml(carbs)}
                      </strong>
                      carbs
                    </span>
                  `
                  : ''
              }

            
              ${
                fats !== ''
                  ? `
                    <span>
                      <strong>
                        ${escapeHtml(fats)}
                      </strong>
                      fats
                    </span>
                  `
                  : ''
              }

              <div class="meal-completion">
                <button
                  class="meal-complete-btn ${isCompleted ? 'completed' : ''}"
                  data-meal-name="${escapeHtml(title)}"
                  ${isCompleted ? 'disabled' : ''}
                >
                  ${isCompleted ? '✓ Completed today' : 'Mark as Done'}
                </button>
              </div>
            </div>

          </article>

        `;
      }
    )
    .join('');
}


/* =========================================================
   MEAL LABELS
========================================================= */

function getMealLabel(index) {

  const labels = [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snack'
  ];

  return labels[index] ||
    `Meal ${index + 1}`;
}


/* =========================================================
   MEAL ICONS
========================================================= */

function getMealIcon(title, index) {

  const text =
    String(title)
      .toLowerCase();


  if (
    text.includes('breakfast') ||
    index === 0
  ) {

    return `
      <span>☀️</span>
    `;
  }


  if (
    text.includes('lunch') ||
    index === 1
  ) {

    return `
      <span>🥗</span>
    `;
  }


  if (
    text.includes('dinner') ||
    index === 2
  ) {

    return `
      <span>🌙</span>
    `;
  }


  if (
    text.includes('snack') ||
    index === 3
  ) {

    return `
      <span>🍎</span>
    `;
  }


  return `
    <span>🍽️</span>
  `;
}


/* =========================================================
   REGENERATE
========================================================= */

async function regeneratePlan() {

  const button =
    document.getElementById(
      'regenerateDietBtn'
    );

  if (!button) return;


  setButtonLoading(
    button,
    true,
    'Regenerating...'
  );


  /*
   * Backend route:
   * POST /api/plans/diet/regenerate
   */

  const result =
    await api.post(
      '/plans/diet/regenerate'
    );


  setButtonLoading(
    button,
    false
  );


  if (!result.success) {

    showToast(
      result.error?.message ||
      'Could not regenerate the diet plan.',
      'error'
    );

    return;
  }


  currentPlan =
    result.data;


  renderPlan(
    document.getElementById('page'),
    currentPlan
  );


  showToast(
    'Your diet plan has been regenerated.',
    'success'
  );
}


/* =========================================================
   GENERATED VIA LABEL
========================================================= */

function formatGeneratedVia(value) {

  if (!value) return '';

  if (value === 'llm') {
    return 'AI ✦';
  }

  if (
    value === 'rule_based_fallback'
  ) {
    return 'Rule-based fallback';
  }

  if (
    value === 'rule_based'
  ) {
    return 'Rule-based';
  }

  return String(value);
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {

  currentPlan = null;

}