#!/usr/bin/env python3
"""
ETAPA 14 — verificator CAS (SymPy) pentru integrale nedefinite.

Citește items parsate (JSON pe disc), pentru fiecare:
    F = integrate(integrand, var)
    self_check = (d/dx F - integrand) == 0   (simbolic / numeric prin .equals)
și scrie F (LaTeX) + verified. Rulat SEPARAT de pipeline-ul Node, date prin JSON pe disc.

Cheia probei: pentru integrale nedefinite CAS se AUTO-verifică (derivează înapoi), deci NU
depinde de cheia de răspunsuri. Determinist.

ROBUSTEȚE: unele integrale pot face SymPy să exploadeze (memorie/timp). Rulăm fiecare item
într-un WORKER persistent; dacă depășește TIMEOUT, omorâm workerul și marcăm 'timeout', apoi
pornim un worker nou. Astfel un singur input patologic nu blochează toată proba.

Utilizare:
    python verify_integrals.py <in.json> <out.json>     # parent (orchestrare)
    python verify_integrals.py --worker                 # worker (stdin→stdout JSON-lines)
"""
import json
import subprocess
import sys
import threading

TIMEOUT_S = 8.0  # buget per integrală


def _verify_one(integrand_str: str, var_str: str):
    """Returnează (computed_latex|None, verified|None, note). Importă SymPy local (doar în worker)."""
    import sympy as sp
    from sympy.parsing.sympy_parser import parse_expr, standard_transformations

    local = {
        "sqrt": sp.sqrt, "exp": sp.exp, "log": sp.log, "ln": sp.log,
        "sin": sp.sin, "cos": sp.cos, "tan": sp.tan, "cot": sp.cot,
        "sec": sp.sec, "csc": sp.csc,
        "asin": sp.asin, "acos": sp.acos, "atan": sp.atan, "acot": sp.acot,
        "sinh": sp.sinh, "cosh": sp.cosh, "tanh": sp.tanh,
        "Abs": sp.Abs, "Rational": sp.Rational, "pi": sp.pi, "E": sp.E,
    }
    try:
        var = sp.Symbol(var_str or "x")
        integrand = parse_expr(integrand_str, local_dict=local, transformations=standard_transformations, evaluate=True)
    except Exception as e:  # noqa: BLE001
        return None, None, f"parse SymPy esuat: {type(e).__name__}: {e}"

    try:
        F = sp.integrate(integrand, var)
    except Exception as e:  # noqa: BLE001
        return None, False, f"integrate esuat: {type(e).__name__}: {e}"

    if F.has(sp.Integral):
        return sp.latex(F), False, "integrala a ramas neevaluata"

    try:
        diff_back = sp.diff(F, var) - integrand
        ok = diff_back.equals(0)
        if ok is None:
            ok = sp.simplify(diff_back) == 0
        return sp.latex(F), bool(ok), "" if ok else "self-check d/dx F != integrand"
    except Exception as e:  # noqa: BLE001
        return sp.latex(F), False, f"self-check esuat: {type(e).__name__}: {e}"


def run_worker():
    """Citește câte un item JSON pe linie de la stdin, scrie rezultatul JSON pe stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        it = json.loads(line)
        latex, verified, note = _verify_one(it.get("integrand", ""), it.get("var", "x"))
        sys.stdout.write(json.dumps({"computed_latex": latex, "verified": verified, "note": note}) + "\n")
        sys.stdout.flush()


def spawn_worker():
    return subprocess.Popen(
        [sys.executable, __file__, "--worker"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        text=True, encoding="utf-8", bufsize=1,
    )


def ask(worker, item, timeout):
    """Trimite un item workerului; întoarce dict rezultat sau None la timeout/EOF."""
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
        return None  # timeout sau worker mort
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
        res = ask(worker, {"integrand": it.get("integrand", ""), "var": it.get("var", "x")}, TIMEOUT_S)
        if res is None:
            timeouts += 1
            try:
                worker.kill()
            except Exception:  # noqa: BLE001
                pass
            worker = spawn_worker()  # worker proaspăt pentru următorul item
            res = {"computed_latex": None, "verified": False, "note": f"timeout CAS (> {TIMEOUT_S:.0f}s)"}
        out.append({"key": it["key"], **res})
        if (i + 1) % 50 == 0:
            print(f"  …{i + 1}/{len(items)} (timeouts {timeouts})", file=sys.stderr)

    try:
        worker.stdin.close()
        worker.kill()
    except Exception:  # noqa: BLE001
        pass

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    n = len(out)
    ok = sum(1 for r in out if r["verified"] is True)
    print(f"SymPy: {n} items | self_check=true {ok} | false/null {n - ok} | timeouts {timeouts}", file=sys.stderr)


if __name__ == "__main__":
    main()
