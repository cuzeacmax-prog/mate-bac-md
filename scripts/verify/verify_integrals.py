#!/usr/bin/env python3
"""
ETAPA 14/15 — verificator CAS (SymPy) pentru ANALIZĂ (primitive + integrale).

Fiecare item are un `task`:
  - "indefinite": {integrand, var} → F=integrate; self_check = d/dx F == integrand.
  - "primitive" : {F, f, var}      → self_check = d/dx F == f. (verifică/alege primitiva)
  - "definite"  : {integrand, var, lower, upper} → I=integrate(f,(var,a,b)); verifică SIMBOLIC vs
                   NUMERIC (quadratură independentă) că valoarea închisă coincide.
  - "area_volume": ca "definite" (integrandul + limitele vin din enunț).

Cheia probei: pentru integrale CAS se AUTO-verifică (derivează înapoi / compară simbolic↔numeric),
deci NU depinde de cheia de răspunsuri. Determinist.

ROBUSTEȚE: unele integrale pot face SymPy să exploadeze. Fiecare item rulează într-un WORKER
persistent; la depășirea TIMEOUT omorâm workerul, marcăm 'timeout', pornim worker nou.

PARAMETRI SIMBOLICI: dacă self-check-ul rămâne neconcludent și expresia are parametri liberi
(m, n, a, b...), substituim valori numerice concrete ÎNAINTE de comparație (param_used=True).

Utilizare:
    python verify_integrals.py <in.json> <out.json>     # parent (orchestrare)
    python verify_integrals.py --worker                 # worker (stdin→stdout JSON-lines)
"""
import json
import subprocess
import sys
import threading

TIMEOUT_S = 8.0
_PARAM_VALS = [2, 3, 5, 7, 11, 13]


def _check_zero(D, var):
    """(verified, param_used) pentru ipoteza D ≡ 0. Încearcă substituție de parametri liberi."""
    import sympy as sp
    try:
        ok = D.equals(0)
    except Exception:  # noqa: BLE001
        ok = None
    if ok is None:
        try:
            ok = sp.simplify(D) == 0
        except Exception:  # noqa: BLE001
            ok = False
    if ok is True:
        return True, False
    params = sorted([s for s in D.free_symbols if s != var], key=lambda s: s.name)
    if params:
        subs = {p: _PARAM_VALS[i % len(_PARAM_VALS)] for i, p in enumerate(params)}
        try:
            D2 = D.subs(subs)
            ok2 = D2.equals(0)
            if ok2 is None:
                ok2 = sp.simplify(D2) == 0
            if ok2 is True:
                return True, True
        except Exception:  # noqa: BLE001
            pass
    return False, False


