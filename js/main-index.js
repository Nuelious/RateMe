// main-index.js
// Page controller for index.html — wires together auth.js, createProfile.js,
// and settings.js. Not imported anywhere else.

import { applySavedAppearance, initSettingsPanel } from './settings.js';
import { initAuthForms } from './auth.js';
import { initCreateProfile, getExistingProfileForUser } from './createProfile.js';

applySavedAppearance();
initSettingsPanel();

const authSection = document.getElementById('auth-section');
const createSection = document.getElementById('create-profile-section');
const existingSection = document.getElementById('existing-profile-section');
const logoutBtn = document.getElementById('logout-btn');

initCreateProfile({
  onProfileCreated: () => {
    window.location.href = 'results.html';
  }
});

initAuthForms({
  onAuthenticated: async (user) => {
    authSection?.classList.add('hidden');
    logoutBtn?.classList.remove('hidden');

    const existing = await getExistingProfileForUser(user.id);
    if (existing) {
      document.getElementById('existing-profile-name').textContent = existing.name;
      existingSection?.classList.remove('hidden');
      createSection?.classList.add('hidden');
    } else {
      createSection?.classList.remove('hidden');
      existingSection?.classList.add('hidden');
    }
  }
});
