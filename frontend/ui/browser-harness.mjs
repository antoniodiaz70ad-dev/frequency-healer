import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { startLocalServer } from '../scripts/local-test-server.mjs';

export async function startHarness() {
  const server = await startLocalServer(true, process.env.FH_UI_ARTIFACTS_DIR ? `${process.env.FH_UI_ARTIFACTS_DIR}/server.log` : undefined);
  let browser;
  const close = async () => { try { await browser?.close(); } finally { await server.close(); } };
  try {
    const response = await fetch(server.origin + '/laboratorio-armonico', { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, 'Build with NEXT_PUBLIC_HARMONIC_LAB_ENABLED=true before test:ui');
    browser = await chromium.launch({ headless: true, timeout: 20000, args: ['--mute-audio'],
      ...(process.env.FH_UI_BROWSER_PATH ? { executablePath: process.env.FH_UI_BROWSER_PATH } : process.env.FH_UI_BROWSER === 'chromium' ? {} : { channel: 'chrome' }) });
    return { browser, origin: server.origin, close };
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
