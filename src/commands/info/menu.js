import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getByCategory } from '../../commands/registry.js';

/** @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const aliases = ['ajuda', 'help', 'comandos'];

const MAIN_MENU_TEMPLATE = `
╭══════════════════════╗
╰╮  🐾 𝙳𝙰𝚃𝙰: {{DATA}}
╭┤  ⏰ 𝙷𝙾𝚁𝙰: {{HORA}}
╰╮  ⚡ 𝙿𝙸𝙽𝙶: {{PING}}ms
╭┤  🐈 𝚂𝚃𝙰𝚃𝚄𝚂: 𝙾𝙽𝙻𝙸𝙽𝙴
┃╰═════════════════════╝
╰╔═════════════════════╗
╭┤    🐱  𝙼𝙴𝙽𝚄 𝙿𝚁𝙸𝙽𝙲𝙸𝙿𝙰𝙻  🐱
┃╚═════════════════════╝`;

function getCategoryFolders() {
  const commandsDir = path.resolve(__dirname, '..');
  return fs
    .readdirSync(commandsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

/**
 * @param {CommandContext} context
 */
export default async ({
  jurandir,
  from,
  info,
  prefix,
  utils: { react, toUnicodeBoldUpper, sendButton, sendImage },
  botConfig,
}) => {
  const startTime = Date.now();

  if (info.key) {
    await react(jurandir, from, '🐱', info.key);
  }

  const now = new Date();
  const categories = getCategoryFolders().sort((a, b) => a.localeCompare(b));

  const localDate = now.toLocaleDateString('pt-BR');
  const localTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ping = Date.now() - startTime;

  const bodyText = MAIN_MENU_TEMPLATE.replace('{{DATA}}', localDate)
    .replace('{{HORA}}', localTime)
    .replace('{{PING}}', String(ping));

  const catEmojis = ['🐾', '🐈', '🐱', '🧶', '🐟', '🥛', '🐭', '🐁', '😽', '😼'];
  const shuffledEmojis = [...catEmojis].sort(() => Math.random() - 0.5);

  let totalCommandsCount = 0;

  const rows = categories.map((category, index) => {
    const emoji = shuffledEmojis[index % shuffledEmojis.length];
    const categoryCommands = getByCategory(category);
    const commandCount = categoryCommands.length;

    totalCommandsCount += commandCount;

    return {
      id: `${prefix}menu${category}`,
      title: `${emoji} ${toUnicodeBoldUpper(category)}`,
      description: `${commandCount} ${toUnicodeBoldUpper(commandCount === 1 ? 'feitiço disponível' : 'feitiços disponíveis')}`,
    };
  });

  const bannerUrl = botConfig.assets.primary.headerImage;
  const botName = botConfig.name.toUpperCase();
  const buttonMode = botConfig.buttons !== undefined ? botConfig.buttons : 2;

  if (buttonMode === 0) {
    const textMenuLines = categories
      .map((category, index) => {
        const emoji = shuffledEmojis[index % shuffledEmojis.length];
        return `┃ ${emoji} ${prefix}${toUnicodeBoldUpper('menu' + category)}`;
      })
      .join('\n');

    const textBody = `${bodyText}
┃ 
┃  ${toUnicodeBoldUpper(`[ TOTAL: ${totalCommandsCount} COMANDOS ]`)}
┃ 
${textMenuLines}
┃
╰╔═════════════════════╗
╭┤           🐱  ${botName}  🐱
╰╚═════════════════════╝`;

    await sendImage(jurandir, from, bannerUrl, textBody, info);
    return;
  }

  const forceCarousel = buttonMode === 1;

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(`${botName} - CAIXA DE COMANDOS`),
    asCarousel: forceCarousel,
    cards: [
      {
        header: { mediaUrl: bannerUrl, mediaType: 'image' },
        body: bodyText,
        footer: toUnicodeBoldUpper('Selecione uma categoria'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('📋 CATEGORIAS'),
            sections: [
              {
                title: toUnicodeBoldUpper(`TOTAL: ${totalCommandsCount} COMANDOS`),
                highlight_label: toUnicodeBoldUpper('🐱'),
                rows,
              },
            ],
          },
        ],
      },
    ],
    quotedMessage: info,
  });
};
