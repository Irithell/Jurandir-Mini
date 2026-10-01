import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../../configs/config.json');

export const description = 'Lista os donos do bot';

export const aliases = [
  'donos', 'listardonos', 'listardono',
  'listadonos', 'listdonos', 'owners',
];

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async ({
  jurandir, from, info,
  utils: { toUnicodeBoldUpper, reply },
}) => {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  const phones = config.owner.phones;

  if (!phones.length) {
    await reply(jurandir, from, toUnicodeBoldUpper('Nenhum dono cadastrado.'), info);
    return;
  }

  const pairs = [];
  for (let i = 0; i < phones.length; i += 2) {
    const jid = phones[i]?.split('@')[0] ?? '';
    const lid = phones[i + 1] ?? '';
    pairs.push({ jid, lid });
  }

  const lines = [
    `╭══════════════════════╗`,
    `╰╮  DONOS DO BOT`,
    `╭┤`,
  ];

  pairs.forEach(({ jid, lid }, i) => {
    lines.push(`╰╮  ${i + 1}. ${jid}`);
    lines.push(`╭┤     ${lid}`);
    if (i < pairs.length - 1) lines.push(`┃`);
  });

  lines.push(`┃╰═════════════════════╝`);

  await reply(jurandir, from, toUnicodeBoldUpper(lines.join('\n')), info);
};
