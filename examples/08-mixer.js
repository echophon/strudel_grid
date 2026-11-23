// 08 · mixer — controls can stand upright. `vertical: true` turns a fader into a column
// (bottom = quiet, top = loud) and a radio/clips/snapshots strip into a stack of keys.
// Here: a 12-step drum machine on the left (x 0–11), mute keys in column 11 below it,
// and a 4-channel volume mixer on the right (x 12–15, 8 keys tall).
setcps(0.5)

const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x..x..x..x.x' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '...x.....x..' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'xxxxxxxxxxxx' })
const open  = grid.toggles({ id: 'open',  y: 3, init: '..x..x..x..x' })

const on0 = grid.play({ id: 'on0', x: 11, y: 4 })   // one key each: start/stop that channel
const on1 = grid.play({ id: 'on1', x: 11, y: 5 })
const on2 = grid.play({ id: 'on2', x: 11, y: 6 })
const on3 = grid.play({ id: 'on3', x: 11, y: 7 })

const v0 = grid.fader({ id: 'v0', x: 12, y: 0, vertical: true, init: 1 })
const v1 = grid.fader({ id: 'v1', x: 13, y: 0, vertical: true, init: .8 })
const v2 = grid.fader({ id: 'v2', x: 14, y: 0, vertical: true, init: .5 })
const v3 = grid.fader({ id: 'v3', x: 15, y: 0, vertical: true, init: .4 })

stack(
  s("bd").struct(kick).gain(v0).sw(on0),
  s("sd").struct(snare).gain(v1).sw(on1),
  s("hh").struct(hat).gain(v2).sw(on2),
  s("oh").struct(open).gain(v3).sw(on3),
).bank('tr909')
