// Firebase Configuration - REPLACE WITH YOUR OWN CREDENTIALS
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (e) {
  console.warn('Firebase not configured. Using localStorage fallback.');
}

const STORAGE_KEYS = {
  settings: 'gloryWar_settings',
  scores: 'gloryWar_scores',
  playerName: 'gloryWar_playerName',
};

const DEFAULT_ALLIANCES = [
  '#22 Nuj',
  '#22 Hero',
  '#22[Ants]',
  '#50 CSI',
];

const DEFAULT_SETTINGS = {
  alliances: [...DEFAULT_ALLIANCES],
  countdownSeconds: 5,
};

const OPPONENT_META = [
  { rank: '1', wreath: true, flag: 'blue', shield: '17,990,261,261', coin: '14,888,634', loot: '2,977,727' },
  { rank: '2', wreath: true, flag: 'brown', shield: '16,338,252,495', coin: '14,233,302', loot: '2,846,660' },
  { rank: '4', wreath: false, flag: 'blue', shield: '16,266,220,881', coin: '12,837,149', loot: '2,567,430' },
  { rank: '5', wreath: false, flag: 'brown', shield: '14,425,952,814', coin: '10,624,192', loot: '2,124,838' },
];

let settings = loadSettings();
let countdownInterval = null;
let reactionStartTime = null;
let countdownRemaining = 0;
let practiceActive = false;

const $ = (sel) => document.querySelector(sel);

const startScreen = $('#start-screen');
const practiceScreen = $('#practice-screen');
const opponentModal = $('#opponent-modal');
const resultOverlay = $('#result-overlay');
const settingsModal = $('#settings-modal');

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed, alliances: parsed.alliances || DEFAULT_ALLIANCES };
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS, alliances: [...DEFAULT_ALLIANCES] };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

async function loadScores() {
  // Try Firebase first
  if (db) {
    try {
      const snapshot = await db.collection('scores')
        .orderBy('timeMs', 'asc')
        .limit(50)
        .get();
      
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => doc.data());
      }
    } catch (e) {
      console.warn('Firebase load failed, using localStorage:', e);
    }
  }
  
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scores);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [];
}

