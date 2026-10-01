import { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { InteractiveMessagePlugin } from './buttons.plugin.js';
import { botConfig } from '../configs/bot.config.js';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@/types/buttons.d.ts').CleanButton} CleanButton
 * @typedef {import('@/types/buttons.d.ts').NativeButton} NativeButton
 * @typedef {import('@/types/buttons.d.ts').InteractiveCard} InteractiveCard
 * @typedef {import('@/types/buttons.d.ts').InteractivePayload} InteractivePayload
 */

/**
 * @param {WASocket} sock
 * @returns {InteractiveMessagePlugin}
 */
export function getInteractiveManager(sock) {
  if (!sock) {
    throw new Error('Socket is required to get InteractiveMessagePlugin');
  }
  const extendedSock = /** @type {any} */ (sock);
  if (!extendedSock._interactivePlugin) {
    extendedSock._interactivePlugin = new InteractiveMessagePlugin(sock);
  }
  return extendedSock._interactivePlugin;
}

/**
 * @param {CleanButton} button
 * @returns {NativeButton}
 */
export function translateButtonToNative(button) {
  switch (button.type) {
    case 'reply':
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          id: button.id,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'list':
      return {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: button.text,
          sections: button.sections,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'url':
      return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          url: button.url,
          merchant_url: button.url,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'webview':
    case 'open_webview':
      return {
        name: 'open_webview',
        buttonParamsJson: JSON.stringify({
          title: button.title || button.text,
          display_text: button.displayText || button.text,
          link: button.link || {
            url: button.url,
            in_app_webview: button.inAppWebview ?? true,
            full_screen: button.fullScreen ?? true,
          },
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'copy':
      return {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          copy_code: button.payload,
          ...(button.id && { id: button.id }),
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'call':
      return {
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          phone_number: button.phone,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'catalog':
      return {
        name: 'cta_catalog',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          business_phone_number: button.phone,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'location':
      return {
        name: 'send_location',
        buttonParamsJson: JSON.stringify({
          display_text: button.text || 'Localização',
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'pix':
      return {
        name: 'review_and_pay',
        buttonParamsJson: JSON.stringify({
          reference_id: button.referenceId,
          type: 'digital-goods',
          payment_type: 'br',
          currency: 'BRL',
          total_amount: { value: Math.round(button.amount * 100), offset: 100 },
          payment_settings: [
            {
              type: 'pix_dynamic_code',
              pix_dynamic_code: {
                code: button.pixCode,
                merchant_name: button.merchantName,
                key: button.pixKey,
                key_type: button.keyType,
              },
            },
          ],
        }),
      };

    case 'pix_static': {
      const amountVal = Math.round(button.amount * 100);
      return {
        name: 'payment_info',
        buttonParamsJson: JSON.stringify({
          currency: 'BRL',
          total_amount: { value: amountVal, offset: 100 },
          reference_id: button.referenceId,
          type: 'physical-goods',
          order: {
            status: 'pending',
            subtotal: { value: amountVal, offset: 100 },
            order_type: 'ORDER',
            items: [
              {
                name: button.itemName || 'Produto',
                amount: { value: amountVal, offset: 100 },
                quantity: 1,
                sale_amount: { value: amountVal, offset: 100 },
              },
            ],
          },
          payment_settings: [
            {
              type: 'pix_static_code',
              pix_static_code: {
                merchant_name: button.merchantName,
                key: button.pixKey,
                key_type: button.keyType,
              },
            },
          ],
          share_payment_status: false,
          is_soft_deleted: false,
          referral: 'chat_attachment',
        }),
      };
    }

    case 'boleto':
      return {
        name: 'review_and_pay',
        buttonParamsJson: JSON.stringify({
          reference_id: button.referenceId,
          type: 'physical-goods',
          payment_type: 'br',
          currency: 'BRL',
          total_amount: { value: Math.round(button.amount * 100), offset: 100 },
          payment_settings: [
            {
              type: 'boleto',
              boleto: { digitable_line: button.digitableLine },
            },
          ],
        }),
      };

    case 'payment_link':
      return {
        name: 'review_and_pay',
        buttonParamsJson: JSON.stringify({
          reference_id: button.referenceId,
          type: 'digital-goods',
          payment_type: 'br',
          currency: 'BRL',
          total_amount: { value: Math.round(button.amount * 100), offset: 100 },
          payment_settings: [
            {
              type: 'payment_link',
              payment_link: { uri: button.uri },
            },
          ],
        }),
      };

    case 'card_pay':
      return {
        name: 'review_and_pay',
        buttonParamsJson: JSON.stringify({
          reference_id: button.referenceId,
          type: 'physical-goods',
          payment_type: 'br',
          currency: 'BRL',
          total_amount: { value: Math.round(button.amount * 100), offset: 100 },
          payment_settings: [
            {
              type: 'offsite_card_pay',
              offsite_card_pay: {
                last_four_digits: button.lastFourDigits,
                credential_id: button.credentialId,
              },
            },
          ],
        }),
      };

    case 'reminder':
    case 'cta_reminder':
      return {
        name: 'cta_reminder',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'cancel_reminder':
    case 'cta_cancel_reminder':
      return {
        name: 'cta_cancel_reminder',
        buttonParamsJson: JSON.stringify({
          display_text: button.text,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'mpm':
      return {
        name: 'mpm',
        buttonParamsJson: JSON.stringify({
          display_text: button.text || button.title || 'Ver Produtos',
          sections: button.sections,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'catalog_message':
      return {
        name: 'catalog_message',
        buttonParamsJson: JSON.stringify({
          display_text: button.text || 'Ver Catálogo',
          ...(button.businessPhoneNumber && { business_phone_number: button.businessPhoneNumber }),
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'view_catalog':
    case 'automated_greeting_message_view_catalog':
      return {
        name: 'automated_greeting_message_view_catalog',
        buttonParamsJson: JSON.stringify({
          display_text: button.text || 'Ver Produto',
          business_phone_number: button.businessPhoneNumber,
          catalog_product_id: button.catalogProductId,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'transaction_details':
    case 'wa_payment_transaction_details':
      return {
        name: 'wa_payment_transaction_details',
        buttonParamsJson: JSON.stringify({
          display_text: button.text || 'Detalhes da Transação',
          transaction_id: button.transactionId,
          ...(button.icon && { icon: button.icon }),
        }),
      };

    case 'galaxy':
    case 'galaxy_message':
    case 'flow':
      return {
        name: 'galaxy_message',
        buttonParamsJson: JSON.stringify({
          flow_cta: button.flowCta || button.text || 'Abrir',
          flow_action: button.flowAction || 'navigate',
          flow_message_version: button.flowMessageVersion || '3',
          flow_action_payload: {
            screen: button.flowScreen || 'SATISFACTION_SCREEN',
            data: button.flowPayload || {},
          },
          ...(button.icon && { icon: button.icon }),
        }),
      };

    default:
      throw new Error(`Tipo de botão desconhecido: ${/** @type {any} */ (button).type}`);
  }
}

/**
 * @param {any} [quotedMessage]
 * @param {string[]} [mentions]
 * @returns {object | null}
 */
export function buildContextInfo(quotedMessage, mentions) {
  const contextInfo = {};

  if (quotedMessage?.key?.id && quotedMessage.message) {
    contextInfo.stanzaId = quotedMessage.key.id;
    contextInfo.participant = quotedMessage.key.participant || quotedMessage.key.remoteJid || null;
    contextInfo.quotedMessage = quotedMessage.message;
  }

  if (mentions && mentions.length > 0) {
    contextInfo.mentionedJid = mentions;
  }

  return Object.keys(contextInfo).length > 0 ? contextInfo : null;
}

/**
 * @param {WASocket} sock
 * @param {InteractiveCard} card
 */
export async function buildCarouselHeader(sock, card) {
  /** @type {Record<string, any>} */
  let headerObj = {};
  let headerType = undefined;

  if (card.header?.mediaBuffer || card.header?.mediaUrl || card.header?.mediaPath) {
    const isVideo = card.header.mediaType === 'video';

    let mediaSrc;
    if (card.header.mediaBuffer) {
      mediaSrc = card.header.mediaBuffer;
    } else if (card.header.mediaPath) {
      mediaSrc = { url: card.header.mediaPath };
    } else if (card.header.mediaUrl) {
      mediaSrc = { url: card.header.mediaUrl };
    }

    /** @type {any} */
    const mediaPayload = isVideo
      ? { video: mediaSrc, gifPlayback: card.header.isGif }
      : { image: mediaSrc };

    const menuMedia = await prepareWAMessageMedia(mediaPayload, { upload: sock.waUploadToServer });

    if (isVideo && menuMedia.videoMessage) {
      headerObj = { hasMediaAttachment: true, videoMessage: menuMedia.videoMessage };
      headerType = 'VIDEO';
    } else if (!isVideo && menuMedia.imageMessage) {
      headerObj = { hasMediaAttachment: true, imageMessage: menuMedia.imageMessage };
      headerType = 'IMAGE';
    }
  }

  if (card.header?.title) headerObj.title = card.header.title;
  return { headerObj, headerType };
}

/**
 * @param {WASocket} sock
 * @param {string} to
 * @param {InteractivePayload} payload
 */
export async function sendButton(sock, to, payload) {
  if (!payload.cards || payload.cards.length === 0) {
    throw new Error('É necessário fornecer ao menos um card no payload.');
  }

  const buttonMode = botConfig?.buttons !== undefined ? botConfig.buttons : 2;
  const requestedCarousel =
    payload.asCarousel !== undefined ? payload.asCarousel : buttonMode === 1;
  const isCarousel = requestedCarousel === true || payload.cards.length > 1;
  const hasDocument = payload.cards.some((c) => c.header?.mediaType === 'document');

  if (isCarousel && hasDocument) {
    throw new Error(
      'Carrosséis não suportam a renderização de documentos. Utilize imagens ou vídeos.'
    );
  }

  const manager = getInteractiveManager(sock);

  if (payload.legacy) {
    if (isCarousel) {
      throw new Error('Botões legacy não suportam o formato de Carrossel.');
    }

    const card = payload.cards[0];
    if (!card) {
      throw new Error('Card indefinido ou inválido no payload.');
    }

    if (card.header?.mediaType === 'video' || card.header?.mediaType === 'document') {
      throw new Error(
        'Botões legacy suportam exclusivamente imagens (JPEG). O envio de vídeo ou documento foi bloqueado.'
      );
    }

    const legacyButtons = card.buttons.map((btn, idx) => {
      if (btn.type !== 'reply') {
        throw new Error(
          `Botões legacy aceitam apenas o tipo 'reply'. Encontrado tipo inválido: ${btn.type}`
        );
      }
      return {
        buttonId: btn.id || `btn-${idx}`,
        buttonText: { displayText: btn.text },
      };
    });

    /** @type {Record<string, any>} */
    const locationConfig = {
      name: card.header?.title || '',
      address: card.header?.subtitle || '',
    };

    if (card.header?.mediaBuffer) {
      locationConfig.jpegThumbnail = card.header.mediaBuffer;
    } else if (card.header?.mediaPath) {
      locationConfig.jpegThumbnail = card.header.mediaPath;
    } else if (card.header?.mediaUrl) {
      locationConfig.jpegThumbnail = card.header.mediaUrl;
    }

    const contextInfo = buildContextInfo(payload.quotedMessage, payload.mentions);

    /** @type {Record<string, any>} */
    const legacyPayload = {
      text: card.body,
      footer: card.footer,
      buttons: legacyButtons,
      location: locationConfig,
    };

    if (contextInfo) {
      legacyPayload.contextInfo = contextInfo;
    }

    return await manager.sendLegacyButtons(to, /** @type {any} */(legacyPayload), {});
  }

  if (!isCarousel) {
    const card = payload.cards[0];
    if (!card) {
      throw new Error('Card indefinido ou inválido no payload.');
    }

    const contextInfo = buildContextInfo(payload.quotedMessage, payload.mentions);

    /** @type {Record<string, any>} */
    const pluginPayload = {
      aimode: payload.aimode,
      title: card.header?.title,
      text: card.body,
      footer: card.footer,
      interactiveButtons: card.buttons.map(translateButtonToNative),
    };

    if (payload.messageParamsJson) {
      pluginPayload.messageParamsJson =
        typeof payload.messageParamsJson === 'string'
          ? payload.messageParamsJson
          : JSON.stringify(payload.messageParamsJson);
    } else if (payload.messageParams) {
      const mp = payload.messageParams;
      if (mp.bottomSheet) {
        pluginPayload.messageParamsJson = JSON.stringify({
          bottom_sheet: {
            in_thread_buttons_limit: mp.bottomSheet.inThreadButtonsLimit ?? 1,
            divider_indices: mp.bottomSheet.dividerIndices ?? [1, 2],
            list_title: mp.bottomSheet.listTitle ?? '',
            button_title: mp.bottomSheet.buttonTitle ?? '',
          },
        });
      } else {
        pluginPayload.messageParamsJson = JSON.stringify(mp);
      }
    }

    if (contextInfo) {
      pluginPayload.contextInfo = contextInfo;
    }

    if (card.header?.mediaUrl || card.header?.mediaPath || card.header?.mediaBuffer) {
      let mediaSrc;
      if (card.header.mediaBuffer) {
        mediaSrc = { buffer: card.header.mediaBuffer };
      } else if (card.header.mediaPath) {
        mediaSrc = { url: card.header.mediaPath };
      } else if (card.header.mediaUrl) {
        mediaSrc = { url: card.header.mediaUrl };
      }

      if (card.header.mediaType === 'video') {
        pluginPayload.video = mediaSrc;
        pluginPayload.isGif = card.header.isGif;
      } else if (card.header.mediaType === 'document') {
        pluginPayload.document = mediaSrc;
        pluginPayload.fileName = card.header.fileName;
        pluginPayload.mimetype = card.header.mimetype;
      } else {
        pluginPayload.image = mediaSrc;
      }
    }

    return await manager.sendInteractiveMessage(to, pluginPayload);
  } else {
    const cardPromises = payload.cards.map(async (card) => {
      const { headerObj, headerType } = await buildCarouselHeader(sock, card);

      /** @type {Record<string, any>} */
      const cardMessage = {
        body: { text: card.body },
        nativeFlowMessage: {
          buttons: card.buttons.map(translateButtonToNative),
          messageParamsJson: '',
        },
      };

      if (Object.keys(headerObj).length > 0) {
        cardMessage.header = headerObj;
        if (headerType) cardMessage.headerType = headerType;
      }

      if (card.footer) {
        cardMessage.footer = { text: card.footer };
      }

      return cardMessage;
    });

    const carouselCards = await Promise.all(cardPromises);
    const contextInfo = buildContextInfo(payload.quotedMessage, payload.mentions);

    /** @type {Record<string, any>} */
    const interactiveMsgObj = {
      body: { text: payload.bodyText || '' },
      carouselMessage: { cards: carouselCards },
    };

    if (contextInfo) {
      interactiveMsgObj.contextInfo = contextInfo;
    }

    return await sock.relayMessage(
      to,
      {
        interactiveMessage: interactiveMsgObj,
      },
      {
        additionalNodes: [
          {
            tag: 'biz',
            attrs: {},
            content: [
              {
                tag: 'interactive',
                attrs: { type: 'native_flow', v: '1' },
                content: [
                  {
                    tag: 'native_flow',
                    attrs: { v: '9', name: 'mixed' },
                  },
                ],
              },
            ],
          },
        ],
      }
    );
  }
}
