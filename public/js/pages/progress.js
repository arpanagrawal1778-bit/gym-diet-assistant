import { api } from '../api.js';
import {
  escapeHtml,
  showLoading,
  showToast,
  setButtonLoading
} from '../components.js';

export async function render(container) {
  showLoading(
    container,
    'Loading your progress...'
  );

  const [
    profileResult,
    weightHistoryResult,
    trendResult,
    progressResult,
    adherenceResult
  ] = await Promise.all([
    api.get('/profile'),
    api.get('/weight?limit=100'),
    api.get('/weight/trend?days=365'),
    api.get('/progress?limit=30'),
    api.get('/adherence/summary')
  ]);

  const profile =
    profileResult.success
      ? profileResult.data
      : null;

  const weightHistory =
    weightHistoryResult.success
      ? weightHistoryResult.data
      : null;

  const trend =
    trendResult.success
      ? trendResult.data
      : null;

  const progress =
    progressResult.success
      ? progressResult.data
      : null;

  const adherence =
    adherenceResult.success
      ? adherenceResult.data
      : null;

  renderPage(container, {
    profile,
    weightHistory,
    trend,
    progress,
    adherence
  });
}


/* =========================================================
   MAIN PAGE
========================================================= */

function renderPage(container, data) {
  const weights =
    normalizeWeights(
      data.weightHistory
    );

  const logs =
    normalizeLogs(
      data.progress
    );

  const adherence =
    normalizeAdherence(
      data.adherence
    );

  const latestWeight =
    getLatestWeight(
      weights
    );

  const previousWeight =
    getPreviousWeight(
      weights
    );

  const startingWeight =
    getStartingWeight(
      data.profile
    );

  const recentChange =
    latestWeight !== null &&
    previousWeight !== null
      ? latestWeight -
        previousWeight
      : null;

  const changeFromStarting =
    latestWeight !== null &&
    startingWeight !== null
      ? latestWeight -
        startingWeight
      : null;


  container.innerHTML = `
    <div class="page-header">

      <div>
        <h1>Progress</h1>

        <p>
          Track your weight, activity and
          consistency over time.
        </p>
      </div>

    </div>


    <!-- =========================================
         SUMMARY
    ========================================== -->

    <section class="stats-grid progress-stats">

      <div class="stat-card">

        <div class="stat-label">
          Current Weight
        </div>

        <div class="stat-value">
          ${
            latestWeight !== null
              ? `${latestWeight.toFixed(1)} kg`
              : startingWeight !== null
                ? `${startingWeight.toFixed(1)} kg`
                : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Change From Starting Weight
        </div>

        <div class="stat-value">
          ${
            changeFromStarting !== null
              ? formatChange(
                  changeFromStarting
                )
              : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Adherence
        </div>

        <div class="stat-value">
          ${
            adherence !== null
              ? `${Math.round(adherence)}%`
              : '—'
          }
        </div>

      </div>


      <div class="stat-card">

        <div class="stat-label">
          Progress Logs
        </div>

        <div class="stat-value">
          ${logs.length}
        </div>

      </div>

    </section>


    <!-- =========================================
         WEIGHT LOG + ADHERENCE
    ========================================== -->

    <section class="grid grid-2">

      <div class="card">

        <div class="card-header">

          <div>

            <h2>
              Log Weight
            </h2>

            <p>
              Add your latest weight measurement.
            </p>

          </div>

        </div>


        <form
          id="weightForm"
          class="progress-form"
        >

          <div class="form-group">

            <label
              for="weightInput"
            >
              Weight (kg)
            </label>

            <input
              id="weightInput"
              type="number"
              min="30"
              max="300"
              step="0.1"
              placeholder="e.g. 65.5"
              required
            >

          </div>


          <div class="form-group">

            <label
              for="weightDate"
            >
              Date
            </label>

            <input
              id="weightDate"
              type="date"
              required
            >

          </div>


          <button
            id="saveWeightBtn"
            type="submit"
            class="btn btn-primary"
          >
            Save Weight
          </button>

        </form>

      </div>


      <div class="card">

        <div class="card-header">

          <div>

            <h2>
              Adherence
            </h2>

            <p>
              Your recent meal and workout consistency.
            </p>

          </div>

        </div>


        ${
          adherence !== null
            ? `
              <div class="adherence-display">

                <div class="adherence-circle">

                  <span>
                    ${Math.round(
                      adherence
                    )}%
                  </span>

                </div>


                <div>

                  <h3>
                    Overall consistency
                  </h3>

                  <p>
                    Based on the meal and workout
                    activity recorded in the app.
                  </p>

                </div>

              </div>
            `
            : `
              <div class="progress-empty-small">

                <div>
                  📊
                </div>

                <p>
                  No adherence activity recorded yet.
                </p>

              </div>
            `
        }

      </div>

    </section>


    <!-- =========================================
         STARTING WEIGHT CHANGE
    ========================================== -->

    ${
      changeFromStarting !== null
        ? `
          <section class="card progress-highlight-card">

            <div>

              <span
                class="progress-highlight-label"
              >
                Change From Starting Weight
              </span>


              <strong
                class="${
                  changeFromStarting > 0
                    ? 'progress-change-up'
                    : changeFromStarting < 0
                      ? 'progress-change-down'
                      : ''
                }"
              >
                ${formatChange(
                  changeFromStarting
                )}
              </strong>

            </div>


            <p>
              Starting weight:
              <strong>
                ${startingWeight.toFixed(1)} kg
              </strong>
            </p>

          </section>
        `
        : ''
    }


    <!-- =========================================
         RECENT CHANGE
    ========================================== -->

    ${
      recentChange !== null
        ? `
          <section class="card">

            <div class="card-header">

              <div>

                <h2>
                  Recent Weight Change
                </h2>

                <p>
                  Difference between your two
                  most recent recorded measurements.
                </p>

              </div>

            </div>


            <div class="progress-recent-change">

              <strong>
                ${formatChange(
                  recentChange
                )}
              </strong>

            </div>

          </section>
        `
        : ''
    }


    <!-- =========================================
         WEIGHT HISTORY
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Weight History
          </h2>

          <p>
            Your recorded weight measurements.
          </p>

        </div>

      </div>


      ${
        weights.length
          ? `
            <div class="weight-history">

              ${weights
                .map(
                  (item, index) =>
                    renderWeightRow(
                      item,
                      index,
                      weights
                    )
                )
                .join('')}

            </div>
          `
          : `
            <div class="progress-empty">

              <div class="progress-empty-icon">
                📈
              </div>

              <h3>
                No weight history yet
              </h3>

              <p>
                Log your first weight measurement
                above to start tracking.
              </p>

            </div>
          `
      }

    </section>


    <!-- =========================================
         ACTIVITY HISTORY
    ========================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Activity History
          </h2>

          <p>
            Your recent progress entries.
          </p>

        </div>

      </div>


      ${
        logs.length
          ? `
            <div class="progress-log-list">

              ${logs
                .map(
                  renderLogRow
                )
                .join('')}

            </div>
          `
          : `
            <div class="progress-empty">

              <div class="progress-empty-icon">
                ✦
              </div>

              <h3>
                No progress logs yet
              </h3>

              <p>
                Your workout and meal activity
                will appear here once recorded.
              </p>

            </div>
          `
      }

    </section>
  `;


  setDefaultDate();


  document
    .getElementById(
      'weightForm'
    )
    ?.addEventListener(
      'submit',
      saveWeight
    );
}


