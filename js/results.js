import { supabase, requireAuth } from './supabaseClient.js';
import { showToast, setPanelLoading, renderSocialShare } from './ui.js';
import { getExistingProfileForUser } from './createProfile.js';

const GAME_UNLOCK_THRESHOLD = 8;

let profile = null;
let allRatings = [];
let radarChart = null;
let barChart = null;

export async function initResultsPage() {
  const user = await requireAuth();
  if (!user) return;

  const container = document.getElementById('results-container');
  setPanelLoading(container, true, 'Loading your results…');

  profile = await getExistingProfileForUser(user.id);

  if (!profile) {
    setPanelLoading(container, false);
    document.getElementById('no-profile-state')?.classList.remove('hidden');
    container?.classList.add('hidden');
    return;
  }

  document.getElementById('owner-profile-name').textContent = profile.name;
  const shareUrl = `${window.location.origin}${window.location.pathname.replace('results.html', 'rate.html')}?code=${profile.share_code}`;
  document.getElementById('share-link-value').value = shareUrl;

  wireShareCopy();
  renderSocialShare(
    document.getElementById('results-share-banner'),
    shareUrl,
    `Rate me on RateMe! 🌟 ${profile.name} wants your honest opinion.`
  );

  await loadRatings();
  setPanelLoading(container, false);
  renderDashboard();
  subscribeToLiveRatings();

  return profile;
}

function wireShareCopy() {
  const btn = document.getElementById('copy-share-link-btn');
  const input = document.getElementById('share-link-value');
  btn?.addEventListener('click', async () => {
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      showToast('Share link copied!', 'success', 1800);
    } catch {
      document.execCommand('copy');
      showToast('Share link copied!', 'success', 1800);
    }
  });
}

async function loadRatings() {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Failed to load ratings: ' + error.message, 'error');
    allRatings = [];
    return;
  }
  allRatings = data || [];
}

