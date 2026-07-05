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
import {
  getGroupMetadataCache,
  setGroupMetadataCache,
  warmupCache,
} from '../utils/cache.js';

const SESSION_ID = 'JURANDIR';
const codeMode = process.argv.includes('--code');

const cache = new NodeCache({ stdTTL: 300, useClones: false });

const msgRetryCounterCache = {
  get: (key) => cache.get(key),
  set: (key, value) => cache.set(key, value),
  del: (key) => cache.del(key),
  flushAll: () => cache.flushAll(),
};

/**
 * @param {string} question
 * @returns {Promise<string>}
 */
const ask = (question) => {
  return new Promise((resolve) => {
    ConsoleLogger.dispatch({
      level: 'tutor',
      lines: [{ message: question, tags: [{ label: 'TUTOR' }] }],
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl.on('line', (answer) => {
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

  // Carrega todos os grupos do SQLite pra RAM antes de conectar.
  // Nenhuma rede é tocada aqui — é só leitura de disco.
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
    generateHighQualityLinkPreview: true,
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
  logger: makeBaileysLogger(SESSION_ID),
  browser: ['Ubuntu', 'Edge', '110.0.1587.56'],
});

jurandir.ev.on('creds.update', saveCreds);

if (codeMode && !jurandir.authState.creds.registered) {
  let phoneNumber = await ask(
    'Por favor, insira o número de telefone (com DDD, sem espaços ou caracteres especiais): '
  );
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
    await delay(1500);
    const code = await jurandir.requestPairingCode(phoneNumber, 'JURANDIR');

    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
    ConsoleLogger.dispatch({
      level: 'tutor',
      lines: [
        { message: `Código de pareamento: ${formattedCode}`, tags: [{ label: 'CODE' }] },
        {
          message: 'Insira este código nas notificações do WhatsApp para autenticar o bot.',
          omitTimestamp: true,
        },
      ],
    });
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

// Atualiza cache individual quando grupo é modificado
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
    ConsoleLogger.dispatch({
      level: 'info',
      lines: [{ message: 'Escaneie o QR Code:', tags: [{ label: 'AUTH' }] }],
    });
    qrcode.generate(qr, { small: true });
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
    // Nenhum fetch de rede aqui — o cache já foi populado pelo warmupCache().
    // Grupos stale serão revalidados individualmente quando forem acessados.
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
