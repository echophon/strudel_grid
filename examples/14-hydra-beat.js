// 14 · hydra beat — every drum row also plays a visual, and some keys only affect the picture.
//   H(row)               → 1 while a step of that row sounds, 0 between: kick punches, snare
//                          flashes colour, hats shimmer
//   H(pure(1).sw(key))   → a grid.play key as a visual on/off switch (no sound attached)
//   faders               → continuous visual amounts (feedback trails, spin)
setcps(0.5)
await initHydra()

const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x...' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.x.x.x.x.xx' })

const strobe = grid.play({ id: 'strobe', x: 0, y: 4, init: false })   // invert on every kick
const mirror = grid.play({ id: 'mirror', x: 1, y: 4, init: false })   // kaleidoscope
const feed   = grid.fader({ id: 'feed', y: 6, range: [0, .95], init: .5 })
const spin   = grid.fader({ id: 'spin', y: 7, range: [-.3, .3], init: .05 })
const on     = (key) => H(pure(1).sw(key))

osc(20, .03, () => 1 + 2 * H(snare)())
  .modulate(noise(3), () => .03 + .3 * H(hat)())
  .scale(() => 1 + .4 * H(kick)())
  .kaleid(() => (on(mirror)() ? 5 : 1))
  .invert(() => on(strobe)() * H(kick)())
  .blend(src(o0).rotate(H(spin)).scale(1.02), H(feed))
  .out()

stack(
  s("bd").struct(kick),
  s("sd").struct(snare).gain(.8),
  s("hh").struct(hat).gain(.4),
).bank('tr909')
