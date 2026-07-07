import Database from '@irithell-js/better-sqlite3-termux';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const addonsDir = join(__dirname, '../../database/addons');
mkdirSync(addonsDir, { recursive: true });

const db = new Database(join(addonsDir, 'addons.db'));

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');

db.exec(`
  CREATE TABLE IF NOT EXISTS addons (
    name         TEXT PRIMARY KEY,
    version      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    current_step TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    manifest     TEXT NOT NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_log TEXT
  );

  CREATE TABLE IF NOT EXISTS addon_files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    addon_name TEXT NOT NULL REFERENCES addons(name) ON DELETE CASCADE,
    src        TEXT NOT NULL,
    dest       TEXT NOT NULL,
    type       TEXT NOT NULL,
    hash       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS addon_hooks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    addon_name  TEXT NOT NULL REFERENCES addons(name) ON DELETE CASCADE,
    event       TEXT NOT NULL,
    file        TEXT NOT NULL,
    phase       TEXT NOT NULL,
    export_name TEXT NOT NULL DEFAULT 'default'
  );

  CREATE TABLE IF NOT EXISTS addon_injects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    addon_name  TEXT NOT NULL REFERENCES addons(name) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    file        TEXT NOT NULL,
    export_name TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_addon_files_name   ON addon_files(addon_name);
  CREATE INDEX IF NOT EXISTS idx_addon_hooks_name   ON addon_hooks(addon_name);
  CREATE INDEX IF NOT EXISTS idx_addon_injects_name ON addon_injects(addon_name);

  CREATE TRIGGER IF NOT EXISTS addons_updated_at
  AFTER UPDATE ON addons FOR EACH ROW
  BEGIN
    UPDATE addons SET updated_at = CURRENT_TIMESTAMP WHERE name = OLD.name;
  END;
`);

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {import('better-sqlite3').RunResult}
 */
export const addonDbRun = (query, params = []) => db.prepare(query).run(...params);

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {any}
 */
export const addonDbGet = (query, params = []) => db.prepare(query).get(...params);

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {any[]}
 */
export const addonDbAll = (query, params = []) => db.prepare(query).all(...params);

export default db;
