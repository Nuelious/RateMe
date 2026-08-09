import { supabase, generateShareCode, getUserProfile } from './supabaseClient.js';
import { showToast, setButtonLoading } from './ui.js';

export const PREDEFINED_TRAITS = [
  { key: 'confident', label: 'Confident', icon: 'fa-solid fa-crown' },
  { key: 'funny', label: 'Funny', icon: 'fa-solid fa-face-laugh-beam' },
  { key: 'kind', label: 'Kind', icon: 'fa-solid fa-heart' },
  { key: 'smart', label: 'Smart', icon: 'fa-solid fa-brain' },
  { key: 'creative', label: 'Creative', icon: 'fa-solid fa-palette' },
  { key: 'loyal', label: 'Loyal', icon: 'fa-solid fa-shield-heart' },
  { key: 'ambitious', label: 'Ambitious', icon: 'fa-solid fa-rocket' },
  { key: 'chill', label: 'Chill', icon: 'fa-solid fa-leaf' },
  { key: 'honest', label: 'Honest', icon: 'fa-solid fa-comment-dots' },
  { key: 'adventurous', label: 'Adventurous', icon: 'fa-solid fa-mountain' },
  { key: 'organized', label: 'Organized', icon: 'fa-solid fa-list-check' },
  { key: 'charismatic', label: 'Charismatic', icon: 'fa-solid fa-star' },
  { key: 'empathetic', label: 'Empathetic', icon: 'fa-solid fa-hand-holding-heart' },
  { key: 'stylish', label: 'Stylish', icon: 'fa-solid fa-shirt' },
  { key: 'competitive', label: 'Competitive', icon: 'fa-solid fa-trophy' },
  { key: 'mysterious', label: 'Mysterious', icon: 'fa-solid fa-mask' },
  { key: 'reliable', label: 'Reliable', icon: 'fa-solid fa-handshake' },
  { key: 'energetic', label: 'Energetic', icon: 'fa-solid fa-bolt' }
];

const MAX_TRAITS = 15;
const MIN_TRAITS = 3;
let selectedTraits = new Set();

export function initCreateProfile({ onProfileCreated } = {}) {
  const grid = document.getElementById('trait-grid');
  const nameInput = document.getElementById('profile-name-input');
  const customInput = document.getElementById('custom-trait-input');
  const addCustomBtn = document.getElementById('add-custom-trait-btn');
  const createBtn = document.getElementById('create-profile-btn');
  const counter = document.getElementById('trait-counter');
  const customTraitsWrap = document.getElementById('custom-traits-list');

  if (!grid) return;

  grid.innerHTML = PREDEFINED_TRAITS.map(t => traitCardHtml(t.key, t.label, t.icon)).join('');
  updateCounter();

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.trait-card');
    if (!card) return;
    toggleTrait(card.dataset.trait, card);
  });

  addCustomBtn?.addEventListener('click', () => addCustomTrait());
  customInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTrait();
    }
  });

  function addCustomTrait() {
    const label = customInput.value.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, '-');
    if (selectedTraits.has(key)) {
      showToast('That trait is already added.', 'info', 2000);
      customInput.value = '';
      return;
    }
    if (selectedTraits.size >= MAX_TRAITS) {
      showToast(`You can select up to ${MAX_TRAITS} traits.`, 'error');
      return;
    }
    selectedTraits.add(key);

    const chip = document.createElement('div');
    chip.className = 'custom-trait-chip';
    chip.dataset.trait = key;
    chip.innerHTML = `
      <i class="fa-solid fa-tag"></i>
      <span>${escapeHtml(label)}</span>
      <button type="button" class="remove-chip-btn" aria-label="Remove trait">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    chip.querySelector('.remove-chip-btn').addEventListener('click', () => {
      selectedTraits.delete(key);
      chip.remove();
      updateCounter();
    });
    customTraitsWrap.appendChild(chip);
    customInput.value = '';
    updateCounter();
  }

  createBtn?.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Please enter your name.', 'error');
      nameInput.focus();
      return;
    }
    if (selectedTraits.size < MIN_TRAITS) {
      showToast(`Select at least ${MIN_TRAITS} traits.`, 'error');
      return;
    }

    setButtonLoading(createBtn, true, 'Creating profile…');

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user) {
        throw new Error('You must be logged in to create a profile.');
      }

      const userProfile = await getUserProfile(userData.user.id);
      const shareCode = generateShareCode();
      const traitsArray = Array.from(selectedTraits);

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          name,
          username: userProfile?.username || null,
          traits: traitsArray,
          share_code: shareCode,
          owner_id: userData.user.id
        })
        .select()
        .single();

      if (error) throw error;

      showToast('Profile created!', 'success');
      onProfileCreated?.(data);
    } catch (err) {
      showToast(err.message || 'Failed to create profile.', 'error');
    } finally {
      setButtonLoading(createBtn, false);
    }
  });

  function toggleTrait(key, cardEl) {
    if (selectedTraits.has(key)) {
      selectedTraits.delete(key);
      cardEl.classList.remove('selected');
    } else {
      if (selectedTraits.size >= MAX_TRAITS) {
        showToast(`You can select up to ${MAX_TRAITS} traits.`, 'error');
        return;
      }
      selectedTraits.add(key);
      cardEl.classList.add('selected');
    }
    updateCounter();
  }

  function updateCounter() {
    if (counter) {
      counter.textContent = `${selectedTraits.size} / ${MAX_TRAITS} selected (min ${MIN_TRAITS})`;
    }
  }
}

function traitCardHtml(key, label, icon) {
  return `
    <button type="button" class="trait-card" data-trait="${key}">
      <i class="${icon}"></i>
      <span>${label}</span>
      <span class="trait-check"><i class="fa-solid fa-circle-check"></i></span>
    </button>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

export async function getExistingProfileForUser(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) return null;
  return data;
}
