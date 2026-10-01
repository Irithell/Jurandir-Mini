import {
  generateWAMessageContent,
  isJidGroup,
  generateMessageID,
  proto,
} from '@whiskeysockets/baileys';
import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'node:stream';

/**
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 * @typedef {import('@/types/buttons.d.ts').InteractiveContent} InteractiveContent
 * @typedef {import('@/types/buttons.d.ts').InteractiveButton} InteractiveButton
 * @typedef {import('@/types/buttons.d.ts').InteractiveMessageOptions} InteractiveMessageOptions
 * @typedef {import('@/types/buttons.d.ts').LegacyButtonsPayload} LegacyButtonsPayload
 * @typedef {import('@/types/buttons.d.ts').LegacyButton} LegacyButton
 */

export class InteractiveValidationError extends Error {
  /**
   * @param {string} message
   * @param {{ context?: string; errors?: string[]; warnings?: string[]; payload?: any }} [options={}]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'InteractiveValidationError';
    this.context = options.context || '';
    this.errors = options.errors || [];
    this.warnings = options.warnings || [];
    this.payload = options.payload || null;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      errors: this.errors,
      warnings: this.warnings,
      payload: this.payload,
    };
  }

  formatDetailed() {
    const lines = [`[ ${this.name} ]: ${this.message}${this.context ? ` (${this.context})` : ''}`];
    if (this.errors.length) {
      lines.push('Errors:');
      this.errors.forEach((err) => lines.push('  - ' + err));
    }
    if (this.warnings.length) {
      lines.push('Warnings:');
      this.warnings.forEach((warn) => lines.push('  - ' + warn));
    }
    return lines.join('\n');
  }
}

const allowedButtonTypes = new Set([
  'quick_reply',
  'cta_url',
  'cta_copy',
  'cta_call',
  'cta_catalog',
  'cta_reminder',
  'cta_cancel_reminder',
  'send_location',
  'open_webview',
  'mpm',
  'wa_payment_transaction_details',
  'automated_greeting_message_view_catalog',
  'galaxy_message',
  'single_select',
  'review_and_pay',
  'payment_info',
  'catalog_message',
]);

/** @type {Record<string, string[]>} */
const requiredParams = {
  cta_url: ['display_text', 'url'],
  cta_copy: ['display_text', 'copy_code'],
  cta_call: ['display_text', 'phone_number'],
  cta_catalog: ['business_phone_number'],
  send_location: [],
  catalog_message: [],
  open_webview: ['title', 'link'],
  mpm: ['sections'],
  wa_payment_transaction_details: ['transaction_id'],
  automated_greeting_message_view_catalog: ['business_phone_number', 'catalog_product_id'],
  single_select: ['title', 'sections'],
  quick_reply: ['display_text', 'id'],
  review_and_pay: [
    'reference_id',
    'type',
    'payment_type',
    'currency',
    'total_amount',
    'payment_settings',
  ],
  payment_info: ['reference_id', 'type', 'currency', 'total_amount', 'order', 'payment_settings'],
};

export class InteractiveMessagePlugin {
  /**
   * @param {WASocket} sock
   */
  constructor(sock) {
    /** @type {any} */
    this.sock = sock;
    /** @type {any} */
    this.logger = sock?.logger;
  }

  /**
   * @returns {any}
   */
  getBaseGenerationOptions() {
    /** @type {Record<string, any>} */
    const opts = {
      upload: this.sock?.waUploadToServer,
      logger: this.logger,
    };
    if (this.sock?.mediaCache !== undefined) opts.mediaCache = this.sock.mediaCache;
    if (this.sock?.options !== undefined) opts.options = this.sock.options;
    return opts;
  }

