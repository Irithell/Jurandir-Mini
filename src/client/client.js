import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay,
} from '@whiskeysockets/baileys';

import pino from 'pino';
import qrcode from 'qrcode-terminal';
import readline from 'node:readline';
import NodeCache from 'node-cache';

import { loadCommands } from '../commands/registry.js';
import { handleMessage } from '../core/handlers/message.handler.js';
import { dbRun } from '../configs/database.js';
import { useSQLiteAuthState } from './auth.js';
import { ConsoleLogger, bannerLog } from '../utils/logger.js';
import { makeBaileysLogger } from '../utils/baileys-logger.js';
import { getGroupMetadataCache, setGroupMetadataCache, warmupCache } from '../utils/cache.js';
import { init as initAddons } from '../core/addon-loader.js';

const SESSION_ID = 'JURANDIR';
const codeMode = process.argv.includes('--code');

const cache = new NodeCache({ stdTTL: 300, useClones: false });

/** @type {import('@whiskeysockets/baileys').CacheStore} */
const msgRetryCounterCache = {
  get: (key) => cache.get(key),
  set: (key, value) => cache.set(key, value),
  del: (key) => cache.del(key),
  flushAll: () => cache.flushAll(),
};

const colors = {
  /** @param {string} text */ cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  /** @param {string} text */ white: (text) => `\x1b[37m${text}\x1b[0m`,
  /** @param {string} text */ yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  /** @param {string} text */ green: (text) => `\x1b[32m${text}\x1b[0m`,
  /** @param {string} text */ gray: (text) => `\x1b[90m${text}\x1b[0m`,
  /** @param {string} text */ red: (text) => `\x1b[31m${text}\x1b[0m`,
};

/**
 * @param {number} [customWidth=54]
 * @returns {string}
 */
function getPad(customWidth = 54) {
  const cols = process.stdout.columns || 80;
  return ' '.repeat(Math.max(0, Math.floor((cols - customWidth) / 2)));
}

/**
 * @param {string} text
 */
