// 04 · melody — grid.notes() is a pitch matrix: column = step, row = scale degree
// (bottom row = degree 0). It returns degree numbers, so scale, octave and sound stay in
// code: change "C:minor" and the same shape plays in another key.
// Tap a step to set its pitch; tap the lit key again for a rest.
// poly: true lets a column hold several notes → chords. Two matrices share the rows here:
// a 12-step melody on the left, four whole-cycle chords (step: 1) on the right.
setcps(0.5)

const mel   = grid.notes({ id: 'mel', y: 0, h: 7, init: '0..2..3.4.2.' })               // x 0–11
const chord = grid.notes({ id: 'chord', x: 12, y: 0, h: 7, poly: true, step: 1,
  init: [[0, 2, 4], [1, 3, 5], [0, 3, 5], [1, 4, 6]] })                                   // x 12–15
const kick  = grid.toggles({ id: 'kick', y: 7, init: 'x...x...x...x...' })

stack(
  n(mel).scale("C4:minor").s("sawtooth").lpf(1800).decay(.15).sustain(0).gain(.5),
  n(chord).scale("C3:minor").s("triangle").gain(.25).room(.5),
  s("bd").struct(kick).bank('tr909'),
)
