import sys
import os
import json
import math
import random
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder="public", static_url_path="")
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DATA_FILE = os.path.join(DATA_DIR, "progress.json")

MODE_CONFIG = {
    "easy": "Easy (Grade 1-4)",
    "middle": "Middle (Grade 4-6)",
    "hard": "Hard (Grade 7-9)",
    "advanced": "Algebra + Geometry (Grade 10-12)",
    "calculus": "Calculus (Grade 10-12+)"
}
MODE_RANK = {"easy": 1, "middle": 2, "hard": 3, "advanced": 4, "calculus": 5}
QUESTION_BANK = {}

def ensure_store():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump({"players": [], "leaderboard": []}, f, indent=2)

def read_store():
    ensure_store()
    with open(DATA_FILE) as f:
        return json.load(f)

def write_store(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def generate_question(mode):
    py = os.path.join(os.path.dirname(__file__), "math_questions.py")
    try:
        r = subprocess.run(["python3", py, mode], capture_output=True, text=True, timeout=3)
        if r.returncode == 0:
            return json.loads(r.stdout)
    except:
        pass

    builders = {
        "easy": build_easy, "middle": build_middle, "hard": build_hard,
        "advanced": build_advanced, "calculus": build_calculus
    }
    prompt, answer, topic, hint = builders.get(mode, build_easy)()
    distractors = gen_distractors(answer)
    options = distractors + [answer]
    random.shuffle(options)
    letters = ["A", "B", "C"]
    choices = {letters[i]: fmt(options[i]) for i in range(3)}
    idx = options.index(answer)
    return {
        "prompt": prompt,
        "answer": fmt(answer),
        "choices": choices,
        "correct_letter": letters[idx],
        "topic": topic,
        "hint": hint,
        "mode": mode
    }

def fmt(v):
    return round(v, 2) if isinstance(v, float) else v

def gen_distractors(correct, count=2):
    s = set()
    spread = max(2, int(abs(correct) * 0.15) if correct != 0 else 3)
    pool = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 15, -15]
    for _ in range(50):
        if len(s) >= count:
            break
        c = random.choice([
            correct + random.randint(1, spread),
            correct - random.randint(1, spread),
            correct * random.choice([0.5, 1.5, 2, 0.75]),
            correct + random.choice(pool)
        ])
        c = round(c, 2) if isinstance(correct, float) else int(round(c))
        if c != correct and c not in s:
            s.add(c)
    while len(s) < count:
        s.add(correct + (len(s) + 1) * 3)
    return list(s)[:count]

def rnd(a, b):
    return random.randint(a, b)

def build_easy():
    op = random.choice(["+", "-", "*", "/"])
    if op == "+":
        a, b = rnd(1, 40), rnd(1, 40)
        return f"{a} + {b} = ?", a + b, "Arithmetic", f"{a} + {b} = "
    if op == "-":
        a, b = rnd(10, 50), rnd(1, a)
        return f"{a} - {b} = ?", a - b, "Arithmetic", f"{a} - {b} = "
    if op == "*":
        a, b = rnd(2, 12), rnd(2, 12)
        return f"{a} x {b} = ?", a * b, "Arithmetic", f"{a} x {b} = "
    b = rnd(2, 12)
    ans = rnd(2, 12)
    return f"{b * ans} / {b} = ?", ans, "Arithmetic", f"{b * ans} / {b} = "

def build_middle():
    t = random.choice(["fraction", "power", "root"])
    if t == "fraction":
        d, base, add = rnd(5, 15), rnd(2, 12), rnd(2, 10)
        n = base * d + add
        return f"{n} / {d} = ? (decimal)", fmt(n / d), "Fractions", f"Divide {n} by {d}"
    if t == "power":
        b, p = rnd(3, 12), rnd(2, 4)
        return f"{b}^{p} = ?", b ** p, "Exponents", " x ".join([str(b)] * p) + " = "
    r = rnd(2, 30)
    return f"sqrt({r * r}) = ?", r, "Square roots", f"What × what = {r * r}?"

def build_hard():
    t = random.choice(["linear", "percent", "ratio"])
    if t == "linear":
        x, a, b = rnd(3, 25), rnd(3, 15), rnd(10, 50)
        c = a * x + b
        return f"Solve for x: {a}x + {b} = {c}", x, "Linear equations", f"{a}x = {c} - {b} = {c - b}, x = {c - b} ÷ {a}"
    if t == "percent":
        p, total = rnd(5, 75), rnd(100, 1000)
        return f"{p}% of {total} = ?", fmt(total * p / 100), "Percentages", f"{total} x {p} ÷ 100 = "
    a, b, s = rnd(3, 20), rnd(3, 20), rnd(2, 6)
    return f"If {a}:{b}, what is {a * s}:?", b * s, "Ratios", f"? = {b} x {s}"

