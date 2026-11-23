// 07 · xy pad — grid.xy() is a 2-D pad: one key press sets TWO values.
// Column → pad.x (left = low), row → pad.y (bottom = low). Each is a continuous value,
// just like a fader, so it goes into any parameter: .lpf(pad.x).room(pad.y).
// xExp / yExp space an axis exponentially (frequencies); glide slides to the new point.
// Pads can be any size, and you can have several.
setcps(0.5)

// left: an 8-step pentatonic riff (x 0–7, rows 0–3) and a small drum pad below it
const mel  = grid.notes({ id: 'mel', y: 0, h: 4, init: '0.1.2.3.' })
const dpad = grid.xy({ id: 'dpad', x: 0, y: 4, w: 8, h: 3,
  xRange: [300, 12000], xExp: true,      // → drum filter
  yRange: [0, .6] })                     // → drum delay
// right: a big lead pad (x 8–15, rows 0–6)
const lead = grid.xy({ id: 'lead', x: 8, y: 0, w: 8, h: 7,
  xRange: [150, 8000], xExp: true,       // → filter cutoff
  yRange: [0, 25],                       // → resonance
  glide: .5, init: [1200, 5] })
const kick = grid.toggles({ id: 'kick', y: 7, init: 'x...x...x..xx...' })

stack(
  n(mel).scale("C4:minor:pentatonic").s("sawtooth")
    .lpf(lead.x).lpq(lead.y).decay(.2).sustain(0).gain(.5),
  stack(s("bd").struct(kick), s("hh*8").gain(.4), s("~ cp").gain(.6))
    .bank('tr909').lpf(dpad.x).delay(dpad.y).delaytime(3/16),
)
