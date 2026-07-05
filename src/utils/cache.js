import { dbCacheGet, dbCacheRun, dbCacheAll } from '../configs/cache-db.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@whiskeysockets/baileys').GroupMetadata} GroupMetadata
 */

const CACHE_TTL = 5 * 60 * 1000;

/** @type {Map<string, { data: GroupMetadata, timestamp: number }>} */
const memoryCache = new Map();

/** @type {Map<string, { data: Record<string, GroupMetadata>, timestamp: number }>} */
const allGroupsMemoryCache = new Map();

/** @type {Map<string, Promise<GroupMetadata | undefined>>} */
const metadataInflightRequests = new Map();

// ==================== WRITE ====================

/**
 * @param {string} groupId
 * @param {GroupMetadata} metadata
 */
export function setGroupMetadataCache(groupId, metadata) {
  memoryCache.set(groupId, { data: metadata, timestamp: Date.now() });

  // Atualiza a view de todos os grupos se ela existir
  const allHit = allGroupsMemoryCache.get('all');
  if (allHit) {
    allHit.data[groupId] = metadata;
  }

  setImmediate(() => {
    dbCacheRun(
      'INSERT OR REPLACE INTO group_metadata (jid, metadata, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [groupId, JSON.stringify(metadata)]
    );
  });
}

// ==================== WARMUP ====================

/**
 * Popula a RAM com todos os grupos salvos no SQLite.
 * Deve ser chamado uma única vez na inicialização, antes do socket conectar.
 * Não faz nenhuma chamada de rede — apenas move dados do disco para a memória.
 * A revalidação individual acontece em background quando cada grupo for acessado.
 */
export function warmupCache() {
  try {
    const rows = dbCacheAll(
      'SELECT jid, metadata, strftime("%s", updated_at) * 1000 AS ts FROM group_metadata'
    );

    if (!rows || rows.length === 0) return;

    /** @type {Record<string, GroupMetadata>} */
    const allGroups = {};

    for (const row of rows) {
      try {
        const metadata = JSON.parse(row.metadata);
        const ts = Number(row.ts) || 0;
        memoryCache.set(row.jid, { data: metadata, timestamp: ts });
        allGroups[row.jid] = metadata;
      } catch {
        // linha corrompida — ignora
      }
    }

    if (Object.keys(allGroups).length > 0) {
      allGroupsMemoryCache.set('all', { data: allGroups, timestamp: Date.now() });
    }
  } catch {
    // DB ainda não pronto ou vazio — segue sem warmup
  }
}

// ==================== READ: grupo individual ====================

/**
 * Revalida um único grupo em background (ou aguarda se waitForNetwork=true).
 * Rate limit: 300ms entre requisições individuais.
 *
 * @param {WASocket} jurandir
 * @param {string} groupId
 * @param {boolean} waitForNetwork
 * @returns {Promise<GroupMetadata | undefined>}
 */
async function revalidateGroupMetadata(jurandir, groupId, waitForNetwork = false) {
  const inflight = metadataInflightRequests.get(groupId);
  if (inflight) return waitForNetwork ? inflight : undefined;

  const promise = (async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const meta = await jurandir.groupMetadata(groupId);
      setGroupMetadataCache(groupId, meta);
      return meta;
    } catch {
      return undefined;
    } finally {
      metadataInflightRequests.delete(groupId);
    }
  })();

  metadataInflightRequests.set(groupId, promise);
  return waitForNetwork ? promise : undefined;
}

/**
 * Retorna metadados de um grupo.
 * Ordem: RAM → DB → rede.
 * Se o dado estiver stale, serve o cache e revalida em background (SWR).
 *
 * @param {WASocket} jurandir
 * @param {string} groupId
 * @returns {Promise<GroupMetadata | undefined>}
 */
export async function getGroupMetadataCache(jurandir, groupId) {
  const now = Date.now();

  // 1. RAM — serve imediato, revalida em background se stale
  const ramHit = memoryCache.get(groupId);
  if (ramHit) {
    if (now - ramHit.timestamp > CACHE_TTL) {
      revalidateGroupMetadata(jurandir, groupId, false);
    }
    return ramHit.data;
  }

  // 2. DB — carrega pra RAM, revalida em background se stale
  try {
    const row = dbCacheGet(
      'SELECT metadata, strftime("%s", updated_at) * 1000 AS ts FROM group_metadata WHERE jid = ?',
      [groupId]
    );
    if (row?.metadata) {
      const metadata = JSON.parse(row.metadata);
      const dbTimestamp = Number(row.ts) || 0;
      memoryCache.set(groupId, { data: metadata, timestamp: dbTimestamp });
      if (now - dbTimestamp > CACHE_TTL) {
        revalidateGroupMetadata(jurandir, groupId, false);
      }
      return metadata;
    }
  } catch {
    // ignora erro de parse
  }

  // 3. Rede — grupo desconhecido, blocking
  return revalidateGroupMetadata(jurandir, groupId, true);
}

// ==================== READ: todos os grupos ====================

/**
 * Retorna o mapa de todos os grupos a partir da RAM.
 * Não faz nenhuma chamada de rede — é uma view somente leitura do que foi
 * carregado pelo warmupCache e atualizado incrementalmente pelo setGroupMetadataCache.
 * Use getGroupMetadataCache para obter dados frescos de um grupo específico.
 *
 * @returns {Record<string, GroupMetadata>}
 */
export function getAllGroupsCache() {
  const ramHit = allGroupsMemoryCache.get('all');
  if (ramHit) return ramHit.data;

  // Reconstrói a partir dos grupos individuais (fallback pós-warmup)
  if (memoryCache.size > 0) {
    /** @type {Record<string, GroupMetadata>} */
    const rebuilt = {};
    for (const [jid, entry] of memoryCache.entries()) {
      rebuilt[jid] = entry.data;
    }
    allGroupsMemoryCache.set('all', { data: rebuilt, timestamp: Date.now() });
    return rebuilt;
  }

  return {};
}
