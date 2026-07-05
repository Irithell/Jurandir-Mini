import Database from '@irithell-js/better-sqlite3-termux';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { ConsoleLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cacheDir = join(__dirname, '../../database/cache');
mkdirSync(cacheDir, { recursive: true });

const dbPath = join(cacheDir, 'cache.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');

db.exec(`
  CREATE TABLE IF NOT EXISTS group_metadata (
    jid TEXT PRIMARY KEY,
    metadata TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * @param {string} query
 * @param {any[]} params
 */
export const dbCacheRun = (query, params = []) => {
  try {
    return db.prepare(query).run(...params);
  } catch (err) {
    ConsoleLogger.dispatch({
      level: 'error',
      lines: [
        { message: 'Erro ao gravar no cache de disco:', tags: [{ label: 'CACHE' }] },
        { message: String(err), omitTimestamp: true },
      ],
    });
  }
};

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {any}
 */
export const dbCacheGet = (query, params = []) => {
  return db.prepare(query).get(...params);
};

/**
 * @param {string} query
 * @param {any[]} params
 * @returns {any[]}
 */
export const dbCacheAll = (query, params = []) => {
  const stmt = db.prepare(query);
  return stmt.all(...params);
};

export default db;