def _verify_one(it):
    """Returnează dict {computed_latex, verified, note, param_used}."""
    import sympy as sp
    from sympy.parsing.sympy_parser import parse_expr, standard_transformations

    local = {
        "sqrt": sp.sqrt, "exp": sp.exp, "log": sp.log, "ln": sp.log, "lg": lambda a: sp.log(a, 10),
        "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "cot": sp.cot, "sec": sp.sec, "csc": sp.csc,
        "asin": sp.asin, "acos": sp.acos, "atan": sp.atan, "acot": sp.acot,
        "sinh": sp.sinh, "cosh": sp.cosh, "tanh": sp.tanh,
        "Abs": sp.Abs, "Rational": sp.Rational, "pi": sp.pi, "E": sp.E,
    }
    tr = standard_transformations

    def P(s):
        return parse_expr(s, local_dict=local, transformations=tr, evaluate=True)

    def fail(note):
        return {"computed_latex": None, "verified": None, "note": note, "param_used": False}

    task = it.get("task", "indefinite")
    var = sp.Symbol(it.get("var") or "x")

    try:
        if task == "primitive":
            F = P(it["F"]); f = P(it["f"])
            verified, pu = _check_zero(sp.diff(F, var) - f, var)
            return {"computed_latex": sp.latex(F), "verified": bool(verified), "param_used": pu,
                    "note": "" if verified else "d/dx F != f"}

        if task in ("definite", "area_volume", "rotation_volume"):
            base = P(it["integrand"]); a = P(it["lower"]); b = P(it["upper"])
            f = sp.pi * base ** 2 if task == "rotation_volume" else base  # V = π·∫ f² dx
            val = sp.integrate(f, (var, a, b))
            if val.has(sp.Integral):
                return {"computed_latex": None, "verified": False, "param_used": False,
                        "note": "integrala definita ramasa neevaluata simbolic"}
            # cross-check numeric; dacă rămân parametri liberi (a, m...), substituie valori concrete
            params = sorted([s for s in (f.free_symbols | a.free_symbols | b.free_symbols) if s != var], key=lambda s: s.name)
            param_used = False
            fc, ac, bc, vc = f, a, b, val
            if params:
                subs = {p: _PARAM_VALS[i % len(_PARAM_VALS)] for i, p in enumerate(params)}
                fc, ac, bc, vc = f.subs(subs), a.subs(subs), b.subs(subs), val.subs(subs)
                param_used = True
            try:
                sym = complex(sp.N(vc, 25))
                quad = complex(sp.N(sp.Integral(fc, (var, ac, bc)), 25))  # quadratură independentă
            except Exception as e:  # noqa: BLE001
                return {"computed_latex": sp.latex(val), "verified": False, "param_used": param_used,
                        "note": f"evalf esuat: {type(e).__name__}"}
            agree = abs(sym - quad) <= 1e-6 * (1 + abs(quad))
            return {"computed_latex": sp.latex(val), "verified": bool(agree), "param_used": param_used,
                    "note": "" if agree else f"simbolic {sym:.6g} != numeric {quad:.6g}"}

        # default: indefinite
        integrand = P(it["integrand"])
        F = sp.integrate(integrand, var)
        if F.has(sp.Integral):
            return {"computed_latex": sp.latex(F), "verified": False, "param_used": False,
                    "note": "integrala a ramas neevaluata"}
        verified, pu = _check_zero(sp.diff(F, var) - integrand, var)
        return {"computed_latex": sp.latex(F), "verified": bool(verified), "param_used": pu,
                "note": "" if verified else "self-check d/dx F != integrand"}
    except KeyError as e:
        return fail(f"camp lipsa: {e}")
    except Exception as e:  # noqa: BLE001
        return fail(f"{task} esuat: {type(e).__name__}: {e}")


def run_worker():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        it = json.loads(line)
        sys.stdout.write(json.dumps(_verify_one(it)) + "\n")
        sys.stdout.flush()


def spawn_worker():
    return subprocess.Popen(
        [sys.executable, __file__, "--worker"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1,
    )


def ask(worker, item, timeout):
    holder = {}

    def reader():
        holder["line"] = worker.stdout.readline()

    try:
        worker.stdin.write(json.dumps(item) + "\n")
        worker.stdin.flush()
    except (BrokenPipeError, ValueError):
        return None
    t = threading.Thread(target=reader, daemon=True)
    t.start()
    t.join(timeout)
    if t.is_alive() or not holder.get("line"):
        return None
    return json.loads(holder["line"])


def main():
    if len(sys.argv) == 2 and sys.argv[1] == "--worker":
        run_worker()
        return
    if len(sys.argv) != 3:
        print("Utilizare: python verify_integrals.py <in.json> <out.json>", file=sys.stderr)
        sys.exit(1)
    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    worker = spawn_worker()
    out = []
    timeouts = 0
    for i, it in enumerate(items):
        res = ask(worker, it, TIMEOUT_S)
        if res is None:
            timeouts += 1
            try:
                worker.kill()
            except Exception:  # noqa: BLE001
                pass
            worker = spawn_worker()
            res = {"computed_latex": None, "verified": False, "note": f"timeout CAS (> {TIMEOUT_S:.0f}s)", "param_used": False}
        out.append({"key": it["key"], **res})
        if (i + 1) % 50 == 0:
            print(f"  ...{i + 1}/{len(items)} (timeouts {timeouts})", file=sys.stderr)

    try:
        worker.stdin.close()
        worker.kill()
    except Exception:  # noqa: BLE001
        pass

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    n = len(out)
    ok = sum(1 for r in out if r["verified"] is True)
    pu = sum(1 for r in out if r.get("param_used"))
    print(f"SymPy: {n} items | true {ok} | false/null {n - ok} | param_used {pu} | timeouts {timeouts}", file=sys.stderr)


if __name__ == "__main__":
    main()
