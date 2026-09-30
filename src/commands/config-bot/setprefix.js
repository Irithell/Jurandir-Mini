import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Altera o prefixo do bot';

export const aliases = [
  'mudarprefixo', 'alterarprefixo', 'changeprefix',
  'mudarpref', 'alterarpref', 'novoprefix', 'novoprefixo',
];

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async ({
  jurandir, from, info, args, userJid,
  utils: { toUnicodeBoldUpper, reply, errorReply, isOwner },
}) => {
  if (!isOwner(userJid)) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Apenas donos do bot podem usar este comando.'), info);
    return;
  }

  const newPrefix = args[0]?.trim();

  if (!newPrefix || newPrefix.length !== 1) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('O prefixo deve ser exatamente 1 caractere.'), info);
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  config.prefix = newPrefix;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  await reply(
    jurandir, from,
    toUnicodeBoldUpper(`> Prefixo alterado para: ${newPrefix}\n> Reiniciando para aplicar...`),
    info
  );

  await new Promise((r) => setTimeout(r, 800));
  process.send?.({ type: 'RESTART' });
};
