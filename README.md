# strudel × grid

Live-code music in [Strudel](https://strudel.cc) and play it from a [monome grid](https://monome.org/docs/grid/).
Every key and LED on the grid is declared in your code. Nothing is built in: you pick from a kit of controls
(step rows, pitch matrices, switches, faders, x–y pads, clip launchers, snapshots, pages…) and put
them wherever you like. Optional [hydra](https://hydra.ojack.xyz) visuals can follow the same controls.

## Requirements

- **Node.js 20.19+ or 22.12+** (what Vite 8 requires; tested with 22.17) and npm
- **Chrome or Edge** (or another Chromium browser). Connecting a hardware grid uses WebSerial,
  which Firefox and Safari don't have. Without a grid, everything works in any modern
  browser with the on-screen grid.
- A **monome grid** (optional; tested with a 128, the 16×8 size)
- An internet connection on first run (drum samples, and hydra when used, load from the web)

## Install & run

```sh
git clone https://github.com/echophon/strudel_grid
cd strudel_grid
npm install
npm run dev
```

Open <http://localhost:5173>, press **▶ Run** (or Ctrl+Enter), and click keys on the on-screen grid.

### Connecting a hardware grid

1. Plug in the grid.
2. **Stop serialosc** if it's running, because it holds the grid's serial port and the browser can't open it.
3. Click **Connect grid** and choose the grid from the browser's port list.

The hardware and on-screen grids mirror each other, and either can be played.

## Using it

- **examples…** in the top bar loads a series that starts with a single step row and builds up to a
  full four-page set, including vertical layouts and hydra visuals. **Open…** / **Save** (or drag a
  file onto the editor) load and save your own `.js` projects.
- **⤓ Capture** (Ctrl/Cmd+Shift+Enter) writes what you played on the grid back into the code's
  `init:` options, so a performance becomes source.
- The panel beside the grid lists the controls on the current page.
- **reset** forgets the saved code and grid state (both autosave in the browser).

A minimal project:

```js
const kick = grid.toggles({ y: 0, init: 'x...x...x...x...' })
const cut  = grid.fader({ y: 7, range: [200, 5000], exp: true })

s("bd").struct(kick).lpf(cut)
```

## Development

```sh
npm test           # unit tests (vitest), including every example project
npm run e2e        # browser tests (Playwright); first run: npx playwright install chromium
npm run build      # type-check + production build into dist/
```
