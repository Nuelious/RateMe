import { supabase } from './supabaseClient.js';
import { showToast, setButtonLoading } from './ui.js';

const STORAGE_KEYS = {
  theme: 'ppr_theme',
  cardStyle: 'ppr_card_style'
};

export const THEMES = [
  'dark', 'light', 'neon', 'space', 'night', 'sunny', 'cloudy', 'aurora',
  'desert', 'rain', 'forest', 'ocean', 'sunset', 'winter', 'candy', 'mono',
  'cyber', 'vintage', 'lavender', 'fire', 'gold', 'matrix', 'rose'
];

export const CARD_STYLES = [
  'default', 'glass', 'glassmorphism', 'neumorphism', 'gradient', 'outline',
  'elevated', 'flat', 'frost', 'striped', 'ribbon', 'image_overlay',
  'border_animated', 'minimal', 'tagged', 'stacked', 'glow', 'divider',
  'round', 'sharp', 'parallax', 'holo'
];

const THEME_LABELS = {
  dark: 'Dark', light: 'Light', neon: 'Neon', space: 'Space', night: 'Night',
  sunny: 'Sunny', cloudy: 'Cloudy', aurora: 'Aurora', desert: 'Desert',
  rain: 'Rain', forest: 'Forest', ocean: 'Ocean', sunset: 'Sunset',
  winter: 'Winter', candy: 'Candy', mono: 'Mono', cyber: 'Cyber',
  vintage: 'Vintage', lavender: 'Lavender', fire: 'Fire', gold: 'Gold',
  matrix: 'Matrix', rose: 'Rose'
};

const CARD_LABELS = {
  default: 'Default', glass: 'Glass', glassmorphism: 'Glassmorphism',
  neumorphism: 'Neumorphism', gradient: 'Gradient', outline: 'Outline',
  elevated: 'Elevated', flat: 'Flat', frost: 'Frost', striped: 'Striped',
  ribbon: 'Ribbon', image_overlay: 'Image Overlay', border_animated: 'Animated Border',
  minimal: 'Minimal', tagged: 'Tagged', stacked: 'Stacked', glow: 'Glow',
  divider: 'Divider', round: 'Round', sharp: 'Sharp', parallax: 'Parallax', holo: 'Holo'
};

let themeLinkEl = null;
let cardLinkEl = null;

export function getSavedTheme() {
  return localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
}

export function getSavedCardStyle() {
  return localStorage.getItem(STORAGE_KEYS.cardStyle) || 'default';
}

export function applySavedAppearance() {
  applyTheme(getSavedTheme(), false);
  applyCardStyle(getSavedCardStyle(), false);
}

export function applyTheme(themeName, persist = true) {
  if (!THEMES.includes(themeName)) themeName = 'dark';
  if (!themeLinkEl) {
    themeLinkEl = document.getElementById('theme-stylesheet');
  }
  if (!themeLinkEl) {
    themeLinkEl = document.createElement('link');
    themeLinkEl.rel = 'stylesheet';
    themeLinkEl.id = 'theme-stylesheet';
    document.head.appendChild(themeLinkEl);
  }
  themeLinkEl.href = `css/theme_${themeName}.css`;
  document.documentElement.setAttribute('data-theme', themeName);
  if (persist) localStorage.setItem(STORAGE_KEYS.theme, themeName);
}

export function applyCardStyle(styleName, persist = true) {
  if (!CARD_STYLES.includes(styleName)) styleName = 'default';
  if (!cardLinkEl) {
    cardLinkEl = document.getElementById('card-stylesheet');
  }
  if (!cardLinkEl) {
    cardLinkEl = document.createElement('link');
    cardLinkEl.rel = 'stylesheet';
    cardLinkEl.id = 'card-stylesheet';
    document.head.appendChild(cardLinkEl);
  }
  cardLinkEl.href = `css/card_${styleName}.css`;
  document.documentElement.setAttribute('data-card-style', styleName);
  if (persist) localStorage.setItem(STORAGE_KEYS.cardStyle, styleName);
}

