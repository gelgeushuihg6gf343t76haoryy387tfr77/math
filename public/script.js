const state = {
  username: "",
  score: 0,
  mode: "easy",
  streak: 0,
  lives: 3,
  solvedToday: 0,
  currentQuestion: null,
  answered: false
};

const scoreEl = document.getElementById("score");
const modeEl = document.getElementById("mode");
const streakEl = document.getElementById("streak");
const livesEl = document.getElementById("lives");
const questionTextEl = document.getElementById("questionText");
const topicTextEl = document.getElementById("topicText");
const messageEl = document.getElementById("message");
const usernameEl = document.getElementById("username");
const goalProgressEl = document.getElementById("goalProgress");
const goalTextEl = document.getElementById("goalText");
const leaderboardEl = document.getElementById("leaderboard");
const modeButtonsWrap = document.getElementById("modeButtons");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const startBtn = document.getElementById("startBtn");
const hintBtn = document.getElementById("hintBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const choicesWrap = document.getElementById("choicesWrap");
const questionCard = document.querySelector(".question-card");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverScore = document.getElementById("gameOverScore");
const gameOverStreak = document.getElementById("gameOverStreak");
const gameOverMode = document.getElementById("gameOverMode");
const tryAgainBtn = document.getElementById("tryAgainBtn");

const modeLabels = {
  easy: "Easy", middle: "Middle", hard: "Hard",
  advanced: "Advanced", calculus: "Calculus"
};

const modeMultipliers = {
  easy: 1, middle: 1.2, hard: 1.5, advanced: 1.8, calculus: 2.2
};

const modeRanks = {
  easy: 1, middle: 2, hard: 3, advanced: 4, calculus: 5
};

function renderStats() {
  scoreEl.textContent = String(state.score);
  modeEl.textContent = modeLabels[state.mode] || "Easy";
  streakEl.textContent = String(state.streak);
  livesEl.textContent = String(state.lives);
  goalProgressEl.value = state.solvedToday;
  goalTextEl.textContent = `${state.solvedToday} / 10`;
}

function animateEl(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function showGameOver() {
  gameOverScore.textContent = state.score;
  gameOverStreak.textContent = state.streak;
  gameOverMode.textContent = modeLabels[state.mode];
  gameOverOverlay.classList.add("show");
}

function hideGameOver() {
  gameOverOverlay.classList.remove("show");
}

function saveLocalState() {
  const snapshot = {
    username: state.username, score: state.score, mode: state.mode,
    streak: state.streak, lives: state.lives, solvedToday: state.solvedToday,
    isLightMode: document.body.classList.contains("light-mode")
  };
  localStorage.setItem("math-save", JSON.stringify(snapshot));
}

function loadLocalState() {
  const raw = localStorage.getItem("math-save");
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    state.username = saved.username || "";
    state.score = Number(saved.score) || 0;
    state.mode = modeLabels[saved.mode] ? saved.mode : "easy";
    state.streak = Number(saved.streak) || 0;
    state.lives = Number(saved.lives) || 3;
    state.solvedToday = Number(saved.solvedToday) || 0;
    if (state.username) usernameEl.value = state.username;
    setMode(state.mode);
    renderStats();
    if (saved.isLightMode) {
      document.body.classList.add("light-mode");
      themeToggleBtn.textContent = "Dark";
    }
    return true;
  } catch { return false; }
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "message";
  if (type) messageEl.classList.add(type);
}

async function getQuestion() {
  const res = await fetch(`/api/question?mode=${state.mode}`);
  const data = await res.json();
  state.currentQuestion = data;
  state.answered = false;
  questionTextEl.textContent = data.prompt;
  topicTextEl.textContent = data.topic;

  choicesWrap.innerHTML = "";
  const letters = ["A", "B", "C"];
  letters.forEach((letter) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.dataset.letter = letter;
    btn.innerHTML = `<span class="choice-letter">${letter}</span><span class="choice-value">${data.choices[letter]}</span>`;
    btn.addEventListener("click", () => handleChoice(letter));
    choicesWrap.appendChild(btn);
  });
}

function handleChoice(letter) {
  if (state.answered) return;
  if (!state.currentQuestion) return;
  if (!state.username) {
    setMessage("Enter your name and press Start first.");
    return;
  }

  state.answered = true;
  const btns = choicesWrap.querySelectorAll(".choice-btn");
  btns.forEach((b) => b.classList.remove("selected"));
  const chosenBtn = choicesWrap.querySelector(`[data-letter="${letter}"]`);
  if (chosenBtn) chosenBtn.classList.add("selected");

  fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId: state.currentQuestion.id, userAnswer: letter })
  })
    .then((r) => r.json())
    .then((result) => {
      btns.forEach((b) => {
        b.classList.remove("correct", "wrong");
        if (b.dataset.letter === result.correct_letter) b.classList.add("correct");
        if (b.dataset.letter === letter && !result.correct) b.classList.add("wrong");
        b.style.pointerEvents = "none";
      });

      if (result.correct) {
        const points = Math.round((10 + Math.min(state.streak, 5)) * modeMultipliers[state.mode]);
        state.score += points;
        state.streak += 1;
        state.solvedToday += 1;
        setMessage(`+${points} pts`);
      } else {
        state.lives -= 1;
        state.streak = 0;
        setMessage(`${result.correct_letter}: ${result.answer}`);
      }

      if (state.lives <= 0) {
        saveProgress().then(() => showGameOver());
        return;
      }

      renderStats();
      saveProgress().then(() => {
        loadLeaderboard();
        setTimeout(() => {
          resetChoices();
          getQuestion();
        }, 1200);
      });
    });
}

