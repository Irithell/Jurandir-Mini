import os from 'node:os';
import process from 'node:process';
import * as msgUtils from '../utils/message.js';
import * as unicodeUtils from '../utils/unicode.js';
import * as cacheUtils from '../utils/cache.js';
import * as loggerUtils from '../utils/logger.js';
import * as stringUtils from '../utils/string.js';
import * as baileysUtils from '../utils/baileys.js';
import { botConfig } from '../configs/bot.config.js';
import { getInjects, _setForward } from './addon-loader.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@whiskeysockets/baileys').WAMessage} WAMessage
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
 * @param {WAMessage} rawMessage
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
    prefix: botConfig.prefix,
    userJid: extractedData.userJid,
    isGroup: extractedData.isGroup,
    botConfig,
    botName: botConfig.name,
    os,

    utils: {
      ...msgUtils,
      ...unicodeUtils,
      ...stringUtils,
      ...baileysUtils,
      logger: loggerUtils.ConsoleLogger,
      cache: cacheUtils,
      formatUptime,
      formatBytes,
      getAllGroups: () => cacheUtils.getAllGroupsCache(),
      /** @param {string} groupId */
      getGroupMetadata: (groupId) => cacheUtils.getGroupMetadataCache(jurandir, groupId),
    },

    ...getInjects(),

    get uptime() {
      return Date.now() - botStartTime;
    },
    get ramUsada() {
      return process.memoryUsage().heapUsed;
    },
    get ramTotal() {
      return os.totalmem();
    },

    /**
     * @param {number} ms
     */
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    /**
     * @param {any} data
     */
    forward(data) {
      _setForward(ctx, data);
    },
  };

  return ctx;
}
