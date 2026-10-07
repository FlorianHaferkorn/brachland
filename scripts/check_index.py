#!/usr/bin/env python3
"""Index-Drift-Gate — hält die _INDEX.md-Navigation ehrlich UND ungefüllt-frei.

Repo-agnostisch, pure Python. Vier Prüfungen:

  1. VOLLSTÄNDIGKEIT (hart) — Subtree-Ownership: jede `*.md` gehört dem NÄCHSTEN
     Vorfahren-Ordner mit `_INDEX.md` und MUSS dort gelistet sein. Ein Index besitzt
     seinen Unterbaum bis zum nächsten Index → auch `docs/sprints/x.md` wird erfasst,
     ohne den `docs/sprints/_INDEX.md`-Bereich doppelt zu regieren.

  2. PFAD/ANKER (hart) — jeder konkrete Pfad (mit '/') im Index zeigt auf ein echtes
     Ziel; Anker (#frag) gegen die Überschriften-Slugs. Globs/{{…}}/URLs übersprungen,
     ebenso Ziele, die git ignoriert (`.cache/` u. ä. — lokale Belege, im Clone nie vorhanden).

  3. QUALITÄT/PLATZHALTER — `{{…}}` in einem committeten `_INDEX.md`/`CLAUDE.md`/
     `GOI_DOKTRIN.md` = ungefülltes Gerüst. Default: WARNUNG. Mit `--strict`: HART
     (du kannst kein Stub committen). Das ist der maschinell erzwingbare Qualitäts-
     Floor; die Decke (gutes Routing) liefert Mensch/Skill.

  4. STALENESS (advisory) — `last-reviewed` älter als `shelf-life-days` → WARNUNG.

Exit 1 bei harten Befunden, 0 sonst.

Aufruf:  python3 scripts/check_index.py [--strict] [TEILBAUM]
         (pre-commit/CI: --strict; lokal/nach-Scaffold: ohne)
"""
from __future__ import annotations

import datetime as _dt
import fnmatch
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

IGNORE_DIRS = {".git", "node_modules", "dist", "build", ".venv", "venv",
               "__pycache__", ".stubs", ".next", "out", "target"}
EXEMPT_FILES = {"_INDEX.md", "README.md", "README_Template.md", "_MANIFEST.md",
                "CHANGELOG.md", "LICENSE.md", "NAVIGATION_PHILOSOPHY.md",
                "_INDEX.area.md", "_INDEX.ledger.md"}
# Platzhalter-Prüfung gilt nur für echte, gefüllte Dateien — Vorlagen sind ausgenommen.
TEMPLATE_NAMES = {"_INDEX.area.md", "_INDEX.ledger.md"}

DUPE_RE = re.compile(r" \d+(\.[A-Za-z0-9]+)?$")
PATH_RE = re.compile(r"`([^`]+)`")
FRONT_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
PLACEHOLDER_RE = re.compile(r"\{\{[^}]+\}\}")


def slugify(h: str) -> str:
    s = re.sub(r"[^\w\s-]", "", h.strip().lower(), flags=re.UNICODE)
    return re.sub(r"\s+", "-", s)


def headings_of(md: Path) -> set[str]:
    return {slugify(m.group(1)) for m in
            (re.match(r"^#{1,6}\s+(.*)", ln) for ln in md.read_text(encoding="utf-8", errors="replace").splitlines())
            if m}


def find_indexes(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("_INDEX.md")
                  if not any(part in IGNORE_DIRS for part in p.parts))


def ignored(md: Path) -> bool:
    return (any(p in IGNORE_DIRS for p in md.parts) or md.name in EXEMPT_FILES
            or DUPE_RE.search(md.name) or DUPE_RE.search(md.stem))


LIESWENN_HEADER_RE = re.compile(r"nicht\s*n(ö|oe)tig", re.IGNORECASE)


