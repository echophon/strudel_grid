// 01 · first steps — one row of the grid becomes a 16-step sequencer.
// Ctrl+Enter = run · Ctrl+. = stop · tap grid keys (or the on-screen grid) to toggle steps.
//
// grid.toggles() puts a row of on/off keys on the grid and returns a pattern of true/false
// steps. .struct() plays the sound on every lit step. The playhead sweeps along the row.
setcps(0.5)

const kick = grid.toggles({ y: 0, init: 'x...x...x...x...' })

s("bd").struct(kick).bank('tr909')
