// 05 · transforms — grid.switches() turns keys into your own functions.
// Each column is one function; tap = latch on/off, hold = on only while held.
// Changes land on the next cycle. `.sw(f)` applies a switch anywhere in a chain.
//   fx.row(r) → the functions of row r (one row per part)   fx.all → every row
// grid.play() is a single key that starts/stops a pattern on the next cycle.
// all(f) applies a transform to everything that plays.
setcps(0.5)

const kick = grid.toggles({ id: 'kick', y: 0, init: 'x...x...x...x.x.' })
const hat  = grid.toggles({ id: 'hat',  y: 1, init: 'x.x.x.x.x.x.x.xx' })
const bass = grid.play({ id: 'bass', x: 15, y: 3, init: false })

const fx = grid.switches({ id: 'fx', y: 4, h: 2, fns: [   // row 4 → kick, row 5 → hat
  x=>x.fast(2), x=>x.ply(2), x=>x.degradeBy(.5), rev, x=>x.room(.6) ]})
const glob = grid.switches({ id: 'glob', y: 7, fns: [ x=>x.hurry(2), x=>x.slow(2), x=>x.crush(4) ]})
all(glob.all)

stack(
  s("bd").struct(kick).sw(fx.row(0)),
  s("hh").struct(hat).gain(.4).sw(fx.row(1)),
  n("0 ~ 3 5").scale("C2:minor").s("square").lpf(500).decay(.2).sustain(0).gain(.4).sw(bass),
).bank('tr909')
