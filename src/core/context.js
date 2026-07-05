import os from 'node:os';
import process from 'node:process';
import * as msgUtils from '../utils/message.js';
import { toUnicodeBoldUpper } from '../utils/unicode.js';
import { getAllGroupsCache, getGroupMetadataCache } from '../utils/cache.js';
import { botConfig } from '../configs/bot.config.js';
import { ConsoleLogger } from '../utils/logger.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
 */

const botStartTime = Date.now();

/**
 * @param {WASocket} jurandir
 * @param {any} extractedData
 * @param {any} rawMessage
 * @returns {CommandContext}
 */
export function buildCommandContext(jurandir, extractedData, rawMessage) {
  return {
    jurandir,
    info: rawMessage,
    from: extractedData.from,
    body: extractedData.body,
    command: extractedData.command,
    args: extractedData.args,
    prefix: botConfig.prefix,
    userJid: extractedData.userJid,
    isGroup: extractedData.isGroup,

    ...msgUtils,

    toUnicodeBoldUpper,
    botConfig,
    os,
    logger: ConsoleLogger,

    getAllGroups: () => getAllGroupsCache(),
    getGroupMetadata: (groupId) => getGroupMetadataCache(jurandir, groupId),

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
  };
}
