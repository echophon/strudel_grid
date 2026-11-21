// On-screen 16x8 mirror: shows the same levels as the hardware and accepts pointer input
// (hardware and virtual are live at the same time, sharing one key handler).
import { H, W } from '../surface';

export function createVirtualGrid(root: HTMLElement, onKey: (x: number, y: number, down: boolean) => void) {
  root.classList.add('vgrid');
  const cells: HTMLElement[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = document.createElement('div');
      d.className = 'cell';
      d.dataset.x = String(x);
      d.dataset.y = String(y);
      let isDown = false;
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        d.setPointerCapture(e.pointerId);
        isDown = true;
        onKey(x, y, true);
      });
      const up = () => { if (isDown) { isDown = false; onKey(x, y, false); } };
      d.addEventListener('pointerup', up);
      d.addEventListener('pointercancel', up);
      root.appendChild(d);
      cells.push(d);
    }
  const last: number[] = Array(W * H).fill(-1);
  return {
    render(levels: number[][]) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const lv = levels[y][x];
          if (lv === last[i]) continue;
          last[i] = lv;
          cells[i].style.setProperty('--lv', String(lv / 15));
          cells[i].dataset.lv = String(lv);
        }
    },
  };
}
