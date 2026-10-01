import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { botConfig } from '../../configs/bot.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Altera o modo de exibição de botões (0 = Desativado, 1 = Carrossel, 2 = Padrão)';

export const aliases = [
  'setbutton', 'setbotoes', 'mudarbotoes', 'mudarbotao',
  'buttons', 'botoes', 'modobotoes',
];

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async ({
  jurandir, from, info, args, prefix, userJid, botName,
  utils: { toUnicodeBoldUpper, reply, errorReply, isOwner },
}) => {
  if (!isOwner(userJid)) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Apenas donos do bot podem usar este comando.'), info);
    return;
  }

  const rawMode = args[0]?.trim();

  if (rawMode !== '0' && rawMode !== '1' && rawMode !== '2') {
    const helpText = toUnicodeBoldUpper(`╭══════════════════════╗
╰╮  Modo de Botões:
╭┤
╰╮ 0: Desativado (Texto)
╭┤
╰╮ 1: Carrossel Forçado
╭┤
╰╮ 2: Interativo Padrão
╭┤
╰╮ Uso: ${prefix}setbuttons <0|1|2>
╭┤
┃╰═════════════════════╝
╰╔═════════════════════╗
╭┤           🐱  ${botName}  🐱
╰╚═════════════════════╝`);

    await errorReply(jurandir, from, helpText, info);
    return;
  }

  const newMode = parseInt(rawMode, 10);

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  config.buttons = newMode;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  botConfig.buttons = newMode;

  /** @type {Record<number, string>} */
  const modeDescriptions = {
    0: '0 - Desativado (Texto)',
    1: '1 - Carrossel Forçado',
    2: '2 - Interativo Padrão',
  };

  const successText = toUnicodeBoldUpper(`╭══════════════════════╗
╰╮  Configuração:
╭┤
╰╮ Botões: Atualizado!
╭┤
╰╮ Novo Modo:
╭┤
╰╮ ${modeDescriptions[newMode]}
╭┤
┃╰═════════════════════╝
╰╔═════════════════════╗
╭┤           🐱  ${botName}  🐱
╰╚═════════════════════╝`);

  await reply(jurandir, from, successText, info);
};
