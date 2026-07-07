import { ConsoleLogger } from './logger.js';

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 };

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
  /not logged in, attempting registration/i,
  /uploading pre-keys/i,
  /uploaded pre-keys successfully/i,
  /no name present, ignoring presence update request/i,
  /identity changed/i,
  /identity key changed/i,
  /invalid mex newsletter notification content/i,
  /injecting new app state sync keys/i,
  /resyncing/i,
  /Transitioned to Syncing state/i,
  /Doing app state sync/i,
  /restored state of/i,
  /synced \w+ to/i,
  /got history notification/i,
  /got my own devices/i,
];

const FORCE_SHOW = [
  /connected to WA/i,
  /opened connection to WA/i,
  /pre-keys found on server/i,
  /Current prekey ID:/i,
  /PreKey validation passed/i,
  /offline preview received/i,
  /handled \d+ offline messages/i,
  /Connection is now AwaitingInitialSync/i,
  /Transitioning to Online/i,
  /History sync is disabled by config/i,
];

/**
 * @param {string} msg
 * @param {'info'|'warn'|'error'|'fatal'} level
 * @returns {{ text: string, category: string }}
 */
function translate(msg, level) {
  const m = msg;

  if (/failed to decrypt message/i.test(m))
    return { category: 'CRYPT', text: 'Falha ao descriptografar mensagem (sessão desatualizada).' };
  if (/No SenderKeyRecord found/i.test(m))
    return { category: 'CRYPT', text: 'SenderKey do grupo não encontrado.' };
  if (/No session found to decrypt/i.test(m))
    return { category: 'CRYPT', text: 'Sessão de criptografia ausente para a mensagem recebida.' };
  if (/bad mac/i.test(m))
    return { category: 'CRYPT', text: 'Falha de integridade (Bad MAC) na descriptografia.' };
  if (/Decrypted message with closed session/i.test(m))
    return { category: 'CRYPT', text: 'Mensagem descriptografada utilizando sessão encerrada.' };
  if (/sent retry receipt/i.test(m))
    return { category: 'CRYPT', text: 'Solicitando reenvio de mensagem à rede (retry receipt).' };
  if (/retry.*decrypt|retry.*message/i.test(m))
    return { category: 'CRYPT', text: 'Tentando reprocessar descriptografia da mensagem.' };
  if (/Closing open session in favor of incoming prekey bundle/i.test(m))
    return { category: 'CRYPT', text: 'Rotacionando sessão (pre-key externo recebido).' };
  if (/Closing stale open session for new outgoing prekey bundle/i.test(m))
    return { category: 'CRYPT', text: 'Rotacionando sessão (novo pre-key interno gerado).' };
  if (/rate.overlimit/i.test(m))
    return { category: 'RATE', text: 'Limite de requisições excedido (rate-overlimit).' };
  if (/stream errored out|Stream Errored/i.test(m))
    return { category: 'NET', text: 'Falha na transmissão do socket.' };
  if (/timed out|timeout/i.test(m))
    return { category: 'NET', text: 'Tempo limite de resposta excedido.' };
  if (/keep.alive|keepalive/i.test(m))
    return { category: 'NET', text: 'Confirmação de integridade da conexão (Ping).' };

  if (/connected to WA/i.test(m))
    return { category: 'CONN', text: 'Handshake inicial estabelecido.' };
  if (/opened connection to WA/i.test(m))
    return { category: 'CONN', text: 'Socket de comunicação alocado.' };

  if (/pre-keys found on server/i.test(m)) {
    const match = m.match(/(\d+) pre-keys found/i);
    const count = match ? match[1] : '0';
    return {
      category: 'CRYPT',
      text: `${count} chaves de criptografia (pre-keys) disponíveis no servidor.`,
    };
  }

  if (/Current prekey ID: .* exists in storage:/i.test(m)) {
    const match = m.match(/Current prekey ID: (\d+), exists in storage: (true|false)/i);
    const id = match ? match[1] : '?';
    const status = match && match[2] === 'true' ? 'validado' : 'ausente';
    return {
      category: 'CRYPT',
      text: `Pre-key referencial [ ${id} ] em armazenamento local: ${status}.`,
    };
  }

  if (/PreKey validation passed/i.test(m))
    return { category: 'CRYPT', text: 'Validação mútua de pre-keys aprovada.' };
  if (/offline preview received/i.test(m))
    return { category: 'WA', text: 'Sinalização de tráfego offline interceptada.' };

  if (/handled \d+ offline messages/i.test(m)) {
    const match = m.match(/handled (\d+) offline/i);
    const count = match ? match[1] : '0';
    return { category: 'WA', text: `${count} notificação(ões) offline processada(s).` };
  }

  if (/Connection is now AwaitingInitialSync/i.test(m))
    return { category: 'SYNC', text: 'Aguardando protocolo de sincronização primária.' };
  if (/Transitioning to Online|History sync is disabled by config/i.test(m))
    return { category: 'SYNC', text: 'Sincronização inativa. Assumindo modo de conexão direta.' };
  if (
    /Flushing event buffer|released buffered events|Event buffer activated|flushed events/i.test(m)
  )
    return { category: 'SYNC', text: 'Buffer local esvaziado.' };
  if (/Connection closed|connection closed/i.test(m))
    return { category: 'CONN', text: 'Socket encerrado.' };
  if (/logged out|logout/i.test(m))
    return { category: 'CONN', text: 'Assinatura do dispositivo revogada externamente.' };
  if (/conflict/i.test(m))
    return {
      category: 'CONN',
      text: 'Queda forçada: outra instância iniciou tráfego com estas credenciais.',
    };
  if (/pairing/i.test(m) && /code/i.test(m))
    return { category: 'PAIR', text: 'Processamento de código de autenticação acionado.' };
  if (/qr/i.test(m)) return { category: 'PAIR', text: 'Hash QR providenciado.' };
  if (/transaction failed|rolling back/i.test(m))
    return { category: 'DB', text: 'Rollback acionado. Transação interna corrompida.' };
  if (/entering transaction/i.test(m)) return { category: 'DB', text: 'Inicializando transação.' };
  if (/transaction completed/i.test(m)) return { category: 'DB', text: 'Transação executada.' };
  if (/no mutations in transaction/i.test(m))
    return { category: 'DB', text: 'Transação redundante ignorada.' };
  if (/read receipt|Message receipt/i.test(m))
    return { category: 'MSG', text: 'Pacote de confirmação de leitura processado.' };
  if (/loading from store|Cache miss|updated cache/i.test(m))
    return { category: 'CACHE', text: msg };

  return {
    category: level === 'error' || level === 'fatal' ? 'SYS' : 'WA',
    text: msg,
  };
}

