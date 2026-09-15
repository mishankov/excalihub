import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'excalihub-test-'));
process.env.DATABASE_PATH = join(dir, 'test.sqlite');
const store = await import('../server/store.mjs');
after(() => {
  store.db().close();
  rmSync(dir, { recursive: true, force: true });
});
test('authentication, persistence, ownership, conflicts, and password reset', async () => {
  const alice = await store.createUser('Alice', 'strong-test-password');
  const bob = await store.createUser('bob', 'another-test-password');
  assert.equal(alice.username, 'alice');
  const stored = store
    .db()
    .prepare('SELECT password FROM users WHERE id=?')
    .get(alice.id).password;
  assert.notEqual(stored, 'strong-test-password');
  assert.ok(await store.verifyPassword('strong-test-password', stored));
  await assert.rejects(
    store.login('alice', 'wrong'),
    (error) => error.status === 401,
  );
  const session = await store.login('ALICE', 'strong-test-password');
  assert.equal(store.sessionUser(session.token).id, alice.id);
  assert.equal(store.sessionUser('invalid'), null);
  const diagram = store.createDiagram(alice.id, 'Architecture');
  assert.equal(diagram.version, 1);
  assert.equal(diagram.thumbnail_dark, null);
  assert.equal(store.listDiagrams(bob.id).length, 0);
  assert.throws(
    () => store.getDiagram(bob.id, diagram.id),
    (error) => error.status === 404,
  );
  const scene = {
    elements: [{ id: 'a', type: 'rectangle', version: 1 }],
    appState: { viewBackgroundColor: '#fff' },
    files: { asset: { id: 'asset', dataURL: 'data:image/png;base64,AA==' } },
  };
  const saved = store.saveDiagram(alice.id, diagram.id, {
    title: 'New name',
    scene,
    version: 1,
    thumbnail: 'data:image/png;base64,bGlnaHQ=',
    thumbnail_dark: 'data:image/png;base64,ZGFyaw==',
  });
  assert.equal(saved.version, 2);
  assert.match(saved.thumbnail_dark, /ZGFyaw==$/);
  assert.deepEqual(store.getDiagram(alice.id, diagram.id).scene, scene);
  assert.throws(
    () =>
      store.saveDiagram(bob.id, diagram.id, {
        title: 'Hijacked',
        scene,
        version: 2,
      }),
    (error) => error.status === 404,
  );
  assert.throws(
    () =>
      store.saveDiagram(alice.id, diagram.id, {
        title: 'Stale',
        scene,
        version: 1,
      }),
    (error) => error.status === 409,
  );
  assert.throws(
    () => store.deleteDiagram(bob.id, diagram.id),
    (error) => error.status === 404,
  );
  await store.changePassword('alice', 'replacement-password');
  assert.equal(store.sessionUser(session.token), null);
  await assert.rejects(
    store.login('alice', 'strong-test-password'),
    (error) => error.status === 401,
  );
  const newSession = await store.login('alice', 'replacement-password');
  store.logout(newSession.token);
  assert.equal(store.sessionUser(newSession.token), null);
  store.deleteDiagram(alice.id, diagram.id);
  assert.equal(store.listDiagrams(alice.id).length, 0);
});
test('unknown and known accounts have the same credential error; attempts are throttled', async () => {
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      store.login('nobody', 'incorrect'),
      (error) =>
        error.status === 401 &&
        error.message === 'Incorrect username or password.',
    );
  await assert.rejects(
    store.login('nobody', 'incorrect'),
    (error) => error.status === 429,
  );
});
test('validation, expired sessions, and database ownership indexes', async () => {
  await assert.rejects(store.createUser('bad name', 'strong-test-password'));
  await assert.rejects(store.createUser('valid', 'short'));
  const user = await store.createUser('expiry', 'long-test-password');
  const auth = await store.login('expiry', 'long-test-password');
  store
    .db()
    .prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?')
    .run(user.id);
  assert.equal(store.sessionUser(auth.token), null);
});

test('eight-character passwords work for account creation and password changes', async () => {
  await assert.rejects(
    store.createUser('too-short', '1234567'),
    /between 8 and 256/,
  );
  const user = await store.createUser('eight-char', 'abcdefgh');
  assert.equal((await store.login('eight-char', 'abcdefgh')).user.id, user.id);
  await assert.rejects(
    store.changePassword('eight-char', '1234567'),
    /between 8 and 256/,
  );
  await store.changePassword('eight-char', '87654321');
  assert.equal((await store.login('eight-char', '87654321')).user.id, user.id);
});

test('folders enforce ownership, preserve drawings when deleted, and support independent moves', async () => {
  const alice = await store.createUser('folders-alice', 'password');
  const bob = await store.createUser('folders-bob', 'password');
  const folder = store.createFolder(alice.id, 'Work');
  const drawing = store.createDiagram(alice.id, 'Draft');
  assert.equal(drawing.folder_id, null);
  assert.throws(
    () => store.moveDiagram(bob.id, drawing.id, folder.id),
    (e) => e.status === 404,
  );
  assert.throws(
    () => store.createDiagram(bob.id, 'Draft', folder.id),
    (e) => e.status === 404,
  );
  assert.throws(
    () => store.renameFolder(bob.id, folder.id, 'Other'),
    (e) => e.status === 404,
  );
  assert.throws(
    () => store.deleteFolder(bob.id, folder.id),
    (e) => e.status === 404,
  );
  assert.equal(store.listFolders(bob.id).length, 0);
  assert.throws(
    () => store.createFolder(alice.id, 'Work'),
    (e) => e.status === 409,
  );
  assert.throws(
    () => store.createFolder(alice.id, ' '),
    (e) => e.status === 400,
  );
  store.renameFolder(alice.id, folder.id, 'Projects');
  store.moveDiagram(alice.id, drawing.id, folder.id);
  const saved = store.saveDiagram(alice.id, drawing.id, drawing);
  assert.equal(saved.folder_id, folder.id);
  const renamed = store.renameDiagram(
    alice.id,
    drawing.id,
    'Renamed',
    saved.version,
  );
  assert.equal(renamed.title, 'Renamed');
  assert.deepEqual(renamed.scene, drawing.scene);
  assert.throws(
    () => store.renameDiagram(alice.id, drawing.id, 'Stale', saved.version),
    (e) => e.status === 409,
  );
  const inside = store.createDiagram(alice.id, 'Inside', folder.id);
  store.deleteFolder(alice.id, folder.id);
  assert.equal(store.getDiagram(alice.id, drawing.id).folder_id, null);
  assert.equal(store.getDiagram(alice.id, inside.id).folder_id, null);
});
