import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const ROOT_DIR = process.cwd();
const RAW_MANIFEST_URL =
  'https://raw.githubusercontent.com/Irithell/Jurandir-Mini/main/manifest.json';
const TAR_URL =
  'https://github.com/Irithell/Jurandir-Mini/releases/latest/download/jurandir-mini.tar.gz';

const TMP_DIR = path.join(ROOT_DIR, '.tmp_update');
const EXTRACTED_DIR = TMP_DIR;

const PROTECTED_CONFIGS = ['src/configs/config.json', 'src/configs/settings.json'];
const PROTECTED_FILES = ['start.sh', 'scripts/updater.mjs'];

const args = process.argv.slice(2);
const action = args[0] || 'check';

function logInfo(msg) {
  console.log(`\x1b[36m[ i ]\x1b[0m ${msg}`);
}
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
function logItem(color, icon, file, extra = '') {
  console.log(`  \x1b[${color}m[ ${icon} ]\x1b[0m ${file} ${extra}`);
}

function promptConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`\n\x1b[33m${question} [S/n]: \x1b[0m`, (answer) => {
      rl.close();
      resolve(answer.trim() === '' || answer.trim().toLowerCase() === 's');
    });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Jurandir' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchJson(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Falha de Parse JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadTar(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Jurandir' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadTar(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
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
      if (action !== 'check') logSuccess('Sistema operando na versão mais recente.');
      process.exit(0);
    }

    if (action === 'check') process.exit(1);

    logStep(`Iniciando handshake com versão v${remoteManifest.version}`);
    cleanTemp();
    fs.mkdirSync(TMP_DIR, { recursive: true });

    console.log(`\n\x1b[36m[ i ] Diff Estrutural de Atualização:\x1b[0m`);
    const allFiles = new Set([
      ...Object.keys(localManifest.files),
      ...Object.keys(remoteManifest.files),
    ]);
    const sortedFiles = Array.from(allFiles).sort();

    for (const file of sortedFiles) {
      const oldHash = localManifest.files[file];
      const newHash = remoteManifest.files[file];
      if (!oldHash && newHash) logItem('32', '+', file, '\x1b[32m(Adição)\x1b[0m');
      else if (oldHash && !newHash) logItem('31', '-', file, '\x1b[31m(Remoção)\x1b[0m');
      else if (oldHash !== newHash) logItem('33', '~', file, '\x1b[33m(Modificação)\x1b[0m');
    }
    console.log('');

    const tarDest = path.join(TMP_DIR, 'main.tar.gz');
    logStep('Processando download do payload...');
    await downloadTar(TAR_URL, tarDest);

    logStep('Descompactando Tarball no ambiente temporário...');
    execSync(`tar -xzf main.tar.gz`, { cwd: TMP_DIR, stdio: 'ignore' });

    console.log(`\n\x1b[36m[ ⚙ ] Validando assinaturas de integridade...\x1b[0m`);
    const filesToApply = [];
    let validationErrors = 0;

    for (const [file, expectedHash] of Object.entries(remoteManifest.files)) {
      const extractedFilePath = path.join(EXTRACTED_DIR, file);

      if (!fs.existsSync(extractedFilePath)) {
        logItem('31', 'FALHA', file, '\x1b[31m(Ausente no Payload)\x1b[0m');
        validationErrors++;
        continue;
      }

      const actualHash = getFileHash(extractedFilePath);
      if (actualHash !== expectedHash) {
        logItem('31', 'FALHA', file, '\x1b[31m(Violação de Hash)\x1b[0m');
        validationErrors++;
        continue;
      }

      logItem('32', 'OK', file);

      const oldManifestHash = localManifest.files[file];
      const isProtected = PROTECTED_CONFIGS.includes(file);
      const fileExists = fs.existsSync(path.join(ROOT_DIR, file));

      let shouldApply = false;

      if (!fileExists) {
        shouldApply = true;
      } else if (oldManifestHash !== expectedHash) {
        shouldApply = true;
      } else if (forceAll || isReinstall) {
        if (!isProtected) {
          shouldApply = true;
        }
      }

      if (shouldApply) {
        filesToApply.push(file);
      }
    }

    if (validationErrors > 0) {
      throw new Error(
        `Validação interrompida: ${validationErrors} conflito(s) estruturais. Operação abortada.`
      );
    }

    const confirm = await promptConfirm('Deseja prosseguir com a injeção dos arquivos no sistema?');
    if (!confirm) {
      cleanTemp();
      console.log('');
      logWarn('Transação cancelada.');
      process.exit(1);
    }

    console.log('');
    logStep('Aplicando mapeamento de arquivos...');
    let deletedCount = 0;

    const targetList = isReinstall
      ? Object.keys(localManifest.files)
      : Object.keys(localManifest.files).filter((f) => !remoteManifest.files[f]);

    for (const file of targetList) {
      if (isReinstall && PROTECTED_FILES.includes(file)) continue;
      if (isReinstall && PROTECTED_CONFIGS.includes(file)) continue;

      const filePath = path.join(ROOT_DIR, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logItem('31', 'REMOVIDO', file);
        deletedCount++;
      }
    }

    let appliedCount = 0;
    for (const file of filesToApply) {
      const srcPath = path.join(EXTRACTED_DIR, file);
      const destPath = path.join(ROOT_DIR, file);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);

      if (file.endsWith('.sh')) {
        try {
          fs.chmodSync(destPath, 0o755);
        } catch (e) {}
      }

      logItem('32', 'APLICADO', file);
      appliedCount++;
    }

    fs.copyFileSync(path.join(EXTRACTED_DIR, 'manifest.json'), localManifestPath);
    cleanTemp();

    console.log('');
    logSuccess('Build aplicado e sincronizado com sucesso.');
    logWarn(`Modificações: ${appliedCount} aplicados | ${deletedCount} descartados`);
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
