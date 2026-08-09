// main-game.js
// Page controller for game.html.

import { applySavedAppearance, initSettingsPanel } from './settings.js';
import { initGamePage } from './miniGame.js';

applySavedAppearance();
initSettingsPanel();
initGamePage();
