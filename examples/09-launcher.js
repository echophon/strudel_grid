// 09 · clip launcher — grid.clips() is a strip of keys, each holding a whole pattern.
// Tap a clip = it starts on the next cycle (blinks until then); tap the playing one = stop.
// Vertical strips make launcher columns, one per instrument.
// pattern.grid({...}) shows ANY pattern on the grid — display only, here the whole mix.
setcps(0.5)

const drums = grid.clips({ id: 'drums', x: 0, y: 0, vertical: true, init: 0, patterns: [
  s("bd*4"), s("bd*4, ~ cp"), s("bd(3,8), hh*8"), s("bd*2, ~ sd, hh*16").gain(.8) ]})
const bass = grid.clips({ id: 'bass', x: 1, y: 0, vertical: true, patterns: [
  n("0 ~ 0 3"), n("0 0 7 5"), n("<0 -2> ~ 3 ~"), n("0*8").degradeBy(.3) ]})
const keys = grid.clips({ id: 'keys', x: 2, y: 0, vertical: true, patterns: [
  n("[0,2,4]"), n("<[0,2,4] [-1,1,3]>"), n("[0,2,4]*4").late(1/8), n("<[0,2,4] [1,3,5] [-1,1,4] [0,2,4]>") ]})
const lead = grid.clips({ id: 'lead', x: 3, y: 0, vertical: true, patterns: [
  n("0 2 4 7"), n("7 ~ 4 ~ 2 ~ 0 ~"), n("[0 2 4 2]*2").fast(2), n("~ 9 ~ 7") ]})

stack(
  drums.bank('tr909'),
  bass.scale("C2:minor").s("square").lpf(500).decay(.2).sustain(0).gain(.45),
  keys.scale("C3:minor").s("triangle").gain(.25).room(.5),
  lead.scale("C5:minor").s("sawtooth").lpf(2500).decay(.12).sustain(0).gain(.3).delay(.3),
).grid({ x: 5, y: 0, w: 11, h: 8 })   // x 5–15: watch everything that plays
