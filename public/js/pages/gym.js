import { api } from '../api.js';
import {
  escapeHtml,
  showLoading,
  showToast,
  setButtonLoading
} from '../components.js';

let currentPlan = null;
let todayCompletions = new Set();

const DAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun'
];

export async function render(container) {
  currentPlan = null;
  todayCompletions.clear();

  showLoading(
    container,
    'Loading your personalized gym plan...'
  );

  const [result, progressResult] = await Promise.all([
    api.get('/plans/gym'),
    api.get('/progress?log_type=workout_completion&limit=100')
  ]);

  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  if (progressResult.success && progressResult.data) {
    progressResult.data.forEach(log => {
      if (log.value_json?.completed_date === todayIST) {
        todayCompletions.add(log.value_json.workout_name);
      }
    });
  }

  if (!result.success) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Gym Plan</h1>
          <p>Your personalized workout plan.</p>
        </div>
      </div>

      <div class="card">
        <div class="empty-state">
          <h2>Gym plan not available</h2>

          <p>
            ${escapeHtml(
              result.error?.message ||
              'Complete your profile first to generate your gym plan.'
            )}
          </p>

          <a
            href="#/profile"
            class="btn btn-primary"
          >
            Open Profile
          </a>
        </div>
      </div>
    `;

    return;
  }

  currentPlan = result.data;

  renderPlan(
    container,
    currentPlan
  );
}

function renderPlan(container, plan) {
  const data = normalizePlan(plan);

  const today =
    getTodayKey();

  const todayWorkout =
    data.weeklyPlan.find(
      day => normalizeDay(day.day) === today
    ) ||
    data.weeklyPlan[0] ||
    null;

  const todayExercises =
    todayWorkout?.exercises || [];

  container.innerHTML = `
    <div class="page-header">

      <div>
        <h1>Gym Plan</h1>

        <p>
          A personalized workout plan based on
          your goal, experience and profile.
        </p>
      </div>

      <button
        id="regenerateGymBtn"
        class="btn btn-primary"
      >
        ✦ Regenerate Plan
      </button>

    </div>


    <!-- ================================
         PLAN STATS
    ================================= -->

    <section class="stats-grid gym-stats">

      <div class="stat-card">
        <div class="stat-label">
          Goal
        </div>

        <div class="stat-value">
          ${escapeHtml(
            data.goal || '—'
          )}
        </div>
      </div>


      <div class="stat-card">
        <div class="stat-label">
          Experience
        </div>

        <div class="stat-value">
          ${escapeHtml(
            data.experience || '—'
          )}
        </div>
      </div>


      <div class="stat-card">
        <div class="stat-label">
          Plan Type
        </div>

        <div class="stat-value">
          ${escapeHtml(
            data.generatedVia || '—'
          )}
        </div>
      </div>


      <div class="stat-card">
        <div class="stat-label">
          Weekly Days
        </div>

        <div class="stat-value">
          ${data.weeklyPlan.length || '—'}
        </div>
      </div>

    </section>


    <!-- ================================
         TODAY'S WORKOUT
    ================================= -->

    ${
      todayWorkout
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Today's Workout

                  <span class="gym-day-badge">
                    ${escapeHtml(
                      today
                    )}
                  </span>
                </h2>

                <p>
                  Focus:
                  <strong>
                    ${escapeHtml(
                      formatValue(
                        todayWorkout.focus ||
                        'Workout'
                      )
                    )}
                  </strong>
                </p>

              </div>

            </div>


            ${
              todayExercises.length
                ? `
                  <div class="workout-grid">
                    ${renderWorkouts(
                      todayExercises
                    )}
                  </div>
                `
                : `
                  <div class="empty-state">
                    <h3>
                      Recovery Day
                    </h3>

                    <p>
                      Today is a rest or recovery day
                      in your personalized plan.
                    </p>
                  </div>
                `
            }

          </section>
        `
        : `
          <section class="card">

            <div class="empty-state">

              <h2>
                No workout available
              </h2>

              <p>
                Regenerate your plan to create
                a workout routine.
              </p>

            </div>

          </section>
        `
    }


    <!-- ================================
         WEEKLY TABLE
    ================================= -->

    ${
      data.weeklyPlan.length
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Weekly Workout Schedule
                </h2>

                <p>
                  Your complete 7-day
                  personalized routine.
                </p>

              </div>

            </div>


            <div class="table-responsive">

              ${renderWeeklyPlan(
                data.weeklyPlan
              )}

            </div>

          </section>
        `
        : ''
    }


    <!-- ================================
         ALTERNATIVES
    ================================= -->

    ${
      data.alternatives.length
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Exercise Alternatives
                </h2>

                <p>
                  Alternative exercises included
                  in your plan.
                </p>

              </div>

            </div>


            <div class="alternative-list">

              ${data.alternatives
                .map(
                  item => `
                    <div
                      class="alternative-item"
                    >

                      <span
                        class="alternative-icon"
                      >
                        ↔
                      </span>

                      <div>

                        <strong>
                          ${escapeHtml(
                            item.exercise ||
                            item.name ||
                            'Exercise'
                          )}
                        </strong>

                        <span>
                          ${escapeHtml(
                            item.alternative ||
                            item.replacement ||
                            'Alternative exercise'
                          )}
                        </span>

                      </div>

                    </div>
                  `
                )
                .join('')}

            </div>

          </section>
        `
        : ''
    }


    <!-- ================================
         SAFETY NOTE
    ================================= -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Safety Note
          </h2>

          <p>
            Keep your reported limitations in mind.
          </p>

        </div>

      </div>


      <div class="gym-notes">

        ${escapeHtml(
          data.disclaimer ||
          'Stop an exercise if it causes pain. For existing injuries or medical concerns, consult a qualified healthcare professional.'
        )}

      </div>

    </section>


    <!-- ================================
         PLAN NOTES
    ================================= -->

    ${
      data.notes
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Plan Notes
                </h2>

                <p>
                  Additional information
                  for your workout plan.
                </p>

              </div>

            </div>


            <div class="gym-notes">

              ${escapeHtml(
                data.notes
              )}

            </div>

          </section>
        `
        : ''
    }

  `;


  const regenerateBtn =
    document.getElementById(
      'regenerateGymBtn'
    );


  if (regenerateBtn) {

    regenerateBtn.addEventListener(
      'click',
      regeneratePlan
    );

  }

  const completeBtns = container.querySelectorAll('.complete-workout-btn');
  completeBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const workoutName = btn.dataset.workoutName;
      if (!workoutName || btn.disabled) return;

      setButtonLoading(btn, true, 'Saving...');

      const res = await api.post('/progress/workout-complete', { workout_name: workoutName });

      if (!res.success) {
        setButtonLoading(btn, false, 'Mark as Done');
        showToast(res.error?.message || 'Could not complete workout.', 'error');
        return;
      }

      todayCompletions.add(workoutName);
      setButtonLoading(btn, false, '✓ Completed today');
      btn.disabled = true;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary', 'completed');
      showToast(res.message || 'Workout marked as completed', 'success');
    });
  });
}


/* =========================================================
   TODAY'S WORKOUT CARDS
========================================================= */

function renderWorkouts(workouts) {
  return workouts
    .map(
      (workout, index) => {

        const name =
          workout.name ||
          workout.exercise ||
          workout.exercise_name ||
          workout.title ||
          `Exercise ${index + 1}`;


        const sets =
          workout.sets !== undefined &&
          workout.sets !== null
            ? workout.sets
            : '';


        const reps =
          workout.reps ||
          workout.repetitions ||
          '';


        const duration =
          workout.duration ||
          workout.time ||
          '';


        const rest =
          workout.rest ||
          workout.rest_time ||
          '';


        const muscle =
          workout.muscle_group ||
          workout.muscle_groups ||
          workout.target ||
          workout.muscle ||
          '';


        const description =
          workout.description ||
          workout.instructions ||
          workout.notes ||
          '';


        return `
          <article
            class="workout-card"
          >

            <div
              class="workout-card-top"
            >

              <div
                class="workout-icon"
              >
                ⚡
              </div>


              <div
                class="workout-heading"
              >

                <h3>
                  ${escapeHtml(name)}
                </h3>


                ${
                  Array.isArray(muscle)
                    ? muscle.length
                      ? `
                        <span>
                          ${escapeHtml(
                            muscle.join(', ')
                          )}
                        </span>
                      `
                      : ''
                    : muscle
                      ? `
                        <span>
                          ${escapeHtml(
                            String(muscle)
                          )}
                        </span>
                      `
                      : ''
                }

              </div>

            </div>


            ${
              sets ||
              reps ||
              duration ||
              rest
                ? `
                  <div
                    class="workout-details"
                  >

                    ${
                      sets
                        ? `
                          <div
                            class="workout-detail"
                          >

                            <span>
                              Sets
                            </span>

                            <strong>
                              ${escapeHtml(
                                String(sets)
                              )}
                            </strong>

                          </div>
                        `
                        : ''
                    }


                    ${
                      reps
                        ? `
                          <div
                            class="workout-detail"
                          >

                            <span>
                              Reps
                            </span>

                            <strong>
                              ${escapeHtml(
                                String(reps)
                              )}
                            </strong>

                          </div>
                        `
                        : ''
                    }


                    ${
                      duration
                        ? `
                          <div
                            class="workout-detail"
                          >

                            <span>
                              Duration
                            </span>

                            <strong>
                              ${escapeHtml(
                                String(duration)
                              )}
                            </strong>

                          </div>
                        `
                        : ''
                    }


                    ${
                      rest
                        ? `
                          <div
                            class="workout-detail"
                          >

                            <span>
                              Rest
                            </span>

                            <strong>
                              ${escapeHtml(
                                String(rest)
                              )}
                            </strong>

                          </div>
                        `
                        : ''
                    }

                  </div>
                `
                : ''
            }


            ${
              description
                ? `
                  <div
                    class="workout-description"
                  >

                    ${escapeHtml(
                      description
                    )}

                  </div>
                `
                : ''
            }

            <div class="workout-action" style="margin-top: 1rem;">
              <button 
                class="btn ${todayCompletions.has(name) ? 'btn-secondary completed' : 'btn-primary'} complete-workout-btn" 
                data-workout-name="${escapeHtml(name)}"
                ${todayCompletions.has(name) ? 'disabled' : ''}
              >
                ${todayCompletions.has(name) ? '✓ Completed today' : 'Mark as Done'}
              </button>
            </div>

          </article>
        `;
      }
    )
    .join('');
}


/* =========================================================
   WEEKLY TABLE
========================================================= */

function renderWeeklyPlan(weeklyPlan) {

  return `
    <table class="gym-weekly-table">

      <thead>

        <tr>

          <th>
            Day
          </th>

          <th>
            Focus
          </th>

          <th>
            Exercises
          </th>

          <th>
            Sets / Reps
          </th>

        </tr>

      </thead>


      <tbody>

        ${DAYS
          .map(dayName => {

            const day =
              weeklyPlan.find(
                item =>
                  normalizeDay(
                    item.day
                  ) === dayName
              );


            if (!day) {

              return `
                <tr>

                  <td>
                    <strong>
                      ${dayName}
                    </strong>
                  </td>

                  <td>
                    —
                  </td>

                  <td>
                    —
                  </td>

                  <td>
                    —
                  </td>

                </tr>
              `;
            }


            const isRest =
              [
                'rest',
                'recovery',
                'active recovery'
              ].includes(
                String(
                  day.focus || ''
                )
                  .toLowerCase()
                  .trim()
              );


            const exercises =
              Array.isArray(
                day.exercises
              )
                ? day.exercises
                : [];


            return `
              <tr
                ${
                  dayName ===
                  getTodayKey()
                    ? 'class="today-row"'
                    : ''
                }
              >

                <!-- DAY -->

                <td>

                  <div
                    class="gym-day-cell"
                  >

                    <strong>
                      ${escapeHtml(
                        dayName
                      )}
                    </strong>


                    ${
                      dayName ===
                      getTodayKey()
                        ? `
                          <span
                            class="today-badge"
                          >
                            Today
                          </span>
                        `
                        : ''
                    }

                  </div>

                </td>


                <!-- FOCUS -->

                <td>

                  <span
                    class="gym-focus-badge"
                  >
                    ${escapeHtml(
                      formatValue(
                        day.focus ||
                        'Workout'
                      )
                    )}
                  </span>

                </td>


                <!-- EXERCISES -->

                <td>

                  ${
                    isRest
                      ? `
                        <span
                          class="gym-rest-text"
                        >
                          Recovery / Rest Day
                        </span>
                      `
                      : `
                        <div
                          class="gym-table-exercises"
                        >

                          ${
                            exercises.length
                              ? exercises
                                  .map(
                                    exercise => `
                                      <div
                                        class="gym-table-exercise"
                                      >

                                        <strong>
                                          ${escapeHtml(
                                            exercise.name ||
                                            'Exercise'
                                          )}
                                        </strong>


                                        ${
                                          exercise.description
                                            ? `
                                              <small>
                                                ${escapeHtml(
                                                  exercise.description
                                                )}
                                              </small>
                                            `
                                            : ''
                                        }

                                      </div>
                                    `
                                  )
                                  .join('')
                              : `
                                <span>
                                  No exercises
                                </span>
                              `
                          }

                        </div>
                      `
                  }

                </td>


                <!-- SETS / REPS -->

                <td>

                  ${
                    isRest
                      ? `
                        <span>
                          —
                        </span>
                      `
                      : `
                        <div
                          class="gym-table-sets"
                        >

                          ${
                            exercises.length
                              ? exercises
                                  .map(
                                    exercise => `
                                      <div>

                                        ${
                                          exercise.sets
                                            ? `
                                              <strong>
                                                ${escapeHtml(
                                                  String(
                                                    exercise.sets
                                                  )
                                                )}
                                              </strong>
                                              sets
                                            `
                                            : ''
                                        }


                                        ${
                                          exercise.reps
                                            ? `
                                              ×
                                              ${escapeHtml(
                                                String(
                                                  exercise.reps
                                                )
                                              )}
                                            `
                                            : ''
                                        }

                                      </div>
                                    `
                                  )
                                  .join('')
                              : '—'
                          }

                        </div>
                      `
                  }

                </td>

              </tr>
            `;
          })
          .join('')}

      </tbody>

    </table>
  `;
}


/* =========================================================
   NORMALIZE PLAN
========================================================= */

function normalizePlan(plan) {

  const source =
    plan?.plan ||
    plan?.gym_plan ||
    plan?.workout_plan ||
    plan ||
    {};


  let weeklyPlan =
    source.weekly_plan ||
    source.weeklyPlan ||
    [];


  if (!Array.isArray(weeklyPlan)) {
    weeklyPlan = [];
  }


  let alternatives =
    source.alternatives ||
    source.exercise_alternatives ||
    source.replacements ||
    [];


  if (!Array.isArray(alternatives)) {
    alternatives = [];
  }


  return {

    goal:
      formatValue(
        source.goal ||
        source.fitness_goal ||
        source.target
      ),


    experience:
      formatValue(
        source.experience ||
        source.experience_level ||
        source.gym_experience_level
      ),


    generatedVia:
      formatValue(
        source.generated_via ||
        source.source ||
        source.type
      ),


    disclaimer:
      source.disclaimer ||
      '',


    weeklyPlan,


    alternatives,


    notes:
      source.notes ||
      source.instructions ||
      source.additional_notes ||
      ''

  };
}


/* =========================================================
   HELPERS
========================================================= */

function normalizeDay(day) {

  const value =
    String(day || '')
      .trim()
      .toLowerCase();


  const map = {

    mon: 'Mon',
    monday: 'Mon',

    tue: 'Tue',
    tues: 'Tue',
    tuesday: 'Tue',

    wed: 'Wed',
    wednesday: 'Wed',

    thu: 'Thu',
    thurs: 'Thu',
    thursday: 'Thu',

    fri: 'Fri',
    friday: 'Fri',

    sat: 'Sat',
    saturday: 'Sat',

    sun: 'Sun',
    sunday: 'Sun'

  };


  return map[value] || day;
}


function getTodayKey() {

  const dayNumber =
    new Date().getDay();


  const map = {

    0: 'Sun',
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat'

  };


  return map[dayNumber];
}


function formatValue(value) {

  if (!value) {
    return '';
  }


  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char =>
      char.toUpperCase()
    );
}


/* =========================================================
   REGENERATE
========================================================= */

async function regeneratePlan() {

  const button =
    document.getElementById(
      'regenerateGymBtn'
    );


  if (!button) {
    return;
  }


  setButtonLoading(
    button,
    true,
    'Regenerating...'
  );


  const result =
    await api.post(
      '/plans/gym/regenerate'
    );


  setButtonLoading(
    button,
    false,
    '✦ Regenerate Plan'
  );


  if (!result.success) {

    showToast(
      result.error?.message ||
      'Could not regenerate the gym plan.',
      'error'
    );

    return;
  }


  currentPlan =
    result.data;


  const page =
    document.getElementById(
      'page'
    );


  if (page) {

    renderPlan(
      page,
      currentPlan
    );

  }


  showToast(
    'Your gym plan has been regenerated.',
    'success'
  );
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {
  currentPlan = null;
}