function subscribeToLiveRatings() {
  supabase
    .channel(`ratings-${profile.id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ratings', filter: `profile_id=eq.${profile.id}` },
      async () => {
        await loadRatings();
        renderDashboard();
        showToast('New rating received!', 'info', 2500);
      }
    )
    .subscribe();

  setInterval(async () => {
    const prevCount = allRatings.length;
    await loadRatings();
    if (allRatings.length !== prevCount) renderDashboard();
  }, 20000);
}

function computeTraitAverages() {
  const sums = {};
  const counts = {};
  profile.traits.forEach(t => { sums[t] = 0; counts[t] = 0; });

  allRatings.forEach(r => {
    const values = r.ratings?.values || {};
    profile.traits.forEach(t => {
      if (typeof values[t] === 'number') {
        sums[t] += values[t];
        counts[t] += 1;
      }
    });
  });

  const averages = {};
  profile.traits.forEach(t => {
    averages[t] = counts[t] > 0 ? sums[t] / counts[t] : 0;
  });
  return averages;
}

function renderDashboard() {
  const averages = computeTraitAverages();
  const labels = profile.traits.map(formatTraitLabel);
  const values = profile.traits.map(t => Number(averages[t].toFixed(2)));

  document.getElementById('total-ratings-count').textContent = allRatings.length;

  renderTopTraits(averages);
  renderRadarChart(labels, values);
  renderBarChart(labels, values);
  renderRatingsList();
  renderSummary(averages);
  renderGameUnlockState();
}

function renderTopTraits(averages) {
  const sorted = Object.entries(averages).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const wrap = document.getElementById('top-traits-list');
  if (!wrap) return;

  if (allRatings.length === 0) {
    wrap.innerHTML = `<p class="empty-hint">No ratings yet — share your link to get started.</p>`;
    return;
  }

  wrap.innerHTML = sorted.map(([trait, avg], i) => `
    <div class="top-trait-item rank-${i + 1}">
      <span class="top-trait-rank">#${i + 1}</span>
      <span class="top-trait-name">${formatTraitLabel(trait)}</span>
      <span class="top-trait-score">${avg.toFixed(1)} / 10</span>
    </div>
  `).join('');
}

function renderRadarChart(labels, values) {
  const ctx = document.getElementById('radar-chart')?.getContext('2d');
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent-color').trim() || '#6c63ff';
  const gridColor = styles.getPropertyValue('--chart-grid-color').trim() || 'rgba(150,150,150,0.25)';
  const textColor = styles.getPropertyValue('--text-color').trim() || '#eee';

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Average Rating',
        data: values,
        backgroundColor: hexToRgba(accent, 0.25),
        borderColor: accent,
        borderWidth: 2,
        pointBackgroundColor: accent
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 10,
          angleLines: { color: gridColor },
          grid: { color: gridColor },
          pointLabels: { color: textColor, font: { size: 11 } },
          ticks: { display: false, stepSize: 2 }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderBarChart(labels, values) {
  const ctx = document.getElementById('bar-chart')?.getContext('2d');
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent-color-2').trim() || '#06d6a0';
  const gridColor = styles.getPropertyValue('--chart-grid-color').trim() || 'rgba(150,150,150,0.25)';
  const textColor = styles.getPropertyValue('--text-color').trim() || '#eee';

  const percentages = values.map(v => Math.round((v / 10) * 100));

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Percentage',
        data: percentages,
        backgroundColor: hexToRgba(accent, 0.65),
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: textColor, callback: v => v + '%' }, grid: { color: gridColor } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderRatingsList() {
  const wrap = document.getElementById('ratings-list');
  if (!wrap) return;

  if (allRatings.length === 0) {
    wrap.innerHTML = `<p class="empty-hint">No one has rated you yet.</p>`;
    return;
  }

  wrap.innerHTML = allRatings.map(r => {
    const values = r.ratings?.values || {};
    const anon = r.ratings?.anonymous !== false;
    const raterName = r.ratings?.rater_name || r.ratings?.rater_username;
    const avg = average(Object.values(values));
    const date = new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return `
      <div class="rating-entry">
        <div class="rating-entry-avatar">
          <i class="fa-solid ${anon ? 'fa-user-secret' : 'fa-user'}"></i>
        </div>
        <div class="rating-entry-info">
          <div class="rating-entry-name">${anon ? 'Anonymous' : escapeHtml(raterName || 'Someone')}</div>
          <div class="rating-entry-date">${date}</div>
        </div>
        <div class="rating-entry-score">${avg.toFixed(1)} / 10</div>
      </div>
    `;
  }).join('');
}

function renderSummary(averages) {
  const el = document.getElementById('personality-summary');
  if (!el) return;

  if (allRatings.length === 0) {
    el.textContent = 'Once people start rating you, a personality summary will appear here.';
    return;
  }

  const sorted = Object.entries(averages).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 2).map(([t]) => formatTraitLabel(t));
  const low = sorted.slice(-1).map(([t]) => formatTraitLabel(t))[0];
  const overallAvg = average(Object.values(averages));

  let tone;
  if (overallAvg >= 8) tone = 'People see you in a remarkably positive light.';
  else if (overallAvg >= 6) tone = 'People generally have a strong, positive impression of you.';
  else if (overallAvg >= 4) tone = 'People see a balanced mix of strengths in you.';
  else tone = "There's room to grow — people are still forming a full picture of you.";

  el.textContent = `Based on ${allRatings.length} rating${allRatings.length === 1 ? '' : 's'}, you're seen as especially ${top.join(' and ')}. ${tone}${low ? ` ${formatTraitLabel(low)} scored comparatively lower — worth reflecting on.` : ''}`;
}

function renderGameUnlockState() {
  const banner = document.getElementById('game-unlock-banner');
  if (!banner) return;

  if (allRatings.length >= GAME_UNLOCK_THRESHOLD) {
    banner.innerHTML = `
      <i class="fa-solid fa-gamepad"></i>
      <span>The Personality Game is unlocked!</span>
      <a href="game.html" class="btn btn-accent btn-sm">
        <i class="fa-solid fa-play"></i> Play Now
      </a>
    `;
    banner.classList.add('unlocked');
  } else {
    const remaining = GAME_UNLOCK_THRESHOLD - allRatings.length;
    banner.innerHTML = `
      <i class="fa-solid fa-lock"></i>
      <span>Get ${remaining} more rating${remaining === 1 ? '' : 's'} to unlock the Personality Game</span>
    `;
    banner.classList.remove('unlocked');
  }
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatTraitLabel(key) {
  return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substring(0, 2), 16) || 108;
  const g = parseInt(hex.substring(2, 4), 16) || 99;
  const b = parseInt(hex.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getCurrentProfile() {
  return profile;
}
export function getCurrentRatings() {
  return allRatings;
}
