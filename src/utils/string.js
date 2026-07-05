import LinkifyIt from 'linkify-it';

const linkify = new LinkifyIt();

/**
 * @param {string | undefined | null} text
 * @returns {string}
 */
export function onlyNumbers(text) {
  if (!text) return '';
  return String(text).replace(/[^0-9]/g, '');
}

/**
 * @param {string} text
 * @returns {string}
 */
export function onlyLettersAndNumbers(text) {
  return String(text).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * @param {string | undefined | null} text
 * @returns {string}
 */
export function removeAccents(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * @param {string} text
 * @returns {string}
 */
export function formatCommand(text) {
  return onlyLettersAndNumbers(removeAccents(String(text).toLowerCase().trim()));
}

/**
 * @param {string | number} number
 * @returns {string}
 */
export function toUserJid(number) {
  return `${onlyNumbers(String(number))}@s.whatsapp.net`;
}

/**
 * @param {string | number} number
 * @returns {string}
 */
export function toUserLid(number) {
  return `${onlyNumbers(String(number))}@lid`;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isLink(text) {
  const matches = linkify.match(text);
  return matches !== null && matches.length > 0;
}

/**
 * @param {string | undefined | null} text
 * @returns {string[]}
 */
export function detectUrls(text) {
  if (!text) return [];

  const matches = linkify.match(text);
  if (!matches) return [];

  return matches.map((match) => match.url);
}

/**
 * @param {string} str
 * @param {string[]} characters
 * @returns {string[]}
 */
export function splitByCharacters(str, characters) {
  const escapedChars = characters.map((char) => (char === '\\' ? '\\\\' : char));
  const regex = new RegExp(`[${escapedChars.join('')}]`);
  return String(str)
    .split(regex)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} commandName
 * @returns {string}
 */
export function sanitizeCommandName(commandName) {
  return (
    String(commandName)
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      // eslint-disable-next-line no-control-regex --- IGNORE E NÂO APAGUE O COMENTARIO ---
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/[^\w\-_.]/g, '')
      .substring(0, 50)
      .toLowerCase()
      .trim()
  );
}

/**
 * @param {string | undefined | null} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function splitIntoLines(text, maxChars) {
  if (!text) return [];

  const paragraphs = String(text).split('\n');
  const allLines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      allLines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (word.length > maxChars) {
        if (currentLine) {
          allLines.push(currentLine.trim());
          currentLine = '';
        }
        allLines.push(word);
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        if (currentLine) allLines.push(currentLine.trim());
        currentLine = word;
      }
    }

    if (currentLine) allLines.push(currentLine.trim());
  }

  return allLines;
}

/**
 * @param {string | undefined | null} text
 * @param {number} [maxChars=29]
 * @param {string} [prefix='┃ ']
 * @returns {string}
 */
export function wrapTextForDecoration(text, maxChars = 29, prefix = '┃ ') {
  if (!text) return '';
  return splitIntoLines(text, maxChars)
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

/**
 * @param {string | undefined | null} text
 * @param {number} [maxChars=25]
 * @returns {string}
 */
export function wrapQuotedText(text, maxChars = 25) {
  if (!text) return '""';

  const lines = splitIntoLines(text, maxChars);

  if (lines.length === 0) return '""';
  if (lines.length === 1) return `┃ "${lines[0]}"`;

  return lines
    .map((line, index) => {
      if (index === 0) return `┃ "${line}`;
      if (index === lines.length - 1) return `┃ ${line}"`;
      return `┃ ${line}`;
    })
    .join('\n');
}
