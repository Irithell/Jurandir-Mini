import Database from '@irithell-js/better-sqlite3-termux';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sessionsDir = join(__dirname, '../../database/sessions');
mkdirSync(sessionsDir, { recursive: true });

const dbPath = join(sessionsDir, 'jurandir.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_state (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    creds TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_auth_state_session ON auth_state(session_id);

  CREATE TABLE IF NOT EXISTS auth_keys (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    key_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, key_id)
  );

  CREATE INDEX IF NOT EXISTS idx_auth_keys_session ON auth_keys(session_id);
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS auth_state_updated_at
  AFTER UPDATE ON auth_state
  FOR EACH ROW
  BEGIN
    UPDATE auth_state SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

  CREATE TRIGGER IF NOT EXISTS auth_keys_updated_at
  AFTER UPDATE ON auth_keys
  FOR EACH ROW
  BEGIN
    UPDATE auth_keys SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
`);

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {import('@irithell-js/better-sqlite3-termux').RunResult}
 */
export const dbRun = (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.run(...params);
};

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {any}
 */
export const dbGet = (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.get(...params);
};

export default db;
