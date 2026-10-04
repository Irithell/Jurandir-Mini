import os from 'node:os';
import process from 'node:process';
import * as msgUtils from '../utils/message.js';
import * as buttonUtils from '../utils/buttons.js';
import * as unicodeUtils from '../utils/unicode.js';
import * as cacheUtils from '../utils/cache.js';
import * as loggerUtils from '../utils/logger.js';
import * as stringUtils from '../utils/string.js';
import * as baileysUtils from '../utils/baileys.js';
import { isOwner, isAdmin, isBotAdmin, extractId } from '../utils/permissions.js';
import { botConfig } from '../configs/bot.config.js';
import db from '../configs/database.js';
import { getInjects, _setForward } from './addon-loader.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@whiskeysockets/baileys').GroupMetadata} GroupMetadata
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
 * @typedef {import('@/types/baileys.d.ts').ExtractedMessageData} ExtractedMessageData
 */

const botStartTime = Date.now();

/**
 * @param {number} milliseconds
 * @returns {string}
 */
function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return `${days.toString().padStart(2, '0')} D ${(hours % 24).toString().padStart(2, '0')} H ${(minutes % 60).toString().padStart(2, '0')} Min ${(seconds % 60).toString().padStart(2, '0')} Seg`;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

/**
 * @param {WASocket} jurandir
 * @param {ExtractedMessageData} extractedData
 * @param {any} rawMessage
 * @returns {Promise<CommandContext>}
 */
