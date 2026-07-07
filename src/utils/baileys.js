import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {import('@whiskeysockets/baileys').WAMessage} WAMessage
 * @typedef {import('@/types/baileys.d.ts').ExtractedMessageData} ExtractedMessageData
 * @typedef {import('@/types/baileys.d.ts').ExtractedMessageContent} ExtractedMessageContent
 * @typedef {Parameters<typeof downloadContentFromMessage>[1]} BaileysMediaType
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.resolve(__dirname, '../../tmp');

/**
 * @param {WAMessage} message
 * @param {string} context
 * @returns {any}
 */
export function getContent(message, context) {
  const viewOnceMsg =
    message.message?.viewOnceMessage?.message ||
    message.message?.viewOnceMessageV2?.message ||
    message.message?.viewOnceMessageV2Extension?.message;

  const key = `${context}Message`;

  if (viewOnceMsg) {
    return /** @type {any} */ (viewOnceMsg)[key];
  }

  return (
    /** @type {any} */ (message.message)?.[key] ||
    /** @type {any} */ (message.message?.extendedTextMessage?.contextInfo?.quotedMessage)?.[key]
  );
}

/**
 * @param {WAMessage} message
 * @param {string} context
 */
export function baileysIs(message, context) {
  return !!getContent(message, context);
}

/**
 * @param {string | null | undefined} mimetype
 */
function getMimetypeExtension(mimetype) {
  if (!mimetype) return 'bin';

  /** @type {Record<string, string>} */
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/mpeg': 'mpeg',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'application/json': 'json',
  };

  return mimeMap[mimetype.toLowerCase()] || mimetype.split('/')[1] || 'bin';
}

/**
 * @param {WAMessage} message
 */
function getViewOnceMessage(message) {
  const msg = message.message;
  if (!msg) return null;
  return (
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.viewOnceMessageV2Extension?.message ||
    null
  );
}

/**
 * @param {WAMessage} message
 * @returns {ExtractedMessageContent}
 */
function detectMessageType(message) {
  let msg = message.message;
  if (!msg) return { type: 'unknown', content: null, isViewOnce: false };

  const viewOnceWrapper =
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.viewOnceMessageV2Extension?.message;

  let isViewOnceDetected = !!viewOnceWrapper;

  if (msg.imageMessage?.viewOnce) isViewOnceDetected = true;
  if (msg.videoMessage?.viewOnce) isViewOnceDetected = true;
  if (msg.audioMessage?.viewOnce) isViewOnceDetected = true;

  if (viewOnceWrapper) msg = viewOnceWrapper;

  /**
   * @param {string} type
   * @param {any} content
   * @param {any} [metadata]
   * @returns {ExtractedMessageContent}
   */
  const baseReturn = (type, content, metadata) => ({
    type,
    content,
    metadata,
    isViewOnce: isViewOnceDetected,
  });

  if (msg.conversation || msg.extendedTextMessage)
    return baseReturn('text', msg.conversation || msg.extendedTextMessage?.text);
  if (msg.buttonsResponseMessage) return baseReturn('buttons', msg.buttonsResponseMessage);
  if (msg.listResponseMessage) return baseReturn('list', msg.listResponseMessage);
  if (msg.templateButtonReplyMessage) return baseReturn('template', msg.templateButtonReplyMessage);
  if (msg.interactiveResponseMessage)
    return baseReturn('interactive', msg.interactiveResponseMessage);

  if (msg.imageMessage) {
    return baseReturn('image', msg.imageMessage, {
      caption: msg.imageMessage.caption ?? null,
      mimetype: msg.imageMessage.mimetype ?? null,
      fileLength: msg.imageMessage.fileLength ? Number(msg.imageMessage.fileLength) : null,
    });
  }

  if (msg.videoMessage) {
    return baseReturn('video', msg.videoMessage, {
      caption: msg.videoMessage.caption ?? null,
      mimetype: msg.videoMessage.mimetype ?? null,
      seconds: msg.videoMessage.seconds ?? null,
    });
  }

  if (msg.audioMessage) {
    return baseReturn('audio', msg.audioMessage, {
      mimetype: msg.audioMessage.mimetype ?? null,
      seconds: msg.audioMessage.seconds ?? null,
    });
  }

  if (msg.documentMessage || msg.documentWithCaptionMessage) {
    const doc = msg.documentMessage || msg.documentWithCaptionMessage?.message?.documentMessage;
    return baseReturn('document', doc, {
      caption: doc?.caption ?? null,
      mimetype: doc?.mimetype ?? null,
      fileName: doc?.fileName ?? null,
    });
  }

  if (msg.stickerMessage)
    return baseReturn('sticker', msg.stickerMessage, {
      mimetype: msg.stickerMessage.mimetype ?? null,
    });
  if (msg.contactMessage) return baseReturn('contact', msg.contactMessage);
  if (msg.locationMessage) return baseReturn('location', msg.locationMessage);
  if (msg.liveLocationMessage) return baseReturn('liveLocation', msg.liveLocationMessage);
  if (msg.pollCreationMessage || msg.pollCreationMessageV3)
    return baseReturn('poll', msg.pollCreationMessage || msg.pollCreationMessageV3);

  return baseReturn('unknown', msg);
}

