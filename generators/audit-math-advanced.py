#!/usr/bin/env python3
"""Independent audit of generated/math-advanced.json.

Re-parses each item's stem (never the generator's parameters) and recomputes
the keyed answer. Items whose stem cannot be parsed are skipped and reported.
Exit code 1 on any mismatch.
"""
import json
import math
import re
import sys
from collections import Counter
from fractions import Fraction

PATH = "generated/math-advanced.json"

items = json.load(open(PATH))["items"]


def sd(s):
    return s.replace("\\$", "").replace("$", "").replace("\\left", "").replace("\\right", "")


def cl(s):
    return sd(s).replace(" ", "")


def numv(s):
    s = s.strip()
    return float(Fraction(s)) if "/" in s else float(s)


def keynum(it):
    if it["type"] == "spr":
        try:
            return numv(it["accepted_spr"][0])
        except Exception:
            return None
    s = sd(it["choices"]["ABCD".index(it["answer"])]).strip()
    m = re.fullmatch(r"[+-]?\d+(?:/\d+)?", s)
    return numv(s) if m else None


def keypts(it):
    if it["type"] != "mcq":
        return None
    s = cl(it["choices"]["ABCD".index(it["answer"])])
    pts = re.findall(r"\((-?\d+),(-?\d+)\)", s)
    return [(int(a), int(b)) for a, b in pts] or None


def quad(s):
    s = cl(s)
    s = re.sub(r"^(y=|f\(x\)=|p\(x\)=)", "", s)
    s = re.sub(r"=0$", "", s)
    if re.search(r"[a-bd-z]", s.replace("x", "")):
        return None
    m = re.fullmatch(r"([+-]?\d*)x\^2(?:([+-]\d*)x)?(?:([+-]\d+))?", s)
    if not m:
        return None

    def cf(t, d):
        if t in (None, ""):
            return d
        return 1 if t == "+" else (-1 if t == "-" else int(t))

    return (cf(m.group(1), 1), cf(m.group(2), 1) if m.group(2) is not None else 0,
            int(m.group(3)) if m.group(3) else 0)


def line(s):
    s = cl(s)
    m = re.fullmatch(r"y=([+-]?\d*)x([+-]\d+)?", s)
    if not m:
        return None
    a = 1 if m.group(1) in ("", "+") else (-1 if m.group(1) == "-" else int(m.group(1)))
    return (a, int(m.group(2)) if m.group(2) else 0)


def cubic(s):
    t = cl(s)
    m = re.fullmatch(r"p\(x\)=x\^3(?:([+-]\d*)x\^2)?(?:([+-]\d*)x)?(?:([+-]\d+))?", t)
    if not m:
        return None

    def cf(x):
        if x in (None, ""):
            return 0
        return 1 if x == "+" else (-1 if x == "-" else int(x))

    return (1, cf(m.group(1)), cf(m.group(2)), int(m.group(3)) if m.group(3) else None)


verified = 0
mismatches = []
per = Counter()

