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

/**
 * @param {string} groupId
 * @param {GroupMetadata} metadata
 */
export function setGroupMetadataCache(groupId, metadata) {
  memoryCache.set(groupId, { data: metadata, timestamp: Date.now() });

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
        // ignore
      }
    }

    if (Object.keys(allGroups).length > 0) {
      allGroupsMemoryCache.set('all', { data: allGroups, timestamp: Date.now() });
    }
  } catch {
    // ignore
  }
}

/**
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
 * @param {WASocket} jurandir
 * @param {string} groupId
 * @returns {Promise<GroupMetadata | undefined>}
 */
export async function getGroupMetadataCache(jurandir, groupId) {
  const now = Date.now();

  const ramHit = memoryCache.get(groupId);
  if (ramHit) {
    if (now - ramHit.timestamp > CACHE_TTL) {
      revalidateGroupMetadata(jurandir, groupId, false);
    }
    return ramHit.data;
  }

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
    // ignore
  }

  return revalidateGroupMetadata(jurandir, groupId, true);
}

/**
 * @returns {Record<string, GroupMetadata>}
 */
export function getAllGroupsCache() {
  const ramHit = allGroupsMemoryCache.get('all');
  if (ramHit) return ramHit.data;

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