/**
 * @param {WAMessage} message
 */
export function extractBodyText(message) {
  let msg = message.message;
  if (!msg) return '';

  const viewOnceMsg = getViewOnceMessage(message);
  if (viewOnceMsg) msg = viewOnceMsg;

  let body =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    msg.buttonsMessage?.imageMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    '';

  if (!body && msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const parsed = JSON.parse(
        msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
      );
      body = parsed?.id || '';
    } catch {
      body = '';
    }
  }

  return String(body || '');
}

/**
 * @param {string} body
 * @param {string[]} prefixes
 */
function pickMatchedPrefix(body, prefixes) {
  const cleaned = (body || '').trim();
  if (!cleaned) return null;

  const list = [...new Set(prefixes)]
    .filter((p) => typeof p === 'string' && p.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const p of list) {
    if (cleaned.startsWith(p)) return p;
  }
  return null;
}

/**
 * @param {WAMessage} message
 * @param {string} fallbackPrefix
 * @returns {ExtractedMessageData}
 */
export function extractMessageData(message, fallbackPrefix) {
  const messageContent = detectMessageType(message);
  const body = extractBodyText(message);
  const key = message.key;

  const emptyReturn = {
    args: [],
    body: '',
    command: '',
    from: '',
    fullArgs: '',
    isReply: false,
    prefix: '',
    replyJid: null,
    userJid: '',
    isGroup: false,
    messageType: messageContent.type,
    messageContent,
    rawMessage: message,
  };

  if (!key) return emptyReturn;

  const from = key.remoteJid || '';
  const isGroup = from.endsWith('@g.us');
  const userJid = key.participant?.replace(/:[ 0-9 ]{1,2}/g, '') || from;

  const isReply =
    !!message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    !!message.message?.imageMessage?.contextInfo?.quotedMessage ||
    !!message.message?.videoMessage?.contextInfo?.quotedMessage;

  const replyJid =
    message.message?.extendedTextMessage?.contextInfo?.participant ||
    message.message?.imageMessage?.contextInfo?.participant ||
    message.message?.videoMessage?.contextInfo?.participant ||
    null;

  if (!body) return { ...emptyReturn, from, userJid, isGroup, isReply, replyJid };

  const bodyString = String(body);
  const matchedPrefix = pickMatchedPrefix(bodyString, [fallbackPrefix]);

  if (!matchedPrefix)
    return { ...emptyReturn, body: bodyString, from, userJid, isGroup, isReply, replyJid };

  const afterPrefix = bodyString.slice(matchedPrefix.length).trim();
  if (!afterPrefix)
    return { ...emptyReturn, body: bodyString, from, userJid, isGroup, isReply, replyJid };

  const parts = afterPrefix.split(' ');
  const command = parts[0]?.toLowerCase().trim() || '';
  const args = parts.slice(1);

  if (!command)
    return { ...emptyReturn, body: bodyString, from, userJid, isGroup, isReply, replyJid };

  return {
    args,
    body: bodyString,
    command,
    from,
    fullArgs: args.join(' '),
    isReply,
    prefix: matchedPrefix,
    replyJid,
    userJid,
    isGroup,
    messageType: messageContent.type,
    messageContent,
    rawMessage: message,
  };
}

/**
 * @param {WAMessage} message
 * @param {BaileysMediaType} mediaType
 * @param {string} [fileName]
 */
export async function downloadMedia(message, mediaType, fileName) {
  const content = getContent(message, mediaType);
  if (!content) return null;

  const stream = await downloadContentFromMessage(content, mediaType);
  let buffer = Buffer.from([]);

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  const mimetype = content.mimetype;
  const extension = getMimetypeExtension(mimetype);
  const finalFileName = fileName || `download_${Date.now()}`;
  const filePath = path.resolve(TEMP_DIR, `${finalFileName}.${extension}`);

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * @param {any} mediaKey
 * @param {BaileysMediaType} mediaType
 */
export async function getMediaBuffer(mediaKey, mediaType) {
  const stream = await downloadContentFromMessage(mediaKey, mediaType);
  let buffer = Buffer.from([]);

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

/**
 * @param {WAMessage} message
 */
export function isViewOnceMessage(message) {
  const msg = message.message;
  if (!msg) return false;

  const viewOnceWrapper =
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.viewOnceMessageV2Extension?.message;

  if (viewOnceWrapper) return true;
  return !!(msg.imageMessage?.viewOnce || msg.videoMessage?.viewOnce || msg.audioMessage?.viewOnce);
}