def _register_entries(text: str) -> set[str]:
    """Backtick-Tokens aus Tabellenzeilen außerhalb der lies-wenn-Routing-Tabelle.
    Zählt NICHT: Fließtext (keine `|`-Zeile) und die lies-wenn-Tabelle selbst (erkannt
    an ihrer 'NICHT nötig'-Kopfzeile) — deren 'Lies'/'NICHT nötig'-Spalten sind reine
    Routing-Abkürzung, kein Ersatz für einen echten Register-Eintrag mit Zweck-Zeile
    (sonst wäre eine Erwähnung in der Routing-Tabelle allein schon 'registriert').
    Jede ANDERE Tabelle zählt mit ALLEN Zellen — auch gruppierte Unterbereichs-Register
    (`architecture/` → `a.md`, `b.md`) sind eine bewusst unterstützte Register-Form
    (siehe templates/_INDEX.area.md: 'Granularität wählst DU')."""
    entries: set[str] = set()
    in_lieswenn = False
    for ln in text.splitlines():
        s = ln.strip()
        if not s.startswith("|"):
            in_lieswenn = False
            continue
        if re.match(r"^\|[\s:|-]+\|?$", s):
            continue  # Trennzeile — Tabellen-Zugehörigkeit bleibt wie zuvor
        if LIESWENN_HEADER_RE.search(s):
            in_lieswenn = True
            continue
        if in_lieswenn:
            continue
        for c in s.strip("|").split("|"):
            for m in re.finditer(r"`([^`]+)`", c):
                entries.add(m.group(1).strip())
    return entries


def _registered(rel: Path, entries: set[str], basename_unique: bool) -> bool:
    """Datei gilt als registriert, wenn ihr voller Pfad ODER — nur bei im Teilbaum
    eindeutigem Namen — ihr bloßer Dateiname als Register-Eintrag vorkommt. Ohne die
    Eindeutigkeits-Bedingung würde EIN Basename-Eintrag mehrere gleichnamige Dateien
    in verschiedenen Unterordnern gleichzeitig als 'gelistet' durchgehen lassen."""
    # as_posix() normalises the separator so a forward-slash register entry
    # (e.g. `adr/0001-…md`) matches on Windows too, where str(rel) would yield
    # backslashes. On POSIX as_posix() == str(rel), so CI behaviour is unchanged.
    if rel.as_posix() in entries:
        return True
    return basename_unique and rel.name in entries


def _frontmatter(text: str) -> dict:
    m = FRONT_RE.match(text)
    return dict(re.findall(r"^(\S+):\s*(.+)$", m.group(1), re.MULTILINE)) if m else {}


def _owns_globs(index_text: str) -> list[str]:
    """Opt-in: ein _INDEX deklariert `owns: *.sql, *.ts` → Gate erzwingt auch diese Dateien."""
    raw = _frontmatter(index_text).get("owns", "").strip().strip("[]")
    return [g.strip().strip("'\"") for g in raw.split(",") if g.strip()] if raw else []


def _non_navigated(p: Path) -> bool:
    """Nicht-navigierter Bereich → aus Completeness UND Advisory raus: `_`-präfigierter Dir
    (z. B. `_archive`) oder ein `.claude-no-index`-Marker an einem Vorfahren bis REPO_ROOT."""
    d = (p if p.is_dir() else p.parent).resolve()
    try:
        if any(part.startswith("_") for part in d.relative_to(REPO_ROOT).parts):
            return True
    except ValueError:
        pass
    while True:
        if (d / ".claude-no-index").exists():
            return True
        if d == REPO_ROOT or d.parent == d:
            return False
        d = d.parent


def _owned_code_files(d: Path, text: str, index_dirs: set[Path]) -> list[Path]:
    """Dateien unter `d`, die dessen `owns:`-Globs matchen und keinem tieferen Index gehören."""
    globs = _owns_globs(text)
    if not globs:
        return []
    out = []
    for f in d.rglob("*"):
        if not f.is_file() or f.name == "_INDEX.md" or ignored(f) or _non_navigated(f):
            continue
        if any(part in IGNORE_DIRS for part in f.parts):
            continue
        if next((p for p in f.resolve().parents if p in index_dirs), None) != d:
            continue  # gehört einem tieferen Index
        rel = f.resolve().relative_to(d)
        if any(fnmatch.fnmatch(f.name, g) or fnmatch.fnmatch(str(rel), g) for g in globs):
            out.append(f.resolve())
    return out


ADVISORY_FILE = ".claude-completeness-advisory"
ADVISORY_DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\s*$")


