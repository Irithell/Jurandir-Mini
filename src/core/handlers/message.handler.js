import { commandRegistry, noPrefixRegistry } from '../../commands/registry.js';
import { extractMessageData } from '../../utils/baileys.js';
import { botConfig } from '../../configs/bot.config.js';
import { ConsoleLogger } from '../../utils/logger.js';
import { buildCommandContext } from '../context.js';
import { removeAccents } from '../../utils/string.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
 */

const DEDUP_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, number>} */
const processedMessages = new Map();

setInterval(
  () => {
    const now = Date.now();
    for (const [id, ts] of processedMessages.entries()) {
      if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
    }
  },
  10 * 60 * 1000
).unref();

/**
 * @param {WASocket} jurandir
 * @param {any} data
 */
export async function handleMessage(jurandir, data) {
  const message = data.messages[0];

  if (!message || !message.message || data.type !== 'notify') return;

  const msgId = message?.key?.id;
  if (!msgId) return;

  if (processedMessages.has(msgId)) return;
  processedMessages.set(msgId, Date.now());

  try {
    const extractedData = extractMessageData(message, botConfig.prefix);

    if (!extractedData) return;

    if (extractedData.command) {
      const cmdFunction = commandRegistry.get(extractedData.command);

      if (cmdFunction) {
        ConsoleLogger.dispatch({
          level: 'info',
          lines: [
            {
              message: `chamado por ${extractedData.userJid}`,
              tags: [
                { label: 'CMD' },
                {
                  label: extractedData.command.toUpperCase(),
                  theme: { bg: '#8A2BE2', fg: '#FFF' },
                },
              ],
            },
          ],
        });

        const ctx = /** @type {CommandContext} */ (
          buildCommandContext(jurandir, extractedData, message)
        );
        await cmdFunction(ctx);
      }
      return;
    }

    if (extractedData.body && noPrefixRegistry.size > 0) {
      const normalizedBody = removeAccents(extractedData.body).toLowerCase().trim();

      for (const [cmdName, noPrefixCmd] of noPrefixRegistry.entries()) {
        const { matchType, triggers } = noPrefixCmd.config;

        const isMatched = triggers.some((trigger) => {
          if (matchType === 'exact') return normalizedBody === trigger;
          if (matchType === 'startsWith') return normalizedBody.startsWith(trigger);
          if (matchType === 'includes') return normalizedBody.includes(trigger);
          return false;
        });

        if (isMatched) {
          ConsoleLogger.dispatch({
            level: 'info',
            lines: [
              {
                message: `chamado por ${extractedData.userJid}`,
                tags: [
                  { label: 'CMD S/ PREF' },
                  { label: cmdName.toUpperCase(), theme: { bg: '#FF4500', fg: '#FFF' } },
                ],
              },
            ],
          });

          extractedData.command = cmdName;

          const ctx = /** @type {CommandContext} */ (
            buildCommandContext(jurandir, extractedData, message)
          );
          await noPrefixCmd.execute(ctx);
          return;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ConsoleLogger.dispatch({
      level: 'error',
      lines: [
        { message: 'Erro ao processar mensagem:', tags: [{ label: 'HANDLER' }] },
        { message: errorMessage, omitTimestamp: true },
      ],
    });
  }
}