def build_advanced():
    t = random.choice(["circle", "sphere", "trig", "log"])
    if t == "circle":
        r = rnd(5, 25)
        return f"Area of circle radius {r} (π ≈ 3.14)", fmt(3.14 * r * r), "Circle area", f"A = 3.14 x {r}² = 3.14 x {r * r}"
    if t == "sphere":
        r = rnd(3, 10)
        return f"Volume of sphere radius {r} (4/3 π r³)", fmt(4.1867 * r ** 3), "Sphere volume", f"V = 4.1867 x {r}³ = 4.1867 x {r ** 3}"
    if t == "trig":
        angle = random.choice([30, 45, 60])
        name = random.choice(["sin", "cos", "tan"])
        vals = {"sin": {30: 0.5, 45: 0.71, 60: 0.87}, "cos": {30: 0.87, 45: 0.71, 60: 0.5}, "tan": {30: 0.58, 45: 1, 60: 1.73}}
        return f"{name}({angle}°) = ?", vals[name][angle], "Trigonometry", f"Use unit circle. {name}({angle}°) = "
    base = random.choice([2, 10, 5])
    pool = {2: [8, 16, 32, 64], 10: [100, 1000, 10000], 5: [25, 125, 625]}
    v = random.choice(pool[base])
    return f"log_{base}({v}) = ?", round(math.log(v) / math.log(base)), "Logarithms", f"{base}^? = {v} → "

def build_calculus():
    t = random.choice(["derivative", "integral", "tangent"])
    if t == "derivative":
        n, x = rnd(3, 8), rnd(2, 10)
        ans = n * x ** (n - 1)
        return f"d/dx of x^{n} at x = {x}", ans, "Power rule", f"d/dx(x^{n}) = {n}x^{n-1} → {n} x {x}^{n-1} = {n} x {x ** (n - 1)}"
    if t == "integral":
        a, b = rnd(3, 15), rnd(5, 20)
        return f"∫₀¹ ({a}x + {b}) dx", fmt(a / 2 + b), "Definite integral", f"∫({a}x + {b}) = {a/2}x² + {b}x, evaluate 0 to 1"
    x = rnd(2, 8)
    return f"Slope of tangent to y = x² at x = {x}", 2 * x, "Tangent slope", f"dy/dx = 2x → at x = {x}, slope = 2 x {x}"

@app.route("/api/health")
def health():
    return jsonify({"ok": True, "app": "Math"})

@app.route("/api/question")
def question():
    mode = request.args.get("mode", "easy")
    safe = mode if mode in MODE_CONFIG else "easy"
    data = generate_question(safe)
    qid = f"{random.randint(0, 999999)}-{random.random():.6f}"[2:16]
    QUESTION_BANK[qid] = {"correct_letter": data["correct_letter"], "answer": data["answer"]}
    return jsonify({
        "id": qid, "prompt": data["prompt"], "choices": data["choices"],
        "mode": safe, "modeLabel": MODE_CONFIG[safe],
        "topic": data["topic"], "hint": data["hint"]
    })

@app.route("/api/check", methods=["POST"])
def check():
    body = request.json or {}
    qid = body.get("questionId")
    ans = body.get("userAnswer")
    if not qid or not ans:
        return jsonify({"error": "questionId and userAnswer required"}), 400
    cached = QUESTION_BANK.get(qid)
    if not cached:
        return jsonify({"error": "Question expired"}), 404
    letter = ans.strip().upper()
    correct = letter == cached["correct_letter"]
    return jsonify({"correct": correct, "answer": cached["answer"], "correct_letter": cached["correct_letter"]})

@app.route("/api/leaderboard")
def leaderboard():
    store = read_store()
    top = sorted(store["leaderboard"], key=lambda x: -x["score"])[:10]
    return jsonify({"leaderboard": top})

@app.route("/api/progress", methods=["POST"])
def progress():
    body = request.json or {}
    name = body.get("username")
    if not name:
        return jsonify({"error": "username required"}), 400
    score = float(body.get("score", 0))
    level = float(body.get("level", 1))
    mode = body.get("mode", "easy")
    streak = float(body.get("streak", 0))
    lives = float(body.get("lives", 3))
    today = float(body.get("solvedToday", 0))
    safe_mode = mode if mode in MODE_CONFIG else "easy"
    safe_level = max(level, MODE_RANK[safe_mode])
    store = read_store()
    existing = next((p for p in store["players"] if p["username"] == name), None)
    now = __import__("datetime").datetime.now().isoformat()
    if not existing:
        store["players"].append({
            "username": name, "bestScore": score, "bestLevel": safe_level,
            "bestStreak": streak, "bestMode": safe_mode,
            "currentScore": score, "currentStreak": streak,
            "currentLives": lives, "currentSolvedToday": today,
            "currentMode": safe_mode, "lastPlayedAt": now
        })
    else:
        existing["bestScore"] = max(existing["bestScore"], score)
        existing["bestLevel"] = max(existing["bestLevel"], safe_level)
        existing["bestStreak"] = max(existing["bestStreak"], streak)
        existing["bestMode"] = safe_mode
        existing.update({"currentScore": score, "currentStreak": streak, "currentLives": lives,
                         "currentSolvedToday": today, "currentMode": safe_mode, "lastPlayedAt": now})
    top = sorted(store["players"], key=lambda x: -x["bestScore"])[:20]
    store["leaderboard"] = [{"username": p["username"], "score": p["bestScore"]} for p in top]
    write_store(store)
    return jsonify({"ok": True, "profile": next((p for p in store["players"] if p["username"] == name), None)})

@app.route("/api/profile/<username>")
def profile(username):
    store = read_store()
    p = next((x for x in store["players"] if x["username"] == username), None)
    if not p:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"profile": p})

@app.route("/")
def index():
    return send_from_directory("public", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("public", path)

if __name__ == "__main__":
    ensure_store()
    port = int(os.environ.get("PORT", 3000))
    print(f"Math running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port)
