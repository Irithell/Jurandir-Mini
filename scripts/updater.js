import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const RAW_MANIFEST_URL =
  'https://raw.githubusercontent.com/Irithell/Jurandir-Mini/main/manifest.json';
const ZIP_URL = 'https://github.com/Irithell/Jurandir-Mini/archive/refs/heads/main.zip';

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
function logItem(action, file) {
  const colors = {
    BAIXANDO: '\x1b[34m',
    VALIDANDO: '\x1b[35m',
    APLICANDO: '\x1b[32m',
    REMOVENDO: '\x1b[31m',
    IGNORADO: '\x1b[33m',
  };
  console.log(`  ${colors[action] || '\x1b[37m'}[ ${action} ]\x1b[0m ${file}`);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Jurandir-Updater' } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let data = '';
        res.on('data', (chunk) => (data += chunk));
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
      .get(url, { headers: { 'User-Agent': 'Jurandir-Updater' } }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function cleanTemp() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

async function performUpdate(forceAll = false, isReinstall = false) {
  try {
    const remoteManifest = await fetchJson(RAW_MANIFEST_URL);
    const localManifestPath = path.join(ROOT_DIR, 'manifest.json');

    let localManifest = { files: {} };
    if (fs.existsSync(localManifestPath)) {
      localManifest = JSON.parse(fs.readFileSync(localManifestPath, 'utf8'));
    }

    const isSameVersion =
      localManifest.version === remoteManifest.version &&
      localManifest.build_time === remoteManifest.build_time;

    if (!forceAll && !isReinstall && isSameVersion) {
      if (action !== 'check') logSuccess('O Jurandir já está na versão mais recente.');
      process.exit(0);
    }

    if (action === 'check') process.exit(1);

    logStep(`Iniciando sincronização para a versão v${remoteManifest.version}`);
    cleanTemp();
    fs.mkdirSync(TMP_DIR, { recursive: true });

    const zipDest = path.join(TMP_DIR, 'main.zip');
    logStep('Baixando pacote criptografado do repositório...');
    await downloadZip(ZIP_URL, zipDest);

    logStep('Extraindo arquivos...');
    try {
      execSync(`unzip -q -o main.zip`, { cwd: TMP_DIR, stdio: 'ignore' });
    } catch (err) {
      throw new Error('Falha ao extrair o ZIP. O pacote pode estar corrompido.');
    }

    logStep('Validando integridade dos arquivos extraídos (SHA-256)...');
    const filesToApply = [];

    for (const [file, expectedHash] of Object.entries(remoteManifest.files)) {
      const extractedFilePath = path.join(EXTRACTED_DIR, file);

      if (!fs.existsSync(extractedFilePath)) {
        throw new Error(`Arquivo ausente no pacote baixado: ${file}`);
      }

      const actualHash = getFileHash(extractedFilePath);
      if (actualHash !== expectedHash) {
        logItem('FALHA', `${file} (Hash Incompatível)`);
        throw new Error(`Integridade comprometida no arquivo: ${file}`);
      }

      if (
        forceAll ||
        isReinstall ||
        localManifest.files[file] !== expectedHash ||
        !fs.existsSync(path.join(ROOT_DIR, file))
      ) {
        filesToApply.push(file);
      }
    }

    logSuccess(
      `Todos os ${Object.keys(remoteManifest.files).length} arquivos passaram na validação!`
    );

    logStep('Aplicando alterações no sistema...');
    let deletedCount = 0;

    const PROTECTED_FILES = ['start.sh', 'scripts/updater.js'];

    if (isReinstall) {
      for (const file of Object.keys(localManifest.files)) {
        if (PROTECTED_FILES.includes(file)) {
          logItem('IGNORADO', `${file} (Proteção de Sistema ativada)`);
          continue;
        }
        const filePath = path.join(ROOT_DIR, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logItem('REMOVENDO', file);
          deletedCount++;
        }
      }
    } else {
      for (const file of Object.keys(localManifest.files)) {
        if (!remoteManifest.files[file]) {
          const filePath = path.join(ROOT_DIR, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logItem('REMOVENDO', file);
            deletedCount++;
          }
        }
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
    logSuccess('Atualização concluída com segurança!');
    logWarn(`Arquivos aplicados: ${appliedCount} | Removidos: ${deletedCount}`);

    process.exit(0);
  } catch (error) {
    cleanTemp();
    console.log('');
    logError(`Falha durante a atualização segura: ${error.message}`);
    logWarn('Nenhum arquivo local foi alterado. O sistema iniciará com a versão atual.');
    process.exit(1);
  }
}

if (action === 'check' || action === 'update') {
  performUpdate(false, false);
} else if (action === 'force') {
  performUpdate(true, false);
} else if (action === 'reinstall') {
  performUpdate(true, true);
} else {
  logError('Ação inválida para o updater.');
  process.exit(1);
}
