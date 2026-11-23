// 11 · sidebar — the same system controls, stood upright down the right edge.
// pages, snapshots, transport, radio, clips and fader all take `vertical: true`;
// for strips, `w` is then the number of keys downwards.
//
//   x 0–11   page content (12-step rows)     x 13  snapshots (8 slots)
//   x 12     page-specific column            x 15  pages (top) + transport (bottom)
setcps(0.5)

grid.page(null)                                                        // ── every page
grid.pages({ x: 15, y: 0, vertical: true })                            // x 15, y 0–2
grid.transport({ x: 15, y: 4, w: 4, vertical: true })                  // button + 3-cycle counter
grid.snapshots({ id: 'snap', x: 13, y: 0, w: 8, vertical: true })      // x 13, y 0–7

grid.page('beat')
const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x..x..x..x.x' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '...x.....x..' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.xx.xx.xx.x' })
const kit   = grid.radio({ id: 'kit', x: 12, y: 0, vertical: true, values: ['tr909', 'tr808'] })
const fx    = grid.switches({ id: 'fx', y: 5, h: 3, fns: [x=>x.fast(2), x=>x.ply(2), x=>x.degradeBy(.5), rev] })

grid.page('lead')
const mel  = grid.notes({ id: 'mel', y: 0, h: 8, init: '0..4..3.7.5.' })
const cut  = grid.fader({ id: 'cut', x: 12, y: 0, vertical: true, range: [200, 6000], exp: true, init: 1500 })

grid.page('bass')
const bass = grid.clips({ id: 'bass', x: 12, y: 0, vertical: true, patterns: [
  n("0 ~ 0 3"), n("0 0 7 5"), n("<0 -2> ~ 3 ~"), n("0*8").degradeBy(.3) ]})
const line = grid.notes({ id: 'line', y: 0, h: 8, init: '0.......0..3' })   // plays with the clips

stack(
  s("bd").struct(kick).sw(fx.row(0)),
  s("sd").struct(snare).gain(.8).sw(fx.row(1)),
  s("hh").struct(hat).gain(.4).sw(fx.row(2)),
).bank(kit)
.stack(n(mel).scale("C4:minor").s("sawtooth").lpf(cut).lpq(6).decay(.15).sustain(0).gain(.5))
.stack(stack(bass, n(line)).scale("C2:minor").s("square").lpf(500).decay(.2).sustain(0).gain(.4))
