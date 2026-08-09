import { supabase, requireAuth } from './supabaseClient.js';
import { showToast, setPanelLoading, fireConfetti, renderSocialShare } from './ui.js';
import { getExistingProfileForUser } from './createProfile.js';

const GAME_UNLOCK_THRESHOLD = 8;
const QUESTION_COUNT = 12;

let profile = null;
let allRatings = [];
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

export async function initGamePage() {
  const user = await requireAuth();
  if (!user) return;

  const container = document.getElementById('game-container');
  setPanelLoading(container, true, 'Loading your data…');

  profile = await getExistingProfileForUser(user.id);

  if (!profile) {
    setPanelLoading(container, false);
    document.getElementById('no-profile-state')?.classList.remove('hidden');
    container?.classList.add('hidden');
    return;
  }

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('profile_id', profile.id);

  setPanelLoading(container, false);

  if (error) {
    showToast('Failed to load ratings: ' + error.message, 'error');
    return;
  }

  allRatings = data || [];

  if (allRatings.length < GAME_UNLOCK_THRESHOLD) {
    const lockedEl = document.getElementById('game-locked-state');
    lockedEl?.classList.remove('hidden');
    document.getElementById('game-locked-count').textContent =
      `${allRatings.length} / ${GAME_UNLOCK_THRESHOLD} ratings`;
    
    const shareUrl = `${window.location.origin}${window.location.pathname.replace('game.html', 'rate.html')}?code=${profile.share_code}`;
    renderSocialShare(
      document.getElementById('game-locked-share'),
      shareUrl,
      `Help me unlock my Personality Game on RateMe! Rate me here:`
    );
    
    container?.classList.add('hidden');
    return;
  }

  questions = buildQuestions();
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  document.getElementById('game-start-screen')?.classList.remove('hidden');
  document.getElementById('game-total-questions').textContent = questions.length;
  document.getElementById('start-game-btn')?.addEventListener('click', startGame);
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

function buildQuestions() {
  const averages = computeTraitAverages();
  const sortedTraits = Object.entries(averages).sort((a, b) => b[1] - a[1]);
  const pool = [];

  if (sortedTraits.length >= 4) {
    const correct = sortedTraits[0][0];
    const distractors = shuffle(sortedTraits.slice(1).map(([t]) => t)).slice(0, 3);
    pool.push(makeMCQ('Which trait scored highest for you?', correct, distractors));
  }

  if (sortedTraits.length >= 4) {
    const correct = sortedTraits[sortedTraits.length - 1][0];
    const distractors = shuffle(sortedTraits.slice(0, -1).map(([t]) => t)).slice(0, 3);
    pool.push(makeMCQ('Which trait scored lowest for you?', correct, distractors));
  }

  profile.traits.forEach(trait => {
    const avg = averages[trait];
    const correctPct = Math.round((avg / 10) * 100);
    const options = generatePercentageOptions(correctPct);
    pool.push({
      type: 'percentage',
      prompt: `What percentage score did you get for "${formatTraitLabel(trait)}"?`,
      options: options.map(p => `${p}%`),
      correctIndex: options.indexOf(correctPct)
    });
  });

  const namedRatings = allRatings.filter(r => r.ratings?.anonymous === false && (r.ratings?.rater_name || r.ratings?.rater_username));
  if (namedRatings.length >= 2) {
    const shuffledNamed = shuffle(namedRatings);
    shuffledNamed.slice(0, 3).forEach(r => {
      const values = r.ratings.values || {};
      const traitEntries = Object.entries(values);
      if (traitEntries.length === 0) return;
      const [trait, traitScore] = traitEntries.sort((a, b) => b[1] - a[1])[0];
      const correctName = r.ratings.rater_name || r.ratings.rater_username;

      const otherNames = shuffle(
        [...new Set(namedRatings.map(x => x.ratings.rater_name || x.ratings.rater_username).filter(n => n && n !== correctName))]
      ).slice(0, 3);

      if (otherNames.length < 2) return;

      const options = shuffle([correctName, ...otherNames]);
      pool.push({
        type: 'who-rated',
        prompt: `Who rated you ${traitScore}/10 on "${formatTraitLabel(trait)}"?`,
        options,
        correctIndex: options.indexOf(correctName)
      });
    });
  }

  const finalPool = pool.filter(q => q.options && q.options.length >= 2 && q.correctIndex >= 0);
  return shuffle(finalPool).slice(0, QUESTION_COUNT);
}

function makeMCQ(prompt, correctTrait, distractorTraits) {
  const options = shuffle([correctTrait, ...distractorTraits]).map(formatTraitLabel);
  const correctIndex = options.indexOf(formatTraitLabel(correctTrait));
  return { type: 'trait', prompt, options, correctIndex };
}

function generatePercentageOptions(correctPct) {
  const options = new Set([correctPct]);
  while (options.size < 4) {
    const offset = (Math.floor(Math.random() * 4) + 1) * 10 * (Math.random() < 0.5 ? -1 : 1);
    let candidate = correctPct + offset;
    candidate = Math.max(0, Math.min(100, candidate));
    options.add(candidate);
  }
  return shuffle([...options]);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTraitLabel(key) {
  return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function startGame() {
  document.getElementById('game-start-screen')?.classList.add('hidden');
  document.getElementById('game-play-screen')?.classList.remove('hidden');
  renderQuestion();
}

function renderQuestion() {
  const q = questions[currentQuestionIndex];
  const stage = document.getElementById('game-question-stage');
  const progressBar = document.getElementById('game-progress-bar');
  const progressLabel = document.getElementById('game-progress-label');

  progressBar.style.width = `${((currentQuestionIndex) / questions.length) * 100}%`;
  progressLabel.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;

  const letters = ['A', 'B', 'C', 'D'];

  stage.innerHTML = `
    <h2 class="game-question-text">${escapeHtml(q.prompt)}</h2>
    <div class="game-options">
      ${q.options.map((opt, i) => `
        <button type="button" class="game-option-btn" data-index="${i}">
          <span class="option-letter">${letters[i]}</span>
          <span class="option-text">${escapeHtml(String(opt))}</span>
        </button>
      `).join('')}
    </div>
  `;

  stage.querySelectorAll('.game-option-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.index)));
  });
}

function handleAnswer(chosenIndex) {
  const q = questions[currentQuestionIndex];
  const isCorrect = chosenIndex === q.correctIndex;
  if (isCorrect) score++;

  userAnswers.push({
    prompt: q.prompt,
    options: q.options,
    chosenIndex,
    correctIndex: q.correctIndex,
    isCorrect
  });

  const buttons = document.querySelectorAll('.game-option-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) btn.classList.add('correct');
    if (i === chosenIndex && !isCorrect) btn.classList.add('incorrect');
  });

  setTimeout(() => {
    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
      renderQuestion();
    } else {
      finishGame();
    }
  }, 900);
}

