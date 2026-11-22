// 03 · lengths & loops — rows don't have to be 16 steps, or start at x 0.
// A row's width is its init length. Without `step` its steps share one cycle (so 12 steps =
// triplets); with `step` each step has a fixed length and rows of different lengths drift
// against each other (polymeter). Two short rows can share one grid row.
//
// Loop a range live: hold one step and tap another → only that range plays. Same again = clear.
// `loop: [a, b]` starts it looped (capture writes it for you).
setcps(0.5)

const kick = grid.toggles({ id: 'kick', y: 0, init: 'x...x...x...x...' })    // 16 in a cycle
const trip = grid.toggles({ id: 'trip', y: 1, init: 'x..x..x..xx.' })        // 12 in a cycle
const rim  = grid.toggles({ id: 'rim',  x: 0, y: 2, init: 'x..x..', step: 1/16 })  // 6 sixteenths
const tom  = grid.toggles({ id: 'tom',  x: 7, y: 2, init: 'x.x..',  step: 1/16 })  // 5 sixteenths
const hat  = grid.toggles({ id: 'hat',  y: 3, init: 'xxxxxxxxxxxxxxxx', loop: [0, 3] })

stack(
  s("bd").struct(kick),
  s("hh").struct(trip).gain(.35).pan(.3),
  s("rim").struct(rim).gain(.5),
  s("lt").struct(tom).gain(.6),
  s("hh").struct(hat).gain(.25).pan(.7),
).bank('tr909')
