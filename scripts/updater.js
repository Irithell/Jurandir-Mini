import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const RAW_MANIFEST_URL =
  'https://raw.githubusercontent.com/Irithell/Jurandir-Mini/main/manifest.json';
const ZIP_URL =
  'https://github.com/Irithell/Jurandir-Mini/releases/latest/download/jurandir-mini.zip';

const TMP_DIR = path.join(ROOT_DIR, '.tmp_update');
const EXTRACTED_DIR = path.join(TMP_DIR, 'Jurandir-Mini-main');

const args = process.argv.slice(2);
const action = args[0] || 'check';

function logStep(msg) {
  console.log(`\x1b[36m[ ⚙ ]\x1b[0m ${msg}`);
}
function logSuccess(msg) {
  console.log(`\x1b[32m[ ✓ ]\x1b[0m ${msg}`);
}
function logWarn(msg) {
  console.log(`\x1b[33m[ ! ]\x1b[0m ${msg}`);
}
function logError(msg) {
  console.log(`\x1b[31m[ x ]\x1b[0m ${msg}`);
}
function logItem(act, file) {
  const colors = {
    BAIXANDO: '\x1b[34m',
    VALIDANDO: '\x1b[35m',
    APLICANDO: '\x1b[32m',
    REMOVENDO: '\x1b[31m',
    IGNORADO: '\x1b[33m',
  };
  console.log(`  ${colors[act] || '\x1b[37m'}[ ${act} ]\x1b[0m ${file}`);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Jurandir' } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('JSON Inválido'));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadZip(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'Jurandir' } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => fs.unlink(dest, () => reject(err)));
  });
}

function getFileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function cleanTemp() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

async function performUpdate(forceAll = false, isReinstall = false) {
  try {
    const remoteManifest = await fetchJson(RAW_MANIFEST_URL);
    const localManifestPath = path.join(ROOT_DIR, 'manifest.json');
    let localManifest = { files: {} };

    if (fs.existsSync(localManifestPath)) {
      localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf8'));
    }

    if (
      !forceAll &&
      !isReinstall &&
      localManifest.version === remoteManifest.version &&
      localManifest.build_time === remoteManifest.build_time
    ) {
      if (action !== 'check') logSuccess('Versão mais recente já instalada.');
      process.exit(0);
    }

    if (action === 'check') process.exit(1);

    logStep(`Sincronizando v${remoteManifest.version}`);
    cleanTemp();
    fs.mkdirSync(TMP_DIR, { recursive: true });

    const zipDest = path.join(TMP_DIR, 'main.zip');
    logStep('Baixando pacote...');
    await downloadZip(ZIP_URL, zipDest);

    logStep('Extraindo e validando hashes...');
    execSync(`unzip -q -o main.zip`, { cwd: TMP_DIR, stdio: 'ignore' });

    const filesToApply = [];
    for (const [file, expectedHash] of Object.entries(remoteManifest.files)) {
      const extractedFilePath = path.join(EXTRACTED_DIR, file);
      if (!fs.existsSync(extractedFilePath)) throw new Error(`Arquivo ausente: ${file}`);
      if (getFileHash(extractedFilePath) !== expectedHash)
        throw new Error(`Integridade comprometida: ${file}`);

      if (
        forceAll ||
        isReinstall ||
        localManifest.files[file] !== expectedHash ||
        !fs.existsSync(path.join(ROOT_DIR, file))
      ) {
        filesToApply.push(file);
      }
    }

    logStep('Aplicando alterações seguras...');
    let deletedCount = 0;
    const PROTECTED_FILES = ['start.sh', 'scripts/updater.js'];

    const targetList = isReinstall
      ? Object.keys(localManifest.files)
      : Object.keys(localManifest.files).filter((f) => !remoteManifest.files[f]);

    for (const file of targetList) {
      if (isReinstall && PROTECTED_FILES.includes(file)) continue;
      const filePath = path.join(ROOT_DIR, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logItem('REMOVENDO', file);
        deletedCount++;
      }
    }

    let appliedCount = 0;
    for (const file of filesToApply) {
      const srcPath = path.join(EXTRACTED_DIR, file);
      const destPath = path.join(ROOT_DIR, file);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      logItem('APLICANDO', file);
      appliedCount++;
    }

    fs.copyFileSync(path.join(EXTRACTED_DIR, 'manifest.json'), localManifestPath);
    cleanTemp();

    console.log('');
    logSuccess('Atualização concluída!');
    logWarn(`Aplicados: ${appliedCount} | Removidos: ${deletedCount}`);
    process.exit(0);
  } catch (error) {
    cleanTemp();
    console.log('');
    logError(error.message);
    process.exit(1);
  }
}

if (action === 'check' || action === 'update') performUpdate(false, false);
else if (action === 'force') performUpdate(true, false);
else if (action === 'reinstall') performUpdate(true, true);
else process.exit(1);
