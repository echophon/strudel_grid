// PROTOTYPE — throwaway TUI shell over gridTag.mjs. Run: npm run proto:tags
import * as S from '@strudel/core';
import { miniAllStrings, mini } from '@strudel/mini';
import { STRATEGIES, readTags, makeToggles, wrapForFlash } from './gridTag.mjs';

miniAllStrings();
const { s, note, stack, rev, getTrigger } = S;

const B = (t) => `\x1b[1m${t}\x1b[0m`;
const D = (t) => `\x1b[2m${t}\x1b[0m`;
const G = (t) => `\x1b[32m${t}\x1b[0m`;
const R = (t) => `\x1b[31m${t}\x1b[0m`;

const state = {
  strategy: 'key',
  lane: 'kick',
  bits: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0].map(Boolean),
    snare: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0].map(Boolean),
  },
  cycles: 4,
};

const k = makeToggles('kick', () => state.bits.kick, () => state.strategy);
const n = makeToggles('snare', () => state.bits.snare, () => state.strategy);

let midiCalls = 0;
const midiLike = () => midiCalls++;

// [label, pattern, expectedTagCount(hap)]
const one = () => 1;
const CASES = [
  ['kick (raw widget)', () => k, one],
  ['s("bd").struct(kick)', () => s('bd').struct(k), one],
  ['s("bd*16").mask(kick)', () => s('bd*16').mask(k), one],
  ['s("bd").struct(kick.rev())', () => s('bd').struct(k.rev()), one],
  ['s("bd").struct(kick).fast(2)', () => s('bd').struct(k).fast(2), one],
  ['…struct(kick).firstOf(2, rev)', () => s('bd').struct(k).firstOf(2, rev), one],
  ['…struct(kick).degradeBy(.5)', () => s('bd').struct(k).degradeBy(0.5), one],
  ['…struct(kick).ply(2)', () => s('bd').struct(k).ply(2), one],
  ['…struct(kick).off(1/16, speed 2)', () => s('bd').struct(k).off(1 / 16, (x) => x.speed(2)), one],
  ['note("c e g").struct(kick)', () => note('c e g').struct(k), one],
  ['stack(bd.struct(kick), s("hh*8"))', () => stack(s('bd').struct(k), s('hh*8')), (h) => (h.value.s === 'hh' ? 0 : 1)],
  ['"<0 1>".pick([bd⋅kick, sd⋅snare])', () => mini('<0 1>').pick([s('bd').struct(k), s('sd').struct(n)]), one],
  ['s("bd*16").struct(kick).mask(snare)', () => s('bd*16').struct(k).mask(n), () => 2],
  ['…struct(kick).onTrigger(midi, dominant)', () => s('bd').struct(k).onTrigger(midiLike, true), one],
];

async function evaluateCase([label, build, expect]) {
  const pat = build();
  const haps = pat.queryArc(0, state.cycles).filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin - b.whole.begin);
  let tagged = 0, lost = 0, wrongCell = 0;
  const seq0 = [];
  for (const h of haps) {
    const tags = readTags(h, state.strategy);
    const want = expect(h);
    if (want > 0 && tags.length > 0) tagged++;
    if (tags.length < want) lost++;
    for (const t of tags) if (!state.bits[t.id]?.[t.x]) wrongCell++;
    if (h.whole.begin < 1 && tags[0]) seq0.push(tags.map((t) => t.id[0] + t.x.toString(16)).join('+'));
  }
  const expected = haps.filter((h) => expect(h) > 0).length;

  // Hook simulation: run fired haps through the real repl getTrigger.
  let outputCalls = 0, flashes = 0, taggedFlashes = 0;
  midiCalls = 0;
  const trigger = getTrigger({ defaultOutput: () => outputCalls++, getTime: () => 0 });
  const wrapped = wrapForFlash(pat, (h) => {
    flashes++;
    if (readTags(h, state.strategy).length) taggedFlashes++;
  });
  for (const h of wrapped.queryArc(0, state.cycles).filter((h) => h.hasOnset())) {
    await trigger(h, 0, h.duration, 0.5, h.whole.begin.valueOf());
  }
  return { label, onsets: haps.length, expected, tagged, lost, wrongCell, seq0, outputCalls, midi: midiCalls, flashes, taggedFlashes };
}

const pad = (v, w) => String(v).padEnd(w);
const lane = (name) =>
  state.bits[name].map((b, x) => (b ? '■' : '·')).join('') + (state.lane === name ? B('  ← editing') : '');

async function render() {
  const rows = [];
  for (const c of CASES) rows.push(await evaluateCase(c));
  console.clear();
  console.log(B('PROTOTYPE — tag survival + single trigger hook') + D(`   (${state.cycles} cycles queried)`));
  console.log(`${B('strategy')}  ${STRATEGIES.map((s) => (s === state.strategy ? B(`[${s}]`) : D(s))).join('  ')}`);
  console.log(`${B('kick ')}     ${lane('kick')}`);
  console.log(`${B('snare')}     ${lane('snare')}`);
  console.log(D('           0123456789abcdef'));
  console.log();
  console.log(B(pad('case', 40) + pad('tagged', 9) + pad('lost', 6) + pad('wrong', 7) + pad('out/midi/flash', 16) + 'cycle-0 tags'));
  for (const r of rows) {
    const ok = r.tagged === r.expected && r.lost === 0 && r.wrongCell === 0;
    const hookOk = r.flashes === r.onsets;
    const tag = `${r.tagged}/${r.expected}`;
    console.log(
      pad(r.label, 40) +
        (ok ? G(pad(tag, 9)) : R(pad(tag, 9))) +
        (r.lost ? R(pad(r.lost, 6)) : pad(0, 6)) +
        (r.wrongCell ? R(pad(r.wrongCell, 7)) : pad(0, 7)) +
        (hookOk ? G : R)(pad(`${r.outputCalls}/${r.midi}/${r.flashes}`, 16)) +
        D(r.seq0.slice(0, 8).join(' ') + (r.seq0.length > 8 ? ' …' : '')),
    );
  }
  console.log();
  console.log(D('tagged = haps carrying ≥1 tag / haps that should · lost = haps with fewer tags than widgets that shaped them'));
  console.log(D('wrong = tag points at an OFF cell · out/midi/flash = defaultOutput / dominant trigger / our hook calls'));
  console.log();
  console.log(`${B('[0-f]')} ${D('toggle cell')}  ${B('[l]')} ${D('switch lane')}  ${B('[s]')} ${D('cycle strategy')}  ${B('[r]')} ${D('randomise')}  ${B('[+/-]')} ${D('cycles')}  ${B('[q]')} ${D('quit')}`);
}

if (!process.stdin.isTTY) {
  // non-interactive: print one frame per strategy and exit
  for (const st of STRATEGIES) { state.strategy = st; await render(); }
  process.exit(0);
}
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (key) => {
  if (key === 'q' || key === '\u0003') process.exit(0);
  const x = parseInt(key, 16);
  if (key.length === 1 && !Number.isNaN(x)) state.bits[state.lane][x] = !state.bits[state.lane][x];
  else if (key === 'l') state.lane = state.lane === 'kick' ? 'snare' : 'kick';
  else if (key === 's') state.strategy = STRATEGIES[(STRATEGIES.indexOf(state.strategy) + 1) % STRATEGIES.length];
  else if (key === 'r') state.bits[state.lane] = state.bits[state.lane].map(() => Math.random() < 0.4);
  else if (key === '+') state.cycles++;
  else if (key === '-') state.cycles = Math.max(1, state.cycles - 1);
  await render();
});
await render();
