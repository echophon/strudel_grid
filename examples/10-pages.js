// 10 · pages — more controls than keys? Put them on pages.
// grid.page('name') puts the following controls on that page; grid.page(null) = every page.
// grid.pages() is the page switcher: one key per page (bright = here, mid = recently
// changed, dim = elsewhere). The on-screen tabs above the grid do the same.
// Along the bottom row of every page:
//   grid.snapshots() — tap an empty slot = save every control, tap = recall, hold = overwrite
//   grid.transport() — start/stop, pulses on the beat
setcps(0.5)

grid.page(null)                                        // ── every page: the bottom row
grid.pages({ x: 0, y: 7 })                             // x 0–1 (sized to the page count)
grid.snapshots({ id: 'snap', x: 8, y: 7, w: 6 })       // x 8–13
grid.transport({ x: 15, y: 7 })

grid.page('beat')                                      // ── page 1
const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x...' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.x.x.x.x.xx' })
const kit   = grid.radio({ id: 'kit', y: 5, values: ['tr909', 'tr808'] })

grid.page('melody')                                    // ── page 2: the same rows, other keys
const mel = grid.notes({ id: 'mel', y: 0, h: 5, init: '0..2..3.4...2.1.' })
const cut = grid.fader({ id: 'cut', y: 6, range: [200, 6000], exp: true, init: 1500 })

stack(
  s("bd").struct(kick),
  s("sd").struct(snare).gain(.8),
  s("hh").struct(hat).gain(.4),
).bank(kit)
.stack(n(mel).scale("C4:minor").s("sawtooth").lpf(cut).decay(.15).sustain(0).gain(.5))
