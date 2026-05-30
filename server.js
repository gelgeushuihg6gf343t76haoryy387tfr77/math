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

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatNum(value) {
  if (Number.isInteger(value)) return value;
  return Math.round(value * 100) / 100;
}

function genDistractors(correct, count = 2) {
  const distractors = new Set();
  const spread = Math.max(1, Math.abs(correct) < 1 ? 3 : Math.round(Math.abs(correct) * 0.2));
  let attempts = 0;
  const picks = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10];
  while (distractors.size < count && attempts < 50) {
    const choice = [() => correct + rand(1, spread),
      () => correct - rand(1, spread),
      () => correct + rand(-2, 2) + Math.floor(spread / 2),
      () => Math.round(correct * [0.5, 1.5, 2, 0.75][rand(0, 3)]),
      () => correct + picks[rand(0, picks.length - 1)]
    ][rand(0, 4)]();
    const val = typeof correct === "number" && !Number.isInteger(correct)
      ? Math.round(choice * 100) / 100
      : Math.round(choice);
    if (val !== correct && !distractors.has(val)) distractors.add(val);
    attempts++;
  }
  while (distractors.size < count) {
    distractors.add(correct + (distractors.size + 1) * 2);
  }
  return [...distractors].slice(0, count);
}

function buildChoices(answer) {
  const distractors = genDistractors(answer);
  const options = [...distractors, answer];
  for (let i = options.length - 1; i > 0; i--) {
    const j = rand(0, i);
    [options[i], options[j]] = [options[j], options[i]];
  }
  const letters = ["A", "B", "C"];
  const choices = {};
  const correctIdx = options.indexOf(answer);
  letters.forEach((l, i) => { choices[l] = formatNum(options[i]); });
  return { choices, correctLetter: letters[correctIdx] };
}

function buildEasy() {
  const ops = ["+", "-", "*", "/"];
  const op = ops[rand(0, 3)];
  let a, b, answer, hint;
  if (op === "+") { a = rand(1, 40); b = rand(1, 40); answer = a + b; hint = `${a} + ${b} = `; }
  else if (op === "-") { a = rand(10, 50); b = rand(1, a); answer = a - b; hint = `${a} - ${b} = `; }
  else if (op === "*") { a = rand(2, 12); b = rand(2, 12); answer = a * b; hint = `${a} × ${b} = `; }
  else { b = rand(2, 12); answer = rand(2, 12); a = b * answer; hint = `${a} ÷ ${b} = `; }
  const symbol = op === "*" ? "x" : op;
  return { prompt: `${a} ${symbol} ${b} = ?`, answer, topic: "Arithmetic", hint };
}

function buildMiddle() {
  const t = ["fraction", "power", "root"][rand(0, 2)];
  if (t === "fraction") {
    const denom = rand(5, 15), base = rand(2, 12), add = rand(2, 10);
    const numer = base * denom + add;
    const val = numer / denom;
    return { prompt: `${numer} / ${denom} = ? (decimal)`, answer: formatNum(val), topic: "Fractions", hint: `Divide ${numer} by ${denom}` };
  }
  if (t === "power") {
    const base = rand(3, 12), power = rand(2, 4);
    const ans = base ** power;
    return { prompt: `${base}^${power} = ?`, answer: ans, topic: "Exponents", hint: `${base} × ${base} ${power > 2 ? "× " + base + (power > 3 ? " × " + base : "") : ""} = ` };
  }
  const root = rand(2, 30);
  return { prompt: `sqrt(${root * root}) = ?`, answer: root, topic: "Square roots", hint: `√${root * root} = ? → ${root} × ${root} = ${root * root}` };
}

