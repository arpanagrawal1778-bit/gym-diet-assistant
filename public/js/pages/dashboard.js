/* =========================================================
   DASHBOARD
   Gym & Diet Assistant
========================================================= */

import { api } from '../api.js';
import * as store from '../store.js';

import {
  escapeHtml,
  showLoading,
  showError,
  showToast,
  formatGoal
} from '../components.js';


/* =========================================================
   HELPERS
========================================================= */

function getData(result) {
  if (!result || !result.success) return null;

  return result.data ?? null;
}


function getLatestWeight(progressData) {
  if (!progressData) return null;

  /*
   * Supports different possible backend response shapes.
   */

  if (progressData.weight !== undefined) {
    return progressData.weight;
  }

  if (progressData.latest_weight !== undefined) {
    return progressData.latest_weight;
  }

  if (progressData.latestWeight !== undefined) {
    return progressData.latestWeight;
  }

  if (progressData.latest?.weight !== undefined) {
    return progressData.latest.weight;
  }

  if (progressData.data?.weight !== undefined) {
    return progressData.data.weight;
  }

  if (Array.isArray(progressData) && progressData.length > 0) {
    return progressData[0]?.weight ?? null;
  }

  return null;
}


function getAdherence(adherenceData) {
  if (!adherenceData) return null;

  if (typeof adherenceData === 'number') {
    return adherenceData;
  }

  return (
    adherenceData.overall ??
    adherenceData.adherence ??
    adherenceData.percentage ??
    adherenceData.compliance ??
    adherenceData.overall_adherence ??
    null
  );
}


function formatWeight(weight) {
  if (
    weight === null ||
    weight === undefined ||
    weight === ''
  ) {
    return '—';
  }

  const number = Number(weight);

  if (Number.isNaN(number)) {
    return escapeHtml(weight);
  }

  return `${number.toFixed(1)} kg`;
}


function formatPercentage(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Not tracked yet';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return '—';
  }

  return `${Math.round(number)}%`;
}


/* =========================================================
   RENDER DASHBOARD
========================================================= */

