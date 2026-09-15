import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createUser, changePassword, db } from '../server/store.mjs';
const [action, username] = process.argv.slice(2);
async function passwordPrompt(label) {
  if (!process.stdin.isTTY)
    throw new Error('Use --password-stdin when piping a password.');
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const prompt = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  const pending = prompt.question(label);
  muted = true;
  try {
    return await pending;
  } finally {
    muted = false;
    prompt.close();
    process.stdout.write('\n');
  }
}
try {
  if (action === 'list') {
    console.table(
      db()
        .prepare('SELECT username, created_at FROM users ORDER BY username')
        .all(),
    );
  } else if ((action === 'create' || action === 'password') && username) {
    let password;
    if (process.argv.includes('--password-stdin')) {
      let input = '';
      for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 1024) throw new Error('Password input too long.');
      }
      password = input.replace(/\r?\n$/, '');
    } else {
      password = await passwordPrompt('Password (at least 8 characters): ');
      if (password !== (await passwordPrompt('Confirm password: ')))
        throw new Error('Passwords do not match.');
    }
    if (action === 'create') await createUser(username, password);
    else await changePassword(username, password);
    console.log(
      action === 'create'
        ? `Created account: ${username}`
        : `Updated password and revoked sessions: ${username}`,
    );
  } else
    throw new Error(
      'Usage: npm run user:create -- <username> | npm run user:password -- <username> | npm run user:list',
    );
} catch (error) {
  console.error(
    error.message.includes('UNIQUE')
      ? 'That username already exists.'
      : error.message,
  );
  process.exitCode = 1;
}
