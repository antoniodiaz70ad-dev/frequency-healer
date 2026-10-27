import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Redis } from '@upstash/redis';

/** Real Redis only, restricted to loopback and synthetic fixtures. */
export function redisTestClient() {
  const port = process.env.ATENEA_TEST_REDIS_PORT!;
  assert.match(port, /^\d{1,5}$/);
  const exec = promisify(execFile);
  const command = async (...args: (string | number)[]) => {
    const { stdout } = await exec('redis-cli', ['-h', '127.0.0.1', '-p', port, '--json', ...args.map(String)]);
    return JSON.parse(stdout);
  };
  const decode = (value: unknown): unknown => typeof value === 'string' && value.startsWith('{') ? JSON.parse(value) : value;
  const client = {
    eval: (script: string, keys: string[], args: (string | number)[]) => command('EVAL', script, keys.length, ...keys, ...args),
    get: async (key: string) => decode(await command('GET', key)),
    zrange: (key: string, min: number, max: number) => command('ZRANGEBYSCORE', key, min, max, 'LIMIT', 0, 25),
    mget: async (...keys: string[]) => (await command('MGET', ...keys) as unknown[]).map(decode),
    zrem: (key: string, ...members: string[]) => command('ZREM', key, ...members),
    del: (...keys: string[]) => command('DEL', ...keys),
  } as unknown as Redis;
  return { client, command };
}
