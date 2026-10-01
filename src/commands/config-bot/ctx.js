export const description = 'Exibe todos os campos e valores montados no CommandContext atual';

export const aliases = ['cmdctx', 'context', 'contexto'];

/**
 * @param {any} val
 * @returns {string}
 */
export function formatFieldValue(val) {
  if (val === null || val === undefined) {
    return '<nil>';
  }

  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }

  if (typeof val === 'number') {
    return String(val);
  }

  if (typeof val === 'string') {
    return val === '' ? '""' : val;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    if (typeof val[0] === 'object' && val[0] !== null) {
      return `[${val.length} itens]`;
    }
    const items = val.map((item) => (typeof item === 'string' ? item : String(item)));
    return '[' + items.join(', ') + ']';
  }

  if (typeof val === 'function') {
    return '[Function]';
  }

  if (typeof val === 'object') {
    if (val.constructor && val.constructor.name === 'Database') {
      return '&Database{...}';
    }
    if (val.ev && (val.authState || val.sendMessage)) {
      return '&WASocket{...}';
    }
    if (val.key && val.message) {
      return '&WAMessage{...}';
    }
    if (val.id && val.participants) {
      return '&GroupMetadata{...}';
    }
    if (val.name && val.owner && val.prefix !== undefined) {
      return '&BotConfig{...}';
    }
    if (val.messageContent && val.body !== undefined) {
      return '&ExtractedMessageData{...}';
    }
    if (
      val.conversation ||
      val.extendedTextMessage ||
      val.imageMessage ||
      val.buttonsResponseMessage ||
      val.listResponseMessage
    ) {
      return '&WAMessageContent{...}';
    }

    const typeName = val.constructor?.name || 'Object';
    return `&${typeName}{...}`;
  }

  return String(val);
}

export const CTX_FIELDS = [
  'sock',
  'client',
  'botName',
  'prefix',
  'config',
  'message',
  'rawMessage',
  'event',
  'messageData',
  'db',
  'from',
  'chat',
  'userJid',
  'sender',
  'senderJid',
  'clearLid',
  'clearJid',
  'senderAlt',
  'recipientAlt',
  'addressingMode',
  'formattedSender',
  'pushName',
  'isOwner',
  'isAdmin',
  'isBotAdmin',
  'isJurandir',
  'isGroup',
  'isPrivate',
  'isNewsletter',
  'isStatus',
  'groupMetadata',
  'groupName',
  'groupOwner',
  'groupParticipants',
  'messageId',
  'timestamp',
  'serverId',
  'type',
  'category',
  'mediaType',
  'isEphemeral',
  'isViewOnce',
  'isEdit',
  'isBotInvoke',
  'isFromMe',
  'isReply',
  'replyJid',
  'command',
  'args',
  'fullArgs',
  'body',
];

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async (ctx) => {
  const {
    jurandir,
    from,
    info,
    userJid,
    utils: { errorReply, reply, toUnicodeBoldUpper, isOwner },
  } = ctx;

  const userIsOwner = ctx.isOwner ?? isOwner(userJid);
  if (!userIsOwner) {
    await errorReply(
      jurandir,
      from,
      toUnicodeBoldUpper('Apenas donos do bot podem usar este comando.'),
      info
    );
    return;
  }

  const lines = CTX_FIELDS.map((fieldName) => {
    const formatted = formatFieldValue(ctx[fieldName]);
    return `${fieldName}: ${formatted}`;
  });

  const response = lines.join('\n');
  await reply(jurandir, from, response, info);
};