function finishGame() {
  document.getElementById('game-play-screen')?.classList.add('hidden');
  const resultsScreen = document.getElementById('game-results-screen');
  resultsScreen?.classList.remove('hidden');

  const pct = Math.round((score / questions.length) * 100);
  document.getElementById('game-final-score').textContent = `${score} / ${questions.length}`;
  document.getElementById('game-final-percentage').textContent = `${pct}%`;

  let message;
  if (pct >= 80) message = "You know yourself incredibly well!";
  else if (pct >= 50) message = "Pretty good self-awareness!";
  else message = "Turns out others see you differently than you expect!";
  document.getElementById('game-result-message').textContent = message;

  if (pct >= 50) fireConfetti();

  const reviewWrap = document.getElementById('game-review-list');
  const letters = ['A', 'B', 'C', 'D'];
  reviewWrap.innerHTML = userAnswers.map((a, idx) => `
    <div class="review-item ${a.isCorrect ? 'review-correct' : 'review-incorrect'}">
      <div class="review-question">
        <i class="fa-solid ${a.isCorrect ? 'fa-check' : 'fa-xmark'}"></i>
        Q${idx + 1}: ${escapeHtml(a.prompt)}
      </div>
      <div class="review-answer">
        Your answer: ${letters[a.chosenIndex]}) ${escapeHtml(String(a.options[a.chosenIndex]))}
        ${!a.isCorrect ? `<br>Correct: ${letters[a.correctIndex]}) ${escapeHtml(String(a.options[a.correctIndex]))}` : ''}
      </div>
    </div>
  `).join('');

  document.getElementById('play-again-btn')?.addEventListener('click', () => {
    questions = buildQuestions();
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    resultsScreen.classList.add('hidden');
    document.getElementById('game-play-screen')?.classList.remove('hidden');
    renderQuestion();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
