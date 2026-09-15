import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
let connection;
export function db() {
  if (connection) return connection;
  const path = resolve(process.env.DATABASE_PATH || './data/excalihub.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS diagrams (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, scene TEXT NOT NULL, thumbnail TEXT, thumbnail_dark TEXT, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS diagrams_owner ON diagrams(user_id, updated_at DESC);`);
  connection.exec('BEGIN IMMEDIATE');
  try {
    connection.exec(
      `CREATE TABLE IF NOT EXISTS folders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(user_id, name));`,
    );
    if (
      !connection
        .prepare('PRAGMA table_info(diagrams)')
        .all()
        .some((column) => column.name === 'folder_id')
    ) {
      connection.exec(
        'ALTER TABLE diagrams ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL',
      );
    }
    if (
      !connection
        .prepare('PRAGMA table_info(diagrams)')
        .all()
        .some((column) => column.name === 'thumbnail_dark')
    ) {
      connection.exec('ALTER TABLE diagrams ADD COLUMN thumbnail_dark TEXT');
    }
    connection.exec(
      'CREATE INDEX IF NOT EXISTS diagrams_folder ON diagrams(user_id, folder_id); COMMIT',
    );
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
  return connection;
}
export async function hashPassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 256
  )
    throw new Error('Use a password between 8 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(':');
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}
export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}
export async function createUser(username, password) {
  username = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(username))
    throw new Error(
      'Username must be 3–40 letters, numbers, dots, underscores, or hyphens.',
    );
  const user = { id: randomUUID(), username };
  const hash = await hashPassword(password);
  db()
    .prepare('INSERT INTO users VALUES (?, ?, ?, ?)')
    .run(user.id, username, hash, new Date().toISOString());
  return user;
}
export async function changePassword(username, password) {
  const hash = await hashPassword(password);
  const user = db()
    .prepare('SELECT id FROM users WHERE username=?')
    .get(normalizeUsername(username));
  if (!user) throw new Error('User not found.');
  db().exec('BEGIN IMMEDIATE');
  try {
    db().prepare('UPDATE users SET password=? WHERE id=?').run(hash, user.id);
    db().prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    db().exec('COMMIT');
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  }
}
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const digest = (value) => createHash('sha256').update(value).digest('hex');
export async function login(username, password) {
  username = normalizeUsername(username);
  const now = Date.now();
  const key = digest(username);
  db().prepare('DELETE FROM login_attempts WHERE expires_at < ?').run(now);
  const attempt = db()
    .prepare('SELECT count FROM login_attempts WHERE key=?')
    .get(key);
  if (attempt && attempt.count >= 5)
    throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');
  // Reserve the attempt before password verification so concurrent requests cannot bypass the limit.
  db()
    .prepare(
      'INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
    )
    .run(key, now + 15 * 60_000);
  const user = db()
    .prepare('SELECT * FROM users WHERE username=?')
    .get(username);
  const dummy = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  const valid = await verifyPassword(password, user?.password || dummy);
  if (!user || !valid)
    throw new HttpError(401, 'Incorrect username or password.');
  db().prepare('DELETE FROM login_attempts WHERE key=?').run(key);
  db().prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  const token = randomBytes(32).toString('hex');
  db()
    .prepare('INSERT INTO sessions VALUES (?,?,?)')
    .run(digest(token), user.id, now + 7 * 86400_000);
  return { token, user: { id: user.id, username: user.username } };
}
export function sessionUser(token) {
  if (!token) return null;
  return (
    db()
      .prepare(
        'SELECT users.id, users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?',
      )
      .get(digest(token), Date.now()) || null
  );
}
export function logout(token) {
  if (token)
    db().prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
}
export function listDiagrams(userId) {
  return db()
    .prepare(
      'SELECT id,title,thumbnail,thumbnail_dark,version,created_at,updated_at,folder_id FROM diagrams WHERE user_id=? ORDER BY updated_at DESC',
    )
    .all(userId);
}
export function createDiagram(userId, title, folderId = null) {
  if (folderId !== null) getFolder(userId, folderId);
  const id = randomUUID(),
    now = new Date().toISOString();
  db()
    .prepare(
      'INSERT INTO diagrams (id,user_id,title,scene,thumbnail,version,created_at,updated_at,folder_id) VALUES (?,?,?,?,NULL,1,?,?,?)',
    )
    .run(
      id,
      userId,
      title,
      JSON.stringify({
        elements: [],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      }),
      now,
      now,
      folderId,
    );
  return getDiagram(userId, id);
}
export function getDiagram(userId, id) {
  const row = db()
    .prepare('SELECT * FROM diagrams WHERE id=? AND user_id=?')
    .get(id, userId);
  if (!row) throw new HttpError(404, 'Diagram not found.');
  const { user_id, ...diagram } = row;
  return { ...diagram, scene: JSON.parse(diagram.scene) };
}
export function saveDiagram(userId, id, data) {
  const result = db()
    .prepare(
      'UPDATE diagrams SET title=?,scene=?,thumbnail=?,thumbnail_dark=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?',
    )
    .run(
      data.title,
      JSON.stringify(data.scene),
      data.thumbnail ?? null,
      data.thumbnail_dark ?? null,
      new Date().toISOString(),
      id,
      userId,
      data.version,
    );
  if (!result.changes) {
    getDiagram(userId, id);
    throw new HttpError(
      409,
      'This diagram changed in another tab. Download your drawing before reloading.',
    );
  }
  return getDiagram(userId, id);
}
export function deleteDiagram(userId, id) {
  const result = db()
    .prepare('DELETE FROM diagrams WHERE id=? AND user_id=?')
    .run(id, userId);
  if (!result.changes) throw new HttpError(404, 'Diagram not found.');
}