/* =========================================================
   NORMALIZE WEIGHT HISTORY
========================================================= */

function normalizeWeights(data) {
  let source = data;

  if (data?.data) {
    source = data.data;
  }

  if (data?.weights) {
    source = data.weights;
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map(item => ({
      id:
        item.id ??
        null,

      weight: Number(
        item.weight ??
        item.value ??
        item.weight_kg
      ),

      date:
        item.recorded_at ??
        item.date ??
        item.logged_at ??
        item.created_at ??
        item.timestamp ??
        ''
    }))
    .filter(
      item =>
        Number.isFinite(
          item.weight
        )
    )
    .sort(
      (a, b) =>
        new Date(
          b.date || 0
        ) -
        new Date(
          a.date || 0
        )
    );
}


/* =========================================================
   NORMALIZE PROGRESS LOGS
========================================================= */

function normalizeLogs(data) {
  let source = data;

  if (data?.data) {
    source = data.data;
  }

  if (data?.logs) {
    source = data.logs;
  }

  if (data?.progress) {
    source = data.progress;
  }

  if (data?.history) {
    source = data.history;
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .slice(0, 30)
    .map(log => ({
      ...log,

      value_json:
        normalizeValueJson(
          log.value_json
        )
    }));
}


function normalizeValueJson(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return {};
  }

  if (
    typeof value === 'object'
  ) {
    return value;
  }

  try {
    const parsed =
      JSON.parse(value);

    return (
      parsed &&
      typeof parsed === 'object'
        ? parsed
        : {}
    );
  } catch {
    return {};
  }
}


/* =========================================================
   ADHERENCE
========================================================= */

function normalizeAdherence(data) {
  if (
    data === null ||
    data === undefined
  ) {
    return null;
  }

  if (
    typeof data === 'number'
  ) {
    return Number.isFinite(data)
      ? data
      : null;
  }


  const value =
    data.overall_adherence_percentage ??
    data.adherence ??
    data.percentage ??
    data.overall_adherence ??
    data.overall ??
    data.averages?.overall_adherence_percentage ??
    data.score;


  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }


  const number =
    Number(value);


  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   WEIGHT HELPERS
========================================================= */

function getLatestWeight(
  weights
) {
  return weights.length
    ? weights[0].weight
    : null;
}


function getPreviousWeight(
  weights
) {
  return weights.length > 1
    ? weights[1].weight
    : null;
}


function getStartingWeight(
  profile
) {
  if (!profile) {
    return null;
  }


  const source =
    profile.profile ||
    profile.data ||
    profile;


  const value =
    Number(
      source.weight
    );


  return Number.isFinite(
    value
  )
    ? value
    : null;
}


function formatChange(
  change
) {
  const sign =
    change > 0
      ? '+'
      : '';

  return `${sign}${change.toFixed(
    1
  )} kg`;
}


/* =========================================================
   WEIGHT ROW
========================================================= */

function renderWeightRow(
  item,
  index,
  weights
) {
  const nextWeight =
    weights[index + 1]?.weight ??
    null;


  const difference =
    nextWeight !== null
      ? item.weight -
        nextWeight
      : null;


  return `
    <div class="weight-row">

      <div class="weight-row-date">

        <span>
          ${escapeHtml(
            formatDate(
              item.date
            )
          )}
        </span>

      </div>


      <div class="weight-row-value">

        <strong>
          ${item.weight.toFixed(
            1
          )} kg
        </strong>


        ${
          difference !== null
            ? `
              <small
                class="${
                  difference > 0
                    ? 'progress-difference-up'
                    : difference < 0
                      ? 'progress-difference-down'
                      : ''
                }"
              >
                ${formatChange(
                  difference
                )}
              </small>
            `
            : ''
        }

      </div>

    </div>
  `;
}


