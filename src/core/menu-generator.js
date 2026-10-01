import { getByCategory } from '../commands/registry.js';

/** @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext */
/** @typedef {import('@/types/commands.d.ts').CommandFunction} CommandFunction */

const SUBMENU_TEMPLATE = {
  header: `╭══════════════════════╗
╰╮  🐾 𝙳𝙰𝚃𝙰: {{DATA}}
╭┤  ⏰ 𝙷𝙾𝚁𝙰: {{HORA}}
╰╮  ⚡ 𝙿𝙸𝙽𝙶: {{PING}}ms
╭┤  🐈 𝚂𝚃𝙰𝚃𝚄𝚂: 𝙾𝙽𝙻𝙸𝙽𝙴
┃╰═════════════════════╝
╰╔═════════════════════╗
╭┤         📦  {{CATEGORY_NAME}}
┃╚═════════════════════╝`,
  footer: `\n╰╔═════════════════════╗
╭┤           🐾  {{BOT_NAME}}  🐾
╰╚═════════════════════╝`,
};

/**
 * @param {string} category
 * @returns {CommandFunction}
 */
export function generateMenuCommand(category) {
  return async ({
    jurandir,
    from,
    info,
    prefix,
    utils: { react, sendTextWithMedia, toUnicodeBoldUpper },
    botConfig,
  }) => {
    const startTime = Date.now();

    if (info.key) {
      await react(jurandir, from, '🐾', info.key);
    }

    const commands = getByCategory(category);

    if (commands.length === 0) {
      await jurandir.sendMessage(from, {
        text: `> Nenhum comando encontrado na categoria ${category} 😿`,
      });
      return;
    }

    const ping = Date.now() - startTime;
    const now = new Date();
    const localDate = now.toLocaleDateString('pt-BR');
    const localTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let bodyText = SUBMENU_TEMPLATE.header
      .replace('{{DATA}}', localDate)
      .replace('{{HORA}}', localTime)
      .replace('{{PING}}', String(ping))
      .replace('{{CATEGORY_NAME}}', toUnicodeBoldUpper(`COMANDOS ${category.toUpperCase()}`));

    const catEmojis = ['🐾', '🐈', '🐱', '🧶', '🐟', '🥛', '🐭', '🐁', '😽', '😼'];

    for (const cmd of commands) {
      const randomEmoji = catEmojis[Math.floor(Math.random() * catEmojis.length)];

      const validAliases = (cmd.aliases || []).filter(
        (alias) => alias && alias.toLowerCase() !== cmd.name.toLowerCase()
      );

      const aliasLines = validAliases
        .map((alias) => `┃    → ${prefix}${toUnicodeBoldUpper(alias)}`)
        .join('\n');

      bodyText += `\n┃ \n┃ ${randomEmoji} ${prefix}${toUnicodeBoldUpper(cmd.name)}${
        aliasLines ? '\n' + aliasLines : ''
      }`;
    }

    bodyText += SUBMENU_TEMPLATE.footer.replace('{{BOT_NAME}}', botConfig.name.toUpperCase());

    const headerImage = botConfig.assets.primary.headerImage;
    await sendTextWithMedia(jurandir, from, headerImage, 'image', bodyText, info);
  };
}