function buildHard() {
  const t = ["linear", "percent", "ratio"][rand(0, 2)];
  if (t === "linear") {
    const x = rand(3, 25), a = rand(3, 15), b = rand(10, 50);
    const c = a * x + b;
    return { prompt: `Solve for x: ${a}x + ${b} = ${c}`, answer: x, topic: "Linear equations", hint: `${a}x + ${b} = ${c} → ${a}x = ${c} - ${b} = ${c - b} → x = ${c - b} ÷ ${a}` };
  }
  if (t === "percent") {
    const pct = rand(5, 75), total = rand(100, 1000);
    return { prompt: `${pct}% of ${total} = ?`, answer: formatNum((pct / 100) * total), topic: "Percentages", hint: `${total} × ${pct} ÷ 100 = ` };
  }
  const a = rand(3, 20), b = rand(3, 20), scale = rand(2, 6);
  return { prompt: `If ${a}:${b}, what is ${a * scale}:?`, answer: b * scale, topic: "Ratios", hint: `${a}:${b} = ${a * scale}:? → ? = ${b} × ${scale}` };
}

function buildAdvanced() {
  const t = ["circle", "sphere", "trig", "log"][rand(0, 3)];
  if (t === "circle") {
    const r = rand(5, 25);
    const area = 3.14 * r * r;
    return { prompt: `Area of circle radius ${r} (π ≈ 3.14)`, answer: formatNum(area), topic: "Circle area", hint: `A = πr² = 3.14 × ${r}² = 3.14 × ${r * r}` };
  }
  if (t === "sphere") {
    const r = rand(3, 10);
    const vol = 4.1867 * r * r * r;
    return { prompt: `Volume of sphere radius ${r} (4/3 π r³)`, answer: formatNum(vol), topic: "Sphere volume", hint: `V = 4/3 × π × ${r}³ = 4.1867 × ${r * r * r}` };
  }
  if (t === "trig") {
    const angles = [30, 45, 60];
    const angle = angles[rand(0, 2)];
    const trigs = ["sin", "cos", "tan"];
    const name = trigs[rand(0, 2)];
    const val = { sin: { 30: 0.5, 45: 0.71, 60: 0.87 }, cos: { 30: 0.87, 45: 0.71, 60: 0.5 }, tan: { 30: 0.58, 45: 1, 60: 1.73 } };
    return { prompt: `${name}(${angle}°) = ?`, answer: val[name][angle], topic: "Trigonometry", hint: `Use unit circle. ${name}(${angle}°) = ` };
  }
  const bases = [2, 10, 5];
  const base = bases[rand(0, 2)];
  const vals = { 2: [8, 16, 32, 64], 10: [100, 1000, 10000], 5: [25, 125, 625] };
  const nums = vals[base];
  const v = nums[rand(0, nums.length - 1)];
  const ans = Math.round(Math.log(v) / Math.log(base));
  return { prompt: `log_${base}(${v}) = ?`, answer: ans, topic: "Logarithms", hint: `${base}^? = ${v} → ` };
}

function buildCalculus() {
  const t = ["derivative", "integral", "tangent"][rand(0, 2)];
  if (t === "derivative") {
    const n = rand(3, 8), x = rand(2, 10);
    const ans = n * x ** (n - 1);
    return { prompt: `d/dx of x^${n} at x = ${x}`, answer: ans, topic: "Power rule", hint: `d/dx(x^${n}) = ${n}x^${n - 1} → ${n} × ${x}^${n - 1} = ${n} × ${x ** (n - 1)}` };
  }
  if (t === "integral") {
    const a = rand(3, 15), b = rand(5, 20);
    return { prompt: `∫₀¹ (${a}x + ${b}) dx`, answer: formatNum(a / 2 + b), topic: "Definite integral", hint: `∫(${a}x + ${b}) = ${a / 2}x² + ${b}x → evaluate from 0 to 1` };
  }
  const x = rand(2, 8);
  const ans = 2 * x;
  return { prompt: `Slope of tangent to y = x² at x = ${x}`, answer: ans, topic: "Tangent slope", hint: `dy/dx = 2x → at x = ${x}, slope = 2 × ${x}` };
}

