function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return `${days.toString().padStart(2, '0')} D ${(hours % 24).toString().padStart(2, '0')} H ${(minutes % 60).toString().padStart(2, '0')} Min ${(seconds % 60).toString().padStart(2, '0')} Seg`;
}

function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

export const description = 'Verifica a latência do bot';

export default async ({
  jurandir,
  from,
  info,
  os,
  uptime,
  ramTotal,
  ramUsada,
  react,
  reply,
  toUnicodeBoldUpper,
  getAllGroups,
  botConfig,
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
╭┤           🐱  ${botConfig.name}  🐱
╰╚═════════════════════╝`);

  await reply(jurandir, from, statusText, info);
};