async function saveScore(name, timeMs) {
  const scoreData = {
    name,
    timeMs,
    date: new Date().toISOString(),
  };

  // Save to Firebase if available
  if (db) {
    try {
      await db.collection('scores').add(scoreData);
      return;
    } catch (e) {
      console.warn('Firebase save failed, using localStorage:', e);
    }
  }
  
  // Fallback to localStorage
  const scores = await loadScores();
  scores.push(scoreData);
  scores.sort((a, b) => a.timeMs - b.timeMs);
  localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(scores.slice(0, 50)));
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(3)}s`;
}

function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0 || m > 0) {
    return `${h > 0 ? h + 'd ' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:00`;
  }
  return `00:00:${String(s).padStart(2, '0')}`;
}

function showScreen(screen) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  screen.classList.add('active');
}

async function renderScores() {
  const scores = await loadScores();
  const list = $('#scores-list');
  if (scores.length === 0) {
    list.innerHTML = '<div class="scores-empty">No times recorded yet</div>';
    return;
  }
  list.innerHTML = scores.slice(0, 10).map((s, i) => `
    <div class="score-row">
      <span class="rank">${i + 1}</span>
      <span class="name">${escapeHtml(s.name)}</span>
      <span class="time">${formatTime(s.timeMs)}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAllianceInputs() {
  const container = $('#alliance-inputs');
  container.innerHTML = settings.alliances.map((name, i) => `
    <div class="alliance-input-group">
      <label for="alliance-${i}">Alliance ${i + 1}</label>
      <input type="text" id="alliance-${i}" value="${escapeHtml(name)}" maxlength="48">
    </div>
  `).join('');
}

function renderOpponentList() {
  const list = $('#opponent-list');
  list.innerHTML = settings.alliances.map((name, i) => {
    const meta = OPPONENT_META[i] || OPPONENT_META[0];
    return `
      <div class="opponent-row">
        <div class="opponent-main">
          <div class="opponent-rank ${meta.wreath ? 'wreath' : ''}">${meta.rank}</div>
          <div class="opponent-flag ${meta.flag}"></div>
          <div class="opponent-details">
            <div class="opponent-name">${escapeHtml(name)}</div>
            <div class="opponent-stats">🛡 ${meta.shield} &nbsp; 🪙 ${meta.coin}</div>
          </div>
          <button type="button" class="declare-war-btn" data-index="${i}">
            Declare War
            <span class="cost">💎 5,000</span>
          </button>
        </div>
        <div class="opponent-loot">Lootable: ${meta.loot}</div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.declare-war-btn').forEach((btn) => {
    btn.addEventListener('click', onDeclareWar);
  });
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function resetPracticeUI() {
  stopCountdown();
  reactionStartTime = null;
  practiceActive = false;
  countdownRemaining = settings.countdownSeconds;

  $('#countdown-timer').textContent = formatCountdown(countdownRemaining);
  $('#select-opponent-btn').classList.add('hidden');
  $('#section-title').textContent = 'Opponent Selection';
  $('#status-text').textContent = `Full Preparedness begins in ${settings.countdownSeconds} mins.`;
  opponentModal.classList.add('hidden');
  resultOverlay.classList.add('hidden');
}

function startCountdown() {
  resetPracticeUI();
  practiceActive = true;
  countdownRemaining = settings.countdownSeconds;
  $('#countdown-timer').textContent = formatCountdown(countdownRemaining);

  countdownInterval = setInterval(() => {
    countdownRemaining -= 1;
    $('#countdown-timer').textContent = formatCountdown(Math.max(0, countdownRemaining));

    if (countdownRemaining <= 0) {
      stopCountdown();
      onCountdownComplete();
    }
  }, 1000);
}

function onCountdownComplete() {
  $('#countdown-timer').textContent = '00:00:00';
  $('#section-title').textContent = 'About to Pick Opponent';
  $('#status-text').textContent = 'Select your opponent now!';
  $('#select-opponent-btn').classList.remove('hidden');
  reactionStartTime = performance.now();
}

function onSelectOpponent() {
  if (!reactionStartTime) return;
  renderOpponentList();
  opponentModal.classList.remove('hidden');
}

async function onDeclareWar() {
  if (!reactionStartTime) return;
  const elapsed = performance.now() - reactionStartTime;
  const playerName = localStorage.getItem(STORAGE_KEYS.playerName) || 'Anonymous';

  await saveScore(playerName, elapsed);

  opponentModal.classList.add('hidden');
  $('#result-time').textContent = formatTime(elapsed);
  $('#result-player').textContent = playerName;
  resultOverlay.classList.remove('hidden');
  practiceActive = false;
}

function startPractice() {
  const name = $('#player-name').value.trim();
  if (!name) {
    $('#player-name').focus();
    $('#player-name').style.borderColor = '#ff6666';
    setTimeout(() => { $('#player-name').style.borderColor = ''; }, 1500);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.playerName, name);
  showScreen(practiceScreen);
  startCountdown();
}

function openSettings() {
  renderAllianceInputs();
  $('#countdown-seconds').value = settings.countdownSeconds;
  settingsModal.classList.remove('hidden');
}

function saveSettingsFromModal() {
  const alliances = [];
  for (let i = 0; i < 4; i++) {
    const val = $(`#alliance-${i}`).value.trim();
    alliances.push(val || DEFAULT_ALLIANCES[i]);
  }
  settings.alliances = alliances;
  settings.countdownSeconds = Math.max(1, Math.min(60, parseInt($('#countdown-seconds').value, 10) || 5));
  saveSettings();
  settingsModal.classList.add('hidden');
}

async function init() {
  const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
  if (savedName) $('#player-name').value = savedName;

  await renderScores();

  $('#start-practice').addEventListener('click', startPractice);
  $('#open-settings').addEventListener('click', openSettings);
  $('#close-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
  $('#save-settings').addEventListener('click', saveSettingsFromModal);
  $('#clear-scores').addEventListener('click', async () => {
    if (confirm('Clear all saved scores?')) {
      localStorage.removeItem(STORAGE_KEYS.scores);
      await renderScores();
    }
  });

  $('#select-opponent-btn').addEventListener('click', onSelectOpponent);
  $('#close-modal').addEventListener('click', () => opponentModal.classList.add('hidden'));

  $('#try-again').addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
    startCountdown();
  });

  $('#back-to-home').addEventListener('click', async () => {
    resetPracticeUI();
    resultOverlay.classList.add('hidden');
    showScreen(startScreen);
    await renderScores();
  });

  $('#back-home').addEventListener('click', () => {
    if (practiceActive && !confirm('Leave practice?')) return;
    resetPracticeUI();
    showScreen(startScreen);
  });

  $('#nav-back').addEventListener('click', () => {
    if (practiceActive && !confirm('Leave practice?')) return;
    resetPracticeUI();
    showScreen(startScreen);
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  opponentModal.addEventListener('click', (e) => {
    if (e.target === opponentModal) opponentModal.classList.add('hidden');
  });
}

init();
