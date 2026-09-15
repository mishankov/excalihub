import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
const directory = mkdtempSync(join(tmpdir(), 'excalihub-http-'));
process.env.DATABASE_PATH = join(directory, 'app.sqlite');
const store = await import('../server/store.mjs');
let child,
  origin,
  logs = '';
async function start() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['build/index.js'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ORIGIN: origin,
      APP_ORIGIN: origin,
      BODY_SIZE_LIMIT: '21M',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => (logs += data));
  child.stderr.on('data', (data) => (logs += data));
  for (let i = 0; i < 200; i++) {
    try {
      await fetch(origin);
      return;
    } catch {
      if (child.exitCode !== null) throw new Error(logs);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('Server did not start: ' + logs);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGTERM');
    await exited;
  }
}
async function request(
  path,
  { cookie, method = 'GET', data, source = origin, raw } = {},
) {
  return fetch(origin + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== 'GET'
        ? { Origin: source, 'Content-Type': 'application/json' }
        : {}),
    },
    body: raw ?? (data === undefined ? undefined : JSON.stringify(data)),
  });
}
async function login(username) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    data: { username, password: 'integration-password' },
  });
  assert.equal(res.status, 200, await res.clone().text());
  assert.match(res.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(res.headers.get('set-cookie'), /SameSite=Lax/i);
  return res.headers.get('set-cookie').split(';')[0];
}
before(async () => {
  await store.createUser('alice', 'integration-password');
  await store.createUser('bob', 'integration-password');
  await start();
});
after(async () => {
  await stop();
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});
test('production HTTP: authentication, CRUD, isolation, validation, restart, logout', async () => {
  assert.equal((await request('/api/diagrams')).status, 401);
  assert.equal((await request('/diagrams')).status, 303);
  assert.equal(
    (await request('/api/auth/register', { method: 'POST', data: {} })).status,
    404,
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        method: 'POST',
        data: { username: 'alice', password: 'wrong' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        method: 'POST',
        source: 'https://evil.example',
        data: { username: 'alice', password: 'integration-password' },
      })
    ).status,
    403,
  );
  const alice = await login('alice'),
    bob = await login('bob');
  const created = await request('/api/diagrams', {
    cookie: alice,
    method: 'POST',
    data: { title: 'First diagram' },
  });
  assert.equal(created.status, 201, await created.clone().text());
  const { diagram } = await created.json();
  assert.equal(
    (await request(`/diagrams/${diagram.id}`, { cookie: alice })).status,
    200,
  );
  assert.equal(
    (await request(`/diagrams/${diagram.id}`, { cookie: bob })).status,
    404,
  );
  assert.equal(
    (await request(`/api/diagrams/${diagram.id}`, { cookie: bob })).status,
    404,
  );
  const scene = {
    elements: [
      {
        id: 'rectangle',
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        version: 1,
      },
    ],
    appState: { viewBackgroundColor: '#ffffff' },
    files: { image: { id: 'image', dataURL: 'data:image/png;base64,AA==' } },
  };
  const update = {
    title: 'Renamed diagram',
    scene,
    version: 1,
    thumbnail: null,
    thumbnail_dark: null,
  };
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: bob,
        method: 'PUT',
        data: update,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'PUT',
        source: 'https://evil.example',
        data: update,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'PUT',
        data: { ...update, scene: null },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'PUT',
        data: { ...update, thumbnail_dark: 'data:image/svg+xml,<svg/>' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'PUT',
        data: { ...update, thumbnail: 'data:image/svg+xml,<svg/>' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/diagrams', {
        cookie: alice,
        method: 'POST',
        raw: '{bad',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/diagrams', {
        cookie: alice,
        method: 'POST',
        data: { title: ' ' },
      })
    ).status,
    400,
  );
  const saved = await request(`/api/diagrams/${diagram.id}`, {
    cookie: alice,
    method: 'PUT',
    data: update,
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.equal((await saved.json()).diagram.version, 2);
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'PUT',
        data: update,
      })
    ).status,
    409,
  );
  await stop();
  await start();
  const persisted = await (
    await request(`/api/diagrams/${diagram.id}`, { cookie: alice })
  ).json();
  assert.equal(persisted.diagram.title, 'Renamed diagram');
  assert.deepEqual(persisted.diagram.scene, scene);
  assert.equal(
    (await (await request('/api/diagrams', { cookie: bob })).json()).diagrams
      .length,
    0,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: bob,
        method: 'DELETE',
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(`/api/diagrams/${diagram.id}`, {
        cookie: alice,
        method: 'DELETE',
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/api/diagrams/${diagram.id}`, { cookie: alice })).status,
    404,
  );
  assert.equal(
    (await request('/api/auth/logout', { cookie: alice, method: 'POST' }))
      .status,
    200,
  );
  assert.equal((await request('/api/auth/me', { cookie: alice })).status, 401);
});
