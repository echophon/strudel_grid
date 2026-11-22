// 02 · drum machine — one row per drum, stacked.
// New: `id` names a control so its state survives edits to its options, and so
// Ctrl+Shift+Enter (capture) can write what you played back into `init:` below.
setcps(0.5)

const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x...' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.x.x.x.x.xx' })
const clap  = grid.toggles({ id: 'clap',  y: 3, init: '................' })  // empty — fill it in

stack(
  s("bd").struct(kick),
  s("sd").struct(snare).gain(.8),
  s("hh").struct(hat).gain(.4),
  s("cp").struct(clap).gain(.6),
).bank('tr909')
