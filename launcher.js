import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { watch } from 'chokidar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ENTRY = path.join(__dirname, 'src/client/client.js');
const ARGS = process.argv.slice(2);

/** @type {import('node:child_process').ChildProcess | null} */
let botProcess = null;
let isInstalling = false;
let pendingRestart = false;
/** @type {NodeJS.Timeout | null} */
let restartDebounce = null;

function spawnBot() {
  botProcess = spawn('node', [BOT_ENTRY, ...ARGS], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    cwd: process.cwd(),
    env: process.env,
  });

  botProcess.on('message', (msg) => {
    const m = /** @type {any} */ (msg);
    if (!m || typeof m !== 'object') return;

    if (m.type === 'INSTALL_START') {
      isInstalling = true;
    } else if (m.type === 'INSTALL_DONE') {
      isInstalling = false;
      if (pendingRestart) {
        pendingRestart = false;
        restartBot();
      }
    }
  });

  botProcess.on('exit', (code) => {
    botProcess = null;
    if (code !== 0 && code !== null) setTimeout(spawnBot, 1000);
  });

  botProcess.on('error', (err) => {
    console.error('[LAUNCHER]', err.message);
  });
}

function restartBot() {
  if (botProcess) {
    botProcess.removeAllListeners('exit');
    botProcess.kill();
    botProcess = null;
  }
  spawnBot();
}

function startWatcher() {
  watch('src', {
    cwd: __dirname,
    persistent: true,
    ignoreInitial: true,
    ignored: (f) => path.basename(f).startsWith('.'),
  }).on('all', () => {
    if (restartDebounce) clearTimeout(restartDebounce);
    restartDebounce = setTimeout(() => {
      if (isInstalling) {
        pendingRestart = true;
        return;
      }
      restartBot();
    }, 500);
  });
}

function shutdown() {
  if (botProcess) botProcess.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

spawnBot();
startWatcher();
