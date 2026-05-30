const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "progress.json");

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    const seed = { players: [], leaderboard: [] };
    fs.writeFileSync(dataFile, JSON.stringify(seed, null, 2), "utf-8");
  }
}

function readStore() {
  ensureDataStore();
  const raw = fs.readFileSync(dataFile, "utf-8");
  return JSON.parse(raw);
}

function writeStore(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), "utf-8");
}

const MODE_CONFIG = {
  easy: "Easy (Grade 1-4)",
  middle: "Middle (Grade 4-6)",
  hard: "Hard (Grade 7-9)",
  advanced: "Algebra + Geometry (Grade 10-12)",
  calculus: "Calculus (Grade 10-12+)"
};

const MODE_RANK = {
  easy: 1, middle: 2, hard: 3, advanced: 4, calculus: 5
};

const questionBank = new Map();

function callPython(mode) {
  const py = spawnSync("python3", [path.join(__dirname, "math_questions.py"), mode], {
    encoding: "utf-8",
    timeout: 5000
  });
  if (py.error || py.status !== 0) {
    console.error("Python error:", py.stderr || py.error);
    return null;
  }
  return JSON.parse(py.stdout);
}

function buildQuestion(mode = "easy") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeMode = MODE_CONFIG[mode] ? mode : "easy";
  const data = callPython(safeMode);

  if (!data) {
    return {
      id,
      prompt: "Error generating question",
      topic: "Error",
      hint: "Try again",
      mode: safeMode,
      modeLabel: MODE_CONFIG[safeMode],
      choices: { A: 0, B: 0, C: 0 }
    };
  }

  questionBank.set(id, {
    correct_letter: data.correct_letter,
    answer: data.answer
  });

  return {
    id,
    prompt: data.prompt,
    choices: data.choices,
    topic: data.topic,
    hint: data.hint,
    mode: safeMode,
    modeLabel: MODE_CONFIG[safeMode]
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "Math" });
});

app.get("/api/question", (req, res) => {
  const mode = String(req.query.mode || "easy");
  const question = buildQuestion(mode);
  res.json({
    id: question.id,
    prompt: question.prompt,
    choices: question.choices,
    mode: question.mode,
    modeLabel: question.modeLabel,
    topic: question.topic,
    hint: question.hint
  });
});

app.post("/api/check", (req, res) => {
  const { questionId, userAnswer } = req.body || {};
  if (!questionId || !userAnswer) {
    return res.status(400).json({ error: "questionId and userAnswer are required" });
  }

  const cached = questionBank.get(questionId);
  if (!cached) {
    return res.status(404).json({ error: "Question expired or not found" });
  }

  const letter = String(userAnswer).toUpperCase().trim();
  const correct = letter === cached.correct_letter;

  return res.json({
    correct,
    answer: cached.answer,
    correct_letter: cached.correct_letter
  });
});

app.get("/api/leaderboard", (_req, res) => {
  const store = readStore();
  const top = [...store.leaderboard]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  res.json({ leaderboard: top });
});

app.post("/api/progress", (req, res) => {
  const { username, score, level, mode, streak, lives, solvedToday } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  const safeScore = Number(score) || 0;
  const levelFromRequest = Number(level) || 0;
  const safeStreak = Number(streak) || 0;
  const safeMode = MODE_CONFIG[mode] ? mode : "easy";
  const safeLevel = Math.max(levelFromRequest, MODE_RANK[safeMode]);
  const safeLives = Number(lives) || 3;
  const safeSolvedToday = Number(solvedToday) || 0;

  const store = readStore();
  const existing = store.players.find((p) => p.username === username);

  if (!existing) {
    store.players.push({
      username,
      bestScore: safeScore,
      bestLevel: safeLevel,
      bestStreak: safeStreak,
      bestMode: safeMode,
      currentScore: safeScore,
      currentStreak: safeStreak,
      currentLives: safeLives,
      currentSolvedToday: safeSolvedToday,
      currentMode: safeMode,
      lastPlayedAt: new Date().toISOString()
    });
  } else {
    existing.bestScore = Math.max(existing.bestScore, safeScore);
    existing.bestLevel = Math.max(existing.bestLevel, safeLevel);
    existing.bestStreak = Math.max(existing.bestStreak, safeStreak);
    existing.bestMode = MODE_CONFIG[safeMode] ? safeMode : existing.bestMode || "easy";
    existing.currentScore = safeScore;
    existing.currentStreak = safeStreak;
    existing.currentLives = safeLives;
    existing.currentSolvedToday = safeSolvedToday;
    existing.currentMode = safeMode;
    existing.lastPlayedAt = new Date().toISOString();
  }

  const topPlayers = [...store.players]
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 20)
    .map((p) => ({ username: p.username, score: p.bestScore }));

  store.leaderboard = topPlayers;
  writeStore(store);

  return res.json({
    ok: true,
    profile: store.players.find((p) => p.username === username)
  });
});

app.get("/api/profile/:username", (req, res) => {
  const username = req.params.username;
  const store = readStore();
  const profile = store.players.find((p) => p.username === username);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json({ profile });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  ensureDataStore();
  console.log(`Math running at http://localhost:${PORT}`);
});