def advisory_state() -> tuple[str, str]:
    """Ist die Vollständigkeitsprüfung befristet auf advisory gestellt? → (zustand, detail).

    Der Zweck ist ein BEFRISTETES Experiment (docs/MEASUREMENT.md, „billigere Alternative"):
    drei Monate beobachten, ob ohne Zwang etwas fehlt, statt 30–40 Messläufe zu bezahlen.
    Deshalb trägt die Datei ein Ablaufdatum und läuft von selbst aus — eine Abschaltung ohne
    Enddatum wäre keine Beobachtung, sondern eine stille Abschaffung.

    Fail-closed: ein unlesbares Datum stuft NICHTS herab, sondern ist ein harter Befund. Ein
    Tippfehler darf das Gate nicht versehentlich entschärfen."""
    f = REPO_ROOT / ADVISORY_FILE
    if not f.is_file():
        return ("off", "")
    for ln in f.read_text(encoding="utf-8", errors="replace").splitlines():
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        m = ADVISORY_DATE_RE.match(s)
        if not m:
            return ("invalid", s[:40])
        return ("active" if m.group(1) >= _dt.date.today().isoformat() else "expired", m.group(1))
    return ("invalid", "(leer)")


def check_completeness(root: Path, indexes: list[Path], errors: list[str],
                       warnings: list[str] | None = None, advisory_until: str = "") -> None:
    index_dirs = {idx.parent.resolve() for idx in indexes}
    cache = {idx.parent.resolve(): idx.read_text(encoding="utf-8", errors="replace") for idx in indexes}
    entries_cache = {d: _register_entries(t) for d, t in cache.items()}

    # Governed .md + owns:-Code-Dateien je Owner sammeln — Basis für die Basename-
    # Eindeutigkeits-Zählung (ein Basename-Register-Eintrag darf nur EINE Datei im
    # Teilbaum abdecken, sonst deckt er versehentlich mehrere gleichnamige gleichzeitig).
    governed: dict[Path, list[Path]] = {d: [] for d in index_dirs}
    for md in root.rglob("*.md"):
        if md.name == "_INDEX.md" or ignored(md) or _non_navigated(md):
            continue
        owner = next((p for p in md.resolve().parents if p in index_dirs), None)
        if owner is not None:
            governed[owner].append(md.resolve())
    for d, text in cache.items():
        governed[d].extend(_owned_code_files(d, text, index_dirs))
    basename_counts = {d: Counter(f.name for f in files) for d, files in governed.items()}
    # Nur die VOLLSTÄNDIGKEIT wird herabgestuft — Pfade und Anker bleiben hart. Ein toter Link
    # ist ein Defekt, kein Pflegerückstand; das Experiment fragt allein nach dem Pflege-Zwang.
    sink = errors if not advisory_until else (warnings if warnings is not None else errors)
    tail = f"  (advisory bis {advisory_until})" if advisory_until else ""

    for md in root.rglob("*.md"):
        if md.name == "_INDEX.md" or ignored(md) or _non_navigated(md):
            continue
        owner = next((p for p in md.resolve().parents if p in index_dirs), None)
        if owner is None:
            continue  # kein Index regiert diesen Ordner — ok
        rel = md.resolve().relative_to(owner)
        unique = basename_counts[owner][md.name] == 1
        if not _registered(rel, entries_cache[owner], unique):
            idx_rel = (owner / "_INDEX.md").relative_to(REPO_ROOT)
            sink.append(f"[Vollständigkeit] {md.relative_to(REPO_ROOT)} fehlt im {idx_rel}{tail}")
    # owns: Code-/Glob-Completeness — HART, aber nur wo ein Index `owns:` deklariert (opt-in).
    for d, text in cache.items():
        for f in _owned_code_files(d, text, index_dirs):
            rel = f.relative_to(d)
            unique = basename_counts[d][f.name] == 1
            if not _registered(rel, entries_cache[d], unique):
                idx_rel = (d / "_INDEX.md").relative_to(REPO_ROOT)
                sink.append(f"[Vollständigkeit/owns] {f.relative_to(REPO_ROOT)} "
                            f"(owns: {', '.join(_owns_globs(text))}) fehlt im {idx_rel}{tail}")


