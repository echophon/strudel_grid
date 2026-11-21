export const DEFAULT_CODE = `// strudel × grid — everything on the grid is declared here.
// Ctrl+Enter = run · Ctrl+. = stop · grid state is kept by id across runs & reloads.
// PAGES: press BOTH bottom corners together → bottom row shows pages → tap one.
setcps(0.5)

grid.page('seq')
const kick  = grid.toggles({ id: 'kick',  y: 0, init: 'x...x...x...x.x.' })
const snare = grid.toggles({ id: 'snare', y: 1, init: '....x.......x..x' })
const hat   = grid.toggles({ id: 'hat',   y: 2, init: 'x.x.x.xxx.x.x.xx' })
// pitch matrix: column = step, row = scale degree (bottom = 0), tap a lit cell = rest
const mel   = grid.notes({ id: 'mel', y: 3, h: 5, init: '0..2..3.4...2.1.' })

grid.page('fx')
// tap = latch · hold > 300ms = momentary · armed switches blink until the next cycle (q: 1)
const FX = [rev, x=>x.fast(2), x=>x.ply(2), x=>x.degradeBy(.5),
            x=>x.jux(rev), x=>x.lpf(600), x=>x.room(.7)]
const drums = grid.switches({ id: 'drums', y: 0, h: 3, fns: FX })   // one row per drum
const mfx   = grid.switches({ id: 'mfx', y: 4, fns: [               // melody, on DEGREES
  x=>x.add(7), x=>x.add(-7), x=>x.add(2), rev, x=>x.ply(2),
  x=>x.palindrome(), x=>x.off(1/8, y=>y.add(4)) ]})
const glob  = grid.switches({ id: 'glob', y: 6, fns: [
  x=>x.hurry(2), x=>x.iter(4), x=>x.slow(2), x=>x.crush(4) ]})
all(glob.all)

stack(
  s("bd").struct(kick).bank("tr909").sw(drums.row(0)),
  s("sd").struct(snare).bank("tr909").gain(.8).sw(drums.row(1)),
  s("hh").struct(hat).bank("tr909").gain(.4).sw(drums.row(2)),
  n(mel.sw(mfx.all)).scale("C:minor").s("sawtooth")
    .lpf(1200).lpq(6).decay(.15).sustain(0).gain(.6),
)
`;
