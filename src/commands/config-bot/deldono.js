import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Remove um dono do bot';

export const aliases = [
  'deletardono', 'removerdono', 'removedono', 'deletedono',
  'delowner', 'removeowner', 'deleteowner', 'remdono',
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

  const input = args[0]?.trim();

  if (!input) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Informe o número ou ID do dono a remover.'), info);
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const phones = config.owner.phones;
  const searchId = input.split('@')[0];

  const index = phones.findIndex((p) => p.split('@')[0] === searchId);

  if (index === -1) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Número não encontrado na lista de donos.'), info);
    return;
  }

  const pairIndex = index % 2 === 0 ? index : index - 1;
  const removed = phones[pairIndex].split('@')[0];

  phones.splice(pairIndex, 2);
  config.owner.phones = phones;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  await reply(
    jurandir, from,
    toUnicodeBoldUpper(`> ${removed} removido da lista de donos.\n> Reiniciando para aplicar...`),
    info
  );

  await new Promise((r) => setTimeout(r, 800));
  process.send?.({ type: 'RESTART' });
};
