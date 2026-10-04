import { delay } from '@whiskeysockets/baileys';
import fs from 'node:fs';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@whiskeysockets/baileys').WAMessage} WAMessage
 * @typedef {import('@whiskeysockets/baileys').AnyMessageContent} AnyMessageContent
 */

const TYPING_DELAY = 0;

/**
 * @param {string} phoneNumber
 */
export function toLidMention(phoneNumber) {
  return `${phoneNumber}@lid`;
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 */
export async function sendTyping(jurandir, from) {
  await delay(TYPING_DELAY);
  await jurandir.sendPresenceUpdate('composing', from);
  await delay(TYPING_DELAY);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 */
export async function sendRecording(jurandir, from) {
  await delay(TYPING_DELAY);
  await jurandir.sendPresenceUpdate('recording', from);
  await delay(TYPING_DELAY);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {string[]} [mentions]
 */
export async function sendText(jurandir, from, text, mentions) {
  /** @type {AnyMessageContent} */
  const content = { text };
  if (mentions && mentions.length > 0) {
    content.mentions = mentions;
  }
  return await jurandir.sendMessage(from, content);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {WAMessage} quotedMessage
 * @param {string[]} [mentions=[]]
 */
export async function reply(jurandir, from, text, quotedMessage, mentions = []) {
  try {
    if (mentions.length > 0) {
      return await jurandir.sendMessage(from, { text, mentions }, { quoted: quotedMessage });
    }
    return jurandir.sendMessage(from, { text }, { quoted: quotedMessage });
  } catch (err) {
    const error = /** @type {any} */ (err);
    if (error?.message?.includes('rate-overlimit') || error?.data === 429) {
      await delay(1500);
      return await jurandir
        .sendMessage(from, { text }, { quoted: quotedMessage })
        .catch(() => undefined);
    }
    throw err;
  }
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} emoji
 * @param {any} messageKey
 */
export async function react(jurandir, from, emoji, messageKey) {
  try {
    const res = jurandir.sendMessage(from, {
      react: { text: emoji, key: messageKey },
    });
    return res;
  } catch {
    return undefined;
  }
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {any} messageKey
 */
export async function successReact(jurandir, from, messageKey) {
  return await react(jurandir, from, '😺', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {any} messageKey
 */
export async function errorReact(jurandir, from, messageKey) {
  return await react(jurandir, from, '😿', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {any} messageKey
 */
export async function waitReact(jurandir, from, messageKey) {
  return await react(jurandir, from, '😽', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {any} messageKey
 */
export async function warningReact(jurandir, from, messageKey) {
  return await react(jurandir, from, '😾', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function successReply(jurandir, from, text, quotedMessage) {
  if (quotedMessage.key) await successReact(jurandir, from, quotedMessage.key);
  await reply(jurandir, from, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function errorReply(jurandir, from, text, quotedMessage) {
  if (quotedMessage.key) await errorReact(jurandir, from, quotedMessage.key);
  await reply(jurandir, from, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function waitReply(jurandir, from, text, quotedMessage) {
  if (quotedMessage.key) await waitReact(jurandir, from, quotedMessage.key);
  await reply(jurandir, from, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function warningReply(jurandir, from, text, quotedMessage) {
  if (quotedMessage.key) await warningReact(jurandir, from, quotedMessage.key);
  await reply(jurandir, from, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string | Buffer} imageSource
 * @param {string} [caption]
 * @param {WAMessage} [quotedMessage]
 */
export async function sendImage(jurandir, from, imageSource, caption, quotedMessage) {
  let image;
  if (Buffer.isBuffer(imageSource)) {
    image = imageSource;
  } else if (typeof imageSource === 'string' && (imageSource.startsWith('http://') || imageSource.startsWith('https://'))) {
    image = { url: imageSource };
  } else {
    image = fs.readFileSync(imageSource);
  }
  const options = { image, caption: caption || '' };
  if (quotedMessage) return await jurandir.sendMessage(from, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(from, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string | Buffer} videoSource
 * @param {string} [caption]
 * @param {WAMessage} [quotedMessage]
 * @param {boolean} [gifPlayback=false]
 */
export async function sendVideo(jurandir, from, videoSource, caption, quotedMessage, gifPlayback = false) {
  let video;
  if (Buffer.isBuffer(videoSource)) {
    video = videoSource;
  } else if (typeof videoSource === 'string' && (videoSource.startsWith('http://') || videoSource.startsWith('https://'))) {
    video = { url: videoSource };
  } else {
    video = fs.readFileSync(videoSource);
  }
  const options = { video, caption: caption || '', gifPlayback };
  if (quotedMessage) return await jurandir.sendMessage(from, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(from, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} audioPath
 * @param {boolean} [ptt=false]
 * @param {string} [mimetype]
 */
export async function sendAudio(jurandir, from, audioPath, ptt = false, mimetype) {
  return await jurandir.sendMessage(from, {
    audio: fs.readFileSync(audioPath),
    mimetype: mimetype || (ptt ? 'audio/ogg; codecs=opus' : 'audio/mp4'),
    ptt,
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} stickerPath
 * @param {WAMessage} [quotedMessage]
 */
export async function sendSticker(jurandir, from, stickerPath, quotedMessage) {
  const options = { sticker: fs.readFileSync(stickerPath) };
  if (quotedMessage) return await jurandir.sendMessage(from, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(from, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} url
 * @param {WAMessage} [quotedMessage]
 */
export async function sendStickerFromUrl(jurandir, from, url, quotedMessage) {
  const options = { sticker: { url } };
  if (quotedMessage) return await jurandir.sendMessage(from, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(from, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} documentPath
 * @param {string} fileName
 * @param {string} mimetype
 * @param {string} [caption]
 */
export async function sendDocument(jurandir, from, documentPath, fileName, mimetype, caption) {
  return await jurandir.sendMessage(from, {
    document: fs.readFileSync(documentPath),
    fileName,
    mimetype,
    caption: caption || '',
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} [name]
 */
export async function sendLocation(jurandir, from, latitude, longitude, name) {
  return await jurandir.sendMessage(from, {
    location: { degreesLatitude: latitude, degreesLongitude: longitude, name: name || '' },
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} contactJid
 * @param {string} displayName
 */
export async function sendContact(jurandir, from, contactJid, displayName) {
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${contactJid.split('@')[0]}:${contactJid.split('@')[0]}\nEND:VCARD`;
  return await jurandir.sendMessage(from, { contacts: { displayName, contacts: [{ vcard }] } });
}

// ========== VERSÕES SEM QUOTED (2) ==========

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {string[]} [mentions]
 */
export async function sendText2(jurandir, from, text, mentions) {
  /** @type {AnyMessageContent} */
  const content = { text };
  if (mentions && mentions.length > 0) content.mentions = mentions;
  return await jurandir.sendMessage(from, content);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {string[]} [mentions=[]]
 */
export async function reply2(jurandir, from, text, mentions = []) {
  if (mentions.length > 0) return await jurandir.sendMessage(from, { text, mentions });
  return await jurandir.sendMessage(from, { text });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function successReply2(jurandir, from, text, messageKey, mentions) {
  if (messageKey) await successReact(jurandir, from, messageKey);
  await reply2(jurandir, from, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function errorReply2(jurandir, from, text, messageKey, mentions) {
  if (messageKey) await errorReact(jurandir, from, messageKey);
  await reply2(jurandir, from, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function waitReply2(jurandir, from, text, messageKey, mentions) {
  if (messageKey) await waitReact(jurandir, from, messageKey);
  await reply2(jurandir, from, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function warningReply2(jurandir, from, text, messageKey, mentions) {
  if (messageKey) await warningReact(jurandir, from, messageKey);
  await reply2(jurandir, from, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string | Buffer} imageSource
 * @param {string} [caption]
 */
export async function sendImage2(jurandir, from, imageSource, caption) {
  let image;
  if (Buffer.isBuffer(imageSource)) {
    image = imageSource;
  } else if (typeof imageSource === 'string' && (imageSource.startsWith('http://') || imageSource.startsWith('https://'))) {
    image = { url: imageSource };
  } else {
    image = fs.readFileSync(imageSource);
  }
  return await jurandir.sendMessage(from, {
    image,
    caption: caption || '',
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string | Buffer} videoSource
 * @param {string} [caption]
 * @param {boolean} [gifPlayback=false]
 */
export async function sendVideo2(jurandir, from, videoSource, caption, gifPlayback = false) {
  let video;
  if (Buffer.isBuffer(videoSource)) {
    video = videoSource;
  } else if (typeof videoSource === 'string' && (videoSource.startsWith('http://') || videoSource.startsWith('https://'))) {
    video = { url: videoSource };
  } else {
    video = fs.readFileSync(videoSource);
  }
  return await jurandir.sendMessage(from, {
    video,
    caption: caption || '',
    gifPlayback,
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} stickerPath
 */
export async function sendSticker2(jurandir, from, stickerPath) {
  return await jurandir.sendMessage(from, { sticker: fs.readFileSync(stickerPath) });
}

/**
 * @param {WASocket} jurandir
 * @param {string} from
 * @param {string} url
 */
export async function sendStickerFromUrl2(jurandir, from, url) {
  return await jurandir.sendMessage(from, { sticker: { url } });
}
