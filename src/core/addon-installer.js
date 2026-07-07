import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, renameSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { addonDbRun, addonDbGet, addonDbAll } from '../configs/addons-db.js';
import { ConsoleLogger } from '../utils/logger.js';

/**
 * @typedef {import('@/types/addons.d.ts').AddonRow} AddonRow
 * @typedef {(text: string) => void} ProgressFn
 */

export const ADDONS_RAW_BASE =
  'https://raw.githubusercontent.com/Irithell/Jurandir-Mini-Addons/main';
const TMP_DIR = join(process.cwd(), 'database/addons/.tmp');

export let isInstalling = false;

function detectPlatform() {
  if (process.env.PREFIX?.includes('/data/data/com.termux')) return 'termux';
  if (process.platform === 'win32') return 'win32';
  return 'default';
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchJsonOrNull(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function validateHash(buffer, expected) {
  return sha256(buffer) === expected.replace('sha256:', '');
}

function safeDest(dest) {
  const cwd = process.cwd();
  const abs = resolve(cwd, dest);
  if (!abs.startsWith(cwd)) throw new Error(`Path traversal detectado: ${dest}`);
  return abs;
}

function setStatus(name, status, step = null) {
  addonDbRun(`UPDATE addons SET status = ?, current_step = ? WHERE name = ?`, [
    status,
    step ?? status,
    name,
  ]);
}

function setFailed(name, errorStack) {
  addonDbRun(`UPDATE addons SET status = 'failed', error_log = ? WHERE name = ?`, [
    errorStack,
    name,
  ]);
}

function log(message, level = 'info') {
  ConsoleLogger.dispatch({
    level: level ?? 'info',
    lines: [{ message, tags: [{ label: 'INSTALLER' }] }],
  });
}

/**
 * @param {any} manifest
 */
function installPackages(manifest) {
  if (!manifest.packages || !Object.keys(manifest.packages).length) return;

  const platform = detectPlatform();

  for (const [pkgName, pkgConfig] of Object.entries(manifest.packages)) {
    const cmd =
      typeof pkgConfig === 'string' ? pkgConfig : (pkgConfig[platform] ?? pkgConfig.default);

    if (!cmd) continue;

    log(`Instalando pacote: ${pkgName}`);
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  }
}

/**
 * @param {Buffer} buffer
 * @param {any} fileEntry
 * @param {string} addonName
 * @param {{ force?: boolean }} [options]
 */
async function writeAtomic(buffer, fileEntry, addonName, { force = false } = {}) {
  const { src, dest, hash } = fileEntry;

  if (!validateHash(buffer, hash)) throw new Error(`Hash inválido para: ${src}`);

  const absDest = safeDest(dest);
  const tmpPath = join(TMP_DIR, addonName, src.replaceAll('/', '_'));

  mkdirSync(dirname(tmpPath), { recursive: true });
  writeFileSync(tmpPath, buffer);

  if (!validateHash(readFileSync(tmpPath), hash)) {
    rmSync(tmpPath, { force: true });
    throw new Error(`Hash inválido após escrita em tmp: ${src}`);
  }

  if (existsSync(absDest) && !force) {
    rmSync(tmpPath, { force: true });
    log(`Arquivo já existe, pulando: ${dest}`, 'warn');
    return;
  }

  mkdirSync(dirname(absDest), { recursive: true });
  renameSync(tmpPath, absDest);

  if (!validateHash(readFileSync(absDest), hash)) {
    throw new Error(`Hash inválido após escrita no destino: ${dest}`);
  }
}

function checkConflicts(manifest) {
  for (const conflict of manifest.conflicts ?? []) {
    const existing = addonDbGet(`SELECT name FROM addons WHERE name = ? AND status = 'done'`, [
      conflict,
    ]);
    if (existing) throw new Error(`Conflito: "${conflict}" já está instalado`);
  }
}

/**
 * @param {any} manifest
 * @param {Set<string>} installing
 * @param {ProgressFn} [onProgress]
 */
async function resolveDeps(manifest, installing, onProgress) {
  for (const dep of manifest.requires ?? []) {
    if (installing.has(dep)) throw new Error(`Ciclo de dependência detectado: ${dep}`);

    const existing = addonDbGet(`SELECT name FROM addons WHERE name = ? AND status = 'done'`, [
      dep,
    ]);
    if (existing) continue;

    installing.add(dep);
    onProgress?.(`Instalando dependência: ${dep}`);
    await installAddon(dep, { _installing: installing, onProgress });
  }
}

async function runMigrations(manifest) {
  for (const migration of manifest.migrations ?? []) {
    const abs = safeDest(migration.file);
    const mod = await import(`file://${abs}`);
    const fn = mod[migration.export];
    if (typeof fn === 'function') await fn();
  }
}

function registerInDB(manifest, addonPath) {
  addonDbRun(
    `UPDATE addons SET manifest = ?, version = ?, status = 'done', current_step = 'done', error_log = NULL WHERE name = ?`,
    [JSON.stringify({ ...manifest, _installedFrom: addonPath }), manifest.version, manifest.name]
  );

  for (const file of manifest.files ?? []) {
    addonDbRun(
      `INSERT INTO addon_files (addon_name, src, dest, type, hash) VALUES (?, ?, ?, ?, ?)`,
      [manifest.name, file.src, file.dest, file.type, file.hash]
    );
  }

  for (const hook of manifest.hooks ?? []) {
    addonDbRun(
      `INSERT INTO addon_hooks (addon_name, event, file, phase, export_name) VALUES (?, ?, ?, ?, ?)`,
      [manifest.name, hook.event, hook.file, hook.phase, hook.export ?? 'default']
    );
  }

  for (const inject of manifest.injects ?? []) {
    addonDbRun(
      `INSERT INTO addon_injects (addon_name, name, file, export_name) VALUES (?, ?, ?, ?)`,
      [manifest.name, inject.name, inject.file, inject.export]
    );
  }
}

/**
 * @param {string} addonPath
 * @param {any} manifest
 * @param {{ force?: boolean, onProgress?: ProgressFn }} [options]
 */
async function runInstall(addonPath, manifest, { force = false, onProgress } = {}) {
  const name = manifest.name;
  const files = manifest.files ?? [];
  const buffers = [];

  setStatus(name, 'packages');
  onProgress?.('Instalando pacotes npm...');
  installPackages(manifest);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    setStatus(name, 'downloading', file.src);
    onProgress?.(`Baixando ${i + 1}/${files.length}: ${file.src}`);
    const url = `https://raw.githubusercontent.com/${manifest.repository}/main/${file.src}`;
    const buffer = await fetchBuffer(url);

    setStatus(name, 'validating', file.src);
    onProgress?.(`Validando: ${file.src}`);
    if (!validateHash(buffer, file.hash)) throw new Error(`Hash inválido ao baixar: ${file.src}`);

    buffers.push({ file, buffer });
  }

  setStatus(name, 'writing');
  onProgress?.('Escrevendo arquivos no sistema...');
  for (const { file, buffer } of buffers) {
    await writeAtomic(buffer, file, name, { force });
  }

  if (manifest.migrations?.length) {
    setStatus(name, 'migrating');
    onProgress?.('Executando migrations...');
    await runMigrations(manifest);
  }

  onProgress?.('Registrando no banco de dados...');
  registerInDB(manifest, addonPath);
}

/**
 * @param {string} addonPath
 * @param {{ force?: boolean, _installing?: Set<string>, onProgress?: ProgressFn }} [options]
 */
async function installAddon(
  addonPath,
  { force = false, _installing = new Set(), onProgress } = {}
) {
  onProgress?.('Buscando manifest...');
  const manifest = await fetchJson(`${ADDONS_RAW_BASE}/${addonPath}/manifest.json`);
  const name = manifest.name;

  onProgress?.('Verificando conflitos...');
  checkConflicts(manifest);

  addonDbRun(
    `INSERT INTO addons (name, version, status, manifest)
     VALUES (?, ?, 'pending', ?)
     ON CONFLICT(name) DO UPDATE SET status = 'pending', current_step = NULL, error_log = NULL`,
    [name, manifest.version, JSON.stringify(manifest)]
  );

  addonDbRun(`DELETE FROM addon_files WHERE addon_name = ?`, [name]);
  addonDbRun(`DELETE FROM addon_hooks WHERE addon_name = ?`, [name]);
  addonDbRun(`DELETE FROM addon_injects WHERE addon_name = ?`, [name]);

  onProgress?.('Resolvendo dependências...');
  await resolveDeps(manifest, _installing, onProgress);

  try {
    await runInstall(addonPath, manifest, { force, onProgress });
    log(`${name} v${manifest.version} instalado com sucesso.`);
  } catch {
    onProgress?.('Tentativa 1 falhou. Tentando novamente...');
    rmSync(join(TMP_DIR, name), { recursive: true, force: true });

    try {
      await runInstall(addonPath, manifest, { force, onProgress });
      log(`${name} v${manifest.version} instalado (segunda tentativa).`);
    } catch (err) {
      setFailed(name, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}

/**
 * @param {string} addonPath
 * @param {{ force?: boolean, onProgress?: ProgressFn }} [options]
 */
export async function install(addonPath, { force = false, onProgress } = {}) {
  isInstalling = true;
  process.send?.({ type: 'INSTALL_START' });

  try {
    const bundle = await fetchJsonOrNull(`${ADDONS_RAW_BASE}/${addonPath}/bundle.json`);

    if (bundle) {
      log(`Instalando bundle: ${bundle.displayName ?? addonPath}`);
      for (const component of bundle.components) {
        await installAddon(`${addonPath}/${component}`, { force, onProgress });
      }
    } else {
      await installAddon(addonPath, { force, onProgress });
    }
  } finally {
    isInstalling = false;
    process.send?.({ type: 'INSTALL_DONE' });
  }
}

/**
 * @param {string} addonName
 * @param {{ onProgress?: ProgressFn }} [options]
 */
export async function update(addonName, { onProgress } = {}) {
  const row = addonDbGet(`SELECT manifest FROM addons WHERE name = ?`, [addonName]);
  if (!row) throw new Error(`Addon "${addonName}" não está instalado.`);

  const { _installedFrom } = JSON.parse(row.manifest);
  isInstalling = true;
  process.send?.({ type: 'INSTALL_START' });

  try {
    await installAddon(_installedFrom ?? addonName, { force: true, onProgress });
  } finally {
    isInstalling = false;
    process.send?.({ type: 'INSTALL_DONE' });
  }
}

/**
 * @param {string} addonName
 */
export async function remove(addonName) {
  const files = addonDbAll(`SELECT dest FROM addon_files WHERE addon_name = ?`, [addonName]);

  for (const { dest } of files) {
    try {
      rmSync(safeDest(dest), { force: true });
    } catch {
      log(`Não foi possível remover: ${dest}`, 'warn');
    }
  }

  addonDbRun(`DELETE FROM addons WHERE name = ?`, [addonName]);
  log(`${addonName} removido.`);
}

export async function resumePending() {
  const pending = addonDbAll(
    `SELECT name, manifest FROM addons WHERE status NOT IN ('done', 'failed')`
  );

  if (!pending.length) return;

  log(`${pending.length} instalação(ões) pendente(s). Retomando...`);
  isInstalling = true;
  process.send?.({ type: 'INSTALL_START' });

  try {
    for (const row of pending) {
      const { _installedFrom, name } = JSON.parse(row.manifest);
      await installAddon(_installedFrom ?? name);
    }
  } finally {
    isInstalling = false;
    process.send?.({ type: 'INSTALL_DONE' });
  }
}