export async function render(container) {

  const user = store.getUser() || {};

  showLoading(
    container,
    'Preparing your personalized dashboard...'
  );


  /*
   * Load dashboard information in parallel.
   */

  const [
    profileResult,
    weightResult,
    adherenceResult
  ] = await Promise.all([
    api.get('/profile'),
    api.get('/weight/latest'),
    api.get('/adherence/summary')
  ]);


  /*
   * If authentication has expired, api.js will handle
   * redirecting to login.
   */

  if (
    !profileResult.success &&
    profileResult.error?.code === 'UNAUTHENTICATED'
  ) {
    return;
  }


  const profile = getData(profileResult) || {};

  const weightData = getData(weightResult);

  const adherenceData = getData(adherenceResult);


  /*
   * Get values.
   */

  const latestWeight =
    getLatestWeight(weightData);

  const goal =
    profile.fitness_goal ||
    profile.goal ||
    null;

  const adherence =
    getAdherence(adherenceData);


  /*
   * User name.
   */

  const name =
    profile.name ||
    user.name ||
    'there';


  /*
   * Render page.
   */

  container.innerHTML = `

    <!-- =====================================================
         PAGE HEADER
    ====================================================== -->

    <div class="page-header">

      <div>

        <h1>
          Welcome back, ${escapeHtml(name)}
        </h1>

        <p>
          Your personalized fitness journey, all in one place.
        </p>

      </div>

    </div>


    <!-- =====================================================
         STATS
    ====================================================== -->

    <section class="stats-grid">

      <!-- Goal -->

      <div class="stat-card">

        <div class="stat-label">
          Fitness Goal
        </div>

        <div class="stat-value">
          ${goal
            ? escapeHtml(formatGoal(goal))
            : 'Not set'}
        </div>

      </div>


      <!-- Weight -->

      <div class="stat-card">

        <div class="stat-label">
          Current Weight
        </div>

        <div class="stat-value">
          ${formatWeight(latestWeight)}
        </div>

      </div>


      <!-- Adherence -->

      <div class="stat-card">

        <div class="stat-label">
          Overall Adherence
        </div>

        <div class="stat-value">
          ${formatPercentage(adherence)}
        </div>

      </div>


      <!-- Profile -->

      <div class="stat-card">

        <div class="stat-label">
          Profile Status
        </div>

        <div class="stat-value">

          ${
            profile.fitness_goal &&
            profile.activity_level
              ? 'Ready'
              : 'Incomplete'
          }

        </div>

      </div>

    </section>


    <!-- =====================================================
         QUICK ACTIONS
    ====================================================== -->

    <section class="card">

      <div class="card-header">

        <div>

          <h2>
            Quick Actions
          </h2>

          <p>
            Jump directly to your personalized plans.
          </p>

        </div>

      </div>


      <div class="grid grid-2">


        <!-- Diet -->

        <a
          href="#/diet"
          class="dashboard-action"
        >

          <div class="dashboard-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path><path d="M12 12v10"></path><path d="M8 22h8"></path><path d="M12 12c-4 0-6 2-6 5s2 5 6 5 6-2 6-5-2-5-6-5z"></path></svg>
          </div>

          <div class="dashboard-action-content">

            <strong>
              View Diet Plan
            </strong>

            <span>
              Check today's personalized meals.
            </span>

          </div>

          <span class="dashboard-action-arrow">
            →
          </span>

        </a>


        <!-- Gym -->

        <a
          href="#/gym"
          class="dashboard-action"
        >

          <div class="dashboard-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11"></path><path d="M6.5 17.5h11"></path><path d="M6 20v-2a6 6 0 1 1 12 0v2"></path><path d="M6 4v2a6 6 0 1 0 12 0V4"></path></svg>
          </div>

          <div class="dashboard-action-content">

            <strong>
              View Gym Plan
            </strong>

            <span>
              Check your personalized workout plan.
            </span>

          </div>

          <span class="dashboard-action-arrow">
            →
          </span>

        </a>


        <!-- Schedule -->

        <a
          href="#/schedule"
          class="dashboard-action"
        >

          <div class="dashboard-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>

          <div class="dashboard-action-content">

            <strong>
              View Schedule
            </strong>

            <span>
              See your college, meals and workouts.
            </span>

          </div>

          <span class="dashboard-action-arrow">
            →
          </span>

        </a>


        <!-- Progress -->

        <a
          href="#/progress"
          class="dashboard-action"
        >

          <div class="dashboard-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </div>

          <div class="dashboard-action-content">

            <strong>
              Track Progress
            </strong>

            <span>
              View your progress and activity history.
            </span>

          </div>

          <span class="dashboard-action-arrow">
            →
          </span>

        </a>

      </div>

    </section>


    <!-- =====================================================
         OVERVIEW
    ====================================================== -->

    <section class="grid grid-2">


      <!-- Profile Overview -->

      <div class="card">

        <div class="card-header">

          <div>

            <h2>
              Your Profile
            </h2>

            <p>
              Information used to personalize your plans.
            </p>

          </div>

          <a
            href="#/profile"
            class="text-link"
          >
            Edit
          </a>

        </div>


        <div class="dashboard-info-list">

          <div class="dashboard-info-row">

            <span>
              Activity Level
            </span>

            <strong>
              ${
                profile.activity_level
                  ? escapeHtml(
                      profile.activity_level
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())
                    )
                  : 'Not set'
              }
            </strong>

          </div>


          <div class="dashboard-info-row">

            <span>
              Gym Experience
            </span>

            <strong>
              ${
                profile.gym_experience_level
                  ? escapeHtml(
                      profile.gym_experience_level
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase())
                    )
                  : 'Not set'
              }
            </strong>

          </div>


          <div class="dashboard-info-row">

            <span>
              College Schedule
            </span>

            <strong>
              ${
                profile.college_start_time &&
                profile.college_end_time
                  ? `${escapeHtml(
                      profile.college_start_time
                    )} – ${escapeHtml(
                      profile.college_end_time
                    )}`
                  : 'Not set'
              }
            </strong>

          </div>


          <div class="dashboard-info-row">

            <span>
              Allergies
            </span>

            <strong>
              ${
                Array.isArray(profile.allergies) &&
                profile.allergies.length
                  ? `${profile.allergies.length} added`
                  : 'None added'
              }
            </strong>

          </div>

        </div>

      </div>


      <!-- Getting Started -->

      <div class="card">

        <div class="card-header">

          <div>

            <h2>
              Your Assistant
            </h2>

            <p>
              Keep your plans up to date.
            </p>

          </div>

        </div>


        <div class="assistant-box">

          <div class="assistant-symbol">
            ✦
          </div>

          <div>

            <h3>
              ${
                profile.fitness_goal
                  ? 'Your profile is ready'
                  : 'Complete your profile'
              }
            </h3>

            <p>
              ${
                profile.fitness_goal
                  ? 'Explore your personalized diet, gym and schedule plans.'
                  : 'Add your fitness and college information so your plans can be personalized.'
              }
            </p>

          </div>

        </div>


        ${
          profile.fitness_goal
            ? `
              <div class="dashboard-bottom-actions">

                <a
                  href="#/diet"
                  class="btn btn-primary"
                >
                  Open Diet Plan
                </a>

                <a
                  href="#/gym"
                  class="btn dashboard-secondary-btn"
                >
                  Open Gym Plan
                </a>

              </div>
            `
            : `
              <div class="dashboard-bottom-actions">

                <a
                  href="#/profile"
                  class="btn btn-primary"
                >
                  Complete Profile
                </a>

              </div>
            `
        }

      </div>

    </section>

  `;


  /*
   * If some non-critical API calls failed,
   * let the user know without breaking the dashboard.
   */

  const failedRequests = [
    profileResult,
    weightResult,
    adherenceResult
  ].filter(
    result => !result.success
  );


  if (failedRequests.length > 0) {

    /*
     * Don't show an alarming error if the page itself
     * rendered successfully.
     */

    console.warn(
      'Some dashboard data could not be loaded.',
      failedRequests
    );
  }
}


/* =========================================================
   DESTROY
========================================================= */

export function destroy() {
  /*
   * No event listeners currently need cleanup.
   */
}