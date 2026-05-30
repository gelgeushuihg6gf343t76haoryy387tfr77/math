import random
import json
import sys
import math

def format_num(value):
    if isinstance(value, float):
        return round(value, 2)
    return value

def gen_distractors(correct, count=2):
    distractors = set()
    spread = max(2, abs(correct) * 0.15 if correct != 0 else 3)
    spread = max(2, int(spread))
    attempts = 0
    while len(distractors) < count and attempts < 50:
        choice = random.choice([
            correct + random.randint(1, spread),
            correct - random.randint(1, spread),
            correct + random.randint(-2, 2) + spread // 2,
            correct * random.choice([0.5, 1.5, 2, 0.75]),
            correct + random.choice([1, -1, 2, -2, 3, -3, 5, -5, 10, -10, 15, -15])
        ])
        if isinstance(correct, float):
            choice = round(choice, 2)
        else:
            choice = int(round(choice))
        if choice != correct and choice not in distractors:
            distractors.add(choice)
        attempts += 1
    while len(distractors) < count:
        distractors.add(correct + (len(distractors) + 1) * 3)
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
    return prompt, format_num(answer), "Arithmetic", "Calculate step by step."

def build_middle():
    types = ["fraction", "power", "root"]
    t = random.choice(types)
    if t == "fraction":
        denom = random.randint(5, 15)
        base = random.randint(2, 12)
        add = random.randint(2, 10)
        numer = base * denom + add
        value = numer / denom
        return f"{numer} / {denom} = ? (decimal)", format_num(value), "Fractions", "Divide numerator by denominator."
    if t == "power":
        base = random.randint(3, 12)
        power = random.randint(2, 4)
        return f"{base}^{power} = ?", base ** power, "Exponents", "Multiply base by itself power times."
    root = random.randint(2, 30)
    return f"sqrt({root * root}) = ?", root, "Square roots", "Find the number that squares to the value."

def build_hard():
    types = ["linear", "percent", "ratio"]
    t = random.choice(types)
    if t == "linear":
        x = random.randint(3, 25)
        a = random.randint(3, 15)
        b = random.randint(10, 50)
        c = a * x + b
        return f"Solve for x: {a}x + {b} = {c}", x, "Linear equations", "Isolate x, then divide."
    if t == "percent":
        pct = random.randint(5, 75)
        total = random.randint(100, 1000)
        return f"{pct}% of {total} = ?", format_num((pct / 100) * total), "Percentages", "Multiply total by pct/100."
    a = random.randint(3, 20)
    b = random.randint(3, 20)
    scale = random.randint(2, 6)
    return f"If {a}:{b}, what is {a * scale}:?", b * scale, "Ratios", "Multiply both sides by the same number."

def build_advanced():
    types = ["circle", "sphere", "trig", "log"]
    t = random.choice(types)
    if t == "circle":
        r = random.randint(5, 25)
        area = 3.14 * r * r
        return f"Area of circle radius {r} (π ≈ 3.14)", format_num(area), "Circle area", "A = πr²"
    if t == "sphere":
        r = random.randint(3, 10)
        vol = 4.1867 * r * r * r
        return f"Volume of sphere radius {r} (4/3 π r³)", format_num(vol), "Sphere volume", "V = 4/3 π r³"
    if t == "trig":
        angles = [30, 45, 60]
        angle = random.choice(angles)
        name = random.choice(["sin", "cos", "tan"])
        vals = {"sin": {30: 0.5, 45: 0.71, 60: 0.87}, "cos": {30: 0.87, 45: 0.71, 60: 0.5}, "tan": {30: 0.58, 45: 1, 60: 1.73}}
        return f"{name}({angle}°) = ?", vals[name][angle], "Trigonometry", "Use the unit circle."
    bases = {2: [8, 16, 32, 64], 10: [100, 1000, 10000], 5: [25, 125, 625]}
    base = random.choice(list(bases.keys()))
    v = random.choice(bases[base])
    ans = round(math.log(v) / math.log(base))
    return f"log_{base}({v}) = ?", ans, "Logarithms", "What power of the base gives the number?"

def build_calculus():
    types = ["derivative", "integral", "tangent"]
    t = random.choice(types)
    if t == "derivative":
        n = random.randint(3, 8)
        x = random.randint(2, 10)
        ans = n * x ** (n - 1)
        return f"d/dx of x^{n} at x = {x}", ans, "Power rule", "n · x^(n-1)"
    if t == "integral":
        a = random.randint(3, 15)
        b = random.randint(5, 20)
        val = a / 2 + b
        return f"∫₀¹ ({a}x + {b}) dx", format_num(val), "Definite integral", "Integrate then evaluate bounds."
    x = random.randint(2, 8)
    return f"Slope of tangent to y = x² at x = {x}", 2 * x, "Tangent slope", "Derivative of x² is 2x."

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
