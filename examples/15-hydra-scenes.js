// 15 · hydra scenes — a performance layout: music on one page, visuals on another, and the
// shared bottom row on both. Snapshots store EVERY control, visual ones included, so a slot
// recalls a whole look + sound. The scene radio blends between three hydra sources and
// changes on the next beat (q: 1/4); the pad glides, so moves look smooth.
setcps(0.5)
await initHydra()

grid.page(null)                                        // ── every page
grid.pages({ x: 0, y: 7 })
grid.snapshots({ id: 'snap', x: 8, y: 7, w: 6 })
grid.transport({ x: 15, y: 7 })

grid.page('music')
const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x...' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.x.x.x.x.xx' })
const bass  = grid.notes({ id: 'bass', y: 3, h: 4, init: '0..0..3.0..2.3..' })

grid.page('visuals')
const scene = grid.radio({ id: 'scene', x: 0, y: 0, vertical: true, q: 1/4, values: [0, 1, 2] })
const pad   = grid.xy({ id: 'pad', x: 2, y: 0, w: 14, h: 6, glide: 1,
  xRange: [2, 40], xExp: true, yRange: [0, 1], init: [8, .3] })
const feed  = grid.fader({ id: 'feed', y: 6, range: [0, .95], init: .6 })
const is    = (k) => () => (H(scene)() === k ? 1 : 0)

osc(H(pad.x), .05, 1.5)                                                  // scene 0: stripes
  .blend(voronoi(() => H(pad.x)() / 4, .3, 2), is(1))                   // scene 1: cells
  .blend(noise(() => 1 + 4 * H(pad.y)(), .1).color(.9, .3, 1), is(2))  // scene 2: clouds
  .rotate(() => H(pad.y)() * .5)
  .scale(() => 1 + .2 * H(kick)())
  .blend(src(o0).scale(1.01), H(feed))
  .out()

stack(
  s("bd").struct(kick),
  s("sd").struct(snare).gain(.8),
  s("hh").struct(hat).gain(.4),
).bank('tr909')
.stack(n(bass).scale("C2:minor").s("square").lpf(pad.x.mul(60)).decay(.2).sustain(0).gain(.4))