/* =========================================================
   LOG ROW
========================================================= */

function renderLogRow(
  log
) {
  const type =
    log.log_type ||
    log.type ||
    log.category ||
    'custom';


  const value =
    log.value_json || {};


  const date =
    log.logged_at ||
    log.date ||
    log.created_at ||
    '';


  const formattedValue =
    formatLogValue(
      value
    );


  return `
    <div class="progress-log-row">

      <div class="progress-log-icon">
        ${getLogIcon(type)}
      </div>


      <div class="progress-log-content">

        <strong>
          ${escapeHtml(
            formatLabel(
              type
            )
          )}
        </strong>


        ${
          formattedValue
            ? `
              <span>
                ${escapeHtml(
                  formattedValue
                )}
              </span>
            `
            : ''
        }

      </div>


      <div class="progress-log-date">
        ${escapeHtml(
          formatDate(date)
        )}
      </div>

    </div>
  `;
}


function formatLogValue(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }


  if (
    typeof value ===
      'string' ||
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return String(value);
  }


  if (
    typeof value ===
      'object' &&
    !Array.isArray(value)
  ) {
    return Object.entries(
      value
    )
      .map(
        ([key, item]) =>
          `${formatLabel(
            key
          )}: ${
            typeof item ===
            'object'
              ? JSON.stringify(
                  item
                )
              : item
          }`
      )
      .join(' • ');
  }


  return String(value);
}