function boxLog(text) {
  console.log(getPad(54) + text);
}

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
const askCentered = (question) => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.question(getPad(54) + question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/**
 * @param {string} sessionId
 */
function clearSession(sessionId) {
  try {
    dbRun('DELETE FROM auth_state WHERE session_id = ?', [sessionId]);
    dbRun('DELETE FROM auth_keys WHERE session_id = ?', [sessionId]);
    ConsoleLogger.dispatch({
      level: 'info',
      lines: [
        { message: 'Sessão limpa com sucesso do banco de dados.', tags: [{ label: 'AUTH' }] },
      ],
    });
  } catch (err) {
    ConsoleLogger.dispatch({
      level: 'warn',
      lines: [
        { message: 'Erro ao limpar sessão:', tags: [{ label: 'AUTH' }] },
        { message: String(err), omitTimestamp: true },
      ],
    });
  }
}

async function iniciarJurandir() {
  bannerLog();

  ConsoleLogger.dispatch({
    level: 'info',
    lines: [{ message: 'Iniciando sistema do Jurandir...', tags: [{ label: 'SYS' }] }],
  });

  await loadCommands();
  warmupCache();

  ConsoleLogger.dispatch({
    level: 'info',
    lines: [{ message: 'Cache de grupos carregado da DB.', tags: [{ label: 'CACHE' }] }],
  });

  const { state, saveCreds } = await useSQLiteAuthState(SESSION_ID);
  const { version } = await fetchLatestBaileysVersion();

  ConsoleLogger.dispatch({
    level: 'info',
    lines: [{ message: `Versão do Baileys: v${version.join('.')}`, tags: [{ label: 'SYS' }] }],
  });

  const jurandir = makeWASocket({
    version,
    emitOwnEvents: true,
    fireInitQueries: true,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    msgRetryCounterCache,
    cachedGroupMetadata: (jid) => getGroupMetadataCache(jurandir, jid),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        /** @type {import('@whiskeysockets/baileys').SignalKeyStore} */ (state.keys),
        pino({ level: 'silent' })
      ),
    },
    printQRInTerminal: false,
    logger: /** @type {any} */ (makeBaileysLogger(SESSION_ID, 'silent')),
    browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
  });

  await initAddons(jurandir);

  jurandir.ev.on('creds.update', /** @type {any} */ (saveCreds));

  if (codeMode && !jurandir.authState.creds.registered) {
    console.log('');
    boxLog(colors.cyan('╭────────────────────────────────────────────────────╮'));
    boxLog(
      colors.cyan('│') +
        colors.white('              CONEXÃO VIA PAIRING CODE              ') +
        colors.cyan('│')
    );
    boxLog(colors.cyan('├────────────────────────────────────────────────────┤'));
    boxLog(
      colors.cyan('│') +
        colors.white(' Insira o número do WhatsApp que será o bot.        ') +
        colors.cyan('│')
    );
    boxLog(
      colors.cyan('│') +
        colors.gray(' Exemplo: 5511999999999 (País + DDD + Número)       ') +
        colors.cyan('│')
    );
    boxLog(colors.cyan('╰────────────────────────────────────────────────────╯'));
    console.log('');

    let phoneNumber = await askCentered(colors.yellow('  ➭ Número: '));
    phoneNumber = phoneNumber.replace(/\D/g, '');

    if (!/^\d{10,15}$/.test(phoneNumber)) {
      ConsoleLogger.dispatch({
        level: 'warn',
        lines: [
          { message: 'Número inválido! Insira um número válido.', tags: [{ label: 'PAIR' }] },
        ],
      });
      process.exit(1);
    }

    try {
      console.log(getPad(54) + colors.yellow('\n  [ ⚙ ] Gerando código de pareamento, aguarde...'));
      await delay(1500);
      const code = await jurandir.requestPairingCode(phoneNumber, 'JURANDIR');
      const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

      const leftSpace = ' '.repeat(17);
      const rightSpace = ' '.repeat(18);

      console.log('');
      boxLog(colors.cyan('╭────────────────────────────────────────────────────╮'));
      boxLog(
        colors.cyan('│') +
          colors.white('                 [ CÓDIGO GERADO ]                  ') +
          colors.cyan('│')
      );
      boxLog(colors.cyan('├────────────────────────────────────────────────────┤'));
      boxLog(
        colors.cyan('│') +
          leftSpace +
          colors.white('CÓDIGO: ') +
          colors.green(formattedCode) +
          rightSpace +
          colors.cyan('│')
      );
      boxLog(colors.cyan('├────────────────────────────────────────────────────┤'));
      boxLog(
        colors.cyan('│') +
          colors.gray(' 1. Abra o WhatsApp no celular do bot.              ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' 2. Vá em Aparelhos Conectados.                     ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' 3. Toque em Conectar um aparelho.                  ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' 4. Selecione Conectar com número de telefone.      ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' 5. Digite o código gerado acima.                   ') +
          colors.cyan('│')
      );
      boxLog(colors.cyan('╰────────────────────────────────────────────────────╯'));
      console.log('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      ConsoleLogger.dispatch({
        level: 'error',
        lines: [
          {
            message: 'Falha ao gerar o código de pareamento. Limpando sessão...',
            tags: [{ label: 'PAIR' }],
          },
          { message: errorMsg, omitTimestamp: true },
        ],
      });
      clearSession(SESSION_ID);
      process.exit(1);
    }
  }

  jurandir.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      if (!update.id) continue;
      const meta = await jurandir.groupMetadata(update.id).catch(() => null);
      if (meta) setGroupMetadataCache(update.id, meta);
    }
  });

  jurandir.ev.on('group-participants.update', async (update) => {
    if (!update.id) return;
    const meta = await jurandir.groupMetadata(update.id).catch(() => null);
    if (meta) setGroupMetadataCache(update.id, meta);
  });

  jurandir.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !codeMode) {
      console.log('');
      boxLog(colors.cyan('╭────────────────────────────────────────────────────╮'));
      boxLog(
        colors.cyan('│') +
          colors.white('                CONEXÃO VIA QR CODE                 ') +
          colors.cyan('│')
      );
      boxLog(colors.cyan('├────────────────────────────────────────────────────┤'));
      boxLog(
        colors.cyan('│') +
          colors.gray(' Escaneie o QR Code abaixo com o seu WhatsApp.      ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' Caso não tenha outro celular para ler o código,    ') +
          colors.cyan('│')
      );
      boxLog(
        colors.cyan('│') +
          colors.gray(' feche e use a Opção [ 2 ] no Painel Iniciar.       ') +
          colors.cyan('│')
      );
      boxLog(colors.cyan('╰────────────────────────────────────────────────────╯'));
      console.log('');

      qrcode.generate(qr, { small: true }, (qrStr) => {
        const qrLines = qrStr.split('\n');
        // eslint-disable-next-line no-control-regex
        const ansiRegex = new RegExp('\\x1B\\[[0-9;]*m', 'g');
        const rawWidth = qrLines[0].replace(ansiRegex, '').length || 33;
        const qrPad = getPad(rawWidth);
        qrLines.forEach((line) => console.log(qrPad + line));
      });
    }

    if (connection === 'close') {
      const error = /** @type {import('@hapi/boom').Boom | undefined} */ (lastDisconnect?.error);
      const reason = error?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        ConsoleLogger.dispatch({
          level: 'error',
          lines: [{ message: 'Desconectado. Limpando sessão...', tags: [{ label: 'AUTH' }] }],
        });
        clearSession(SESSION_ID);
        process.exit(1);
      } else if (reason === 401) {
        ConsoleLogger.dispatch({
          level: 'error',
          lines: [
            { message: 'Sessão expirada (401). Limpando sessão...', tags: [{ label: 'AUTH' }] },
          ],
        });
        clearSession(SESSION_ID);
        process.exit(1);
      } else {
        ConsoleLogger.dispatch({
          level: 'warn',
          lines: [{ message: 'Conexão perdida, reconectando...', tags: [{ label: 'NET' }] }],
        });
        setTimeout(iniciarJurandir, 3000);
      }
    }

    if (connection === 'open') {
      ConsoleLogger.dispatch({
        level: 'success',
        lines: [{ message: 'Conexão efetuada com sucesso!', tags: [{ label: 'NET' }] }],
      });
    }

    if (connection === 'connecting') {
      ConsoleLogger.dispatch({
        level: 'warn',
        lines: [{ message: 'Atualizando sessão...', tags: [{ label: 'NET' }] }],
      });
    }
  });

  jurandir.ev.on('messages.upsert', (data) => {
    handleMessage(jurandir, data);
  });

  return jurandir;
}

iniciarJurandir();