export async function buildCommandContext(jurandir, extractedData, rawMessage) {
  const from = extractedData.from || rawMessage.key?.remoteJid || '';
  const isGroup = Boolean(extractedData.isGroup);
  const userJid = extractedData.userJid || from;

  /** @type {GroupMetadata | null} */
  let groupMetadata = null;
  let groupName = '';
  let groupOwner = '';
  /** @type {any[]} */
  let groupParticipants = [];
  let isAdminUser = false;
  let isBotAdminUser = false;

  if (isGroup && jurandir) {
    try {
      const meta = await cacheUtils.getGroupMetadataCache(jurandir, from);
      if (meta) {
        groupMetadata = meta;
        const metaAny = /** @type {any} */ (meta);
        groupName = meta.subject || metaAny.name || '';
        groupOwner = meta.owner || meta.subjectOwner || '';
        groupParticipants = Array.isArray(meta.participants) ? meta.participants : [];
        isAdminUser =
          isAdmin(userJid, meta) ||
          isAdmin(extractedData.clearJid, meta) ||
          isAdmin(extractedData.clearLid, meta);
        isBotAdminUser = isBotAdmin(jurandir, meta);
      }
    } catch {
      groupMetadata = null;
    }
  }

  const botIdClean = jurandir?.user?.id ? jurandir.user.id.replace(/:[0-9]+@/, '@') : '';
  const userAny = /** @type {any} */ (jurandir?.user || {});
  const botLidClean = userAny.lid ? userAny.lid.replace(/:[0-9]+@/, '@') : '';
  const botCleanNum = extractId(botIdClean);
  const botCleanLid = extractId(botLidClean);

  let isJurandir = Boolean(extractedData.isFromMe || rawMessage.key?.fromMe);
  if (!isJurandir && jurandir?.user) {
    if (
      (botCleanNum &&
        (extractedData.clearJid === botCleanNum || extractedData.userJid === botIdClean)) ||
      (botCleanLid &&
        (extractedData.clearLid === botCleanLid || extractedData.userJid === botLidClean))
    ) {
      isJurandir = true;
    }
  }

  const isOwnerUser =
    isJurandir ||
    isOwner(userJid, botConfig.owner.phones) ||
    isOwner(extractedData.clearJid, botConfig.owner.phones) ||
    isOwner(extractedData.sender, botConfig.owner.phones) ||
    isOwner(extractedData.senderAlt, botConfig.owner.phones);

  const prefix = extractedData.prefix || botConfig.prefix;
  const botName = botConfig.name || 'Jurandir Mini';
  const commandName = extractedData.command || '';
  const args = extractedData.args || [];
  const fullArgs = extractedData.fullArgs || (args.length > 0 ? args.join(' ') : '');
  const body = extractedData.body || '';
  const pushName = extractedData.pushName || rawMessage.pushName || 'Desconhecido';
  const messageId = extractedData.messageId || rawMessage.key?.id || '';
  const timestamp =
    extractedData.timestamp ||
    (rawMessage.messageTimestamp
      ? Number(rawMessage.messageTimestamp)
      : Math.floor(Date.now() / 1000));
  const serverId = extractedData.serverId ?? 0;
  const messageType = extractedData.messageType || 'unknown';
  const category = extractedData.category || '';
  const mediaType = extractedData.mediaType || '';
  const isEphemeral = extractedData.isEphemeral ?? false;
  const isViewOnce = extractedData.isViewOnce ?? false;
  const isEdit = extractedData.isEdit ?? false;
  const isBotInvoke = extractedData.isBotInvoke ?? Boolean(prefix && commandName);
  const isFromMe = Boolean(rawMessage.key?.fromMe);
  const isReply = extractedData.isReply ?? false;
  const replyJid = extractedData.replyJid || '';

  const isNewsletter = Boolean(
    extractedData.isNewsletter ?? from.endsWith('@newsletter')
  );
  const isStatus = Boolean(
    extractedData.isStatus ?? (from === 'status@broadcast' || from.endsWith('@broadcast'))
  );
  const isPrivate = Boolean(
    extractedData.isPrivate ?? (!isGroup && !isNewsletter && !isStatus)
  );

  /** @type {CommandContext} */
  const ctx = {
    sock: jurandir,
    client: jurandir,
    jurandir,
    botName,
    prefix,
    config: botConfig,
    botConfig,
    message: rawMessage.message || null,
    rawMessage,
    event: rawMessage,
    info: rawMessage,
    messageData: extractedData,
    db,
    from,
    chat: from,
    userJid,
    sender: extractedData.sender || userJid,
    senderJid: extractedData.senderJid || userJid,
    clearLid: extractedData.clearLid || '',
    clearJid: extractedData.clearJid || '',
    senderAlt: extractedData.senderAlt || '',
    recipientAlt: extractedData.recipientAlt || '',
    addressingMode:
      extractedData.addressingMode || (userJid.endsWith('@lid') ? 'lid' : 'pn'),
    formattedSender: userJid,
    pushName,
    isOwner: isOwnerUser,
    isAdmin: isAdminUser,
    isBotAdmin: isBotAdminUser,
    isJurandir,
    isGroup,
    isPrivate,
    isNewsletter,
    isStatus,
    groupMetadata,
    groupName,
    groupOwner,
    groupParticipants,
    messageId,
    timestamp,
    serverId,
    type: messageType,
    category,
    mediaType,
    isEphemeral,
    isViewOnce,
    isEdit,
    isBotInvoke,
    isFromMe,
    isReply,
    replyJid: replyJid || null,
    command: commandName,
    args,
    fullArgs,
    body,
    os,

    utils: {
      ...msgUtils,
      ...buttonUtils,
      ...unicodeUtils,
      ...stringUtils,
      ...baileysUtils,
      ...getInjects(),
      logger: loggerUtils.ConsoleLogger,
      cache: cacheUtils,
      formatUptime,
      formatBytes,
      getAllGroups: () => cacheUtils.getAllGroupsCache(),
      getGroupMetadata: (groupId) => cacheUtils.getGroupMetadataCache(jurandir, groupId),
      isOwner: (sender) => isOwner(sender, botConfig.owner.phones),
      isAdmin: (sender, meta) => isAdmin(sender, meta || groupMetadata),
      isBotAdmin: (meta) => isBotAdmin(jurandir, meta || groupMetadata),
    },

    get uptime() {
      return Date.now() - botStartTime;
    },
    get ramUsada() {
      return process.memoryUsage().heapUsed;
    },
    get ramTotal() {
      return os.totalmem();
    },

    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    forward(data) {
      _setForward(ctx, data);
    },
  };

  return ctx;
}
