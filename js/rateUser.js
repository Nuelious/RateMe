import { supabase, getCurrentUser } from './supabaseClient.js';
import { showToast, setButtonLoading, fireConfetti, getQueryParam } from './ui.js';

const PREDEFINED_ICONS = {
  confident: 'fa-crown', funny: 'fa-face-laugh-beam', kind: 'fa-heart',
  smart: 'fa-brain', creative: 'fa-palette', loyal: 'fa-shield-heart',
  ambitious: 'fa-rocket', chill: 'fa-leaf', honest: 'fa-comment-dots',
  adventurous: 'fa-mountain', organized: 'fa-list-check', charismatic: 'fa-star',
  empathetic: 'fa-hand-holding-heart', stylish: 'fa-shirt', competitive: 'fa-trophy',
  mysterious: 'fa-mask', reliable: 'fa-handshake', energetic: 'fa-bolt'
};

let profile = null;
let currentIndex = 0;
let ratings = {};
let isAnonymous = true;
let raterName = '';

export async function initRateFlow() {
  const loadingEl = document.getElementById('rate-loading');
  const errorEl = document.getElementById('rate-error');
  const flowEl = document.getElementById('rate-flow');
  const authGateEl = document.getElementById('rate-auth-gate');

  try {
    const shareCode = getQueryParam('code');

    if (!shareCode) {
      hide(loadingEl);
      show(errorEl);
      setErrorMessage('No profile code provided. Ask your friend for their share link.');
      return;
    }

    // Fetch profile (public read, no auth needed)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, traits, share_code, username')
      .eq('share_code', shareCode)
      .maybeSingle();

    hide(loadingEl);

    if (error || !data) {
      show(errorEl);
      setErrorMessage("This profile doesn't exist or the link is invalid.");
      console.error('Supabase profile error:', error);
      return;
    }

    profile = data;

    // Check auth
    const user = await getCurrentUser();

    if (!user) {
      // Show auth gate if it exists in HTML
      if (authGateEl) {
        show(authGateEl);
        initAuthGate(authGateEl, flowEl);
      } else {
        // Fallback if HTML wasn't updated: just show the flow anyway
        show(flowEl);
        renderStep();
        wireControls();
      }
      return;
    }

    // User is logged in — show rating flow
    show(flowEl);
    renderStep();
    wireControls();

  } catch (err) {
    // CRITICAL: always hide loader and show what broke
    hide(loadingEl);
    show(errorEl);
    setErrorMessage('Error: ' + (err?.message || String(err)));
    console.error('initRateFlow crashed:', err);
  }
}

function setErrorMessage(msg) {
  const el = document.getElementById('rate-error-message');
  if (el) el.textContent = msg;
}

function initAuthGate(authEl, flowEl) {
  const loginForm = authEl.querySelector('#rate-login-form');
  const signupForm = authEl.querySelector('#rate-signup-form');
  const showSignup = authEl.querySelector('#rate-show-signup');
  const showLogin = authEl.querySelector('#rate-show-login');

  showSignup?.addEventListener('click', () => {
    loginForm?.classList.add('hidden');
    signupForm?.classList.remove('hidden');
  });
  showLogin?.addEventListener('click', () => {
    signupForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEl.querySelector('#rate-login-email')?.value.trim();
    const pass = authEl.querySelector('#rate-login-password')?.value;
    const btn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(btn, true, 'Logging in…');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setButtonLoading(btn, false);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    hide(authEl);
    show(flowEl);
    initRateFlow(); // restart now that we're logged in
  });

  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEl.querySelector('#rate-signup-email')?.value.trim();
    const pass = authEl.querySelector('#rate-signup-password')?.value;
    const confirm = authEl.querySelector('#rate-signup-password-confirm')?.value;
    const username = authEl.querySelector('#rate-signup-username')?.value.trim();
    const btn = signupForm.querySelector('button[type="submit"]');

    if (pass !== confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (!username || username.length < 2) {
      showToast('Username must be at least 2 characters.', 'error');
      return;
    }

    setButtonLoading(btn, true, 'Signing up…');
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    setButtonLoading(btn, false);

    if (error) {
      showToast(error.message, 'error');
      return;
    }

    // Email confirmation ON = no session yet
    if (!data.session) {
      localStorage.setItem('pending_username', username);
      showToast('Check your email to confirm, then log in here.', 'info', 6000);
      signupForm?.classList.add('hidden');
      loginForm?.classList.remove('hidden');
      return;
    }

    // Email confirmation OFF = create profile immediately
    const { error: profErr } = await supabase
      .from('user_profiles')
      .insert({ id: data.user.id, username });

    if (profErr) {
      showToast(profErr.message.includes('unique') ? 'Username taken.' : 'Setup failed.', 'error');
      return;
    }

    localStorage.removeItem('pending_username');
    hide(authEl);
    show(flowEl);
    initRateFlow();
  });
}

