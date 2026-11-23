// 13 · hydra — visuals from the same grid. `await initHydra()` starts hydra behind the page;
// H(pattern) turns any pattern into a live hydra parameter. So one key can move the sound
// AND the picture: here the pad drives the bass filter and the stripes at the same time.
// Hydra reference: https://hydra.ojack.xyz  ·  load any other example to turn the visuals off.
setcps(0.5)
await initHydra()

const kick = grid.toggles({ id: 'kick', y: 0, init: 'x...x...x...x...' })
const pad  = grid.xy({ id: 'pad', y: 1, h: 6, glide: .25,
  xRange: [4, 60], xExp: true,     // stripes  · bass cutoff (×100)
  yRange: [2, 8], init: [10, 4] }) // mirrors  · room
const hue  = grid.fader({ id: 'hue', y: 7, init: .3 })

// picture — H(...) is read every frame
osc(H(pad.x), .05, 1.2)
  .kaleid(H(pad.y))
  .hue(H(hue))
  .scale(() => 1 + .25 * H(kick)())   // kick: 1 on a lit step, 0 between → pulse
  .out()

// sound — the same controls
stack(
  s("bd").struct(kick).bank('tr909'),
  n("0 3 5 7 <10 12> 7 5 3").scale("C2:minor").s("sawtooth")
    .lpf(pad.x.mul(100)).lpq(5).room(pad.y.div(10)).decay(.15).sustain(0).gain(.45),
)
