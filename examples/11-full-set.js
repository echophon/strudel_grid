// 11 · full set — everything together: four pages, a shared bottom row, fx, clips and a
// live view. Every key and LED on the grid is declared here; nothing is built in.
// Ctrl+Enter = run · Ctrl+. = stop · Ctrl+Shift+Enter = capture grid state into this code
// Primitives: toggles · notes · switches · play · radio · clips · fader · snapshots · transport
//             · pages · pattern.grid() — pick what the piece needs and place it anywhere.
setcps(0.5)

// ── on every page: the bottom row ────────────────────────────────────────────────────────────
grid.page(null)                               // null = shown on every page
grid.pages({ x: 0, y: 7 })                    // page buttons (one per page below)
grid.snapshots({ id: 'snap', x: 8, y: 7, w: 6 }) // tap empty = save · tap = recall · hold = overwrite
grid.transport({ x: 15, y: 7 })               // start/stop, pulses on the beat

// ── drums ───────────────────────────────────────────────────────────────────────────────────
grid.page('drums')
const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x..x' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.xxx.x.x.xx' })
// any length (width = init length); with step they drift against each other — polymeter.
// hold one step + tap another = loop that range (again = clear)
const rim   = grid.toggles({ id: 'rim', x: 0, y: 3, init: 'x..x..', step: 1/16 })  // 6 steps
const tom   = grid.toggles({ id: 'tom', x: 7, y: 3, init: 'x.x..',  step: 1/16 })  // 5 steps
const perc  = grid.play({ id: 'perc', x: 15, y: 3 })     // start/stop rim + tom on the next cycle
const kit   = grid.radio({ id: 'kit', x: 0, y: 5, values: ['tr909', 'tr808'] })

// ── lead ────────────────────────────────────────────────────────────────────────────────────
grid.page('lead')
// pitch matrix: column = step, row = scale degree (bottom = 0), tap a lit cell = rest
const mel   = grid.notes({ id: 'mel', y: 0, h: 5, init: '0..2..3.4...2.1.' })
const oct   = grid.radio({ id: 'oct', x: 0, y: 5, values: [-7, 0, 7], init: 1 })   // octave
const cut   = grid.fader({ id: 'cut', y: 6, range: [200, 6000], exp: true, glide: .5, init: 1200 })

// ── fx: switches = your own transforms · tap = latch · hold = momentary ───────────────────
grid.page('fx')
const dfx   = grid.switches({ id: 'dfx', y: 0, h: 3, fns: [   // one row per drum
  rev, x=>x.fast(2), x=>x.ply(2), x=>x.degradeBy(.5), x=>x.jux(rev), x=>x.lpf(600), x=>x.room(.7) ]})
const mfx   = grid.switches({ id: 'mfx', y: 4, fns: [         // on DEGREES, before .scale()
  x=>x.add(2), rev, x=>x.ply(2), x=>x.palindrome(), x=>x.off(1/8, y=>y.add(4)) ]})
const glob  = grid.switches({ id: 'glob', y: 6, fns: [
  x=>x.hurry(2), x=>x.iter(4), x=>x.slow(2), x=>x.crush(4) ]})
all(glob.all)

// ── perform: launch bass clips, watch the drums ─────────────────────────────────────────────
grid.page('perform')
const bass  = grid.clips({ id: 'bass', y: 0, patterns: [   // tap = queue · tap playing = stop
  n("0 ~ 0 3"), n("0 0 7 5"), n("<0 -2> ~ 3 ~"), n("0*8").degradeBy(.3) ]})

const drums = stack(
  s("bd").struct(kick).sw(dfx.row(0)),
  s("sd").struct(snare).gain(.8).sw(dfx.row(1)),
  s("hh").struct(hat).gain(.4).sw(dfx.row(2)),
  stack(s("rim").struct(rim).gain(.5), s("lt").struct(tom).gain(.6)).sw(perc),
).bank(kit)

stack(
  drums.grid({ page: 'perform', y: 2 }),      // any pattern can be shown on the grid
  n(mel.sw(mfx.all).add(oct)).scale("C:minor").s("sawtooth")
    .lpf(cut).lpq(6).decay(.15).sustain(0).gain(.6),
  bass.scale("C2:minor").s("square").lpf(500).decay(.2).sustain(0).gain(.45),
)
