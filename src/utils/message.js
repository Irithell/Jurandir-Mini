import { delay, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import fs from 'node:fs';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@whiskeysockets/baileys').WAMessage} WAMessage
 * @typedef {import('@whiskeysockets/baileys').AnyMessageContent} AnyMessageContent
 * @typedef {import('@/types/messages.d.ts').InteractivePayload} InteractivePayload
 * @typedef {import('@/types/messages.d.ts').InteractiveCard} InteractiveCard
 * @typedef {import('@/types/messages.d.ts').CleanButton} CleanButton
 * @typedef {import('@/types/messages.d.ts').MediaType} MediaType
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
 * @param {string} jid
 */
export async function sendTyping(jurandir, jid) {
  await delay(TYPING_DELAY);
  await jurandir.sendPresenceUpdate('composing', jid);
  await delay(TYPING_DELAY);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 */
export async function sendRecording(jurandir, jid) {
  await delay(TYPING_DELAY);
  await jurandir.sendPresenceUpdate('recording', jid);
  await delay(TYPING_DELAY);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {string[]} [mentions]
 */
export async function sendText(jurandir, jid, text, mentions) {
  /** @type {AnyMessageContent} */
  const content = { text };
  if (mentions && mentions.length > 0) {
    content.mentions = mentions;
  }
  return await jurandir.sendMessage(jid, content);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {WAMessage} quotedMessage
 * @param {string[]} [mentions=[]]
 */
export async function reply(jurandir, jid, text, quotedMessage, mentions = []) {
  try {
    if (mentions.length > 0) {
      return await jurandir.sendMessage(jid, { text, mentions }, { quoted: quotedMessage });
    }
    return jurandir.sendMessage(jid, { text }, { quoted: quotedMessage });
  } catch (err) {
    const error = /** @type {any} */ (err);
    if (error?.message?.includes('rate-overlimit') || error?.data === 429) {
      await delay(1500);
      return await jurandir
        .sendMessage(jid, { text }, { quoted: quotedMessage })
        .catch(() => undefined);
    }
    throw err;
  }
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} emoji
 * @param {any} messageKey
 */
export async function react(jurandir, jid, emoji, messageKey) {
  try {
    const res = jurandir.sendMessage(jid, {
      react: { text: emoji, key: messageKey },
    });
    return res;
  } catch (err) {
    return undefined;
  }
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {any} messageKey
 */
export async function successReact(jurandir, jid, messageKey) {
  return await react(jurandir, jid, '😺', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {any} messageKey
 */
export async function errorReact(jurandir, jid, messageKey) {
  return await react(jurandir, jid, '😿', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {any} messageKey
 */
export async function waitReact(jurandir, jid, messageKey) {
  return await react(jurandir, jid, '😽', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {any} messageKey
 */
export async function warningReact(jurandir, jid, messageKey) {
  return await react(jurandir, jid, '😾', messageKey);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function successReply(jurandir, jid, text, quotedMessage) {
  if (quotedMessage.key) await successReact(jurandir, jid, quotedMessage.key);
  await reply(jurandir, jid, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function errorReply(jurandir, jid, text, quotedMessage) {
  if (quotedMessage.key) await errorReact(jurandir, jid, quotedMessage.key);
  await reply(jurandir, jid, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function waitReply(jurandir, jid, text, quotedMessage) {
  if (quotedMessage.key) await waitReact(jurandir, jid, quotedMessage.key);
  await reply(jurandir, jid, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {WAMessage} quotedMessage
 */
export async function warningReply(jurandir, jid, text, quotedMessage) {
  if (quotedMessage.key) await warningReact(jurandir, jid, quotedMessage.key);
  await reply(jurandir, jid, `> ${text}`, quotedMessage);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} imagePath
 * @param {string} [caption]
 * @param {WAMessage} [quotedMessage]
 */
export async function sendImage(jurandir, jid, imagePath, caption, quotedMessage) {
  const options = { image: fs.readFileSync(imagePath), caption: caption || '' };
  if (quotedMessage) return await jurandir.sendMessage(jid, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(jid, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} videoPath
 * @param {string} [caption]
 * @param {WAMessage} [quotedMessage]
 */
export async function sendVideo(jurandir, jid, videoPath, caption, quotedMessage) {
  const options = { video: fs.readFileSync(videoPath), caption: caption || '' };
  if (quotedMessage) return await jurandir.sendMessage(jid, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(jid, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} audioPath
 * @param {boolean} [ptt=false]
 */
export async function sendAudio(jurandir, jid, audioPath, ptt = false) {
  return await jurandir.sendMessage(jid, {
    audio: fs.readFileSync(audioPath),
    mimetype: 'audio/mp4',
    ptt,
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} stickerPath
 * @param {WAMessage} [quotedMessage]
 */
export async function sendSticker(jurandir, jid, stickerPath, quotedMessage) {
  const options = { sticker: fs.readFileSync(stickerPath) };
  if (quotedMessage) return await jurandir.sendMessage(jid, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(jid, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} url
 * @param {WAMessage} [quotedMessage]
 */
export async function sendStickerFromUrl(jurandir, jid, url, quotedMessage) {
  const options = { sticker: { url } };
  if (quotedMessage) return await jurandir.sendMessage(jid, options, { quoted: quotedMessage });
  return await jurandir.sendMessage(jid, options);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} documentPath
 * @param {string} fileName
 * @param {string} mimetype
 * @param {string} [caption]
 */
export async function sendDocument(jurandir, jid, documentPath, fileName, mimetype, caption) {
  return await jurandir.sendMessage(jid, {
    document: fs.readFileSync(documentPath),
    fileName,
    mimetype,
    caption: caption || '',
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} [name]
 */
export async function sendLocation(jurandir, jid, latitude, longitude, name) {
  return await jurandir.sendMessage(jid, {
    location: { degreesLatitude: latitude, degreesLongitude: longitude, name: name || '' },
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} contactJid
 * @param {string} displayName
 */
export async function sendContact(jurandir, jid, contactJid, displayName) {
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL;type=CELL;type=VOICE;waid=${contactJid.split('@')[0]}:${contactJid.split('@')[0]}\nEND:VCARD`;
  return await jurandir.sendMessage(jid, { contacts: { displayName, contacts: [{ vcard }] } });
}

// ========== VERSÕES SEM QUOTED (2) ==========

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {string[]} [mentions]
 */
export async function sendText2(jurandir, jid, text, mentions) {
  /** @type {AnyMessageContent} */
  const content = { text };
  if (mentions && mentions.length > 0) content.mentions = mentions;
  return await jurandir.sendMessage(jid, content);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {string[]} [mentions=[]]
 */
export async function reply2(jurandir, jid, text, mentions = []) {
  if (mentions.length > 0) return await jurandir.sendMessage(jid, { text, mentions });
  return await jurandir.sendMessage(jid, { text });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function successReply2(jurandir, jid, text, messageKey, mentions) {
  if (messageKey) await successReact(jurandir, jid, messageKey);
  await reply2(jurandir, jid, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function errorReply2(jurandir, jid, text, messageKey, mentions) {
  if (messageKey) await errorReact(jurandir, jid, messageKey);
  await reply2(jurandir, jid, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function waitReply2(jurandir, jid, text, messageKey, mentions) {
  if (messageKey) await waitReact(jurandir, jid, messageKey);
  await reply2(jurandir, jid, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} text
 * @param {any} messageKey
 * @param {string[]} [mentions]
 */
export async function warningReply2(jurandir, jid, text, messageKey, mentions) {
  if (messageKey) await warningReact(jurandir, jid, messageKey);
  await reply2(jurandir, jid, `> ${text}`, mentions);
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} imagePath
 * @param {string} [caption]
 */
export async function sendImage2(jurandir, jid, imagePath, caption) {
  return await jurandir.sendMessage(jid, {
    image: fs.readFileSync(imagePath),
    caption: caption || '',
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} videoPath
 * @param {string} [caption]
 */
export async function sendVideo2(jurandir, jid, videoPath, caption) {
  return await jurandir.sendMessage(jid, {
    video: fs.readFileSync(videoPath),
    caption: caption || '',
  });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} stickerPath
 */
export async function sendSticker2(jurandir, jid, stickerPath) {
  return await jurandir.sendMessage(jid, { sticker: fs.readFileSync(stickerPath) });
}

/**
 * @param {WASocket} jurandir
 * @param {string} jid
 * @param {string} url
 */
export async function sendStickerFromUrl2(jurandir, jid, url) {
  return await jurandir.sendMessage(jid, { sticker: { url } });
}

// ==================== INTERACTIVE MESSAGES ====================

/**
 * @param {WASocket} jurandir
 * @param {string} to
 * @param {string} mediaUrl
 * @param {MediaType} mediaType
 * @param {string} [caption]
 * @param {WAMessage} [quotedMessage]
 */
export async function sendTextWithMedia(jurandir, to, mediaUrl, mediaType, caption, quotedMessage) {
  /** @type {AnyMessageContent} */
  const messageContent = {
    caption: caption || '',
    ...(mediaType === 'image' ? { image: { url: mediaUrl } } : { video: { url: mediaUrl } }),
  };

  const options = quotedMessage ? { quoted: quotedMessage } : undefined;
  await jurandir.sendMessage(to, messageContent, options);
}

/**
 * @param {WASocket} jurandir
 * @param {InteractiveCard['header']} header
 * @returns {Promise<{ headerObj: object, headerType: string | undefined }>}
 */
async function prepareCardHeader(jurandir, header) {
  if (!header) return { headerObj: {}, headerType: undefined };

  if (header.mediaBuffer) {
    const media = await prepareWAMessageMedia(
      { video: header.mediaBuffer, gifPlayback: header.isGif || false },
      { upload: jurandir.waUploadToServer }
    );
    return {
      headerObj: { hasMediaAttachment: true, videoMessage: media.videoMessage },
      headerType: 'VIDEO',
    };
  }

  if (header.mediaUrl) {
    const isVideo = header.mediaType === 'video';
    const media = await prepareWAMessageMedia(
      isVideo ? { video: { url: header.mediaUrl } } : { image: { url: header.mediaUrl } },
      { upload: jurandir.waUploadToServer }
    );
    return isVideo
      ? {
          headerObj: { hasMediaAttachment: true, videoMessage: media.videoMessage },
          headerType: 'VIDEO',
        }
      : {
          headerObj: { hasMediaAttachment: true, imageMessage: media.imageMessage },
          headerType: 'IMAGE',
        };
  }

  return { headerObj: {}, headerType: undefined };
}

/**
 * @param {CleanButton} button
 * @returns {{ name: string, buttonParamsJson: string }}
 */
function buildNativeButton(button) {
  switch (button.type) {
    case 'reply':
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: button.text, id: button.id }),
      };
    case 'list':
      return {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({ title: button.text, sections: button.sections }),
      };
    case 'url':
      return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          url: button.url,
          merchant_url: button.url,
        }),
      };
    case 'copy':
      return {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          copy_code: button.payload,
          id: button.id || button.payload,
        }),
      };
    default:
      throw new Error(`Tipo de botão desconhecido: ${/** @type {any} */ (button).type}`);
  }
}

/**
 *
 * @param {WASocket} jurandir
 * @param {string} to
 * @param {InteractivePayload} payload
 */
export async function sendButton(jurandir, to, payload) {
  const { bodyText = '', cards, quotedMessage, mentions } = payload;

  const carouselCards = await Promise.all(
    cards.map(async (card) => {
      const { headerObj, headerType } = await prepareCardHeader(jurandir, card.header);

      return {
        header: headerObj,
        headerType,
        body: { text: card.body },
        footer: card.footer ? { text: card.footer } : null,
        nativeFlowMessage: { buttons: card.buttons.map(buildNativeButton) },
      };
    })
  );

  /** @type {object | null} */
  let contextInfo = null;

  if (quotedMessage?.key?.id && quotedMessage.message) {
    contextInfo = {
      stanzaId: quotedMessage.key.id,
      participant: quotedMessage.key.participant || quotedMessage.key.remoteJid || null,
      quotedMessage: quotedMessage.message,
      ...(mentions?.length ? { mentionedJid: mentions } : {}),
    };
  } else if (mentions?.length) {
    contextInfo = { mentionedJid: mentions };
  }

  await jurandir.relayMessage(
    to,
    {
      interactiveMessage: {
        body: { text: bodyText },
        carouselMessage: { cards: carouselCards },
        contextInfo,
      },
    },
    {}
  );
}