let hasPython = false;
try {
  fs.accessSync(path.join(__dirname, "math_questions.py"));
  const test = spawnSync("python3", ["--version"], { encoding: "utf-8", timeout: 2000 });
  hasPython = test.status === 0 && !test.error;
} catch { hasPython = false; }
if (hasPython) console.log("Python detected, using math_questions.py");
else console.log("No Python, using JS fallback (faster on cloud)");

function callPython(mode) {
  if (!hasPython) return null;
  try {
    const py = spawnSync("python3", [path.join(__dirname, "math_questions.py"), mode], {
      encoding: "utf-8", timeout: 2000
    });
    if (py.error || py.status !== 0) return null;
    return JSON.parse(py.stdout);
  } catch { return null; }
}

function generateJS(mode) {
  const builders = { easy: buildEasy, middle: buildMiddle, hard: buildHard, advanced: buildAdvanced, calculus: buildCalculus };
  const gen = builders[mode]();
  const { choices, correctLetter } = buildChoices(gen.answer);
  return { prompt: gen.prompt, answer: gen.answer, choices, correct_letter: correctLetter, topic: gen.topic, hint: gen.hint, mode };
}

function buildQuestion(mode = "easy") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeMode = MODE_CONFIG[mode] ? mode : "easy";
  let data = callPython(safeMode);
  if (!data) data = generateJS(safeMode);

  questionBank.set(id, { correct_letter: data.correct_letter, answer: data.answer });

  return {
    id, prompt: data.prompt, choices: data.choices,
    topic: data.topic, hint: data.hint,
    mode: safeMode, modeLabel: MODE_CONFIG[safeMode]
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "Math" });
});

app.get("/api/question", (req, res) => {
  const mode = String(req.query.mode || "easy");
  const question = buildQuestion(mode);
  res.json({
    id: question.id, prompt: question.prompt, choices: question.choices,
    mode: question.mode, modeLabel: question.modeLabel,
    topic: question.topic, hint: question.hint
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
  return res.json({ correct: letter === cached.correct_letter, answer: cached.answer, correct_letter: cached.correct_letter });
});

app.get("/api/leaderboard", (_req, res) => {
  const store = readStore();
  const top = [...store.leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
  res.json({ leaderboard: top });
});

app.post("/api/progress", (req, res) => {
  const { username, score, level, mode, streak, lives, solvedToday } = req.body || {};
  if (!username) return res.status(400).json({ error: "username is required" });
  const safeScore = Number(score) || 0;
  const safeLevel = Math.max(Number(level) || 0, MODE_RANK[mode] || 1);
  const safeStreak = Number(streak) || 0;
  const safeMode = MODE_CONFIG[mode] ? mode : "easy";
  const safeLives = Number(lives) || 3;
  const safeSolvedToday = Number(solvedToday) || 0;
  const store = readStore();
  const existing = store.players.find((p) => p.username === username);
  if (!existing) {
    store.players.push({ username, bestScore: safeScore, bestLevel: safeLevel, bestStreak: safeStreak, bestMode: safeMode, currentScore: safeScore, currentStreak: safeStreak, currentLives: safeLives, currentSolvedToday: safeSolvedToday, currentMode: safeMode, lastPlayedAt: new Date().toISOString() });
  } else {
    Object.assign(existing, { bestScore: Math.max(existing.bestScore, safeScore), bestLevel: Math.max(existing.bestLevel, safeLevel), bestStreak: Math.max(existing.bestStreak, safeStreak), bestMode: safeMode, currentScore: safeScore, currentStreak: safeStreak, currentLives: safeLives, currentSolvedToday: safeSolvedToday, currentMode: safeMode, lastPlayedAt: new Date().toISOString() });
  }
  const topPlayers = [...store.players].sort((a, b) => b.bestScore - a.bestScore).slice(0, 20).map((p) => ({ username: p.username, score: p.bestScore }));
  store.leaderboard = topPlayers;
  writeStore(store);
  return res.json({ ok: true, profile: store.players.find((p) => p.username === username) });
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
