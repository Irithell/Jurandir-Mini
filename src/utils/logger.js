import { Chalk } from 'chalk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GifPlayer, BannerBlock, CompositeBlock } from '@irithell-js/illustrator';
import moment from 'moment-timezone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {import('@/types/logger.d.ts').LogPayload} LogPayload
 * @typedef {import('@/types/logger.d.ts').LogHeader} LogHeader
 * @typedef {import('@/types/logger.d.ts').LogLine} LogLine
 * @typedef {import('@/types/logger.d.ts').LogLevel} LogLevel
 * @typedef {import('@/types/logger.d.ts').PaletteConfig} PaletteConfig
 */

const chalk = new Chalk({ level: 3 });
const TIMEZONE = 'America/Sao_Paulo';

const lcdMap = {
  0: '🯰',
  1: '🯱',
  2: '🯲',
  3: '🯳',
  4: '🯴',
  5: '🯵',
  6: '🯶',
  7: '🯷',
  8: '🯸',
  9: '🯹',
};

/** @type {PaletteConfig} */
const palette = {
  success: { bg: '#308446', fg: '#ffffffff' },
  warn: { bg: '#f6762bff', fg: '#FFFFFF' },
  error: { bg: '#ae1818ff', fg: '#FFFFFF' },
  tutor: { bg: '#008B8B', fg: '#FFFFFF' },
  info: { bg: '#007bffff', fg: '#FFFFFF' },
};

function getFormattedTime() {
  const time = moment().tz(TIMEZONE).format('HH:mm:ss');
  return time.replace(/\d/g, (digit) => lcdMap[digit] ?? digit);
}

export class ConsoleLogger {
  /**
   * @param {LogPayload} payload
   */
  static dispatch(payload) {
    const level = payload.level || 'info';

    if (payload.header) {
      this.renderHeader(payload.header, level);
      console.log('');
    }

    payload.lines.forEach((line) => {
      this.renderLine(line, level);
    });
  }

  /**
   * @param {LogHeader} header
   */
  static createStream(header) {
    return new ConsoleStream(header);
  }

  /**
   * @param {LogHeader} header
   * @param {LogLevel} fallbackLevel
   */
  static renderHeader(header, fallbackLevel) {
    const columns = process.stdout.columns || 100;
    const width = Math.floor(columns * 0.8);
    const marginLeft = ' '.repeat(Math.floor((columns - width) / 2));
    const innerWidth = width - 2;

    const levelToUse = header.level || fallbackLevel;
    const bgHex = header.theme?.bg || palette[levelToUse].bg;
    const fgHex = header.theme?.fg || palette[levelToUse].fg;

    const styleBg = chalk.bgHex(bgHex).hex(fgHex).bold;
    const styleBorder = chalk.hex(bgHex).bold;

    const topBorder = marginLeft + styleBorder('╔' + '╍'.repeat(innerWidth) + '╗');
    const bottomBorder = marginLeft + styleBorder('╚' + '╍'.repeat(innerWidth) + '╝');
    const sideBorder = styleBorder('╎');

    const decorLeft = ' ▀▄▀▄ ';
    const decorRight = ' ▄▀▄▀ ';

    const spaceBefore = Math.max(
      1,
      Math.floor((innerWidth - header.title.length) / 2) - decorLeft.length
    );
    const spaceAfter =
      innerWidth - decorLeft.length - spaceBefore - header.title.length - decorRight.length;

    const padLeft = ' '.repeat(spaceBefore);
    const padRight = ' '.repeat(Math.max(0, spaceAfter));

    const centerText = decorLeft + padLeft + header.title + padRight + decorRight;

    console.log('');
    console.log(topBorder);
    console.log(marginLeft + sideBorder + styleBg(centerText) + sideBorder);
    console.log(bottomBorder);
  }

  /**
   * @param {LogLine} line
   * @param {LogLevel} fallbackLevel
   */
  static renderLine(line, fallbackLevel) {
    const defaultBg = palette[fallbackLevel].bg;
    const timeGray = '#5e5e5eff';

    let prefixChain = '';
    let currentBg = timeGray;

    if (!line.omitTimestamp) {
      const timeStr = getFormattedTime();
      prefixChain += chalk.bgHex(currentBg).hex('#FFFFFF').bold(`${timeStr} `);
    }

    if (line.tags && line.tags.length > 0) {
      line.tags.forEach((tag) => {
        const nextBg = tag.theme?.bg || defaultBg;
        const nextFg = tag.theme?.fg || '#FFFFFF';

        if (prefixChain.length > 0) {
          prefixChain += chalk.bgHex(nextBg).hex(currentBg)('');
        }

        prefixChain += chalk.bgHex(nextBg).hex(nextFg).bold(`[ ${tag.label} ]`);
        currentBg = nextBg;
      });
    }

    if (prefixChain.length > 0) {
      prefixChain += chalk.hex(currentBg)('');
    }

    let msgColor = line.textColor;
    if (!msgColor) {
      if (line.tags && line.tags.length > 0) {
        msgColor = currentBg;
      } else {
        msgColor = '#FFFFFF';
      }
    }

    const finalMessage = chalk.hex(msgColor).bold(` ${line.message}`);

    console.log(`${prefixChain}${finalMessage}`);
  }
}