function wireControls() {
  document.getElementById('rate-prev-btn')?.addEventListener('click', goPrev);
  document.getElementById('rate-next-btn')?.addEventListener('click', goNext);
  document.getElementById('rate-submit-btn')?.addEventListener('click', submitRatings);

  const anonToggle = document.getElementById('anonymous-toggle');
  const nameField = document.getElementById('rater-name-field');
  anonToggle?.addEventListener('change', () => {
    isAnonymous = anonToggle.checked;
    nameField?.classList.toggle('hidden', isAnonymous);
  });
  document.getElementById('rater-name-input')?.addEventListener('input', (e) => {
    raterName = e.target.value.trim();
  });
}

function renderStep() {
  const traits = profile.traits;
  const trait = traits[currentIndex];
  const isLast = currentIndex === traits.length - 1;

  const stepEl = document.getElementById('rate-step');
  const progressEl = document.getElementById('rate-progress-bar');
  const progressLabel = document.getElementById('rate-progress-label');
  const icon = PREDEFINED_ICONS[trait] || 'fa-tag';
  const label = formatTraitLabel(trait);

  stepEl.innerHTML = `
    <div class="rate-trait-card">
      <div class="rate-trait-icon"><i class="fa-solid ${icon}"></i></div>
      <h2>${label}</h2>
      <p class="rate-trait-sub">How much would you rate ${escapeHtml(profile.name)} on this trait?</p>
      <div class="star-rating" id="star-rating" role="radiogroup" aria-label="${label} rating">
        ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `
          <button type="button" class="star-btn" data-value="${n}" aria-label="${n} stars">
            <i class="fa-solid fa-star"></i>
          </button>
        `).join('')}
      </div>
      <div class="star-value-label" id="star-value-label">
        ${ratings[trait] ? `${ratings[trait]} / 10` : 'Tap a star to rate'}
      </div>
    </div>
  `;

  const starButtons = stepEl.querySelectorAll('.star-btn');
  paintStars(starButtons, ratings[trait] || 0);

  starButtons.forEach(btn => {
    btn.addEventListener('mouseenter', () => paintStars(starButtons, Number(btn.dataset.value)));
    btn.addEventListener('mouseleave', () => paintStars(starButtons, ratings[trait] || 0));
    btn.addEventListener('click', () => {
      ratings[trait] = Number(btn.dataset.value);
      paintStars(starButtons, ratings[trait]);
      document.getElementById('star-value-label').textContent = `${ratings[trait]} / 10`;
      updateNavButtons();
    });
  });

  progressEl.style.width = `${((currentIndex + 1) / traits.length) * 100}%`;
  progressLabel.textContent = `${currentIndex + 1} of ${traits.length}`;

  document.getElementById('rate-prev-btn').classList.toggle('invisible', currentIndex === 0);
  document.getElementById('rate-next-btn').classList.toggle('hidden', isLast);
  document.getElementById('rate-submit-section').classList.toggle('hidden', !isLast);

  updateNavButtons();
}

function paintStars(buttons, value) {
  buttons.forEach(b => {
    b.classList.toggle('filled', Number(b.dataset.value) <= value);
  });
}

function updateNavButtons() {
  const trait = profile.traits[currentIndex];
  const nextBtn = document.getElementById('rate-next-btn');
  const submitBtn = document.getElementById('rate-submit-btn');
  const hasRating = !!ratings[trait];
  if (nextBtn) nextBtn.disabled = !hasRating;
  if (submitBtn) submitBtn.disabled = !hasRating;
}

function goPrev() {
  if (currentIndex === 0) return;
  currentIndex--;
  renderStep();
}

function goNext() {
  const trait = profile.traits[currentIndex];
  if (!ratings[trait]) {
    showToast('Please give a rating before continuing.', 'error');
    return;
  }
  if (currentIndex < profile.traits.length - 1) {
    currentIndex++;
    renderStep();
  }
}

async function submitRatings() {
  const traits = profile.traits;
  const missing = traits.filter(t => !ratings[t]);
  if (missing.length > 0) {
    showToast('Please rate every trait before submitting.', 'error');
    return;
  }

  const submitBtn = document.getElementById('rate-submit-btn');
  setButtonLoading(submitBtn, true, 'Submitting…');

  try {
    const { data: userData } = await supabase.auth.getUser();
    const raterId = userData?.user?.id || null;

    // Get username if available
    let raterUsername = null;
    if (raterId) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', raterId)
        .maybeSingle();
      raterUsername = prof?.username || null;
    }

    const payload = {
      profile_id: profile.id,
      rater_id: raterId,
      ratings: {
        values: ratings,
        rater_name: isAnonymous ? null : (raterName || raterUsername || null),
        rater_username: isAnonymous ? null : raterUsername,
        anonymous: isAnonymous
      }
    };

    const { error } = await supabase.from('ratings').insert(payload);
    if (error) throw error;

    document.getElementById('rate-flow').classList.add('hidden');
    const successEl = document.getElementById('rate-success');
    show(successEl);
    fireConfetti();
  } catch (err) {
    showToast(err.message || 'Failed to submit ratings.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

function show(el) { el?.classList.remove('hidden'); }
function hide(el) { el?.classList.add('hidden'); }

function formatTraitLabel(key) {
  return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