  /**
   * @param {InteractiveButton[]} buttons
   */
  normalizeButtons(buttons) {
    return buttons.map((btn, idx) => {
      if (btn.name && btn.buttonParamsJson !== undefined) {
        return { name: btn.name, buttonParamsJson: btn.buttonParamsJson };
      }

      const randomStr = Math.random().toString(36).substring(2, 8);
      const id = btn.id || btn.buttonId || `btn-${idx}-${randomStr}`;
      const text = btn.text || btn.displayText || btn.buttonText?.displayText || '';

      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: text, id }),
      };
    });
  }

  /**
   * @param {string} firstBtnName
   */
  getButtonNode(firstBtnName) {
    const baseTag = firstBtnName === 'send_location' ? 'bot' : 'biz';

    if (firstBtnName === 'review_and_pay') {
      return { tag: baseTag, attrs: { native_flow_name: 'order_details' } };
    }
    if (firstBtnName === 'payment_info') {
      return { tag: baseTag, attrs: { native_flow_name: 'payment_info' } };
    }

    const specialNames = [
      'mpm',
      'cta_catalog',
      'send_location',
      'catalog_message',
      'call_permission_request',
      'wa_payment_transaction_details',
      'automated_greeting_message_view_catalog',
    ];

    let v = '9';
    let name = 'mixed';

    if (specialNames.includes(firstBtnName)) {
      v = '2';
      name = firstBtnName;
    }

    return {
      tag: baseTag,
      attrs: {},
      content: [
        {
          tag: 'interactive',
          attrs: { type: 'native_flow', v: '1' },
          content: [{ tag: 'native_flow', attrs: { v, name } }],
        },
      ],
    };
  }

  /**
   * @param {any} content
   * @returns {Promise<any>}
   */
  async generateMediaPayload(content) {
    if (!content.image && !content.video && !content.document) return null;

    try {
      /** @type {any} */
      let mediaPayload;

      if (content.document) {
        const isBuffer = 'buffer' in content.document;
        const target = isBuffer ? content.document.buffer : { url: content.document.url };

        let extractedFileName = content.fileName;

        if (!extractedFileName) {
          if (!isBuffer && typeof content.document.url === 'string') {
            extractedFileName =
              content.document.url.split(/[/\\]/).pop()?.split('?')[0] || 'arquivo.bin';
          } else {
            extractedFileName = 'arquivo.bin';
          }
        }

        mediaPayload = {
          document: target,
          fileName: extractedFileName,
          ...(content.mimetype && { mimetype: content.mimetype }),
        };
      } else if (content.video) {
        const target =
          'buffer' in content.video ? content.video.buffer : { url: content.video.url };
        mediaPayload = { video: target, gifPlayback: content.isGif };
      } else {
        const target =
          'buffer' in content.image ? content.image.buffer : { url: content.image.url };
        mediaPayload = { image: target };
      }

      /** @type {any} */
      const waMsgContent = await generateWAMessageContent(
        mediaPayload,
        this.getBaseGenerationOptions()
      );

      if (waMsgContent.documentMessage) {
        return {
          hasMediaAttachment: true,
          documentMessage: waMsgContent.documentMessage,
        };
      }

      if (waMsgContent.imageMessage) {
        delete waMsgContent.imageMessage.caption;
        return {
          hasMediaAttachment: true,
          imageMessage: waMsgContent.imageMessage,
        };
      }

      if (waMsgContent.videoMessage) {
        delete waMsgContent.videoMessage.caption;
        return {
          hasMediaAttachment: true,
          videoMessage: waMsgContent.videoMessage,
        };
      }

      return null;
    } catch (error) {
      this.logger?.error?.(`Falha no upload isolado de mídia: ${error}`);
      return null;
    }
  }

  /**
   * @param {string} name
   * @param {string} paramsStr
   * @param {string[]} errorsArray
   * @param {number} idx
   */
  validateButtonParams(name, paramsStr, errorsArray, idx) {
    let params;
    try {
      params = JSON.parse(paramsStr);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errorsArray.push(`buttons[ ${idx} ] (${name}) invalid JSON: ${errorMsg}`);
      return null;
    }

    const required = requiredParams[name] || [];
    for (const field of required) {
      if (!(field in params)) {
        errorsArray.push(`buttons[ ${idx} ] (${name}) missing required field '${field}'`);
      }
    }

    if (name === 'single_select' || name === 'mpm') {
      if (!Array.isArray(params['sections']) || params['sections'].length === 0) {
        errorsArray.push(`buttons[ ${idx} ] (${name}) sections must be non-empty array`);
      }
    }

    if (name === 'review_and_pay' || name === 'payment_info') {
      const settings = params['payment_settings'];
      if (!Array.isArray(settings) || settings.length === 0) {
        errorsArray.push(
          `buttons[ ${idx} ] (${name}) 'payment_settings' must be a non-empty array`
        );
      } else if (params['payment_type'] === 'br' || name === 'payment_info') {
        const setting = settings[0];
        if (!setting || !setting.type) {
          errorsArray.push(`buttons[ ${idx} ] (${name}) payment_setting requires a 'type'`);
        } else {
          const pType = setting.type;
          if (pType === 'pix_dynamic_code') {
            const pix = setting.pix_dynamic_code;
            if (!pix || typeof pix !== 'object') {
              errorsArray.push(`buttons[ ${idx} ] (${name}) 'pix_dynamic_code' object missing`);
            } else {
              const pixReq = ['code', 'merchant_name', 'key', 'key_type'];
              for (const f of pixReq) {
                if (!(f in pix)) {
                  errorsArray.push(
                    `buttons[ ${idx} ] (${name}) pix_dynamic_code missing required field '${f}'`
                  );
                }
              }
            }
          } else if (pType === 'pix_static_code') {
            const pixStatic = setting.pix_static_code;
            if (!pixStatic || typeof pixStatic !== 'object') {
              errorsArray.push(`buttons[ ${idx} ] (${name}) 'pix_static_code' object missing`);
            } else {
              const pixReq = ['merchant_name', 'key', 'key_type'];
              for (const f of pixReq) {
                if (!(f in pixStatic)) {
                  errorsArray.push(
                    `buttons[ ${idx} ] (${name}) pix_static_code missing required field '${f}'`
                  );
                }
              }
            }
          } else if (pType === 'payment_link') {
            const pl = setting.payment_link;
            if (!pl || typeof pl !== 'object' || !pl.uri) {
              errorsArray.push(`buttons[ ${idx} ] (${name}) 'payment_link' requires 'uri'`);
            }
          } else if (pType === 'boleto') {
            const bol = setting.boleto;
            if (!bol || typeof bol !== 'object' || !bol.digitable_line) {
              errorsArray.push(`buttons[ ${idx} ] (${name}) 'boleto' requires 'digitable_line'`);
            }
          } else if (pType === 'offsite_card_pay') {
            const card = setting.offsite_card_pay;
            if (
              !card ||
              typeof card !== 'object' ||
              !card.last_four_digits ||
              !card.credential_id
            ) {
              errorsArray.push(
                `buttons[ ${idx} ] (${name}) 'offsite_card_pay' requires 'last_four_digits' and 'credential_id'`
              );
            }
          } else {
            errorsArray.push(
              `buttons[ ${idx} ] (${name}) unsupported payment setting type '${pType}'`
            );
          }
        }
      }
    }

    return params;
  }

  /**
   * @param {any} payload
   */
  validateSendInteractiveMessagePayload(payload) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['payload must be an object'], warnings };
    }

    if (!payload.text || typeof payload.text !== 'string') {
      errors.push('text is mandatory and must be a string');
    }

    if (!Array.isArray(payload.interactiveButtons) || payload.interactiveButtons.length === 0) {
      errors.push('interactiveButtons is mandatory and must be a non-empty array');
    } else {
      const isOnlyLocation =
        payload.interactiveButtons.length === 1 &&
        payload.interactiveButtons[0]?.name === 'send_location';
      if (isOnlyLocation) {
        errors.push(
          `interactiveButtons[ 0 ] ('send_location') cannot be sent alone due to server ack limits. It requires at least one accompanying button to render properly.`
        );
      }

      payload.interactiveButtons.forEach((/** @type {any} */ btn, /** @type {number} */ idx) => {
        if (!btn || typeof btn !== 'object') {
          errors.push(`interactiveButtons[ ${idx} ] must be an object`);
          return;
        }

        if (
          (btn.id || btn.buttonId) &&
          (btn.text || btn.displayText || btn.buttonText?.displayText)
        ) {
          return;
        }

        if (btn.name && btn.buttonParamsJson) {
          if (!allowedButtonTypes.has(btn.name)) {
            errors.push(`interactiveButtons[ ${idx} ] name '${btn.name}' not allowed`);
            return;
          }
          if (typeof btn.buttonParamsJson !== 'string') {
            errors.push(`interactiveButtons[ ${idx} ] buttonParamsJson must be string`);
            return;
          }
          this.validateButtonParams(btn.name, btn.buttonParamsJson, errors, idx);
          return;
        }
        errors.push(`interactiveButtons[ ${idx} ] invalid shape.`);
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * @param {any} payload
   */
  validateSendButtonsPayload(payload) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['payload must be an object'], warnings };
    }

    if (!payload.text || typeof payload.text !== 'string') {
      errors.push('text is mandatory and must be a string');
    }

    if (!Array.isArray(payload.buttons) || payload.buttons.length === 0) {
      errors.push('buttons is mandatory and must be a non-empty array');
    } else {
      const isOnlyLocation =
        payload.buttons.length === 1 && payload.buttons[0]?.name === 'send_location';
      if (isOnlyLocation) {
        errors.push(
          `buttons[ 0 ] ('send_location') cannot be sent alone due to server ack limits. It requires at least one accompanying button to render properly.`
        );
      }

      payload.buttons.forEach((/** @type {any} */ btn, /** @type {number} */ idx) => {
        if (!btn || typeof btn !== 'object') {
          errors.push(`buttons[ ${idx} ] must be an object`);
          return;
        }

        if (
          (btn.id || btn.buttonId) &&
          (btn.text || btn.displayText || btn.buttonText?.displayText)
        ) {
          return;
        }

        if (!btn.name || typeof btn.name !== 'string') {
          errors.push(`buttons[ ${idx} ] missing name`);
          return;
        }

        if (!allowedButtonTypes.has(btn.name)) {
          errors.push(`buttons[ ${idx} ] name '${btn.name}' not allowed`);
          return;
        }

        if (!btn.buttonParamsJson || typeof btn.buttonParamsJson !== 'string') {
          errors.push(`buttons[ ${idx} ] buttonParamsJson must be string`);
          return;
        }

        this.validateButtonParams(btn.name, btn.buttonParamsJson, errors, idx);
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * @param {any} payload
   */
  async buildInteractiveMessage(payload) {
    if (payload.interactiveButtons && payload.interactiveButtons.length > 0) {
      const safeButtons = this.normalizeButtons(payload.interactiveButtons);

      /** @type {any} */
      const nativeMsg = {
        nativeFlowMessage: {
          buttons: safeButtons.map((btn) => ({
            name: btn.name || 'quick_reply',
            buttonParamsJson: btn.buttonParamsJson,
          })),
          messageParamsJson: payload.messageParamsJson || '',
        },
      };

      if (payload.image || payload.video || payload.document) {
        const uploaded = await this.generateMediaPayload(payload);
        if (uploaded) {
          nativeMsg.header = uploaded;
          if (payload.title || payload.subtitle) {
            nativeMsg.header.title = payload.title || payload.subtitle;
          }
        }
      } else if (payload.title || payload.subtitle) {
        nativeMsg.header = { title: payload.title || payload.subtitle || '' };
      }

      if (payload.text) nativeMsg.body = { text: payload.text };
      if (payload.footer) nativeMsg.footer = { text: payload.footer };

      if (payload.contextInfo) nativeMsg.contextInfo = payload.contextInfo;

      const clone = { ...payload };
      delete clone.interactiveButtons;
      delete clone.title;
      delete clone.subtitle;
      delete clone.text;
      delete clone.footer;
      delete clone.image;
      delete clone.video;
      delete clone.document;
      delete clone.fileName;
      delete clone.mimetype;
      delete clone.isGif;
      delete clone.contextInfo;
      delete clone.messageParamsJson;
      delete clone.messageParams;

      const specialNames = [
        'mpm',
        'cta_catalog',
        'send_location',
        'catalog_message',
        'call_permission_request',
        'wa_payment_transaction_details',
        'automated_greeting_message_view_catalog',
        'review_and_pay',
        'payment_info',
      ];

      const firstBtnName = safeButtons[0]?.name || '';

      if (specialNames.includes(firstBtnName)) {
        return {
          ...clone,
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: nativeMsg,
        };
      } else {
        return {
          ...clone,
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: nativeMsg,
            },
          },
        };
      }
    }
    return payload;
  }

  /**
   * @param {string} jid
   * @param {InteractiveContent} content
   * @param {InteractiveMessageOptions} [options={}]
   */
  async sendInteractiveMessage(jid, content, options = {}) {
    if (!this.sock) {
      throw new InteractiveValidationError('Socket is required', {
        context: 'sendInteractiveMessage',
      });
    }

    const aimode = options?.aimode === true || content.aimode === true;
    const cloneOpts = { ...options };
    delete cloneOpts.aimode;

    if (content && Array.isArray(content.interactiveButtons)) {
      const valRes = this.validateSendInteractiveMessagePayload(content);
      if (!valRes.valid) {
        throw new InteractiveValidationError('Interactive authoring payload invalid', {
          context: 'sendInteractiveMessage(validateSendInteractiveMessagePayload)',
          errors: valRes.errors,
          warnings: valRes.warnings,
          payload: content,
        });
      }
    }

    const builtContent = await this.buildInteractiveMessage(content);

    const finalMessageId = cloneOpts.messageId || generateMessageID();
    /** @type {any[]} */
    const additionalNodes = Array.isArray(cloneOpts.additionalNodes)
      ? [...cloneOpts.additionalNodes]
      : [];

    let firstBtnName = '';

    if (builtContent.interactiveMessage?.nativeFlowMessage?.buttons?.[0]?.name) {
      firstBtnName = builtContent.interactiveMessage.nativeFlowMessage.buttons[0].name;
    } else if (
      builtContent.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage?.buttons?.[0]
        ?.name
    ) {
      firstBtnName =
        builtContent.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0].name;
    }

    additionalNodes.push(this.getButtonNode(firstBtnName));

    if (aimode && !isJidGroup(jid)) {
      additionalNodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    }

    /** @type {any} */
    const relayOptions = {
      ...cloneOpts,
      messageId: finalMessageId,
      additionalNodes,
    };

    try {
      const messageIdStr = await this.sock.relayMessage(jid, builtContent, relayOptions);

      /** @type {any} */
      const waMsgToCache = {
        key: {
          remoteJid: jid,
          fromMe: true,
          id: messageIdStr || finalMessageId,
        },
        message: builtContent,
        messageTimestamp: Math.floor(Date.now() / 1000),
      };

      const emitEvent = !isJidGroup(jid);
      if (this.sock.config?.emitOwnEvents && emitEvent) {
        process.nextTick(() => {
          if (this.sock.processingMutex?.mutex && this.sock.upsertMessage) {
            this.sock.processingMutex.mutex(() => this.sock.upsertMessage(waMsgToCache, 'append'));
          }
        });
      }

      return waMsgToCache;
    } catch (error) {
      this.logger?.error?.(`Erro no envio interativo: ${error}`);
      throw error;
    }
  }

  /**
   * @param {string} jid
   * @param {any} payload
   * @param {InteractiveMessageOptions} [options={}]
   */
  async sendButtons(jid, payload, options = {}) {
    if (!this.sock) {
      throw new InteractiveValidationError('Socket is required', { context: 'sendButtons' });
    }

    const {
      text = '',
      footer = '',
      title,
      subtitle,
      buttons = [],
      image,
      video,
      document,
      fileName,
      mimetype,
      isGif,
      aimode = false,
    } = payload;

    const vRes = this.validateSendButtonsPayload({ text, buttons, title, subtitle, footer });
    if (!vRes.valid) {
      throw new InteractiveValidationError('Buttons payload invalid', {
        context: 'sendButtons(validateSendButtonsPayload)',
        errors: vRes.errors,
        warnings: vRes.warnings,
        payload: payload,
      });
    }

    const normButtons = this.normalizeButtons(buttons);
    /** @type {any} */
    const interactivePayload = {
      text: text,
      footer: footer,
      interactiveButtons: normButtons,
    };

    if (title) interactivePayload.title = title;
    if (subtitle) interactivePayload.subtitle = subtitle;

    if (image) interactivePayload.image = image;
    if (video) interactivePayload.video = video;
    if (document) {
      interactivePayload.document = document;
      if (fileName) interactivePayload.fileName = fileName;
      if (mimetype) interactivePayload.mimetype = mimetype;
    }

    if (isGif !== undefined) interactivePayload.isGif = isGif;
    if (aimode !== undefined) interactivePayload.aimode = aimode;

    return this.sendInteractiveMessage(jid, interactivePayload, options);
  }

  /**
   * @param {any} payload
   */
  validateSendLegacyButtonsPayload(payload) {
    /** @type {string[]} */
    const errors = [];
    /** @type {string[]} */
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['payload must be an object'], warnings };
    }

    if (!payload.text || typeof payload.text !== 'string') {
      errors.push('text is mandatory and must be a string');
    }

    if (!Array.isArray(payload.buttons) || payload.buttons.length === 0) {
      warnings.push('buttons is empty. Válido apenas para testes de renderização visual da base.');
    } else {
      if (payload.buttons.length > 3) {
        warnings.push(
          `buttons.length > 3: historicamente o buttonsMessage legacy só renderiza até 3 botões`
        );
      }

      payload.buttons.forEach((/** @type {any} */ btn, /** @type {number} */ idx) => {
        if (!btn || typeof btn !== 'object') {
          errors.push(`buttons[ ${idx} ] must be an object`);
          return;
        }

        const id = btn.id || btn.buttonId;
        const text = btn.text || btn.displayText || btn.buttonText?.displayText;

        if (!id || typeof id !== 'string') errors.push(`buttons[ ${idx} ] missing buttonId`);
        if (!text || typeof text !== 'string') errors.push(`buttons[ ${idx} ] missing text`);
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * @param {LegacyButton[]} buttons
   * @returns {any[]}
   */
  normalizeLegacyButtons(buttons) {
    return buttons.map((btn, idx) => {
      const randomStr = Math.random().toString(36).substring(2, 8);
      const buttonId = btn.id || btn.buttonId || `legacy-btn-${idx}-${randomStr}`;
      const displayText =
        btn.text || btn.displayText || btn.buttonText?.displayText || `Botão ${idx + 1}`;

      return {
        buttonId,
        buttonText: { displayText },
        type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
      };
    });
  }

  /**
   * @param {Buffer} mediaBuffer
   * @returns {Promise<Buffer | undefined>}
   */
  async generateThumbnail(mediaBuffer) {
    return new Promise((resolve) => {
      try {
        const inputStream = Readable.from(mediaBuffer);
        /** @type {Buffer[]} */
        const chunks = [];
        const outputStream = new PassThrough();

        outputStream.on('data', (chunk) => chunks.push(chunk));
        outputStream.on('end', () => {
          const resultBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
          resolve(resultBuffer);
        });
        outputStream.on('error', () => resolve(undefined));

        ffmpeg(inputStream)
          .frames(1)
          .videoFilters(['scale=300:-1'])
          .format('image2')
          .outputOptions(['-vcodec mjpeg', '-q:v 1'])
          .on('error', (err) => {
            this.logger?.warn?.(
              `[ generateThumbnail ] Falha de processamento no FFmpeg: ${err.message}`
            );
            resolve(undefined);
          })
          .pipe(outputStream);
      } catch (error) {
        this.logger?.warn?.(`[ generateThumbnail ] Falha catastrofica de processamento: ${error}`);
        resolve(undefined);
      }
    });
  }

  /**
   * @param {LegacyButtonsPayload} payload
   * @returns {Promise<any>}
   */
  async buildLegacyButtonsMessage(payload) {
    const { text, footer = '', buttons, location = {}, contextInfo } = payload;

    let jpegThumbnail;

    if (location.jpegThumbnail) {
      let rawMediaBuffer;

      if (Buffer.isBuffer(location.jpegThumbnail)) {
        rawMediaBuffer = location.jpegThumbnail;
      } else if (location.jpegThumbnail instanceof Uint8Array) {
        rawMediaBuffer = Buffer.from(location.jpegThumbnail);
      } else if (location.jpegThumbnail instanceof ArrayBuffer) {
        rawMediaBuffer = Buffer.from(new Uint8Array(location.jpegThumbnail));
      } else if (typeof location.jpegThumbnail === 'string') {
        if (location.jpegThumbnail.startsWith('http')) {
          try {
            const response = await fetch(location.jpegThumbnail);
            const arrayBuffer = await response.arrayBuffer();
            rawMediaBuffer = Buffer.from(new Uint8Array(arrayBuffer));
          } catch (error) {
            this.logger?.warn?.(
              `[ buildLegacyButtonsMessage ] Falha no fetch da thumbnail: ${error}`
            );
          }
        } else {
          rawMediaBuffer = Buffer.from(location.jpegThumbnail, 'base64');
        }
      }

      if (rawMediaBuffer) {
        jpegThumbnail = await this.generateThumbnail(rawMediaBuffer);
      }
    }

    /** @type {any} */
    const buttonsMessage = {
      locationMessage: {
        degreesLatitude: location.degreesLatitude ?? 0,
        degreesLongitude: location.degreesLongitude ?? 0,
        name: location.name ?? '',
        address: location.address ?? '',
        ...(jpegThumbnail ? { jpegThumbnail } : {}),
      },
      contentText: text,
      footerText: footer,
      buttons: this.normalizeLegacyButtons(buttons),
      headerType: proto.Message.ButtonsMessage.HeaderType.LOCATION,
    };

    if (contextInfo) {
      buttonsMessage.contextInfo = contextInfo;
    }

    return { buttonsMessage };
  }

  /**
   * @param {string} jid
   * @param {LegacyButtonsPayload} payload
   * @param {InteractiveMessageOptions} [options={}]
   */
  async sendLegacyButtons(jid, payload, options = {}) {
    if (!this.sock) {
      throw new InteractiveValidationError('Socket is required', {
        context: 'sendLegacyButtons',
      });
    }

    const vRes = this.validateSendLegacyButtonsPayload(payload);
    if (!vRes.valid) {
      throw new InteractiveValidationError('Legacy buttons payload invalid', {
        context: 'sendLegacyButtons',
        errors: vRes.errors,
        warnings: vRes.warnings,
        payload,
      });
    }

    vRes.warnings.forEach((w) => this.logger?.warn?.(`[ sendLegacyButtons ] ${w}`));

    const builtContent = await this.buildLegacyButtonsMessage(payload);
    const finalMessageId = options.messageId || generateMessageID();

    /** @type {any[]} */
    const additionalNodes = Array.isArray(options.additionalNodes)
      ? [...options.additionalNodes]
      : [];

    additionalNodes.push(this.getButtonNode('mixed'));

    /** @type {any} */
    const relayOptions = {
      ...options,
      messageId: finalMessageId,
      additionalNodes,
    };

    try {
      const messageIdStr = await this.sock.relayMessage(jid, builtContent, relayOptions);

      /** @type {any} */
      const waMsgToCache = {
        key: {
          remoteJid: jid,
          fromMe: true,
          id: messageIdStr || finalMessageId,
        },
        message: builtContent,
        messageTimestamp: Math.floor(Date.now() / 1000),
      };

      const emitEvent = !isJidGroup(jid);
      if (this.sock.config?.emitOwnEvents && emitEvent) {
        process.nextTick(() => {
          if (this.sock.processingMutex?.mutex && this.sock.upsertMessage) {
            this.sock.processingMutex.mutex(() => this.sock.upsertMessage(waMsgToCache, 'append'));
          }
        });
      }

      return waMsgToCache;
    } catch (error) {
      this.logger?.error?.(`Erro no envio de botões legacy: ${error}`);
      throw error;
    }
  }
}