export function initSettingsPanel(options = {}) {
  const panel = document.getElementById('settings-panel');
  const openBtn = document.getElementById('settings-toggle');
  const closeBtn = document.getElementById('settings-close');
  const overlay = document.getElementById('settings-overlay');

  const themeGrid = document.getElementById('theme-grid');
  const cardGrid = document.getElementById('card-style-grid');

  if (themeGrid) {
    themeGrid.innerHTML = THEMES.map(t => `
      <button class="swatch-btn theme-swatch theme-swatch-${t}" data-theme="${t}" type="button" title="${THEME_LABELS[t]}">
        <span class="swatch-preview"></span>
        <span class="swatch-label">${THEME_LABELS[t]}</span>
      </button>
    `).join('');
    highlightActive(themeGrid, 'theme', getSavedTheme());

    themeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      const theme = btn.dataset.theme;
      applyTheme(theme);
      highlightActive(themeGrid, 'theme', theme);
      showToast(`Theme changed to ${THEME_LABELS[theme]}`, 'success', 1800);
    });
  }

  if (cardGrid) {
    cardGrid.innerHTML = CARD_STYLES.map(c => `
      <button class="swatch-btn card-swatch" data-card="${c}" type="button" title="${CARD_LABELS[c]}">
        <span class="swatch-card-preview">Card</span>
        <span class="swatch-label">${CARD_LABELS[c]}</span>
      </button>
    `).join('');
    highlightActive(cardGrid, 'card', getSavedCardStyle());

    cardGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      const style = btn.dataset.card;
      applyCardStyle(style);
      highlightActive(cardGrid, 'card', style);
      showToast(`Card style changed to ${CARD_LABELS[style]}`, 'success', 1800);
    });
  }

  function highlightActive(grid, kind, value) {
    grid.querySelectorAll('.swatch-btn').forEach(b => {
      b.classList.toggle('active', b.dataset[kind] === value);
    });
  }

  function openPanel() {
    panel?.classList.add('open');
    overlay?.classList.add('open');
  }
  function closePanel() {
    panel?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  if (panel) {
    openBtn?.addEventListener('click', openPanel);
    closeBtn?.addEventListener('click', closePanel);
    overlay?.addEventListener('click', closePanel);
  }

  // ---- Profile editing ----
  document.getElementById('profile-settings-block')?.classList.toggle('hidden', !options.profile);
  document.getElementById('danger-zone-block')?.classList.toggle('hidden', !options.profile);

  const nameForm = document.getElementById('settings-name-form');
  if (nameForm && options.profile) {
    const nameInput = document.getElementById('settings-name-input');
    if (nameInput) nameInput.value = options.profile.name || '';

    nameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = nameForm.querySelector('button[type="submit"]');
      const newName = nameInput.value.trim();
      if (!newName) {
        showToast('Name cannot be empty', 'error');
        return;
      }
      setButtonLoading(submitBtn, true, 'Saving…');
      const { data, error } = await supabase
        .from('profiles')
        .update({ name: newName })
        .eq('id', options.profile.id)
        .select()
        .single();
      setButtonLoading(submitBtn, false);

      if (error) {
        showToast('Failed to update name: ' + error.message, 'error');
        return;
      }
      showToast('Profile name updated', 'success');
      options.onProfileUpdated?.(data);
    });
  }

  // ---- Delete profile ----
  const deleteBtn = document.getElementById('settings-delete-btn');
  if (deleteBtn && options.profile) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(
        `Delete "${options.profile.name}"? This permanently removes the profile and all its ratings. This cannot be undone.`
      );
      if (!confirmed) return;

      setButtonLoading(deleteBtn, true, 'Deleting…');
      const { error: ratingsErr } = await supabase
        .from('ratings')
        .delete()
        .eq('profile_id', options.profile.id);

      if (ratingsErr) {
        setButtonLoading(deleteBtn, false);
        showToast('Failed to delete ratings: ' + ratingsErr.message, 'error');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', options.profile.id);

      setButtonLoading(deleteBtn, false);

      if (error) {
        showToast('Failed to delete profile: ' + error.message, 'error');
        return;
      }
      showToast('Profile deleted', 'success');
      options.onProfileDeleted?.();
    });
  }
}
