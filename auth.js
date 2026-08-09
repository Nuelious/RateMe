import { supabase, getUserProfile, updateActivity } from './supabaseClient.js';
import { showToast, setButtonLoading, setFieldError, clearFieldError } from './ui.js';

export function initAuthForms({ onAuthenticated } = {}) {
  const authSection = document.getElementById('auth-section');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const showSignupBtn = document.getElementById('show-signup');
  const showLoginBtn = document.getElementById('show-login');
  const logoutBtn = document.getElementById('logout-btn');

  showSignupBtn?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  });
  showLoginBtn?.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  /* ---------- LOGIN ---------- */
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    clearFieldError(emailInput);
    clearFieldError(passInput);

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!isValidEmail(email)) {
      setFieldError(emailInput, 'Enter a valid email address.');
      return;
    }
    if (!password) {
      setFieldError(passInput, 'Password is required.');
      return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Logging in…');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setButtonLoading(submitBtn, false);

    if (error) {
      showToast(error.message || 'Login failed.', 'error');
      return;
    }

    // Ensure user_profiles row exists (catches email-confirmation signups)
    await ensureUserProfileRow(data.user);
    await updateActivity();

    showToast('Welcome back!', 'success');
    onAuthenticated?.(data.user);
  });

  /* ---------- SIGNUP ---------- */
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('signup-email');
    const passInput = document.getElementById('signup-password');
    const confirmInput = document.getElementById('signup-password-confirm');
    const usernameInput = document.getElementById('signup-username');

    clearFieldError(emailInput);
    clearFieldError(passInput);
    clearFieldError(confirmInput);
    clearFieldError(usernameInput);

    const email = emailInput.value.trim();
    const password = passInput.value;
    const confirm = confirmInput.value;
    const username = usernameInput?.value.trim();

    if (!isValidEmail(email)) {
      setFieldError(emailInput, 'Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setFieldError(passInput, 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setFieldError(confirmInput, 'Passwords do not match.');
      return;
    }
    if (!username || username.length < 2) {
      setFieldError(usernameInput, 'Username must be at least 2 characters.');
      return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true, 'Creating account…');

    const { data, error } = await supabase.auth.signUp({ email, password });
    setButtonLoading(submitBtn, false);

    if (error) {
      showToast(error.message || 'Signup failed.', 'error');
      return;
    }

    /* 
      Email confirmation ON  → no session. Save username for later, show message.
      Email confirmation OFF → session exists. Create profile immediately.
    */
    if (!data.session) {
      localStorage.setItem('pending_username', username);
      showToast('Account created! Check your email to confirm, then log in.', 'success', 6000);
      signupForm.classList.add('hidden');
      loginForm?.classList.remove('hidden');
      return;
    }

    // Immediate session — safe to insert into user_profiles
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .insert({ id: data.user.id, username });

    if (profileErr) {
      // Real uniqueness conflict or DB issue
      console.error(profileErr);
      showToast(profileErr.message.includes('unique') 
        ? 'That username is taken. Try another.' 
        : 'Profile setup failed. Please try again.', 'error');
      return;
    }

    localStorage.removeItem('pending_username');
    showToast('Account created!', 'success');
    onAuthenticated?.(data.user);
  });

  /* ---------- LOGOUT ---------- */
  logoutBtn?.addEventListener('click', async () => {
    setButtonLoading(logoutBtn, true, 'Logging out…');
    localStorage.removeItem('pending_username');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  /* ---------- EXISTING SESSION ---------- */
  supabase.auth.getUser().then(async ({ data }) => {
    if (data?.user) {
      await ensureUserProfileRow(data.user);
      authSection?.classList.add('hidden');
      onAuthenticated?.(data.user);
    }
  });
}

/* Helper: create user_profiles row if missing (uses pending_username from localStorage) */
async function ensureUserProfileRow(user) {
  const existing = await getUserProfile(user.id);
  if (existing) return existing;

  const pending = localStorage.getItem('pending_username');
  const fallback = 'user_' + Math.random().toString(36).slice(2, 8);
  const username = pending || fallback;

  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ id: user.id, username })
    .select()
    .single();

  if (error) {
    console.warn('Could not auto-create user_profiles on login:', error.message);
    return null;
  }

  localStorage.removeItem('pending_username');
  return data;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
