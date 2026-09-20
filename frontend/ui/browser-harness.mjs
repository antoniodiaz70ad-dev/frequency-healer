import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

// Run against a production build on an ephemeral LOCAL port, never a user's
// browser profile or deployed origin. Build with the lab flag ON first.
export async function startHarness() {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_VOICE_JOURNEY_ENABLED: 'true', NEXT_PUBLIC_HARMONIC_LAB_ENABLED: 'true', VOICE_AI_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', chunk => { log += chunk; });
  server.stderr.on('data', chunk => { log += chunk; });
  let browser;
  const close = async () => {
    try { await browser?.close(); } finally {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = new Promise(resolve => server.once('exit', resolve));
        server.kill('SIGTERM');
        const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
        await exited; clearTimeout(timer);
      }
    }
  };
  try {
    await eventually(async () => {
      assert.equal(server.exitCode, null, log);
      const response = await fetch(origin + '/laboratorio-armonico');
      assert.equal(response.status, 200, 'Build with NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true before test:ui');
    }, 20000);
    browser = await chromium.launch({ headless: true, args: ['--mute-audio'],
      ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : { channel: 'chrome' }) });
    return { browser, origin, close };
  } catch (error) { await close(); throw error; }
}

export async function eventually(check, timeout = 8000) {
  const until = Date.now() + timeout;
  for (;;) {
    try { return await check(); } catch (error) {
      if (Date.now() >= until) throw error;
      await delay(50);
    }
  }
}

// Browser-only observer: all calls delegate to native Web Audio/Storage. No fake
// audio clock, mocked engine, app hooks, altered routes or persisted probe keys.
export function observeBrowser() {
  const contexts = [], writes = [], statuses = [];
  const NativeAudioContext = window.AudioContext;
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      const entry = { context: this, oscillators: [] }; contexts.push(entry);
      const create = this.createOscillator.bind(this);
      this.createOscillator = () => {
        const node = create();
        const row = { node, frequencies: [], starts: [], stops: [], disconnected: false, ended: false };
        entry.oscillators.push(row);
        const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
        node.frequency.setValueAtTime = (hz, time) => { row.frequencies.push(hz); return setFrequency(hz, time); };
        const start = node.start.bind(node), stop = node.stop.bind(node), disconnect = node.disconnect.bind(node);
        node.start = (...values) => { row.starts.push(values[0]); return start(...values); };
        node.stop = (...values) => { row.stops.push(values[0]); return stop(...values); };
        node.disconnect = (...values) => { row.disconnected = true; return disconnect(...values); };
        node.addEventListener('ended', () => { row.ended = true; });
        return node;
      };
    }
  };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const result = setItem.call(this, key, value);
    if (this === localStorage) writes.push({ key, value });
    return result;
  };
  new MutationObserver(() => {
    for (const element of document.querySelectorAll('[role="status"]')) {
      if (element.textContent.startsWith('Experimento:')) statuses.push(element.textContent);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
  window.__fhUI = { snapshot: () => ({
    contexts: contexts.map(entry => ({ state: entry.context.state, oscillators: entry.oscillators.map(row => ({
      frequencies: row.frequencies, starts: row.starts, stops: row.stops, disconnected: row.disconnected, ended: row.ended, waveform: row.node.type,
    })) })), writes, statuses,
  }) };
}