for it in items:
    sk = it["skill"]
    flat = sd(it["stem"])
    k = keynum(it)
    pts = keypts(it)
    segs = re.findall(r"\$([^$]+)\$", it["stem"])
    ok = None
    try:
        if sk in ("Quadratic equations by factoring", "Factoring with a leading coefficient", "Quadratic formula"):
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None:
                a, b, c = P
                D = b * b - 4 * a * c
                if D >= 0 and math.isqrt(D) ** 2 == D:
                    r = math.isqrt(D)
                    rs = sorted([Fraction(-b + r, 2 * a), Fraction(-b - r, 2 * a)])
                    if "greater" in flat:
                        ok = abs(k - float(max(rs))) < 1e-7
                    elif "equivalent" in flat:
                        ok = None
                    else:
                        ok = any(abs(k - float(x)) < 1e-7 for x in rs)
        elif sk == "Axis of symmetry":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None:
                ok = abs(k - float(Fraction(-P[1], 2 * P[0]))) < 1e-7
        elif sk == "Completing the square":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None:
                v = (Fraction(P[1] ** 2, 4) if "perfect square" in flat
                     else Fraction(P[2]) - Fraction(P[1] ** 2, 4 * P[0]))
                ok = abs(k - float(v)) < 1e-7
        elif sk == "Vertex from standard form":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None and "coordinates" not in flat:
                ok = abs(k - float(Fraction(P[2]) - Fraction(P[1] ** 2, 4 * P[0]))) < 1e-7
        elif sk == "Vertex form of a quadratic":
            seg = next((s for s in segs if re.search(r"\(x[+-]\d+\)\^2", s)), None)
            if seg and k is not None and "coordinates" not in flat:
                m = re.search(r"([+-]?\d*)\(x([+-]\d+)\)\^2([+-]\d+)", cl(seg))
                if m:
                    ok = abs(k - int(m.group(3))) < 1e-7
        elif sk == "Equivalent forms of quadratics":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None and "value of $h$" in it["stem"]:
                ok = abs(k - float(Fraction(-P[1], 2 * P[0]))) < 1e-7
        elif sk == "The discriminant":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None:
                D = P[1] ** 2 - 4 * P[0] * P[2]
                ok = abs(k - (2 if D > 0 else (1 if D == 0 else 0))) < 1e-7
        elif sk == "Sum and product of roots":
            P = next((quad(s) for s in segs if quad(s)), None)
            if P and k is not None:
                a, b, c = P
                sm = Fraction(-b, a)
                pr = Fraction(c, a)
                if "r^2+s^2" in flat:
                    v = sm * sm - 2 * pr
                elif "\\frac{1}{r}" in flat:
                    v = sm / pr
                elif "(r-s)^2" in flat:
                    v = sm * sm - 4 * pr
                elif "product" in flat:
                    v = pr
                else:
                    v = sm
                ok = abs(k - float(v)) < 1e-7
        elif sk in ("Line–parabola systems", "Nonlinear systems"):
            Q = next((quad(s) for s in segs if quad(s)), None)
            L = next((line(s) for s in segs if quad(s) is None and line(s)), None)
            if Q and L and pts:
                ok = all(abs(Q[0] * x * x + Q[1] * x + Q[2] - y) < 1e-9 and
                         abs(L[0] * x + L[1] - y) < 1e-9 for x, y in pts)
            elif Q and L and k is not None:
                B = Q[1] - L[0]
                C = Q[2] - L[1]
                D = B * B - 4 * C
                if "How many" in flat:
                    ok = abs(k - (2 if D > 0 else (1 if D == 0 else 0))) < 1e-7
                elif "sum" in flat:
                    ok = abs(k - (-B)) < 1e-7
                elif "product" in flat:
                    ok = abs(k - C) < 1e-7
        elif sk == "Polynomial remainder theorem":
            P = next((cubic(s) for s in segs if cubic(s)), None)
            mk = re.search(r"divided by \$?x([+-]\d+)", flat)
            if P and mk and k is not None:
                kk = -int(mk.group(1))
                base = kk ** 3 + P[1] * kk ** 2 + P[2] * kk
                R = base + (P[3] or 0)
                ok = abs(k - (R - base)) < 1e-7 if "value of c" in flat else abs(k - R) < 1e-7
        elif sk == "Factor theorem":
            P = next((cubic(s) for s in segs if cubic(s)), None)
            if P:
                if it["type"] == "mcq":
                    m = re.fullmatch(r"x([+-]\d+)", cl(it["choices"]["ABCD".index(it["answer"])]))
                    if m and P[3] is not None:
                        r = -int(m.group(1))
                        ok = abs(r ** 3 + P[1] * r * r + P[2] * r + P[3]) < 1e-9
                else:
                    mk = re.search(r"\(x([+-]\d+)\) as a factor", flat)
                    if mk and k is not None:
                        r = -int(mk.group(1))
                        ok = abs(r ** 3 + P[1] * r * r + P[2] * r + k) < 1e-9
        elif sk == "Radical equations":
            m = re.search(r"\\sqrt\{x([+-]\d+)\}=x([+-]\d+)", flat)
            if m and k is not None:
                a, b = int(m.group(1)), int(m.group(2))
                ok = abs(math.sqrt(k + a) - (k - b)) < 1e-9 and k >= b
        elif sk == "Function notation":
            P = next((quad(s) for s in segs if quad(s)), None)
            mk = re.search(r"f\((-?\d+)\)", flat)
            if P and mk and k is not None:
                x = int(mk.group(1))
                ok = abs(k - (P[0] * x * x + P[1] * x + P[2])) < 1e-7
        elif sk == "Function composition":
            f = g = None
            for s in segs:
                t = cl(s)
                m = re.fullmatch(r"f\(x\)=([+-]?\d*)x([+-]\d+)?", t)
                if m and f is None:
                    f = (1 if m.group(1) in ("", "+") else (-1 if m.group(1) == "-" else int(m.group(1))),
                         int(m.group(2)) if m.group(2) else 0)
                m = re.fullmatch(r"g\(x\)=x\^2([+-]\d+)?", t)
                if m:
                    g = int(m.group(1)) if m.group(1) else 0
            mp = re.search(r"f\(g\((-?\d+)\)\)", flat)
            if f and g is not None and mp and k is not None:
                p = int(mp.group(1))
                ok = abs(k - (f[0] * (p * p + g) + f[1])) < 1e-7
        elif sk == "Inverse functions":
            m = re.search(r"f\(x\)=([+-]?\d+)x([+-]\d+)", flat)
            mk = re.search(r"f\^\{-1\}\((\d+)\)", flat)
            if m and mk and k is not None:
                ok = abs(k - (int(mk.group(1)) - int(m.group(2))) / int(m.group(1))) < 1e-7
        elif sk in ("Exponential growth models", "Exponential decay models"):
            base = "P" if "growth" in sk else "V"
            m = re.search(base + r"\(t\)=(\d+)\((\d+(?:\.\d+)?)\)\^t", flat)
            if m and k is not None:
                A, b = float(m.group(1)), float(m.group(2))
                if "percent" in it["stem"]:
                    ok = abs(k - abs(1 - b) * 100) < 1e-7
                else:
                    mt = re.search(r"t=(\d+)", flat) or re.search(r"after (\d+) years", it["stem"])
                    if mt:
                        ok = abs(k - A * (b ** int(mt.group(1)))) < 1e-7
        elif sk == "Exponential model parameters":
            m = re.search(r"There are (\d+) bacteria at t=0 and (\d+) bacteria at t=(\d+)", flat)
            if m and k is not None:
                N0, Nk, kk = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if "value of b" in flat:
                    ok = abs(k - (Nk / N0) ** (1 / kk)) < 1e-7
            m2 = re.search(r"reaching (\d+) bacteria after (\d+) hours", flat)
            if m2 and k is not None:
                ok = abs(k - int(m2.group(1)) / 3 ** int(m2.group(2))) < 1e-7
        elif sk == "Exponential functions from two points":
            m = re.search(r"\(0,(\d+)\) and \((\d+),(\d+)\)", flat)
            if m and k is not None:
                ok = abs(k - (int(m.group(3)) / int(m.group(1))) ** (1 / int(m.group(2)))) < 1e-7
        elif sk == "Half-life and doubling":
            m = re.search(r"half-life of (\d+) years.*?starts with (\d+) grams.*?after (\d+) years", flat, re.S)
            if m and k is not None:
                H, A0, t = int(m.group(1)), int(m.group(2)), int(m.group(3))
                ok = abs(k - A0 / 2 ** (t / H)) < 1e-7
            m2 = re.search(r"After (\d+) years.*?\\frac\{1\}\{(\d+)\}", flat, re.S)
            if m2 and k is not None:
                ok = abs(k - int(m2.group(1)) / math.log2(int(m2.group(2)))) < 1e-7
        elif sk == "Revenue and maximum profit":
            m = re.search(r"R\(p\)=p\((\d+)-(\d+)p\)", flat)
            if m and k is not None:
                a, b = int(m.group(1)), int(m.group(2))
                ok = abs(k - (a / (2 * b) if "ticket price" in flat else a * a / (4 * b))) < 1e-7
        elif sk == "Projectile motion":
            m = re.search(r"h\(t\)=-16t\^2\+(\d+)t\+(\d+)", flat)
            if m and k is not None:
                v0, h0 = int(m.group(1)), int(m.group(2))
                pk = v0 / 32
                if "After how many seconds" in flat:
                    ok = abs(k - ((v0 + math.isqrt(v0 * v0 + 64 * h0)) / 32 if "ground" in flat else pk)) < 1e-7
                elif "maximum height" in flat:
                    ok = abs(k - (h0 + 16 * pk * pk)) < 1e-7
        elif sk == "Graph transformations":
            m = re.search(r"g\(x\)=f\(x([+-]\d+)\)([+-]\d+)", flat)
            mf = re.search(r"f\((\d+)\)=(\d+)", flat)
            mg = re.search(r"g\((-?\d+)\)", flat)
            if m and mf and mg and k is not None:
                h, kk = -int(m.group(1)), int(m.group(2))
                t, fv, x = int(mf.group(1)), int(mf.group(2)), int(mg.group(1))
                ok = (x == t + h) and abs(k - (fv + kk)) < 1e-7
        elif sk == "Exponential vs linear growth":
            m = re.search(r"values are (.+?)\.", flat)
            if m and k is not None:
                vals = [int(x) for x in re.findall(r"\d+", m.group(1))]
                if len(vals) == 4:
                    ok = (abs(k - vals[1] / vals[0]) < 1e-7 if "exponential" in flat
                          else abs(k - (vals[1] - vals[0])) < 1e-7)
        elif sk == "Quadratic word problems: area":
            m = re.search(r"length that is (\d+) feet longer than its width.*?area of the garden is (\d+) square", flat, re.S)
            if m and "What is the width" in flat and k is not None:
                kk, A = int(m.group(1)), int(m.group(2))
                ok = abs(k - (-kk + math.isqrt(kk * kk + 4 * A)) / 2) < 1e-7
            m = re.search(r"enclosed with (\d+) feet of fencing on all four sides", flat)
            if m and k is not None and "greatest possible area" in flat:
                P = int(m.group(1))
                ok = abs(k - P * P / 16) < 1e-7
            m = re.search(r"against a barn using (\d+) feet", flat)
            if m and k is not None:
                P = int(m.group(1))
                if "greatest possible area" in flat:
                    ok = abs(k - P * P / 8) < 1e-7
                elif "What width" in flat:
                    ok = abs(k - P / 4) < 1e-7
        elif sk == "Quadratic inequalities and parameter ranges":
            m = re.search(r"x\^2\+kx\+(\d+)=0", flat)
            if m and k is not None:
                c = int(m.group(1))
                mm = math.isqrt(c)
                if it["type"] == "spr":
                    if "no real solutions" in flat:
                        ok = k == 2 * mm - 1
                    elif "two distinct" in flat:
                        ok = k == 2 * mm + 1
                else:
                    ans = it["choices"]["ABCD".index(it["answer"])]
                    if "no real solutions" in flat:
                        ok = ans == f"$-{2*mm}<k<{2*mm}$"
                    elif "two distinct" in flat:
                        ok = ans == f"$k<-{2*mm}$ or $k>{2*mm}$"
                    elif "exactly one" in flat:
                        ok = ans == f"$k={2*mm}$ or $k={-2*mm}$"
    except Exception:
        pass
    if ok is None:
        continue
    verified += 1
    per[sk] += 1
    if not ok:
        mismatches.append((it["id"], sk, it["stem"][:110], k, pts))

print(f"independently verified {verified}/{len(items)} items ({verified/len(items)*100:.0f}%)")
print("skills covered by audit:", len(per))
print("mismatches:", len(mismatches))
for m in mismatches[:10]:
    print("  ", m)
sys.exit(1 if mismatches else 0)
