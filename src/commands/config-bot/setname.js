import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Altera o nome do bot';

export const aliases = [
  'setnome', 'mudarname', 'mudarnome', 'alterarname',
  'alterarnome', 'changename', 'changenome', 'renomear', 'renamebot',
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

  const newName = args.join(' ').trim();

  if (!newName) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Informe o novo nome do bot.'), info);
    return;
  }

  if (newName.length > 20) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('O nome deve ter no máximo 20 caracteres.'), info);
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  config.name = newName;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  await reply(
    jurandir, from,
    toUnicodeBoldUpper(`> Nome alterado para: ${newName}\n> Reiniciando para aplicar...`),
    info
  );

  await new Promise((r) => setTimeout(r, 800));
  process.send?.({ type: 'RESTART' });
};
