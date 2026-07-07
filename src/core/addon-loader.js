import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addonDbAll } from '../configs/addons-db.js';
import { ConsoleLogger } from '../utils/logger.js';
import { resumePending } from './addon-installer.js';

/** @typedef {import('@whiskeysockets/baileys').WASocket} WASocket */
/** @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext */
/** @typedef {import('@/types/addons.d.ts').AddonHookRow} AddonHookRow */
/** @typedef {import('@/types/addons.d.ts').AddonInjectRow} AddonInjectRow */

/**
 * @typedef {(ctx: CommandContext) => Promise<boolean|void>} ChainFn
 * @typedef {{ gates: ChainFn[], processes: ChainFn[] }} CompiledChain
 */

/** @type {CompiledChain} */
let chain = { gates: [], processes: [] };

/** @type {Record<string, Function>} */
let injects = {};

/** @type {WeakMap<object, any>} */
const forwardMap = new WeakMap();

/**
 * @param {object} ctx
 * @returns {any|null}
 */
export function getForwardedData(ctx) {
  return forwardMap.get(ctx) ?? null;
}

/**
 * @param {object} ctx
 * @param {any} data
 */
export function _setForward(ctx, data) {
  forwardMap.set(ctx, data);
}

/**
 * @returns {CompiledChain}
 */
export function getChain() {
  return chain;
}

/**
 * @returns {Record<string, Function>}
 */
export function getInjects() {
  return injects;
}

/**
 * @param {string} file
 * @param {string} exportName
 * @returns {Promise<Function|null>}
 */
async function importFn(file, exportName) {
  try {
    const mod = await import(pathToFileURL(join(process.cwd(), file)).href);
    const fn = exportName === 'default' ? mod.default : mod[exportName];
    return typeof fn === 'function' ? fn : null;
  } catch {
    ConsoleLogger.dispatch({
      level: 'warn',
      lines: [{ message: `Falha ao importar: ${file}`, tags: [{ label: 'ADDONS' }] }],
    });
    return null;
  }
}

/**
 * @param {WASocket} socket
 */
export async function init(socket) {
  chain = { gates: [], processes: [] };
  injects = {};

  await resumePending();

  /** @type {AddonHookRow[]} */
  const hooks = /** @type {AddonHookRow[]} */ (
    addonDbAll(`
      SELECT h.event, h.file, h.phase, h.export_name
      FROM addon_hooks h
      JOIN addons a ON a.name = h.addon_name
      WHERE a.status = 'done' AND a.enabled = 1
    `)
  );

  /** @type {AddonInjectRow[]} */
  const injectRows = /** @type {AddonInjectRow[]} */ (
    addonDbAll(`
      SELECT i.name, i.file, i.export_name
      FROM addon_injects i
      JOIN addons a ON a.name = i.addon_name
      WHERE a.status = 'done' AND a.enabled = 1
    `)
  );

  for (const hook of hooks) {
    const fn = await importFn(hook.file, hook.export_name);
    if (!fn) continue;

    if (hook.event === 'messages.upsert') {
      if (hook.phase === 'gate') chain.gates.push(/** @type {ChainFn} */ (fn));
      else chain.processes.push(/** @type {ChainFn} */ (fn));
    } else {
      socket.ev.on(/** @type {any} */ (hook.event), /** @type {any} */ (fn));
    }
  }

  for (const row of injectRows) {
    const fn = await importFn(row.file, row.export_name);
    if (fn) injects[row.name] = fn;
  }

  ConsoleLogger.dispatch({
    level: 'info',
    lines: [
      {
        message: `${hooks.length} hook(s) e ${injectRows.length} inject(s) carregados.`,
        tags: [{ label: 'ADDONS' }],
      },
    ],
  });
}
