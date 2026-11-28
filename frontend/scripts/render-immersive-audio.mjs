import {readFileSync, writeFileSync} from 'node:fs';

const phases = JSON.parse(readFileSync(new URL('../src/app/punto-cero-inmersivo/phases.json', import.meta.url)));
const rate = 12000;
const samples = phases.at(-1).end * rate;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);

let start = 0;
for (const {hz, end} of phases) {
  for (let i = start; i < end * rate; i++) {
    const t = (i - start) / rate;
    const angle = 2 * Math.PI * hz * t;
    const envelope = Math.min(1, t / 0.4, (end - i / rate) / 0.4);
    const tone = 0.23 * Math.sin(angle) + 0.09 * Math.sin(2 * angle) + 0.04 * Math.sin(3 * angle);
    wav.writeInt16LE(Math.round(32767 * envelope * tone), 44 + i * 2);
  }
  start = end * rate;
}
writeFileSync(new URL('../public/punto-cero-membrana-v2.wav', import.meta.url), wav);
