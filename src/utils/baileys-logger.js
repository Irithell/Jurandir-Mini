import { ConsoleLogger } from './logger.js';

/**
 * @param {any[]} args
 * @returns {string | undefined}
 */
function firstString(args) {
  return args.find((a) => typeof a === 'string');
}

/**
 * @param {any[]} args
 * @returns {object | undefined}
 */
function firstObject(args) {
  return args.find(
    (a) => a && typeof a === 'object' && !Buffer.isBuffer(a) && !(a instanceof Error)
  );
}

/**
 * @param {string} msg
 * @returns {string}
 */
function norm(msg) {
  return msg.replace(/recv \d+ bytes, total recv \d+ bytes/gi, 'recv <bytes>').trim();
}

const DROP_ALWAYS = [
  /handshake|recv frame|HelloMsg|HandshakeMessage|ClientHello|ServerHello/i,
  /fetched props|sendActiveReceipts/i,
  /handled 0 offline messages/i,
  /LID mapping|pn mappings|bulk device migration/i,
  /Own LID session created successfully/i,
  /logging in\.\.\./i,
];

/**
 * @param {string} msg
 * @param {'info'|'warn'|'error'|'fatal'} level
 * @returns {{ text: string, category: string }}
 */
function translate(msg, level) {
  const m = msg;

  if (/failed to decrypt message/i.test(m))
    return {
      category: 'CRYPT',
      text: 'Falha ao descriptografar mensagem (sessão pode estar desatualizada).',
    };
  if (/No SenderKeyRecord found/i.test(m))
    return {
      category: 'CRYPT',
      text: 'SenderKey do grupo não encontrado — pode ser necessário re-sincronizar.',
    };
  if (/No session found to decrypt/i.test(m))
    return { category: 'CRYPT', text: 'Sessão de criptografia não encontrada para esta mensagem.' };
  if (/bad mac/i.test(m))
    return { category: 'CRYPT', text: 'Falha de integridade (Bad MAC) ao descriptografar.' };
  if (/Decrypted message with closed session/i.test(m))
    return { category: 'CRYPT', text: 'Mensagem descriptografada com sessão já encerrada.' };
  if (/sent retry receipt/i.test(m))
    return { category: 'CRYPT', text: 'Solicitando reenvio de mensagem (retry receipt).' };
  if (/retry.*decrypt|retry.*message/i.test(m))
    return { category: 'CRYPT', text: 'Tentando re-descriptografar mensagem.' };
  if (/Closing open session in favor of incoming prekey bundle/i.test(m))
    return { category: 'CRYPT', text: 'Rotacionando sessão — novo preKey recebido.' };
  if (/Closing stale open session for new outgoing prekey bundle/i.test(m))
    return { category: 'CRYPT', text: 'Rotacionando sessão — novo preKey enviado.' };
  if (/rate.overlimit/i.test(m))
    return { category: 'RATE', text: 'Limite de requisições atingido (rate-overlimit).' };
  if (/stream errored out|Stream Errored/i.test(m))
    return { category: 'NET', text: 'Falha no stream da conexão (rede instável).' };
  if (/timed out|timeout/i.test(m))
    return { category: 'NET', text: 'Tempo de resposta excedido (timeout).' };
  if (/keep.alive|keepalive/i.test(m)) return { category: 'NET', text: 'Keep-alive da conexão.' };
  if (/connected to WA/i.test(m)) return { category: 'CONN', text: 'Conectado ao WhatsApp.' };
  if (/opened connection to WA/i.test(m))
    return { category: 'CONN', text: 'Conexão com o WhatsApp aberta.' };
  if (/Connection is now AwaitingInitialSync/i.test(m))
    return { category: 'SYNC', text: 'Aguardando sincronização inicial.' };
  if (/Transitioning to Online|History sync is disabled by config/i.test(m))
    return { category: 'SYNC', text: 'Sincronização desativada — entrando em modo Online.' };
  if (
    /Flushing event buffer|released buffered events|Event buffer activated|flushed events/i.test(m)
  )
    return { category: 'SYNC', text: 'Buffer de eventos processado.' };
  if (/Connection closed|connection closed/i.test(m))
    return { category: 'CONN', text: 'Conexão encerrada.' };
  if (/logged out|logout/i.test(m))
    return { category: 'CONN', text: 'Sessão deslogada no dispositivo.' };
  if (/conflict/i.test(m))
    return { category: 'CONN', text: 'Conflito detectado — outra conexão assumiu a sessão.' };
  if (/pairing/i.test(m) && /code/i.test(m))
    return { category: 'PAIR', text: 'Código de pareamento gerado/solicitado.' };
  if (/qr/i.test(m)) return { category: 'PAIR', text: 'QR Code solicitado/atualizado.' };
  if (/transaction failed|rolling back/i.test(m))
    return { category: 'DB', text: 'Falha em transação interna — revertendo (rollback).' };
  if (/entering transaction/i.test(m))
    return { category: 'DB', text: 'Iniciando transação interna.' };
  if (/transaction completed/i.test(m))
    return { category: 'DB', text: 'Transação interna concluída.' };
  if (/no mutations in transaction/i.test(m))
    return { category: 'DB', text: 'Transação sem alterações.' };
  if (/history sync/i.test(m)) return { category: 'SYNC', text: 'Evento de histórico recebido.' };
  if (/read receipt|Message receipt/i.test(m))
    return { category: 'MSG', text: 'Confirmação de leitura recebida.' };
  if (/loading from store|Cache miss|updated cache/i.test(m))
    return { category: 'CACHE', text: msg };
  if (/PreKey|pre-keys found/i.test(m)) return { category: 'CRYPT', text: msg };

  return {
    category: level === 'error' || level === 'fatal' ? 'SYS' : 'WA',
    text: msg,
  };
}

