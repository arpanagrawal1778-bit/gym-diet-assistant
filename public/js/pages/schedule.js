import { api } from '../api.js';
import {
  escapeHtml,
  showLoading,
  showToast,
  setButtonLoading
} from '../components.js';

let currentSchedule = null;

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
  currentSchedule = null;

  showLoading(
    container,
    'Loading your smart schedule...'
  );

  const result = await api.get('/schedule');

  if (!result.success) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Smart Schedule</h1>
          <p>
            Your college, meals and workout routine
            in one place.
          </p>
        </div>
      </div>

      <div class="card">
        <div class="empty-state">
          <h2>Schedule not available</h2>

          <p>
            ${escapeHtml(
              result.error?.message ||
              'Complete your profile first to create your schedule.'
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

  currentSchedule = result.data;

  renderSchedule(
    container,
    currentSchedule
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

function renderSchedule(
  container,
  schedule
) {
  const data =
    normalizeSchedule(schedule);

  const today =
    getTodayKey();

  const todayData =
    data.weeklySchedule[today] ||
    null;

  const todayTimeline =
    todayData?.timeline || [];

  container.innerHTML = `
    <div class="page-header">

      <div>

        <h1>
          Smart Schedule
        </h1>

        <p>
          Your college, meals and workout routine
          arranged around your daily timings.
        </p>

      </div>


      <button
        id="regenerateScheduleBtn"
        class="btn btn-primary"
      >
        ✦ Regenerate Schedule
      </button>

    </div>


    <!-- =========================================
         SUMMARY
    ========================================== -->

    <section
      class="schedule-summary-grid"
    >

      <div
        class="schedule-summary-card"
      >

        <div
          class="schedule-summary-icon"
        >
          📚
        </div>

        <div>

          <span>
            College
          </span>

          <strong>
            ${escapeHtml(
              data.collegeTime ||
              'Not set'
            )}
          </strong>

        </div>

      </div>


      <div
        class="schedule-summary-card"
      >

        <div
          class="schedule-summary-icon"
        >
          🍽️
        </div>

        <div>

          <span>
            Meals / Week
          </span>

          <strong>
            ${data.mealCount}
          </strong>

        </div>

      </div>


      <div
        class="schedule-summary-card"
      >

        <div
          class="schedule-summary-icon"
        >
          🏋️
        </div>

        <div>

          <span>
            Workout Days
          </span>

          <strong>
            ${data.workoutDays}
          </strong>

        </div>

      </div>


      <div
        class="schedule-summary-card"
      >

        <div
          class="schedule-summary-icon"
        >
          ${
            data.totalConflicts > 0
              ? '⚠️'
              : '✓'
          }
        </div>

        <div>

          <span>
            Conflicts
          </span>

          <strong class="${
            data.totalConflicts > 0
              ? 'schedule-warning-value'
              : 'schedule-success-value'
          }">
            ${data.totalConflicts}
          </strong>

        </div>

      </div>

    </section>


    <!-- =========================================
         TODAY
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Today's Timeline
          </h2>

          <p>
            ${escapeHtml(
              todayData?.is_college_day
                ? `${today} • College day`
                : `${today} • No college scheduled`
            )}
          </p>

        </div>


        ${
          todayData?.has_conflicts
            ? `
              <span
                class="schedule-conflict-badge"
              >
                ⚠ Schedule overlap
              </span>
            `
            : `
              <span
                class="schedule-clear-badge"
              >
                ✓ No conflicts
              </span>
            `
        }

      </div>


      ${
        todayTimeline.length
          ? `
            <div
              class="smart-timeline"
            >
              ${renderTimeline(
                todayTimeline
              )}
            </div>
          `
          : `
            <div class="schedule-empty">

              <div
                class="schedule-empty-icon"
              >
                📅
              </div>

              <h3>
                No schedule items today
              </h3>

              <p>
                Regenerate your schedule to create
                today's routine.
              </p>

            </div>
          `
      }

    </section>


    <!-- =========================================
         WEEKLY TABLE
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Weekly Schedule
          </h2>

          <p>
            Your complete college, meals and workout
            routine for the week.
          </p>

        </div>

      </div>


      <div class="schedule-table-wrapper">

        ${renderWeeklyTable(
          data.weeklySchedule
        )}

      </div>

    </section>


    <!-- =========================================
         NOTES
    ========================================== -->

    ${
      data.notes
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Schedule Notes
                </h2>

                <p>
                  Additional information
                  about your routine.
                </p>

              </div>

            </div>

            <div class="schedule-notes">
              ${escapeHtml(
                data.notes
              )}
            </div>

          </section>
        `
        : ''
    }


    <!-- =========================================
         DISCLAIMER
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Smart Schedule Note
          </h2>

          <p>
            How this schedule is generated.
          </p>

        </div>

      </div>

      <div class="schedule-notes">

        ${escapeHtml(
          data.disclaimer ||
          'This schedule is automatically generated from your college timings, meals and workout plan.'
        )}

      </div>

    </section>
  `;


  const regenerateBtn =
    document.getElementById(
      'regenerateScheduleBtn'
    );

  if (regenerateBtn) {
    regenerateBtn.addEventListener(
      'click',
      regenerateSchedule
    );
  }
}


/* =========================================================
   WEEKLY TABLE
========================================================= */

function renderWeeklyTable(
  weeklySchedule
) {
  return `
    <table
      class="smart-schedule-table"
    >

      <thead>

        <tr>

          <th>
            Time
          </th>

          ${DAYS.map(
            day => `
              <th
                class="${
                  day === getTodayKey()
                    ? 'schedule-today-column'
                    : ''
                }"
              >

                ${day}

                ${
                  day ===
                  getTodayKey()
                    ? `
                      <span
                        class="schedule-today-label"
                      >
                        Today
                      </span>
                    `
                    : ''
                }

              </th>
            `
          ).join('')}

        </tr>

      </thead>


      <tbody>

        ${buildTimeRows(
          weeklySchedule
        )}

      </tbody>

    </table>
  `;
}


/* =========================================================
   BUILD TABLE ROWS
========================================================= */

function buildTimeRows(
  weeklySchedule
) {
  const timeMap = new Map();


  DAYS.forEach(day => {

    const dayData =
      weeklySchedule[day];

    if (!dayData) {
      return;
    }

    const timeline =
      dayData.timeline || [];

    timeline.forEach(event => {

      if (!event?.start_time) {
        return;
      }

      const time =
        event.start_time;

      if (!timeMap.has(time)) {
        timeMap.set(
          time,
          {}
        );
      }

      timeMap
        .get(time)[day] =
        event;
    });

  });


  const times =
    Array.from(
      timeMap.keys()
    ).sort(
      (a, b) =>
        getMinutes(a) -
        getMinutes(b)
    );


  if (!times.length) {
    return `
      <tr>
        <td
          colspan="8"
          class="schedule-table-empty"
        >
          No timetable data available.
        </td>
      </tr>
    `;
  }


  return times
    .map(time => {

      return `
        <tr>

          <td
            class="schedule-time-cell"
          >
            ${escapeHtml(
              formatTime(time)
            )}
          </td>


          ${DAYS.map(day => {

            const event =
              timeMap
                .get(time)?.[day];


            if (!event) {
              return `
                <td
                  class="${
                    day ===
                    getTodayKey()
                      ? 'schedule-today-column'
                      : ''
                  }"
                >
                  <span
                    class="schedule-free"
                  >
                    —
                  </span>
                </td>
              `;
            }


            const type =
              getItemType(event);


            return `
              <td
                class="${
                  day ===
                  getTodayKey()
                    ? 'schedule-today-column'
                    : ''
                }"
              >

                <div
                  class="schedule-table-event ${type.className}"
                >

                  <div
                    class="schedule-event-title"
                  >
                    ${type.icon}

                    <strong>
                      ${escapeHtml(
                        event.title ||
                        'Activity'
                      )}
                    </strong>
                  </div>


                  <span
                    class="schedule-event-type"
                  >
                    ${escapeHtml(
                      type.label
                    )}
                  </span>


                  ${
                    event.end_time
                      ? `
                        <span
                          class="schedule-event-time"
                        >
                          ${escapeHtml(
                            formatTime(
                              event.start_time
                            )
                          )}
                          –
                          ${escapeHtml(
                            formatTime(
                              event.end_time
                            )
                          )}
                        </span>
                      `
                      : ''
                  }


                  ${
                    event.meal_type
                      ? `
                        <span
                          class="schedule-event-detail"
                        >
                          ${escapeHtml(
                            formatValue(
                              event.meal_type
                            )
                          )}
                        </span>
                      `
                      : ''
                  }


                  ${
                    event.focus
                      ? `
                        <span
                          class="schedule-event-detail"
                        >
                          Focus:
                          ${escapeHtml(
                            formatValue(
                              event.focus
                            )
                          )}
                        </span>
                      `
                      : ''
                  }

                </div>

              </td>
            `;
          }).join('')}

        </tr>
      `;
    })
    .join('');
}


/* =========================================================
   TODAY TIMELINE
========================================================= */

function renderTimeline(
  items
) {
  return items
    .map(
      (item, index) => {

        const title =
          item.title ||
          item.name ||
          item.activity ||
          item.type ||
          `Activity ${
            index + 1
          }`;


        const startTime =
          item.start_time ||
          item.time ||
          item.start ||
          '';


        const endTime =
          item.end_time ||
          item.end ||
          '';


        const description =
          item.description ||
          item.details ||
          '';


        const type =
          getItemType(item);


        return `
          <div
            class="timeline-item"
          >

            <div
              class="timeline-time"
            >

              ${escapeHtml(
                formatTime(
                  startTime
                )
              )}

              ${
                endTime
                  ? `
                    <span>
                      –
                      ${escapeHtml(
                        formatTime(
                          endTime
                        )
                      )}
                    </span>
                  `
                  : ''
              }

            </div>


            <div
              class="timeline-line"
            >

              <div
                class="timeline-dot ${type.className}"
              >
                ${type.icon}
              </div>

            </div>


            <div
              class="timeline-content"
            >

              <div
                class="timeline-content-top"
              >

                <div>

                  <h3>
                    ${escapeHtml(
                      title
                    )}
                  </h3>

                  <span
                    class="timeline-type"
                  >
                    ${escapeHtml(
                      type.label
                    )}
                  </span>

                </div>

              </div>


              ${
                description
                  ? `
                    <p>
                      ${escapeHtml(
                        description
                      )}
                    </p>
                  `
                  : ''
              }

            </div>

          </div>
        `;
      }
    )
    .join('');
}


/* =========================================================
   NORMALIZE SCHEDULE
========================================================= */

function normalizeSchedule(
  schedule
) {
  const source =
    schedule?.schedule ||
    schedule ||
    {};


  let weeklySchedule =
    source.weekly_schedule ||
    source.weeklySchedule ||
    {};


  if (
    Array.isArray(
      weeklySchedule
    )
  ) {
    const converted = {};

    weeklySchedule.forEach(
      dayData => {

        const day =
          normalizeDay(
            dayData.day
          );

        if (day) {
          converted[day] =
            dayData;
        }
      }
    );

    weeklySchedule =
      converted;
  }


  const collegeStart =
    source.profile_info
      ?.college_start_time ||
    source.college_start_time ||
    '';


  const collegeEnd =
    source.profile_info
      ?.college_end_time ||
    source.college_end_time ||
    '';


  const collegeTime =
    collegeStart &&
    collegeEnd
      ? `${formatTime(
          collegeStart
        )} – ${formatTime(
          collegeEnd
        )}`
      : '';


  let mealCount = 0;
  let workoutDays = 0;
  let totalConflicts = 0;


  DAYS.forEach(day => {

    const dayData =
      weeklySchedule[day];


    if (!dayData) {
      return;
    }


    const meals =
      Array.isArray(
        dayData.meals
      )
        ? dayData.meals
        : [];


    if (meals.length) {
      mealCount += meals.length;
    }


    const focus =
      String(
        dayData.workout_focus ||
        ''
      )
        .toLowerCase()
        .trim();


    if (
      dayData.workouts?.length &&
      ![
        'rest',
        'recovery',
        'active recovery'
      ].includes(focus)
    ) {
      workoutDays += 1;
    }


    if (
      Array.isArray(
        dayData.conflicts
      )
    ) {
      totalConflicts +=
        dayData.conflicts.length;
    }

  });


  return {

    weeklySchedule,

    collegeTime,

    mealCount,

    workoutDays,

    totalConflicts,

    notes:
      source.notes ||
      source.additional_notes ||
      '',

    disclaimer:
      source.disclaimer ||
      ''

  };
}


/* =========================================================
   EVENT TYPE
========================================================= */

function getItemType(
  item
) {
  const text =
    String(
      item?.type ||
      item?.category ||
      item?.meal_type ||
      item?.focus ||
      item?.title ||
      item?.name ||
      ''
    ).toLowerCase();


  if (
    text.includes(
      'college'
    ) ||
    text.includes(
      'class'
    ) ||
    text.includes(
      'lecture'
    ) ||
    text.includes(
      'lab'
    )
  ) {
    return {

      icon: '📚',

      label: 'College',

      className:
        'schedule-event-college'

    };
  }


  if (
    text.includes(
      'meal'
    ) ||
    text.includes(
      'breakfast'
    ) ||
    text.includes(
      'lunch'
    ) ||
    text.includes(
      'dinner'
    ) ||
    text.includes(
      'snack'
    )
  ) {
    return {

      icon: '🍽️',

      label: 'Meal',

      className:
        'schedule-event-meal'

    };
  }


  if (
    text.includes(
      'workout'
    ) ||
    text.includes(
      'gym'
    ) ||
    text.includes(
      'exercise'
    ) ||
    text.includes(
      'training'
    ) ||
    [
      'push',
      'pull',
      'legs',
      'cardio'
    ].includes(text)
  ) {
    return {

      icon: '🏋️',

      label: 'Workout',

      className:
        'schedule-event-workout'

    };
  }


  if (
    text.includes(
      'recovery'
    ) ||
    text.includes(
      'rest'
    )
  ) {
    return {

      icon: '🌿',

      label: 'Recovery',

      className:
        'schedule-event-recovery'

    };
  }


  return {

    icon: '✦',

    label: 'Routine',

    className:
      'schedule-event-routine'

  };
}


/* =========================================================
   DAY HELPERS
========================================================= */

function normalizeDay(
  day
) {
  const value =
    String(day || '')
      .trim()
      .toLowerCase();


  const map = {

    mon: 'Mon',
    monday: 'Mon',

    tue: 'Tue',
    tuesday: 'Tue',

    wed: 'Wed',
    wednesday: 'Wed',

    thu: 'Thu',
    thursday: 'Thu',

    fri: 'Fri',
    friday: 'Fri',

    sat: 'Sat',
    saturday: 'Sat',

    sun: 'Sun',
    sunday: 'Sun'

  };


  return (
    map[value] ||
    day
  );
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


  return map[
    dayNumber
  ];
}


/* =========================================================
   TIME HELPERS
========================================================= */

function getMinutes(
  value
) {
  if (!value) {
    return 9999;
  }


  const match =
    String(value).match(
      /(\d{1,2}):(\d{2})/
    );


  if (!match) {
    return 9999;
  }


  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}


function formatTime(
  value
) {
  if (!value) {
    return '';
  }


  const match =
    String(value).match(
      /^(\d{1,2}):(\d{2})/
    );


  if (!match) {
    return String(value);
  }


  let hour =
    Number(match[1]);


  const minute =
    match[2];


  const period =
    hour >= 12
      ? 'PM'
      : 'AM';


  hour =
    hour % 12 || 12;


  return `${hour}:${minute} ${period}`;
}


function formatValue(
  value
) {
  if (!value) {
    return '';
  }


  return String(value)
    .replace(
      /_/g,
      ' '
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}


/* =========================================================
   REGENERATE
========================================================= */

async function regenerateSchedule() {

  const button =
    document.getElementById(
      'regenerateScheduleBtn'
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
      '/schedule/regenerate'
    );


  setButtonLoading(
    button,
    false,
    '✦ Regenerate Schedule'
  );


  if (!result.success) {

    showToast(
      result.error?.message ||
      'Could not regenerate the schedule.',
      'error'
    );

    return;
  }


  currentSchedule =
    result.data;


  const page =
    document.getElementById(
      'page'
    );


  if (page) {

    renderSchedule(
      page,
      currentSchedule
    );

  }


  showToast(
    'Your smart schedule has been regenerated.',
    'success'
  );
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {
  currentSchedule = null;
}