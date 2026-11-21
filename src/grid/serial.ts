// WebSerial grid device (Chromium only). serialosc must not be holding the port.
import { createParser, encodeQuadrant, QUERY, REQUEST_ID, REQUEST_SIZE, type MextMessage } from './mext';

export interface SerialGrid {
  /** push a full frame; only changed 8x8 quadrants are sent */
  sendFrame(levels: number[][]): void;
  close(): Promise<void>;
}

// navigator.serial isn't in TS's DOM lib yet
type Port = any;

export async function connectSerialGrid(opts: {
  onKey(x: number, y: number, down: boolean): void;
  onInfo?(m: MextMessage): void;
  onDisconnect?(): void;
}): Promise<SerialGrid> {
  const serial = (navigator as any).serial;
  if (!serial) throw new Error('WebSerial is not available in this browser (use Chrome or Edge)');
  // No vendor filter: grids use FTDI (0x0403) or, on recent editions, other USB-serial chips.
  const port: Port = await serial.requestPort();
  await port.open({ baudRate: 115200 });
  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();
  let open = true;

  const parse = createParser((m) => {
    if (m.type === 'key') opts.onKey(m.x, m.y, m.down);
    else opts.onInfo?.(m);
  });
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parse(value);
      }
    } catch {
      /* device unplugged */
    } finally {
      open = false;
      opts.onDisconnect?.();
    }
  })();

  await writer.write(QUERY);
  await writer.write(REQUEST_ID);
  await writer.write(REQUEST_SIZE);

  const last: string[] = [];
  return {
    sendFrame(levels) {
      if (!open) return;
      for (const [i, [x0, y0]] of [[0, 0], [8, 0]].entries()) {
        const q = encodeQuadrant(levels, x0, y0);
        const sig = q.join(',');
        if (sig === last[i]) continue;
        last[i] = sig;
        writer.write(q).catch(() => {});
      }
    },
    async close() {
      open = false;
      try { await reader.cancel(); } catch {}
      reader.releaseLock();
      writer.releaseLock();
      await port.close();
    },
  };
}
