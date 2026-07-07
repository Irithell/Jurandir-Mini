import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { randomUUID } from 'node:crypto';
import db, { dbGet, dbRun } from '../configs/database.js';
import { ConsoleLogger } from '../utils/logger.js';

/** @typedef {import('@/types/auth.d.ts').AuthStateRow} AuthStateRow */
/** @typedef {import('@/types/auth.d.ts').AuthKeyRow} AuthKeyRow */

const FLUSH_INTERVAL_MS = 2000;
const FLUSH_SIZE_LIMIT = 500;

/** @type {Map<string, any>} */
const pendingKeys = new Map();

/** @type {ReturnType<typeof setTimeout> | null} */
let flushTimer = null;

/**
 * @param {string} sessionId
 */
function flushPendingKeys(sessionId) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (pendingKeys.size === 0) return;

  const snapshot = new Map(pendingKeys);
  pendingKeys.clear();

  const upsertStmt = db.prepare(`
    INSERT INTO auth_keys (id, session_id, key_id, key_data)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, key_id) DO UPDATE SET key_data = excluded.key_data
  `);

  const deleteStmt = db.prepare('DELETE FROM auth_keys WHERE session_id = ? AND key_id = ?');

  try {
    db.transaction(() => {
      for (const [keyId, value] of snapshot.entries()) {
        if (value === null) {
          deleteStmt.run(sessionId, keyId);
        } else {
          upsertStmt.run(
            randomUUID(),
            sessionId,
            keyId,
            JSON.stringify(value, BufferJSON.replacer)
          );
        }
      }
    })();
  } catch (error) {
    ConsoleLogger.dispatch({
      level: 'error',
      lines: [
        {
          message: 'Falha de I/O durante transação de flush (auth_keys).',
          tags: [{ label: 'AUTH' }],
        },
        { message: String(error), omitTimestamp: true },
      ],
    });
  }
}

/**
 * @param {string} sessionId
 */
function scheduleFlush(sessionId) {
  if (pendingKeys.size >= FLUSH_SIZE_LIMIT) {
    flushPendingKeys(sessionId);
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => flushPendingKeys(sessionId), FLUSH_INTERVAL_MS);
  }
}

/**
 * @param {string} sessionId
 */
export async function useSQLiteAuthState(sessionId) {
  const loadCreds = () => {
    try {
      /** @type {AuthStateRow | undefined} */
      const row = dbGet('SELECT creds FROM auth_state WHERE session_id = ?', [sessionId]);

      if (row) {
        ConsoleLogger.dispatch({
          level: 'info',
          lines: [
            {
              message: 'Sessão recuperada da base de dados.',
              tags: [{ label: 'AUTH' }, { label: sessionId }],
            },
          ],
        });
        return JSON.parse(row.creds, BufferJSON.reviver);
      }

      ConsoleLogger.dispatch({
        level: 'info',
        lines: [
          {
            message: 'Inicializando novo estado de sessão.',
            tags: [{ label: 'AUTH' }, { label: sessionId }],
          },
        ],
      });

      const creds = initAuthCreds();
      dbRun('INSERT INTO auth_state (id, session_id, creds) VALUES (?, ?, ?)', [
        randomUUID(),
        sessionId,
        JSON.stringify(creds, BufferJSON.replacer),
      ]);
      return creds;
    } catch (error) {
      ConsoleLogger.dispatch({
        level: 'error',
        lines: [
          {
            message: 'Falha estrutural ao carregar credenciais primárias.',
            tags: [{ label: 'AUTH' }],
          },
          { message: String(error), omitTimestamp: true },
        ],
      });
      throw error;
    }
  };

  /**
   * @param {import('@whiskeysockets/baileys').AuthenticationCreds} creds
   */
  const saveCreds = async (creds) => {
    try {
      /** @type {AuthStateRow | undefined} */
      const row = dbGet('SELECT creds FROM auth_state WHERE session_id = ?', [sessionId]);

      const fullCreds = row ? { ...JSON.parse(row.creds, BufferJSON.reviver), ...creds } : creds;

      dbRun(
        `INSERT INTO auth_state (id, session_id, creds) VALUES (?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET creds = excluded.creds`,
        [randomUUID(), sessionId, JSON.stringify(fullCreds, BufferJSON.replacer)]
      );
    } catch (error) {
      ConsoleLogger.dispatch({
        level: 'error',
        lines: [
          {
            message: 'Falha durante atualização do estado de credenciais.',
            tags: [{ label: 'AUTH' }],
          },
          { message: String(error), omitTimestamp: true },
        ],
      });
    }
  };

  const keys = {
    /**
     * @param {string} type
     * @param {Array<string>} ids
     */
    get: async (type, ids) => {
      /** @type {Record<string, any>} */
      const data = {};
      /** @type {Array<{id: string, keyId: string}>} */
      const missing = [];

      for (const id of ids) {
        const keyId = `${type}_${id}`;
        if (pendingKeys.has(keyId)) {
          const val = pendingKeys.get(keyId);
          if (val !== null) data[id] = val;
        } else {
          missing.push({ id, keyId });
        }
      }

      if (missing.length > 0) {
        try {
          const chunkSize = 500;
          for (let i = 0; i < missing.length; i += chunkSize) {
            const chunk = missing.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '?').join(', ');
            const queryParams = [sessionId, ...chunk.map((m) => m.keyId)];

            const rows = /** @type {AuthKeyRow[]} */ (
              db
                .prepare(
                  `SELECT key_id, key_data FROM auth_keys WHERE session_id = ? AND key_id IN (${placeholders})`
                )
                .all(...queryParams)
            );

            const rowMap = new Map(rows.map((r) => [r.key_id, r.key_data]));

            for (const { id, keyId } of chunk) {
              const raw = rowMap.get(keyId);
              if (raw) {
                try {
                  data[id] = JSON.parse(raw, BufferJSON.reviver);
                } catch (parseError) {
                  ConsoleLogger.dispatch({
                    level: 'error',
                    lines: [
                      {
                        message: `Inconsistência de serialização no key_id: ${keyId}`,
                        tags: [{ label: 'AUTH' }],
                      },
                      { message: String(parseError), omitTimestamp: true },
                    ],
                  });
                }
              }
            }
          }
        } catch (dbError) {
          ConsoleLogger.dispatch({
            level: 'error',
            lines: [
              {
                message: 'Falha crítica na leitura em lote das Signal Keys.',
                tags: [{ label: 'AUTH' }],
              },
              { message: String(dbError), omitTimestamp: true },
            ],
          });
        }
      }

      return data;
    },

    /**
     * @param {Record<string, Record<string, any>>} data
     */
    set: async (data) => {
      try {
        for (const category of Object.keys(data || {})) {
          for (const id of Object.keys(data[category] || {})) {
            const keyId = `${category}_${id}`;
            const value = data[category][id];
            pendingKeys.set(keyId, value ?? null);
          }
        }
        scheduleFlush(sessionId);
      } catch (error) {
        ConsoleLogger.dispatch({
          level: 'error',
          lines: [
            {
              message: 'Falha durante o push de chaves para memória cache.',
              tags: [{ label: 'AUTH' }],
            },
            { message: String(error), omitTimestamp: true },
          ],
        });
      }
    },
  };

  const creds = loadCreds();

  ConsoleLogger.dispatch({
    level: 'success',
    lines: [
      {
        message: 'Auth state construído e protegido.',
        tags: [{ label: 'AUTH' }, { label: sessionId }],
      },
    ],
  });

  return { state: { creds, keys }, saveCreds };
}