/* =========================================================
   ICONS
========================================================= */

function getLogIcon(
  type
) {
  const text =
    String(type)
      .toLowerCase();


  if (
    text.includes(
      'weight'
    )
  ) {
    return '⚖️';
  }


  if (
    text.includes(
      'workout'
    )
  ) {
    return '🏋️';
  }


  if (
    text.includes(
      'meal'
    )
  ) {
    return '🍽️';
  }


  if (
    text.includes(
      'measurement'
    )
  ) {
    return '📏';
  }


  if (
    text.includes(
      'photo'
    )
  ) {
    return '📸';
  }


  return '✦';
}


/* =========================================================
   FORMATTING
========================================================= */

function formatLabel(
  value
) {
  return String(
    value ||
      'Progress'
  )
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


function formatDate(
  value
) {
  if (!value) {
    return 'Date not available';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }


  return date.toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );
}


/* =========================================================
   DEFAULT DATE
========================================================= */

function setDefaultDate() {
  const input =
    document.getElementById(
      'weightDate'
    );


  if (!input) {
    return;
  }


  const today =
    new Date();


  const yyyy =
    today.getFullYear();


  const mm =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const dd =
    String(
      today.getDate()
    ).padStart(
      2,
      '0'
    );


  input.value =
    `${yyyy}-${mm}-${dd}`;
}


/* =========================================================
   SAVE WEIGHT
========================================================= */

async function saveWeight(
  event
) {
  event.preventDefault();


  const weightInput =
    document.getElementById(
      'weightInput'
    );


  const dateInput =
    document.getElementById(
      'weightDate'
    );


  const button =
    document.getElementById(
      'saveWeightBtn'
    );


  const weight =
    Number(
      weightInput?.value
    );


  const date =
    dateInput?.value;


  if (
    !Number.isFinite(
      weight
    ) ||
    weight < 30 ||
    weight > 300
  ) {
    showToast(
      'Please enter a valid weight between 30 and 300 kg.',
      'error'
    );

    return;
  }


  if (!date) {
    showToast(
      'Please select a date.',
      'error'
    );

    return;
  }


  const recordedAt =
    new Date(
      `${date}T12:00:00`
    );


  if (
    Number.isNaN(
      recordedAt.getTime()
    )
  ) {
    showToast(
      'Please select a valid date.',
      'error'
    );

    return;
  }


  if (
    recordedAt >
    new Date()
  ) {
    showToast(
      'Weight date cannot be in the future.',
      'error'
    );

    return;
  }


  setButtonLoading(
    button,
    true,
    'Saving...'
  );


  const result =
    await api.post(
      '/weight',
      {
        weight,
        recorded_at:
          recordedAt.toISOString()
      }
    );


  setButtonLoading(
    button,
    false,
    'Save Weight'
  );


  if (!result.success) {
    showToast(
      result.error?.message ||
      'Could not save your weight.',
      'error'
    );

    return;
  }


  showToast(
    'Weight recorded successfully.',
    'success'
  );


  await render(
    document.getElementById(
      'page'
    )
  );
}


export function destroy() {}