export class ConsoleStream {
  /**
   * @param {LogHeader} header
   */
  constructor(header) {
    this.level = header.level || 'info';
    ConsoleLogger.renderHeader(header, this.level);
  }

  /**
   * @param {LogLine} line
   */
  write(line) {
    ConsoleLogger.renderLine(line, this.level);
  }

  close() {}
}

const shadowPalettes = [
  { name: 'roxo', base: [160, 110, 255] },
  { name: 'ciano', base: [0, 200, 255] },
  { name: 'verde', base: [50, 200, 100] },
  { name: 'rosa', base: [255, 120, 200] },
  { name: 'azul', base: [90, 140, 255] },
  { name: 'laranja', base: [255, 150, 50] },
  { name: 'vermelho', base: [255, 70, 70] },
];

/**
 * @param {number[]} shadowColor
 * @returns {Record<string, number[]>}
 */
function generateShadowShades(shadowColor) {
  const levels = { '█': 1.0, '▓': 0.75, '▒': 0.5, '░': 0.25, ' ': 0.0 };
  /** @type {Record<string, number[]>} */
  const shades = {};

  for (const [char, weight] of Object.entries(levels)) {
    shades[char] = shadowColor.map((c) => Math.round(c * (1 - weight) + 255 * weight));
  }
  return shades;
}

export async function bannerLog() {
  const index = Math.floor(Math.random() * shadowPalettes.length);
  const palette = shadowPalettes[index] || { name: 'default', base: [255, 255, 255] };
  const shades = generateShadowShades(palette.base);

  const bannerText = `
╔════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                                    ║
║        ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░ ░▒▓██████▓▒░░▒▓███████▓▒░░▒▓███████▓▒░░▒▓█▓▒░▒▓███████▓▒░  ║
║        ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ║
║        ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ║
║        ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓███████▓▒░  ║
║ ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ║
║ ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ║
║  ░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ║
║                                                                                                    ║
║                                                                                                    ║
║                           ░▒▓██████████████▓▒░░▒▓█▓▒░▒▓███████▓▒░░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                           ░▒▓█▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░                           ║
║                                                                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════════════════════╝`;

  const coloredLines = bannerText
    .trim()
    .split('\n')
    .map((line) =>
      line
        .split('')
        .map((char) => {
          const rgb = shades[char] || [255, 255, 255];
          return chalk.rgb(.../** @type {[number, number, number]} */ (rgb))(char);
        })
        .join('')
    );

  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  const gifPath = path.resolve(__dirname, '../../database/media/gifs/cat.gif');

  const showBanner = cols >= 102;
  const showGif = cols < 102 || rows >= 40;

  if (showBanner && showGif) {
    const bannerBlock = new BannerBlock(coloredLines, { alignment: 'center-h' });
    const gifPlayer = await GifPlayer.create(
      {
        type: 'gif',
        path: gifPath,
        keep: true,
        outDir: path.resolve(__dirname, '../../database/media/gifs/tmp'),
      },
      { width: 36, height: 18, colorMode: 'full', delay: 42, binaries: { strategy: 'auto' } }
    );
    const composite = new CompositeBlock({
      alignment: 'center-h',
      gap: 1,
      clearScreen: true,
      muteConsole: true,
    });

    composite.add(bannerBlock);
    composite.add(gifPlayer);

    await composite.play({ loop: 1 });
    composite.dispose();
  } else if (showBanner && !showGif) {
    const bannerBlock = new BannerBlock(coloredLines, { alignment: 'center-h' });
    const composite = new CompositeBlock({
      alignment: 'center-h',
      clearScreen: true,
      muteConsole: true,
    });

    composite.add(bannerBlock);
    await composite.play({ loop: 1 });
  } else if (!showBanner && showGif) {
    const gifPlayer = await GifPlayer.create(
      {
        type: 'gif',
        path: gifPath,
        keep: true,
        outDir: path.resolve(__dirname, '../../database/media/gifs/tmp'),
      },
      {
        width: 36,
        height: 18,
        colorMode: 'full',
        delay: 42,
        alignment: 'center-vh',
        clearScreen: true,
        muteConsole: true,
        binaries: { strategy: 'auto' },
      }
    );

    await gifPlayer.play({ loop: 1 });
  }
}