function resetChoices() {
  choicesWrap.querySelectorAll(".choice-btn").forEach((b) => {
    b.classList.remove("correct", "wrong", "selected");
    b.style.pointerEvents = "auto";
  });
}

function showHint() {
  if (!state.currentQuestion) return;
  setMessage(state.currentQuestion.hint || "Break into steps.");
}

function tryAgain() {
  hideGameOver();
  state.lives = 3;
  state.streak = 0;
  state.score = Math.max(0, state.score - 20);
  renderStats();
  setMessage("");
  resetChoices();
  getQuestion();
}

async function startGame() {
  const username = usernameEl.value.trim();
  if (!username) {
    setMessage("Enter your name first.");
    return;
  }
  hideGameOver();
  const restored = await loadProgressByUsername(username);
  if (!restored) {
    state.username = username;
    state.score = 0;
    state.streak = 0;
    state.lives = 3;
    state.solvedToday = 0;
  }
  renderStats();
  setMessage(restored ? `Welcome back.` : `Started.`);
  await saveProgress();
  await getQuestion();
  await loadLeaderboard();
}

async function saveProgress() {
  if (!state.username) return;
  await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: state.username, score: state.score,
      level: modeRanks[state.mode], mode: state.mode,
      streak: state.streak, lives: state.lives, solvedToday: state.solvedToday
    })
  });
  saveLocalState();
}

async function loadProgressByUsername(username) {
  if (!username) return false;
  const res = await fetch(`/api/profile/${encodeURIComponent(username)}`);
  if (!res.ok) return false;
  const data = await res.json();
  const profile = data.profile || {};
  state.username = username;
  state.score = Number(profile.currentScore ?? profile.bestScore) || 0;
  state.streak = Number(profile.currentStreak ?? profile.bestStreak) || 0;
  state.lives = Number(profile.currentLives) || 3;
  state.solvedToday = Number(profile.currentSolvedToday) || 0;
  state.mode = modeLabels[profile.currentMode] ? profile.currentMode : "easy";
  setMode(state.mode);
  renderStats();
  saveLocalState();
  return true;
}

async function loadLeaderboard() {
  const res = await fetch("/api/leaderboard");
  const data = await res.json();
  leaderboardEl.innerHTML = "";
  if (!data.leaderboard.length) {
    leaderboardEl.innerHTML = "<li>No scores yet.</li>";
    return;
  }
  data.leaderboard.forEach((entry, i) => {
    const li = document.createElement("li");
    li.textContent = `${entry.username} - ${entry.score}`;
    leaderboardEl.appendChild(li);
  });
}

function setMode(mode) {
  state.mode = mode;
  renderStats();
  const modeButtons = modeButtonsWrap.querySelectorAll(".mode-btn");
  modeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  if (state.username) {
    getQuestion();
    saveLocalState();
  }
}

function initModeButtons() {
  const modeButtons = modeButtonsWrap.querySelectorAll(".mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
}

function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  themeToggleBtn.textContent = isLight ? "Dark" : "Light";
  saveLocalState();
}

async function handleManualSave() {
  if (!state.username) {
    const username = usernameEl.value.trim();
    if (!username) {
      setMessage("Enter your name first.");
      return;
    }
    state.username = username;
  }
  await saveProgress();
  setMessage("Saved.");
}

async function handleManualLoad() {
  const username = usernameEl.value.trim() || state.username;
  if (!username) {
    setMessage("Enter your name first.");
    return;
  }
  const loaded = await loadProgressByUsername(username);
  if (!loaded) {
    const hasLocal = loadLocalState();
    if (hasLocal) {
      setMessage("Loaded.");
      await getQuestion();
      return;
    }
    setMessage("No saved data.");
    return;
  }
  setMessage("Loaded.");
  await getQuestion();
}

startBtn.addEventListener("click", startGame);
hintBtn.addEventListener("click", showHint);
themeToggleBtn.addEventListener("click", toggleTheme);
saveBtn.addEventListener("click", handleManualSave);
loadBtn.addEventListener("click", handleManualLoad);
tryAgainBtn.addEventListener("click", tryAgain);

initModeButtons();
renderStats();
loadLeaderboard();
loadLocalState();
