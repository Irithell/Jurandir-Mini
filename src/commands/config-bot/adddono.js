import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Adiciona um novo dono ao bot';

export const aliases = [
  'adicionardono', 'adcdono', 'addowner', 'setdono',
  'novdono', 'novodono', 'adicionarowner',
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
    await errorReply(jurandir, from, toUnicodeBoldUpper('Informe o número do novo dono.'), info);
    return;
  }

  const number = input.replace(/\D/g, '');

  if (!number) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Número inválido.'), info);
    return;
  }

  let result;
  try {
    const [data] = await jurandir.onWhatsApp(number);
    result = data;
  } catch {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Falha ao consultar o número no WhatsApp.'), info);
    return;
  }

  if (!result?.exists) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Número não encontrado no WhatsApp.'), info);
    return;
  }

  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const phones = config.owner.phones;
  const jidId = result.jid.split('@')[0];

  const alreadyExists = phones.some((p) => p.split('@')[0] === jidId);
  if (alreadyExists) {
    await errorReply(jurandir, from, toUnicodeBoldUpper('Este número já é dono do bot.'), info);
    return;
  }

  phones.push(result.jid);
  phones.push(result.lid);
  config.owner.phones = phones;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

  await reply(
    jurandir, from,
    toUnicodeBoldUpper(`> ${jidId} adicionado como dono.\n> Reiniciando para aplicar...`),
    info
  );

  await new Promise((r) => setTimeout(r, 800));
  process.send?.({ type: 'RESTART' });
};
