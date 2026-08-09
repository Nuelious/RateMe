// main-settings.js
// Page controller for the standalone settings.html page.

import { applySavedAppearance, initSettingsPanel } from './settings.js';
import { supabase, requireAuth } from './supabaseClient.js';
import { getExistingProfileForUser } from './createProfile.js';

applySavedAppearance();

(async () => {
  const user = await requireAuth();
  if (!user) return;

  const profile = await getExistingProfileForUser(user.id);

  initSettingsPanel({
    profile,
    onProfileUpdated: () => {
      // Name saved — nothing else to refresh on this page.
    },
    onProfileDeleted: () => {
      window.location.href = 'index.html';
    }
  });
})();