def _strip_fences(text: str) -> str:
    """Fenced Code-Blöcke (``` / ~~~) entfernen, BEVOR Backtick-Tokens gelesen werden.

    Ohne das zerstört ein einziger Fence die Backtick-PAARUNG für den gesamten Rest der
    Datei: die dritte Backtick des öffnenden Fence paart mit der ersten des schließenden,
    der halbe Block wird EIN Token, und jedes danach folgende `pfad.md` fällt in die Lücke
    zwischen zwei Tokens — wird also nicht mehr geprüft. Ein kaputter Pfad hinter einem
    Fence rutschte damit UNBEMERKT durch das harte Gate. Die Kit-eigene Vorlage
    (templates/_INDEX.area.md, Abschnitt „Schichtenmodell") enthält genau so einen Fence,
    d. h. der Fehler betraf jeden daraus erzeugten Index. Ein unterminierter Fence gilt
    wie im Markdown-Renderer bis zum Dateiende als Code."""
    out, in_fence = [], False
    for ln in text.splitlines():
        if re.match(r"^\s*(```|~~~)", ln):
            in_fence = not in_fence
            continue
        if not in_fence:
            out.append(ln)
    return "\n".join(out)


def _git_ignoriert(pfad: Path) -> bool:
    """True, wenn git den Pfad ignoriert. Ohne git (oder ausserhalb des Repos) False — dann bleibt der Befund."""
    try:
        r = subprocess.run(["git", "check-ignore", "-q", str(pfad)], cwd=REPO_ROOT,
                           capture_output=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return False
    return r.returncode == 0


def check_paths(index: Path, errors: list[str]) -> None:
    for raw in PATH_RE.findall(_strip_fences(index.read_text(encoding="utf-8", errors="replace"))):
        ref = raw.strip()
        if not ref or "/" not in ref or "{{" in ref or "*" in ref or ref.startswith(("http://", "https://")):
            continue
        # Prosa/Platzhalter/Verzeichnis-Referenzen NICHT als harte Datei-Pfade prüfen
        # (kein `<passende Datei>`, kein `data/`-Verzeichnis im Fließtext) — nur echte Dateien:
        if any(c in ref for c in " <>"):
            continue
        pathpart = ref.split("#", 1)[0]
        if pathpart.endswith("/") or "." not in pathpart.rsplit("/", 1)[-1]:
            continue
        anchor = None
        if "#" in ref:
            ref, anchor = ref.split("#", 1)
        target = next((c for c in [(index.parent / ref).resolve(), (REPO_ROOT / ref).resolve()] if c.exists()), None)
        if target is None:
            # Verweise auf gitignorte Ablagen (`.cache/`: lokale Mess- und Bildartefakte) sind Belege
            # auf der Maschine, die sie erzeugt hat — ein frischer Clone (CI) hat sie nie.
            if any(_git_ignoriert(c) for c in [index.parent / ref, REPO_ROOT / ref]):
                continue
            errors.append(f"[Pfad] {index.relative_to(REPO_ROOT)} → '{ref}' existiert nicht")
        elif anchor and target.suffix == ".md" and slugify(anchor) not in headings_of(target):
            errors.append(f"[Anker] {index.relative_to(REPO_ROOT)} → '{ref}#{anchor}' trifft keine Überschrift")


ALLOW_PLACEHOLDER_RE = re.compile(r"<!--\s*kit:allow-placeholder\s*-->")


def check_placeholders(path: Path, strict: bool, errors: list[str], warnings: list[str]) -> None:
    if not path.exists() or path.name in TEMPLATE_NAMES:
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    if ALLOW_PLACEHOLDER_RE.search(text):
        return  # Escape-Hatch: Datei dokumentiert bewusst {{…}}-Syntax (z. B. Handlebars/Jinja-Beispiele)
    hits = PLACEHOLDER_RE.findall(text)
    if hits:
        msg = f"[Platzhalter] {path.relative_to(REPO_ROOT)}: {len(hits)} ungefüllte {{…}} (z.B. {hits[0]})"
        (errors if strict else warnings).append(msg)


def check_routing_quality(index: Path, warnings: list[str]) -> None:
    """C/D: Routing-Qualität (advisory) — Lazy-Fill (identische lies-wenn-Zellen),
    Register-Docs ohne Task-Routing-Zeile, und zu große Flach-Register (>20)."""
    text = _strip_fences(index.read_text(encoding="utf-8", errors="replace"))
    rel = index.relative_to(REPO_ROOT)
    pathcount = Counter(p.strip() for p in PATH_RE.findall(text))
    reg_paths, liesvals = [], []
    for ln in text.splitlines():
        s = ln.strip()
        if not s.startswith("|") or re.match(r"^\|[\s:|-]+\|?$", s):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        m = re.search(r"`([^`]+)`", cells[0]) if cells else None
        if m and len(cells) >= 3:
            reg_paths.append(m.group(1).strip())
            liesvals.append(cells[-1])
    if not reg_paths:
        return
    for v, n in Counter(v for v in liesvals if v and "{{" not in v).items():
        if n >= 3:
            warnings.append(f"[Routing] {rel}: lies-wenn '{v[:40]}' {n}× identisch (Lazy-Fill? differenziert nicht)")
    only_reg = [p for p in reg_paths if pathcount[p] <= 1]
    if len(only_reg) >= 3:
        warnings.append(f"[Routing] {rel}: {len(only_reg)}/{len(reg_paths)} Register-Docs in keiner "
                        f"Task-Routing-Zeile (nur Flach-Register) — schwer erreichbar")
    if len(reg_paths) > 20:
        warnings.append(f"[Navigation] {rel}: {len(reg_paths)} Register-Zeilen (>20) — Sub-Index/Gruppen "
                        f"erwägen (ein langes Flach-Register ist selbst ein Scan)")


def check_adr_criterion(index: Path, warnings: list[str]) -> None:
    """S1: Advisory — Ledger-Tabelle B (erkannt an der Kopfzeile '...| ADR |') mit
    mehreren Entscheidungen, aber KEINEM einzigen ADR-Verweis, deutet auf das
    dokumentierte Governance-Vakuum hin (ADR-Layer bleibt leere Vorlage, siehe
    CUT_PLAN_v3.2.md S1). Zählt nur echte Zeilen, keine ungefüllten {{…}}-Stubs."""
    text = index.read_text(encoding="utf-8", errors="replace")
    rel = index.relative_to(REPO_ROOT)
    in_table = False
    decisions = with_adr = 0
    for ln in text.splitlines():
        s = ln.strip()
        if not s.startswith("|"):
            in_table = False
            continue
        if re.match(r"^\|[\s:|-]+\|?$", s):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if cells and cells[-1].strip().upper() == "ADR":
            in_table = True
            continue
        if not in_table or any("{{" in c for c in cells):
            continue
        decisions += 1
        adr = cells[-1].strip()
        if adr and adr not in ("—", "-"):
            with_adr += 1
    if decisions >= 5 and with_adr == 0:
        warnings.append(f"[ADR] {rel}: {decisions} Entscheidungen in Tabelle B, aber kein einziger "
                        f"ADR-Verweis — trägt eine davon ein durables Warum (siehe ADR-Kriterium)?")


def check_dupes(root: Path, warnings: list[str]) -> None:
    """J: ' N'-Kopien (iCloud) sind aus der Completeness ausgenommen — hier sichtbar machen."""
    for f in root.rglob("*.md"):
        if any(p in IGNORE_DIRS for p in f.parts) or _non_navigated(f):
            continue
        if DUPE_RE.search(f.name) or DUPE_RE.search(f.stem):
            warnings.append(f"[Dupe] {f.relative_to(REPO_ROOT)}: sieht aus wie iCloud-Kopie (' N') — "
                            f"aus dem Gate ausgenommen; prüfen/löschen")


CONTEXT_LINE_BUDGET = 200   # Anthropic-Guidance für CLAUDE.md; hier auch auf die GOI angewandt
COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


def _loaded_lines(text: str) -> int:
    """Zeilen, die tatsächlich in den Kontext gelangen — nicht die rohe Dateilänge.

    Block-HTML-Kommentare werden von Claude Code VOR der Injektion entfernt (verifiziert,
    docs/RESEARCH_2026-08.md F9), YAML-Frontmatter ebenso. Beides roh mitzuzählen würde
    Pflegehinweise wie Kontext bepreisen und die Vorlagen des Kits (großer Kommentar-Header)
    fälschlich als zu groß melden."""
    text = FRONT_RE.sub("", text, count=1)
    text = COMMENT_RE.sub("", text)
    return sum(1 for ln in text.splitlines() if ln.strip())


def check_context_size(path: Path, warnings: list[str]) -> None:
    """D-8/GR4: Länge ist der einzige breit gestützte Negativhebel bei Kontextdateien
    (docs/RESEARCH_2026-08-graphs.md G5.11). Bewusst ADVISORY, nie hart: die Evidenzlage
    trägt eine Faustregel, keinen Blocker — und ein Zeilenlimit sagt nichts über Qualität.
    Gilt für die ANWEISUNGS-Schicht (CLAUDE.md/GOI/Regeln), nicht für `_INDEX.md`: Indizes
    wachsen mit dem Repo und werden nicht bei jedem Sessionstart komplett geladen."""
    if not path.is_file():
        return
    n = _loaded_lines(path.read_text(encoding="utf-8", errors="replace"))
    if n > CONTEXT_LINE_BUDGET:
        warnings.append(f"[Größe] {path.relative_to(REPO_ROOT)}: ~{n} geladene Zeilen "
                        f"(> {CONTEXT_LINE_BUDGET}) — lädt bei JEDEM Sessionstart. Kürzen oder "
                        f"Situatives in eine Referenz-/Skill-Datei auslagern.")


def check_staleness(index: Path, warnings: list[str]) -> None:
    rel = index.relative_to(REPO_ROOT)
    fm = _frontmatter(index.read_text(encoding="utf-8", errors="replace"))
    if not fm:
        return
    if fm.get("status", "").strip().lower() in ("historical", "superseded", "frozen"):
        return  # eingefrorenes Artefakt → staleness-frei (F)
    if "last-reviewed" not in fm:
        warnings.append(f"[Staleness] {rel}: kein last-reviewed-Feld"); return
    try:
        age = (_dt.date.today() - _dt.date.fromisoformat(fm["last-reviewed"].strip())).days
        shelf = int(fm.get("shelf-life-days", "90"))
    except ValueError:
        warnings.append(f"[Staleness] {rel}: last-reviewed/shelf-life-days unlesbar"); return
    if age > shelf:
        warnings.append(f"[Staleness] {rel}: vor {age} d reviewt (> {shelf} d) — auffrischen")


def _git_last_commit_date(rel_dir: Path, exclude: str | None = None) -> _dt.date | None:
    """Letztes Commit-Datum, das etwas unter `rel_dir` berührt hat (rein lokal, kein Netz,
    D4/D5-konform). None wenn kein Git-Repo/keine Historie — Aufrufer behandelt das als
    silent skip, kein Fehler."""
    args = ["git", "log", "-1", "--format=%ad", "--date=short", "--", str(rel_dir)]
    if exclude:
        args.append(f":(exclude){rel_dir}/{exclude}")
    try:
        r = subprocess.run(args, cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
        s = r.stdout.strip()
        return _dt.date.fromisoformat(s) if s else None
    except Exception:
        return None


def check_staleness_content(index: Path, warnings: list[str]) -> None:
    """S2: git-gestützter Plausibilitäts-Check (advisory) — ergänzt die reine Datums-
    Staleness um ein Mindestmaß an Inhalts-Signal (weder check_staleness noch die
    verglichene Fiberplane-„Drift" lösen das vollständig, siehe CUT_PLAN_v3.2.md S2)."""
    rel = index.relative_to(REPO_ROOT)
    fm = _frontmatter(index.read_text(encoding="utf-8", errors="replace"))
    if not fm or fm.get("status", "").strip().lower() in ("historical", "superseded", "frozen"):
        return
    if "last-reviewed" not in fm:
        return
    try:
        stamp = _dt.date.fromisoformat(fm["last-reviewed"].strip())
    except ValueError:
        return
    docs_commit = _git_last_commit_date(index.parent.relative_to(REPO_ROOT), exclude="_INDEX.md")
    if docs_commit is None:
        return  # kein Git-Repo/keine Historie unter diesem Pfad — silent skip
    if docs_commit > stamp:
        warnings.append(f"[Staleness/Inhalt] {rel}: Docs im Bereich jünger ({docs_commit}) als "
                        f"last-reviewed ({stamp}) — Stempel nachziehen?")
    elif stamp > docs_commit:
        warnings.append(f"[Staleness/Inhalt] {rel}: last-reviewed ({stamp}) erneuert, aber kein "
                        f"Bereichs-Doc seit {docs_commit} geändert — echte Durchsicht oder nur Stempel?")


def check_unindexed_areas(root: Path, indexes: list[Path], warnings: list[str]) -> None:
    """Advisory: dateireicher Top-Level-Bereich ohne _INDEX.md irgendwo im Subtree →
    Vollständigkeits-Lücke (z. B. scripts/ mit 26 .py). Kein harter Fehler."""
    index_dirs = {idx.parent.resolve() for idx in indexes}
    for child in sorted(p for p in root.iterdir() if p.is_dir()):
        if child.name in IGNORE_DIRS or child.name.startswith(".") or _non_navigated(child):
            continue
        cr = child.resolve()
        if any(d == cr or cr in d.parents for d in index_dirs):
            continue  # Subtree hat schon irgendwo ein _INDEX.md
        n = sum(1 for f in child.rglob("*")
                if f.is_file() and not any(part in IGNORE_DIRS for part in f.parts))
        if n >= 6:
            warnings.append(f"[Navigation] {child.relative_to(REPO_ROOT)}/ hat {n} Dateien, "
                            f"aber kein _INDEX.md — navigierbarer Bereich ohne Index (erwäge einen).")


def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    pos = [a for a in argv[1:] if not a.startswith("--")]
    root = (REPO_ROOT / pos[0]) if pos else REPO_ROOT
    indexes = find_indexes(root)
    errors: list[str] = []
    warnings: list[str] = []
    state, detail = advisory_state()
    advisory_until = detail if state == "active" else ""
    if state == "invalid":
        errors.append(f"[Advisory] {ADVISORY_FILE}: erste inhaltliche Zeile muss ein Ablaufdatum "
                      f"JJJJ-MM-TT sein (gefunden: {detail!r}). Ohne klares Ende wird nichts "
                      f"herabgestuft — Datum korrigieren oder Datei löschen.")
    elif state == "expired":
        warnings.append(f"[Advisory] Die Advisory-Phase endete am {detail}; die "
                        f"Vollständigkeitsprüfung ist wieder HART. Jetzt entscheiden und im "
                        f"Ledger festhalten: behalten (Datei löschen) oder streichen — nicht "
                        f"verlängern, sonst war es keine Beobachtung.")
    if indexes:
        check_completeness(root, indexes, errors, warnings, advisory_until)
        check_unindexed_areas(root, indexes, warnings)
        check_dupes(root, warnings)
        for idx in indexes:
            check_paths(idx, errors)
            check_staleness(idx, warnings)
            check_staleness_content(idx, warnings)
            check_routing_quality(idx, warnings)
            check_adr_criterion(idx, warnings)
            check_placeholders(idx, strict, errors, warnings)
    elif root == REPO_ROOT:
        warnings.append("[Navigation] kein _INDEX.md im Repo — Navigation nicht eingerichtet")
    # CLAUDE.md/GOI IMMER auf Platzhalter prüfen (auch ohne _INDEX — sonst keine Stub-Durchsetzung).
    for f in ("CLAUDE.md", "GOI_DOKTRIN.md"):
        check_placeholders(REPO_ROOT / f, strict, errors, warnings)
    # Größen-Advisory auf der Anweisungs-Schicht (alles, was bei jedem Sessionstart lädt).
    for f in ("CLAUDE.md", "GOI_DOKTRIN.md", ".claude/CLAUDE.md"):
        check_context_size(REPO_ROOT / f, warnings)
    for rule in sorted((REPO_ROOT / ".claude" / "rules").glob("*.md")):
        check_context_size(rule, warnings)
    if advisory_until:
        n = sum(1 for w in warnings if w.startswith("[Vollständigkeit"))
        warnings.append(f"[Advisory] Vollständigkeitsprüfung bis {advisory_until} advisory "
                        f"({n} Befund(e) herabgestuft, sonst hart). Beobachten, ob dadurch "
                        f"etwas fehlt — danach entscheiden, nicht verlängern.")
    for w in warnings:
        print("WARN  " + w)
    for e in errors:
        print("FAIL  " + e)
    mode = "strict" if strict else "lax"
    print(f"[check-index/{mode}] {len(indexes)} Index-Dateien · "
          f"{len(errors)} harte Befunde · {len(warnings)} Warnungen.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
