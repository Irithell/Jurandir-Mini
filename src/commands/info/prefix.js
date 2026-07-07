export const description = 'Informa qual é o prefixo atual do bot';

export const aliases = ['prefix'];

export const noPrefixConfig = {
  matchType: 'exact',
  triggers: ['prefix', 'prefixo', 'prefixo do bot'],
};

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async ({ jurandir, from, info, utils: { toUnicodeBoldUpper, reply }, prefix }) => {
  const texto = toUnicodeBoldUpper(
    `🐱 O meu prefixo atual é: [ ${prefix} ]\n\nExemplo de uso: ${prefix}menu`
  );

  await reply(jurandir, from, texto, info);
};
