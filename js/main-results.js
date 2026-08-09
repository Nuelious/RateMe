// main-results.js
// Page controller for results.html.

import { applySavedAppearance, initSettingsPanel } from './settings.js';
import { initResultsPage } from './results.js';

applySavedAppearance();

initResultsPage().then((profile) => {
  if (!profile) return;
  initSettingsPanel({
    profile,
    onProfileUpdated: (updated) => {
      document.getElementById('owner-profile-name').textContent = updated.name;
    },
    onProfileDeleted: () => {
      window.location.href = 'index.html';
    }
  });
});
