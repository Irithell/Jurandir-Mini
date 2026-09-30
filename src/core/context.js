import os from 'node:os';
import process from 'node:process';
import * as msgUtils from '../utils/message.js';
import * as buttonUtils from '../utils/buttons.js';
import * as unicodeUtils from '../utils/unicode.js';
import * as cacheUtils from '../utils/cache.js';
import * as loggerUtils from '../utils/logger.js';
import * as stringUtils from '../utils/string.js';
import * as baileysUtils from '../utils/baileys.js';
import { isOwner, isAdmin } from '../utils/permissions.js';
import { botConfig } from '../configs/bot.config.js';
import { getInjects, _setForward } from './addon-loader.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
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
 * @param {any} extractedData
 * @param {any} rawMessage
 * @returns {CommandContext}
 */
export function buildCommandContext(jurandir, extractedData, rawMessage) {
  /** @type {CommandContext} */
  const ctx = {
    jurandir,
    info: rawMessage,
    from: extractedData.from,
    body: extractedData.body,
    command: extractedData.command,
    args: extractedData.args,
    fullArgs: extractedData.fullArgs || (extractedData.args ? extractedData.args.join(' ') : ''),
    prefix: botConfig.prefix,
    userJid: extractedData.userJid,
    isGroup: extractedData.isGroup,
    botConfig,
    botName: botConfig.name,
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
      isAdmin: (sender, groupMetadata) => isAdmin(sender, groupMetadata),
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
