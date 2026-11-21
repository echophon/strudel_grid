# PROTOTYPE NOTES — risk #1 (delete prototypes/ once absorbed)

## Question
1. Does a per-cell tag on toggles-widget haps survive Strudel combinators, including two widgets shaping one hap?
2. Does one hook see every fired hap regardless of output (superdough default vs a dominant trigger like `.midi()`)?
3. Does a bare WebSerial/mext connection + truthful flashes feel right on a real 128?

## Answers (from `npm run proto:tags`, Strudel 1.2.6)
- **Tags survive everything tested**: struct, mask, rev, fast, firstOf(rev), degradeBy, ply, off, note/struct, stack, pick.
  Tags follow the *sound*, not the clock: `struct(kick.rev())` fires ke kc k8 k4 k0, so flashes run backwards, as intended.
- **Only the `locations` strategy keeps BOTH tags** when two widgets combine (`struct(kick).mask(snare)`).
  `Hap.combineContext` is a shallow merge except `locations` (concatenated), so our own key AND Strudel's `.tag()` lose one side (16/16 lost).
  → Decision: carry grid tags in `context.locations` as `{grid:{id,x}}` entries, OR patch `Hap.prototype.combineContext` to also concat a `gridTags` key.
  Open: check StrudelMirror's highlighter tolerates location entries without `start/end` (if not, prefer the patch).
- **One hook works**: `repl({editPattern})` + chaining each hap's `context.onTrigger` fires exactly once per onset:
  default output path 20/0/20, dominant `.onTrigger(midi, true)` path 0/20/20 — flash count == onsets in all cases.
- `@strudel/web` bundles its own copy of core → never mix `@strudel/core` imports with it (two Pattern classes/schedulers). Real build: use unbundled packages (codemirror/core/webaudio) or alias.
- `@strudel/web`'s `defaultPrebake` registers synths only — NO samples. Real build must load sample maps
  (felixroos/dough-samples: tidal-drum-machines.json, Dirt-Samples.json) and alias banks (e.g. RolandTR909 → tr909).
- Node: `@kabelsalat/web` has no `exports` map → plain Node loads the IIFE; run headless Strudel via vite-node with deps inlined.

## Hardware spike (`npm run proto:grid`, Chrome, serialosc stopped)
- Verdict (2026-11-21, on the 128): **works — responsive, flashes follow accurately.** Connected fine via the FTDI filter.
  Press latency via scheduler lookahead is acceptable for step edits.
- **Open UX issue — revisit before v1 feedback design is final:** two cases feel odd in practice:
  1. Transformed lanes (e.g. `snare.rev()`): flashes are truthful but run against the dim nominal playhead, and
     lit "on" cells no longer predict *when* they'll sound. Accurate, but confusing to read.
  2. Two widgets shaping one hap (`struct(kick).mask(snare)`): both rows flash for the same event — correct, but
     it's unclear which lane "owns" the sound.
  Ideas to explore later: hide/adjust nominal playhead when a lane is transformed; primary vs secondary tag
  (structure-giving widget flashes bright, masking widget dim); per-widget flash opt-out.

---

# PROTOTYPE 2 — transform switches (grid-spike, `switches.mjs`)

## Question
Do boolean grid switches bound to code-defined transforms feel good — globally via `all()` and per pattern
via `.sw(...)` interspersed in a chain? Does tap=latch / hold=momentary work? Does `q` (cycle-quantised vs immediate) matter?

## Design under test
- `switches({id, x, y, h, fns, q})` — columns = transforms (code-defined fns), rows = independent targets.
  Returns `.at(col, row)` (one switch), `.row(r)` (all switches of a row, applied left→right), `.all` (= row 0).
- `pat.sw(f)` applies a switch/row anywhere in a chain; `all(glob.all)` applies globally.
- Gate splits queries at switch change points and takes each hap from transformed/plain by ONSET →
  no chopped notes, no double triggers; verified identical for one big query vs 0.05-cycle ticks (`_check-gate.mjs`).
- Changes live on a timeline in *cycle* time (lookahead-safe). Armed (pending) switches blink.
- Transformed haps carry the switch's tag → the switch cell flashes in the rhythm it's affecting.

## Verdict
2026-11-21: **works very well.** Some transforms in the default FX/global sets sound off — tuning, not design.
Next gap: step lanes are still hard-wired globals (rows 0–2 → `kick`/`snare`/`hat`), not code-declared like switches.

---

# PROTOTYPE 3 — code-declared widgets + pitch matrix (`widgets.mjs`)

## Question
With nothing hard-wired (`grid.toggles` / `grid.notes` / `grid.switches` declared in code, state by id), does a
pitch matrix (column = step, row = scale degree, bottom = 0; returns degree numbers for `n(mel).scale(...)`) feel
like a good way to sequence notes? Mono (tap replaces pitch, tap lit = rest) vs `poly:true` chords?

## Checked headlessly (`_check-notes.mjs`)
- Degree values, scale mapping and `add(7)` all correct; every note keeps its ABSOLUTE cell tag through n()/add/scale,
  so flashes land on the exact pitch cell (transposed notes flash their source cell).
- Overlapping declarations log a warning; last declared wins. Key-up is routed to the widget that got key-down.

## Verdict
_TBD after playing:_ pitch matrix feel · 5 rows of range enough (with add(7) switch)? · mono vs poly · root-row marker useful?
