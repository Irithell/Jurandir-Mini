export const description = 'Verifica a latência do bot e o uso de hardware';

/** @type {import('@/types/commands.d.ts').CommandFunction} */
export default async ({
  jurandir,
  from,
  info,
  os,
  uptime,
  ramTotal,
  ramUsada,
  botName,
  utils: { react, reply, toUnicodeBoldUpper, getAllGroups, formatUptime, formatBytes },
}) => {
  const startTime = Date.now();

  if (info.key) {
    await react(jurandir, from, '🏓', info.key);
  }

  const latencyMs = Date.now() - startTime;

  const uptimeFormatted = formatUptime(uptime);
  const totalRAMFormatted = formatBytes(ramTotal);
  const heapUsedFormatted = formatBytes(ramUsada);

  const platform = os.platform();
  const osName =
    platform === 'linux'
      ? 'Linux'
      : platform === 'win32'
        ? 'Windows'
        : platform.charAt(0).toUpperCase() + platform.slice(1);

  const chats = await getAllGroups();
  const groupCount = Object.keys(chats).length;

  const statusText = toUnicodeBoldUpper(`╭══════════════════════╗
╰╮  Online por:
╭┤ 
╰╮ ${uptimeFormatted}
╭┤
╰╮ Tempo de Resposta: ${latencyMs}ms
╭┤
╰╮ Funcionando em: ${groupCount} Grupos
╭┤
╰╮ OS: ${osName}
╭┤
╰╮ RAM Total: ${totalRAMFormatted}
╭┤
╰╮ RAM Usada: ${heapUsedFormatted}
╭┤
┃╰═════════════════════╝
╰╔═════════════════════╗
╭┤           🐱  ${botName}  🐱
╰╚═════════════════════╝`);

  await reply(jurandir, from, statusText, info);
};
