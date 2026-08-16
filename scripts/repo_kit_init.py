#!/usr/bin/env python3
"""repo_kit_init — Detection-/Scaffold-Engine für das Claude Repo Kit.

Mechanische Schwerarbeit, deterministisch + idempotent. Wird von install.sh UND
vom /repo-kit:repo-kit-init-Skill genutzt; die *Urteils*-Arbeit (gute Beschreibungen,
echte Projektregeln, „lies-wenn"-Routing) macht danach der Mensch/Claude.

Subcommands (Ziel-Repo = $2 oder cwd):
  detect            JSON: {name, stacks, standards, doc_areas, code_areas}
  prefill-claude F  ersetzt die mechanischen {{Platzhalter}} in F (Repo-Name/Bereiche)
  goi-snippet       druckt den passenden §4-Stack-Block für GOI_DOKTRIN.md (zum Einsetzen)
  prefill-goi F     schreibt §4 (erkannter Stack) in F UND blankt §8-Personenkontext → Platzhalter
  scaffold-index D  schreibt D/_INDEX.md aus dem realen Ordner (Register vollständig)
  scaffold-rules    Monorepo mit Stacks in ≥2 Unterordnern → pfadgebundene .claude/rules/*.md
                    (D7, ARCHITECTURE.md); Single-Stack-Repos: no-op (CLAUDE.md bleibt richtig)
  wire-gate         druckt (oder --apply) die Gate-Verdrahtung (pre-commit/CI/npm)

Kein Tool, kein Netzwerk. Überschreibt nie (→ .new bei Konflikt).
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

IGNORE = {".git", "node_modules", "dist", "build", ".venv", "venv", "__pycache__",
          ".stubs", ".next", "out", "target", "templates", "archive"}

# ── Detection ────────────────────────────────────────────────────────────────

def repo_name(root: Path) -> str:
    cfg = root / ".git" / "config"
    if cfg.exists():
        m = re.search(r"url\s*=\s*.*/([^/\n]+?)(?:\.git)?\s*$", cfg.read_text(errors="replace"), re.M)
        if m:
            return m.group(1)
    return root.resolve().name


def _candidate_dirs(root: Path) -> list[Path]:
    """root + Unterordner bis Tiefe 2 (IGNORE/Dotdirs ausgelassen) — für Monorepos
    wie rallylab/ (Python) + rallylab-web/ (Next.js)."""
    dirs = [root]
    try:
        for d1 in sorted(p for p in root.iterdir() if p.is_dir()):
            if d1.name in IGNORE or d1.name.startswith("."):
                continue
            dirs.append(d1)
            for d2 in sorted(p for p in d1.iterdir() if p.is_dir()):
                if d2.name not in IGNORE and not d2.name.startswith("."):
                    dirs.append(d2)
    except OSError:
        pass
    return dirs


def detect_stacks(root: Path) -> tuple[list[str], str]:
    stacks: list[str] = []
    std: list[str] = []

    def add(name: str, standard: str) -> None:
        if name not in stacks:
            stacks.append(name)
            std.append(standard)

    for d in _candidate_dirs(root):  # Root UND Subdirs → Monorepos melden ALLE Stacks
        pkg = d / "package.json"
        if pkg.exists():
            try:
                data = json.loads(pkg.read_text(errors="replace"))
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            except Exception:
                deps = {}
            if "next" in deps:
                add("Next.js (TypeScript)",
                    "- TypeScript/Next.js: App Router + React Server Components default; "
                    "Server Actions statt API-Routes wo möglich; `strict: true`, kein `any`; "
                    "Server-/Client-Component-Grenze bewusst (`'use client'` minimal).")
            elif "react" in deps:
                add("React (TypeScript)",
                    "- React/TypeScript: Function-Components + Hooks; `strict: true`; "
                    "abgeleiteter State statt Duplikat; Effects sparsam.")
            else:
                add("Node.js/TypeScript" if (d / "tsconfig.json").exists() else "Node.js",
                    "- Node.js: kleine reine Module; async/await statt Callbacks; "
                    "Fehler früh werfen, nicht schlucken.")
            if any("supabase" in x for x in deps) or (d / "supabase").is_dir():
                add("Supabase",
                    "- Supabase: RLS-first (jede Tabelle eine Policy); SQL-Migrations versioniert; "
                    "Service-Role-Key nie clientseitig; Auth-Rollen explizit.")
        if (d / "pyproject.toml").exists() or (d / "requirements.txt").exists() or (d / "setup.py").exists():
            blob = ""
            for f in ("pyproject.toml", "requirements.txt"):
                p = d / f
                if p.exists():
                    blob += p.read_text(errors="replace").lower()
            ml = any(k in blob for k in ("torch", "tensorflow", "mps", "scikit", "numpy", "opencv", "ultralytics"))
            add("Python (ML)" if ml else "Python",
                "- Python: Type-Hints überall; reine Funktionen, klare I/O-Grenzen; "
                "PEP8; Pfade über `pathlib`. " +
                ("ML: Determinismus/Seeds dokumentieren, Pipeline-Schritte idempotent." if ml else ""))
        if (d / "Cargo.toml").exists():
            add("Rust", "- Rust: `cargo clippy` clean; `Result`/`?` statt `unwrap` im Prod-Pfad.")
        if (d / "go.mod").exists():
            add("Go", "- Go: `gofmt`/`go vet` clean; Fehler explizit zurückgeben, nicht panic.")

    if not stacks:  # kein Manifest irgendwo → aus Quelldatei-Endungen ableiten (Notebook-/Script-Repo)
        exts = Counter(p.suffix.lower() for p in root.rglob("*")
                       if p.is_file() and not any(part in IGNORE for part in p.parts))
        if exts[".py"] or exts[".ipynb"]:
            stacks.append("Python (Scripts/Notebooks)")
            std.append("- Python: Type-Hints; reine Funktionen, klare I/O-Grenzen; Pfade über `pathlib`. "
                       "Notebooks idempotent halten, Seeds/Determinismus dokumentieren wo relevant.")
        elif exts[".ts"] or exts[".tsx"]:
            stacks.append("TypeScript")
            std.append("- TypeScript: `strict: true`; abgeleiteter State statt Duplikat; kleine reine Module.")
        elif exts[".cs"]:
            stacks.append("C#/.NET")
            std.append("- C#: nullable enable; async/await; klare DI-Grenzen; keine stillen Catches.")
        elif exts[".sql"] or exts[".dax"]:
            stacks.append("Data/Analytics (SQL/DAX)")
            std.append("- SQL/DAX: lesbare CTEs/Measures, keine Magic-Numbers; Quelle→Modell-Trennung sauber halten.")
    if not stacks:
        stacks.append("(Stack nicht erkannt — manuell eintragen)")
        std.append("- {{Code-Standards deines Stacks hier}}")
    return stacks, "\n".join(std)


def count_md(d: Path) -> int:
    return sum(1 for _ in d.rglob("*.md") if not any(p in IGNORE for p in _.parts))


def detect_areas(root: Path) -> tuple[list[str], list[str]]:
    doc, code = [], []
    for child in sorted(p for p in root.iterdir() if p.is_dir()):
        if child.name in IGNORE or child.name.startswith("."):
            continue
        if count_md(child) >= 2:
            doc.append(child.name)
        elif any((child / s).exists() for s in ("src", "app", "lib", "package.json", "pyproject.toml", "__init__.py")) \
                or any(child.glob("*.py")) or any(child.glob("*.ts")) or any(child.glob("*.tsx")):
            code.append(child.name)
    return doc, code


def detect_test_cmd(root: Path) -> str:
    """Projekt-Test-/Check-Kommando erkennen (für das auto-scaffold-Makefile)."""
    for d in _candidate_dirs(root):
        pkg = d / "package.json"
        if pkg.exists():
            try:
                sc = json.loads(pkg.read_text(errors="replace")).get("scripts", {})
            except Exception:
                sc = {}
            if "check" in sc:
                return "npm run check"
            if "test" in sc:
                return "npm test"
    for d in _candidate_dirs(root):
        if (d / "tests").is_dir():
            return "pytest -q"
        pp = d / "pyproject.toml"
        if pp.exists() and "pytest" in pp.read_text(errors="replace").lower():
            return "pytest -q"
    for base in (root, root / "scripts"):
        if base.is_dir():
            for v in sorted(base.glob("validate_*.py")):
                return f"python3 {v.relative_to(root)}"
    return ""


def rule_seeds(root: Path, stacks: list[str]) -> list[tuple[str, str]]:
    """Stack-/Domänen-Regel-SAATEN: Titel = domänenspezifischer Seed, Body bleibt {{…}}
    (du füllst). Keine aktiven Regeln — nur ein besserer Startpunkt als generische Beispiele."""
    sl = " ".join(stacks).lower()
    cdirs = _candidate_dirs(root)
    medallion = (any(any(d.glob(f"*{e}")) for d in cdirs for e in (".dax", ".tmdl"))
                 or "analytics" in sl
                 or any(re.search(r"bronze|silver|gold", p.name, re.I)
                        for d in cdirs for p in d.glob("*.md")))
    seeds: list[tuple[str, str]] = []
    if medallion:
        seeds += [("Medallion-Reihenfolge (Bronze→Silver→Gold)",
                   "{{Regel: nur abwärts Bronze→Silver→Gold schreiben, nie rückwärts; jede Schicht idempotent}}"),
                  ("Nicht-Admin-/Workspace-Grenze",
                   "{{Regel: keine Workspace-Admin-/Capacity-Operationen im Code — nur Daten-/Modell-Ebene}}")]
    if any("next" in s.lower() or "react" in s.lower() for s in stacks):
        seeds.append(("Server-/Client-Grenze",
                      "{{Regel: RSC default, `'use client'` minimal; Server Actions statt API-Routes}}"))
    if any(s.lower().startswith("python") for s in stacks):
        seeds.append(("I/O-Grenzen & Determinismus",
                      "{{Regel: reine Funktionen, klare I/O-Ränder; Seeds/Determinismus dokumentieren}}"))
    if any("supabase" in s.lower() for s in stacks):
        seeds.append(("RLS-first",
                      "{{Regel: jede Tabelle eine Policy; Service-Role-Key nie clientseitig}}"))
    if not seeds:
        seeds = [('{{Regel-Block 1, z. B. „Official-First-Prinzip"}}', "{{…}}"),
                 ('{{Regel-Block 2, z. B. „Build-Pflichtmuster"}}', "{{…}}")]
    return seeds


def scaffold_stack_rules(root: Path) -> list[str]:
    """D7 (docs/ARCHITECTURE.md): Monorepos mit Stacks in ≥2 verschiedenen direkten
    Unterordnern (z. B. `rallylab/`=Python, `rallylab-web/`=Next.js) bekommen pfadgebundene
    `.claude/rules/<dir>.md` (Anthropic-natives Lazy-Load per `paths:`-Frontmatter) statt
    aller Stack-Regel-Seeds gebündelt in der immer geladenen CLAUDE.md — jede Regel lädt nur,
    wenn tatsächlich Dateien unter ihrem Unterordner angefasst werden. Bei nur einem Stack im
    ganzen Repo bleibt CLAUDE.md die richtige Ablage (kein Lazy-Load-Gewinn ohne Trennung).
    Überschreibt nie eine bestehende Regel-Datei (User-editiert bleibt unangetastet)."""
    per_dir: dict[Path, list[str]] = {}
    try:
        for d in sorted(p for p in root.iterdir() if p.is_dir()):
            if d.name in IGNORE or d.name.startswith("."):
                continue
            stacks, _ = detect_stacks(d)
            if stacks:
                per_dir[d] = stacks
    except OSError:
        pass
    if len(per_dir) < 2:
        return []
    rules_dir = root / ".claude" / "rules"
    rules_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for d, stacks in per_dir.items():
        slug = re.sub(r"[^a-z0-9]+", "-", d.name.lower()).strip("-")
        out = rules_dir / f"{slug}.md"
        if out.exists():
            continue
        seeds = rule_seeds(d, stacks)
        body = "\n\n".join(f"### {t}\n{h}" for t, h in seeds)
        out.write_text(
            f"---\npaths: [\"{d.name}/**\"]\n---\n"
            f"# {', '.join(stacks)} — Stack-Regeln ({d.name}/, pfadgebunden — lädt nur hier)\n\n"
            f"{body}\n",
            encoding="utf-8")
        written.append(str(out.relative_to(root)))
    return written


def detect(root: Path) -> dict:
    stacks, std = detect_stacks(root)
    doc, code = detect_areas(root)
    return {"name": repo_name(root), "stacks": stacks, "standards": std,
            "doc_areas": doc, "code_areas": code, "test_cmd": detect_test_cmd(root)}


# ── Actions ──────────────────────────────────────────────────────────────────

def prefill_claude(claude_md: Path, root: Path) -> None:
    d = detect(root)
    txt = claude_md.read_text(encoding="utf-8", errors="replace")
    a = d["doc_areas"] + d["code_areas"] + ["docs"]
    repl = {
        "{{REPO_NAME}}": d["name"],
        "{{AREA_1}}": a[0] if len(a) > 0 else "docs",
        "{{AREA_2}}": a[1] if len(a) > 1 else "src",
        "{{STRATEGIE/PLANUNGS}}": (a[0].capitalize() if a else "Doku") + "-",
        "{{ENTITY}}": (d["doc_areas"][0] if d["doc_areas"] else "entitäten"),
    }
    for k, v in repl.items():
        txt = txt.replace(k, v)
    # Stack-Hinweis an den Regel-Block hängen (statt blind zu raten).
    hint = (f"<!-- AUTO-DETECT: Stack = {', '.join(d['stacks'])} · "
            f"Doc-Bereiche = {', '.join(d['doc_areas']) or '—'} · "
            f"Code-Bereiche = {', '.join(d['code_areas']) or '—'}. "
            f"Restliche Platzhalter = echtes Urteil (deine Projektregeln). -->")
    txt = txt.replace("## Projekt-spezifische Regeln",
                      "## Projekt-spezifische Regeln\n\n" + hint, 1)
    # Regel-Block-SAATEN: generische `### {{Regel-Block N…}}` + {{…}} durch Stack-Saaten ersetzen
    # (Titel = domänenspezifischer Seed, Body bleibt {{…}} → du füllst). Robust per Regex.
    seed_iter = iter(rule_seeds(root, d["stacks"]))

    def _seed(m):
        try:
            t, h = next(seed_iter)
        except StopIteration:
            return m.group(0)
        return f"### {t}\n{h}"

    txt = re.sub(r"^### \{\{Regel-Block \d[^\n]*\}\}\n\{\{[^}]*\}\}", _seed, txt, flags=re.M)
    # Compliance-Befehl mit erkanntem Test/Check vorbelegen
    txt = txt.replace("{{befehl der vor jedem commit/PR grün sein muss}}",
                      d.get("test_cmd") or "make check", 1)
    claude_md.write_text(txt, encoding="utf-8")
    print(f"✓ prefilled {claude_md.name}: name={d['name']} stacks={d['stacks']} "
          f"test={d.get('test_cmd') or '—'}")


def goi_snippet(root: Path) -> None:
    d = detect(root)
    print("## 4. Code-Standards\n")
    print(d["standards"])
    print(f"\n(Erkannt: {', '.join(d['stacks'])}. In GOI_DOKTRIN.md §4 einsetzen; "
          "§8 Context auf dieses Projekt umschreiben.)")


def _replace_section(text: str, num: int, new_block: str) -> str:
    """Ersetzt den `## <num>. …`-Abschnitt (bis zur nächsten `## N.`-Überschrift)."""
    lines = text.splitlines(keepends=True)
    out, i, n = [], 0, len(lines)
    while i < n:
        if re.match(rf"^## {num}\.\s", lines[i]):
            out.append(new_block if new_block.endswith("\n") else new_block + "\n")
            i += 1
            while i < n and not re.match(r"^## \d", lines[i]):
                i += 1
        else:
            out.append(lines[i]); i += 1
    return "".join(out)


def prefill_goi(goi: Path, root: Path) -> None:
    d = detect(root)
    text = goi.read_text(encoding="utf-8", errors="replace")
    text = _replace_section(text, 4, "## 4. Code-Standards\n\n" + d["standards"] + "\n")
    # Defensiv: die Vorlage hat §8 bereits als Platzhalter — falls doch Personenkontext
    # drinsteht (alte GOI), hier auf Platzhalter ziehen (kein fremder Kontext-Bleed).
    text = re.sub(r"^- Nutze bekannten Kontext.*$",
                  "- Nutze den festen Projekt-Kontext: {{Projekt-Kontext: was ist dieses Projekt, "
                  "Zielgruppe, fester Stack-Kontext}} — ohne ihn zu wiederholen.", text, flags=re.M)
    text = re.sub(r"^- .*(Fabric|Power BI|Nagarro|Freelancer|NGO e\.V\.).*$",
                  "- {{Projekt-Kontext hier eintragen}}", text, flags=re.M)
    goi.write_text(text, encoding="utf-8")
    print(f"✓ GOI §4 gesetzt = {', '.join(d['stacks'])}. §8-Projekt-Kontext bleibt Platzhalter (von dir zu füllen).")


def _doc_purpose(p: Path) -> str:
    """Roh-Zweck aus dem Doc ziehen: erste H1, sonst erste Prosa-Zeile (Frontmatter weg)."""
    try:
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return "{{Zweck — 1 Zeile}}"
    i = 0
    if lines and lines[0].strip() == "---":
        for j in range(1, len(lines)):
            if lines[j].strip() == "---":
                i = j + 1
                break
    h1, prose = None, None
    for ln in lines[i:]:
        s = ln.strip()
        if not s:
            continue
        m = re.match(r"^#\s+(.+)", s)
        if m:
            h1 = m.group(1).strip()
            break
        if prose is None and s[0] not in "#>|`-*<":
            prose = s
    cand = re.sub(r"\s+", " ", (h1 or prose or "")).strip()[:80].rstrip(" .—-")
    return cand.replace("|", r"\|") if cand else "{{Zweck — 1 Zeile}}"


def _doc_topic(p: Path) -> str:
    """lies-wenn-Seed aus dem Dateinamen: Datum raus, -/_ → Leerzeichen (du schärfst)."""
    s = re.sub(r"\d{4}[-_.]\d{2}[-_.]\d{2}", "", p.stem)
    s = re.sub(r"[-_]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()[:40].strip().replace("|", r"\|")


def scaffold_index(folder: Path, root: Path) -> None:
    out = folder / "_INDEX.md"
    if out.exists():
        out = folder / "_INDEX.md.new"
    rows = []
    for md in sorted(folder.rglob("*.md")):
        if md.name in ("_INDEX.md", "_INDEX.md.new") or any(p in IGNORE for p in md.parts):
            continue
        rel = md.relative_to(folder)
        dated = " · datiert → ggf. `status: historical`" if re.search(r"\d{4}-\d{2}-\d{2}", md.name) else ""
        topic = _doc_topic(md)
        lieswenn = f"betrifft {topic}" if topic else "{{lies-wenn}}"
        rows.append(f"| `{rel}` | {_doc_purpose(md)}{dated} | {lieswenn} |")
    big = (f"\n     {len(rows)} Docs (>20): erwäge Sub-Bereiche, z. B. {folder.name}/<gruppe>/_INDEX.md."
           ) if len(rows) > 20 else ""
    body = (
        f"---\nlast-reviewed: {{{{YYYY-MM-DD — beim echten Review setzen, nicht Install-Datum}}}}\nshelf-life-days: 90\n---\n"
        f"# {folder.name} — Zentraler Anlaufpunkt (_INDEX)\n\n"
        f"> Einstieg in `{folder.name}/`. Zuerst diese Datei lesen, dann gezielt zum Doc —\n"
        f"> nicht den ganzen Ordner. Offene Punkte unten im Ledger, nicht im Fließtext.\n\n"
        f"## „Lies-wenn\"-Routing (Token-Disziplin)\n\n"
        f"| Deine Aufgabe ist … | Lies | NICHT nötig |\n|---|---|---|\n"
        f"| {{{{Aufgabe}}}} | `{{{{doc}}}}` | {{{{Rest}}}} |\n\n"
        f"## Dokument-Register (vollständig — Drift-Gate erzwingt das)\n\n"
        f"<!-- Code-Bereich? Frontmatter `owns: *.ts, *.sql` ergänzen → Gate erzwingt auch diese Dateien.{big} -->\n"
        f"| Doc | Zweck | Lies-wenn |\n|---|---|---|\n" + "\n".join(rows) + "\n\n"
        f"## Offene Punkte (Ledger — hier abhaken)\n\n"
        f"| ID | Punkt | Status | Datum |\n|---|---|---|---|\n| — | — | — | — |\n"
    )
    out.write_text(body, encoding="utf-8")
    print(f"✓ {out.relative_to(root)} ({len(rows)} Docs registriert). "
          f"Jetzt nur noch Zweck/lies-wenn füllen.")


def wire_gate(root: Path, apply: bool) -> None:
    # Commit-/CI-Gate fährt --strict → blockt ungefüllte {{…}}-Gerüste (Qualitäts-Floor).
    cmd = "python3 scripts/check_index.py --strict"
    # Pre-commit-Hook: bevorzugt `make check` (Single-Entry, falls vorhanden), sonst direkt
    # das Gate — portabel (python3 ODER python; Windows/Git-Bash hat oft nur 'python').
    hook_body = (
        "# claude-repo-kit: strict Gate — `make check` wenn vorhanden, sonst direkt.\n"
        "if [ -f Makefile ] && grep -q '^check:' Makefile && command -v make >/dev/null 2>&1; then\n"
        "  make check || exit 1\n"
        "else\n"
        "  if command -v python3 >/dev/null 2>&1; then PY=python3; else PY=python; fi\n"
        '  "$PY" scripts/check_index.py --strict || exit 1\n'
        "fi\n"
    )
    print("Single-Entry-Gate: Makefile-Vorlage unter .claude/repo-kit/templates/Makefile ins\n"
          "  Repo-Root übernehmen (Make-Repos) → der pre-commit-Hook nutzt dann `make check`.")
    if (root / "package.json").exists():
        print('npm-Script (Single-Entry) — in package.json "scripts": '
              '"check": "python3 scripts/check_index.py --strict"  (eigene Checks mit && anhängen)')
    if (root / ".github").is_dir():
        print(f"GitHub-Actions-Step:\n  - run: {cmd}")
    # pre-commit-Framework? Dann NICHT .git/hooks/pre-commit schreiben (es verwaltet diese
    # Datei selbst → Kollision). Stattdessen einen local-Hook für die Config ausgeben.
    if (root / ".pre-commit-config.yaml").exists() or (root / ".husky").is_dir():
        print("\n⚠ pre-commit-Framework erkannt (.pre-commit-config.yaml/.husky) — KEIN roher\n"
              "  .git/hooks/pre-commit geschrieben (würde kollidieren). Diesen local-Hook in\n"
              "  .pre-commit-config.yaml eintragen:\n"
              "  - repo: local\n"
              "    hooks:\n"
              "      - id: check-index\n"
              "        name: claude-repo-kit drift+quality gate\n"
              "        entry: python3 scripts/check_index.py --strict\n"
              "        language: system\n"
              "        pass_filenames: false\n"
              "        always_run: true")
        return
    hook = root / ".git" / "hooks" / "pre-commit"
    if apply and (root / ".git").is_dir():
        existing = hook.read_text() if hook.exists() else "#!/usr/bin/env sh\n"
        if "check_index.py" not in existing:
            # R2/D10: `.git` ist ein Protected Path — in einer Claude-Code-Session läuft dieser
            # Write über Prompt/Classifier, im `dontAsk`-Modus (CI/headless) wird er HART
            # verweigert. Auch eine aktive Bash-Sandbox sperrt `.git/hooks`. Ein nackter
            # OSError wäre hier irreführend ("Kit kaputt"), obwohl alles wie vorgesehen wirkt.
            try:
                hook.write_text(existing.rstrip() + "\n" + hook_body)
                hook.chmod(0o755)
            except OSError as e:
                print(f"\n⚠ pre-commit-Hook NICHT verdrahtet: {hook} nicht schreibbar ({e.__class__.__name__}: {e}).\n"
                      "  Häufigster Grund ist kein Defekt, sondern Absicht: `.git` ist ein Protected Path.\n"
                      "  In einer Claude-Code-Session muss der Write bestätigt werden, im `dontAsk`-Modus\n"
                      "  (CI/headless) und unter aktiver Bash-Sandbox ist er gesperrt.\n"
                      "  → Gate-Wiring gehört nicht in einen headless Lauf; einmal manuell im Terminal:\n"
                      f"    printf '%s' '{cmd} || exit 1' >> .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit\n"
                      "  Das Gate AUSFÜHREN ist davon unberührt: `python3 scripts/check_index.py --strict`.\n"
                      "  Hintergrund: docs/GATE_HOOKS.md")
            else:
                print(f"\n✓ pre-commit-Hook verdrahtet ({hook.relative_to(root)}) — strict, portabel (python3/python).")
        else:
            print("\n= pre-commit-Hook ruft check_index.py bereits auf.")
    else:
        print(f"\npre-commit (mit --apply automatisch): in .git/hooks/pre-commit:\n  {cmd} || exit 1")


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__); return 2
    cmd = argv[1]
    root = Path(argv[3]).resolve() if (cmd in ("prefill-claude", "scaffold-index", "prefill-goi") and len(argv) > 3) \
        else Path(argv[2]).resolve() if (cmd in ("detect", "goi-snippet", "wire-gate", "scaffold-rules") and len(argv) > 2 and not argv[2].startswith("--")) \
        else Path.cwd()
    if cmd == "detect":
        print(json.dumps(detect(root), ensure_ascii=False, indent=2))
    elif cmd == "prefill-claude":
        prefill_claude(Path(argv[2]).resolve(), root)
    elif cmd == "goi-snippet":
        goi_snippet(root)
    elif cmd == "prefill-goi":
        prefill_goi(Path(argv[2]).resolve(), root)
    elif cmd == "scaffold-index":
        scaffold_index(Path(argv[2]).resolve(), root)
    elif cmd == "scaffold-rules":
        written = scaffold_stack_rules(root)
        print(f"✓ .claude/rules/: {', '.join(written)}" if written
              else "(kein Monorepo mit Stacks in ≥2 Unterordnern — CLAUDE.md bleibt richtig)")
    elif cmd == "wire-gate":
        wire_gate(root, "--apply" in argv)
    else:
        print(__doc__); return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