/**
 * @param {string} _sessionId
 * @param {keyof typeof LEVELS} [targetLevel='info']
 * @returns {object}
 */
export function makeBaileysLogger(_sessionId, targetLevel = 'info') {
  /** @param {string} [category] */
  const tags = (category) => (category ? [{ label: category }] : []);

  const self = {
    level: targetLevel,

    /** @param {any[]} args */
    info: (...args) => {
      const msgRaw = firstString(args) ?? '';
      const msg = norm(msgRaw);

      if (DROP_ALWAYS.some((r) => r.test(msg))) return;

      const currentLevelWeight = LEVELS[self.level] || LEVELS.info;
      const msgWeight = LEVELS.info;
      const force = FORCE_SHOW.some((r) => r.test(msg));

      if (!force && currentLevelWeight > msgWeight) return;

      if (/Closing session/i.test(msg)) {
        const entry = /** @type {any} */ (firstObject(args));
        const keyId = entry?.pendingPreKey?.signedKeyId;
        const text =
          keyId != null
            ? `Encerramento de sessão — preKey referencial [ ${keyId} ]`
            : 'Encerramento de sessão criptográfica.';
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
      const msg = norm(firstString(args) ?? 'Aviso Interno');
      if (DROP_ALWAYS.some((r) => r.test(msg))) return;

      const currentLevelWeight = LEVELS[self.level] || LEVELS.info;
      const msgWeight = LEVELS.warn;
      const force = FORCE_SHOW.some((r) => r.test(msg));

      if (!force && currentLevelWeight > msgWeight) return;

      const t = translate(msg, 'warn');
      ConsoleLogger.dispatch({
        level: 'warn',
        lines: [{ message: t.text, tags: tags(t.category) }],
      });
    },

    /** @param {any[]} args */
    error: (...args) => {
      const msg = norm(firstString(args) ?? 'Exceção Interna');

      const currentLevelWeight = LEVELS[self.level] || LEVELS.info;
      const msgWeight = LEVELS.error;
      const force = FORCE_SHOW.some((r) => r.test(msg));

      if (!force && currentLevelWeight > msgWeight) return;

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
      const msg = norm(firstString(args) ?? 'Exceção Crítica');
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
