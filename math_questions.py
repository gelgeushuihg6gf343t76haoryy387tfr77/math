import random
import json
import sys

def format_num(value):
    if isinstance(value, float):
        return round(value, 2)
    return value

def gen_distractors(correct, count=2, spread=0):
    distractors = set()
    if spread == 0:
        spread = max(1, abs(correct) * 0.2) if correct != 0 else 3
    spread = max(1, int(spread))
    attempts = 0
    while len(distractors) < count and attempts < 50:
        choice = random.choice([
            correct + random.randint(1, spread),
            correct - random.randint(1, spread),
            correct + random.randint(-2, 2) + spread // 2,
            correct * random.choice([0.5, 1.5, 2, 0.75]),
            correct + random.choice([1, -1, 2, -2, 3, -3, 5, -5, 10, -10])
        ])
        if isinstance(correct, float):
            choice = round(choice, 2)
        else:
            choice = int(round(choice))
        if choice != correct and choice not in distractors:
            distractors.add(choice)
        attempts += 1
    while len(distractors) < count:
        distractors.add(correct + (len(distractors) + 1) * 2)
    return list(distractors)[:count]

def build_easy():
    ops = ["+", "-", "*", "/"]
    op = random.choice(ops)
    if op == "+":
        a = random.randint(1, 40)
        b = random.randint(1, 40)
        answer = a + b
        prompt = f"{a} + {b} = ?"
    elif op == "-":
        a = random.randint(10, 50)
        b = random.randint(1, a)
        answer = a - b
        prompt = f"{a} - {b} = ?"
    elif op == "*":
        a = random.randint(2, 12)
        b = random.randint(2, 12)
        answer = a * b
        prompt = f"{a} x {b} = ?"
    else:
        b = random.randint(2, 12)
        answer = random.randint(2, 12)
        a = b * answer
        prompt = f"{a} / {b} = ?"
    return prompt, format_num(answer), "Core arithmetic", "Go step by step and check each operation."

def build_middle():
    types = ["fraction", "power", "root"]
    t = random.choice(types)
    if t == "fraction":
        denom = random.randint(2, 10)
        base = random.randint(1, 9)
        add = random.randint(1, 9)
        numer = base * denom + add
        value = numer / denom
        return f"{numer} / {denom} = ? (decimal)", format_num(value), "Fractions to decimals", "Divide top by bottom."
    if t == "power":
        base = random.randint(2, 9)
        power = random.randint(2, 3)
        return f"{base}^{power} = ?", base ** power, "Exponents", "Multiply base by itself power times."
    root = random.randint(2, 15)
    return f"sqrt({root * root}) = ?", root, "Square roots", "What number squared gives the inside?"

def build_hard():
    types = ["linear", "percent", "ratio"]
    t = random.choice(types)
    if t == "linear":
        x = random.randint(2, 15)
        a = random.randint(2, 9)
        b = random.randint(1, 20)
        c = a * x + b
        return f"Solve x: {a}x + {b} = {c}", x, "Linear equations", "Move constants, then divide."
    if t == "percent":
        pct = random.randint(5, 40)
        total = random.randint(50, 400)
        return f"{pct}% of {total} = ?", format_num((pct / 100) * total), "Percentages", "Convert % to decimal, multiply."
    a = random.randint(2, 12)
    b = random.randint(2, 12)
    return f"If ratio is {a}:{b}, what is {a * 3}:? second value", b * 3, "Ratios", "Scale both by same number."

def build_advanced():
    types = ["circle", "pythagorean", "quadratic"]
    t = random.choice(types)
    if t == "circle":
        r = random.randint(2, 12)
        return f"Area of circle r={r} (pi=3.14) = ?", format_num(3.14 * r * r), "Geometry (circle area)", "A = pi * r²"
    if t == "pythagorean":
        a = random.randint(3, 12)
        b = random.randint(4, 13)
        c = (a * a + b * b) ** 0.5
        return f"Right triangle legs {a}, {b}. Hypotenuse = ?", format_num(c), "Pythagorean theorem", "c = sqrt(a² + b²)"
    x = random.randint(1, 10)
    p = random.randint(1, 8)
    q = random.randint(1, 8)
    val = (x - p) * (x - q)
    return f"Solve x: (x - {p})(x - {q}) = {val}", x, "Factored equations", "Try values satisfying each bracket."

def build_calculus():
    types = ["derivative", "integral", "slope"]
    t = random.choice(types)
    if t == "derivative":
        n = random.randint(2, 5)
        x = random.randint(2, 6)
        ans = n * x ** (n - 1)
        return f"d/dx of x^{n} at x={x} = ?", ans, "Derivatives", "Power rule: d/dx x^n = n*x^(n-1)"
    if t == "integral":
        a = random.randint(2, 9)
        b = random.randint(1, 9)
        val = a / 2 + b
        return f"Integral from 0 to 1 of ({a}x + {b}) dx = ?", format_num(val), "Definite integrals", "Integrate term by term."
    x = random.randint(1, 8)
    m = random.randint(2, 6)
    c = random.randint(1, 9)
    return f"Slope of y={m}x+{c} at x={x} is ?", m, "Slope", "y=mx+c, slope is always m."

BUILDERS = {
    "easy": build_easy,
    "middle": build_middle,
    "hard": build_hard,
    "advanced": build_advanced,
    "calculus": build_calculus
}

def generate(mode="easy"):
    if mode not in BUILDERS:
        mode = "easy"
    prompt, answer, topic, hint = BUILDERS[mode]()
    distractors = gen_distractors(answer)
    options = distractors + [answer]
    random.shuffle(options)
    correct_idx = options.index(answer)
    letters = ["A", "B", "C"]
    choices = {letters[i]: format_num(options[i]) for i in range(3)}

    result = {
        "prompt": prompt,
        "answer": format_num(answer),
        "choices": choices,
        "correct_letter": letters[correct_idx],
        "topic": topic,
        "hint": hint,
        "mode": mode
    }
    return result

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "easy"
    result = generate(mode)
    print(json.dumps(result))
