// 06 · choose & shape — radio buttons pick one of several things, faders set a value.
//   grid.radio({ values: [...] }) → a value pattern for any parameter: .bank(kit), .add(oct)
//   grid.radio({ fns: [...] })    → one-of-n transform, used with .sw()
//   grid.fader({ range, exp, glide }) → a continuous value; exp spaces the keys evenly in
//     pitch (good for frequencies); glide slides to the new value over that many cycles.
setcps(0.5)

const mel   = grid.notes({ id: 'mel', y: 0, h: 4, init: '0.2.3.2.0..1.3.2' })
const kick  = grid.toggles({ id: 'kick', y: 4, init: 'x...x...x...x...' })
const kit   = grid.radio({ id: 'kit',   x: 0,  y: 5, values: ['tr909', 'tr808', 'tr707'] })
const oct   = grid.radio({ id: 'oct',   x: 4,  y: 5, values: [-7, 0, 7], init: 1 })
const scene = grid.radio({ id: 'scene', x: 8,  y: 5, fns: [x=>x, x=>x.fast(2), x=>x.iter(4), x=>x.off(1/8, y=>y.add(2))] })
const cut   = grid.fader({ id: 'cut', y: 6, range: [200, 6000], exp: true, glide: .5, init: 1200 })
const room  = grid.fader({ id: 'room', y: 7, w: 8, range: [0, .9] })

stack(
  n(mel.sw(scene).add(oct)).scale("C4:minor").s("sawtooth")
    .lpf(cut).lpq(8).decay(.15).sustain(0).gain(.5).room(room),
  s("bd").struct(kick).bank(kit),
)
