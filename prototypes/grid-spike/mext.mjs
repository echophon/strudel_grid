// PROTOTYPE — minimal monome mext serial codec + WebSerial device. Throwaway.
// Protocol: https://monome.org/docs/serialosc/serial.txt
//   in : 0x00 sys/query resp: [0x00, section, count] · 0x03 size: [0x03, x, y]
//        0x20 key up: [0x20, x, y] · 0x21 key down: [0x21, x, y]
//   out: 0x00 query · 0x05 size request · 0x1A level/map: [0x1A, x0, y0, 32 bytes (2 levels/byte, hi nibble first)]

const IN_LEN = { 0x00: 3, 0x01: 33, 0x02: 3, 0x03: 3, 0x0f: 9, 0x20: 3, 0x21: 3 };

// Pure streaming parser: feed bytes, get messages.
export function createParser(onMessage) {
  let buf = [];
  return (bytes) => {
    for (const b of bytes) {
      buf.push(b);
      const need = IN_LEN[buf[0]];
      if (need === undefined) { buf = []; continue; } // unknown header: resync
      if (buf.length === need) { onMessage(buf); buf = []; }
    }
  };
}

// Encode one 8x8 quadrant of a 16x8 levels array (levels[y][x], 0..15).
export function encodeQuadrant(levels, x0, y0) {
  const out = new Uint8Array(35);
  out[0] = 0x1a; out[1] = x0; out[2] = y0;
  let i = 3;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x += 2)
      out[i++] = ((levels[y0 + y]?.[x0 + x] ?? 0) << 4) | (levels[y0 + y]?.[x0 + x + 1] ?? 0);
  return out;
}

export async function connectGrid({ onKey, onInfo }) {
  const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x0403 }] }); // FTDI; Grid editions may differ
  await port.open({ baudRate: 115200 });
  const writer = port.writable.getWriter();
  const parse = createParser((m) => {
    if (m[0] === 0x21 || m[0] === 0x20) onKey(m[1], m[2], m[0] === 0x21 ? 1 : 0);
    else onInfo?.(m);
  });
  (async () => {
    const reader = port.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parse(value);
    }
  })();
  await writer.write(new Uint8Array([0x00])); // query
  await writer.write(new Uint8Array([0x05])); // size
  return {
    port,
    send: (bytes) => writer.write(bytes),
  };
}