export function listFolders(userId) {
  return db()
    .prepare(
      'SELECT id,name FROM folders WHERE user_id=? ORDER BY name COLLATE NOCASE, id',
    )
    .all(userId);
}
export function getFolder(userId, id) {
  if (typeof id !== 'string') throw new HttpError(400, 'Invalid folder.');
  const folder = db()
    .prepare('SELECT id,name FROM folders WHERE id=? AND user_id=?')
    .get(id, userId);
  if (!folder) throw new HttpError(404, 'Folder not found.');
  return folder;
}
function folderName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80)
    throw new HttpError(
      400,
      'Enter a folder name between 1 and 80 characters.',
    );
  return name.trim();
}
export function createFolder(userId, name) {
  name = folderName(name);
  const id = randomUUID();
  try {
    db().prepare('INSERT INTO folders VALUES (?,?,?)').run(id, userId, name);
  } catch (error) {
    if (error.message.includes('UNIQUE'))
      throw new HttpError(409, 'A folder with that name already exists.');
    throw error;
  }
  return getFolder(userId, id);
}
export function renameFolder(userId, id, name) {
  name = folderName(name);
  getFolder(userId, id);
  try {
    db()
      .prepare('UPDATE folders SET name=? WHERE id=? AND user_id=?')
      .run(name, id, userId);
  } catch (error) {
    if (error.message.includes('UNIQUE'))
      throw new HttpError(409, 'A folder with that name already exists.');
    throw error;
  }
  return getFolder(userId, id);
}
export function deleteFolder(userId, id) {
  getFolder(userId, id);
  // ON DELETE SET NULL keeps every diagram when its folder is deleted.
  db().prepare('DELETE FROM folders WHERE id=? AND user_id=?').run(id, userId);
}
export function moveDiagram(userId, id, folderId) {
  if (folderId !== null) getFolder(userId, folderId);
  const result = db()
    .prepare('UPDATE diagrams SET folder_id=? WHERE id=? AND user_id=?')
    .run(folderId, id, userId);
  if (!result.changes) throw new HttpError(404, 'Diagram not found.');
  // Folder changes are independent of scene versions, so an open editor can keep saving.
  return getDiagram(userId, id);
}

export function renameDiagram(userId, id, title, version) {
  const result = db()
    .prepare(
      'UPDATE diagrams SET title=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=?',
    )
    .run(title, new Date().toISOString(), id, userId, version);
  if (!result.changes) {
    getDiagram(userId, id);
    throw new HttpError(
      409,
      'This diagram changed. Refresh the library and try again.',
    );
  }
  return getDiagram(userId, id);
}
