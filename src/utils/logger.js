import { Chalk } from 'chalk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const numberMap = {
  0: '0',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
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
  return time.replace(/\d/g, (digit) => numberMap[digit] ?? digit);
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

  // Calculando o padding para centralizar o banner no terminal
  const bannerWidth = 102; // A largura fixa da string do banner
  const paddingLeftLength = Math.max(0, Math.floor((cols - bannerWidth) / 2));
  const paddingLeft = ' '.repeat(paddingLeftLength);

  console.clear();
  console.log('\n');

  coloredLines.forEach((line) => {
    console.log(paddingLeft + line);
  });

  console.log('\n');
}