/**
 * @param {string} _sessionId
 * @returns {object}
 */
export function makeBaileysLogger(_sessionId) {
  /** @param {string} [category] */
  const tags = (category) => (category ? [{ label: category }] : []);

  const self = {
    level: 'info',

    /** @param {any[]} args */
    info: (...args) => {
      const msgRaw = firstString(args) ?? '';
      const msg = norm(msgRaw);

      if (DROP_ALWAYS.some((r) => r.test(msg))) return;

      // Closing session com objeto SessionEntry
      if (/Closing session/i.test(msg)) {
        const entry = firstObject(args);
        const keyId = entry?.pendingPreKey?.signedKeyId;
        const text =
          keyId != null
            ? `Sessão encerrada — preKey #${keyId}`
            : 'Sessão de criptografia encerrada.';
        ConsoleLogger.dispatch({ level: 'warn', lines: [{ message: text, tags: tags('CRYPT') }] });
        return;
      }

      const t = translate(msg, 'info');
      ConsoleLogger.dispatch({
        level: 'info',
        lines: [{ message: t.text, tags: tags(t.category) }],
      });
    },

    /** @param {any[]} args */
    warn: (...args) => {
      const msg = norm(firstString(args) ?? 'Aviso do Baileys');
      if (DROP_ALWAYS.some((r) => r.test(msg))) return;
      const t = translate(msg, 'warn');
      ConsoleLogger.dispatch({
        level: 'warn',
        lines: [{ message: t.text, tags: tags(t.category) }],
      });
    },

    /** @param {any[]} args */
    error: (...args) => {
      const msg = norm(firstString(args) ?? 'Erro do Baileys');
      const t = translate(msg, 'error');
      const errorObj = args.find((a) => a instanceof Error);
      ConsoleLogger.dispatch({
        level: 'error',
        lines: [
          { message: t.text, tags: tags(t.category) },
          ...(errorObj ? [{ message: String(errorObj.message), omitTimestamp: true }] : []),
        ],
      });
    },

    /** @param {any[]} args */
    fatal: (...args) => {
      const msg = norm(firstString(args) ?? 'Fatal do Baileys');
      const t = translate(msg, 'fatal');
      ConsoleLogger.dispatch({
        level: 'error',
        lines: [{ message: t.text, tags: [...tags(t.category), { label: 'FATAL' }] }],
      });
    },

    debug: () => {},
    trace: () => {},
    child: () => self,
  };

  return self;
}
