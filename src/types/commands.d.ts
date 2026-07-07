import { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { InteractivePayload, MediaType } from './messages';

export interface BotConfig {
  name: string;
  prefix: string;
  owner: {
    name: string;
    phones: string[];
  };
  assets: {
    primary: {
      headerImage: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface CommandUtils {
  formatUptime: (milliseconds: number) => string;
  formatBytes: (bytes: number) => string;
  toUnicodeBoldUpper: (text: string) => string;

  logger: any;
  cache: any;

  // ========== PRESENCE ==========
  sendTyping: (jurandir: WASocket, jid: string) => Promise<void>;
  sendRecording: (jurandir: WASocket, jid: string) => Promise<void>;

  // ========== TEXTOS E RESPOSTAS COM QUOTED ==========
  sendText: (jurandir: WASocket, jid: string, text: string, mentions?: string[]) => Promise<any>;
  reply: (
    jurandir: WASocket,
    jid: string,
    text: string,
    quotedMessage: WAMessage,
    mentions?: string[]
  ) => Promise<any>;

  // ========== REAÇÕES ==========
  react: (jurandir: WASocket, jid: string, emoji: string, messageKey: any) => Promise<any>;
  successReact: (jurandir: WASocket, jid: string, messageKey: any) => Promise<any>;
  errorReact: (jurandir: WASocket, jid: string, messageKey: any) => Promise<any>;
  waitReact: (jurandir: WASocket, jid: string, messageKey: any) => Promise<any>;
  warningReact: (jurandir: WASocket, jid: string, messageKey: any) => Promise<any>;

  // ========== RESPOSTAS COM REAÇÕES (QUOTED) ==========
  successReply: (
    jurandir: WASocket,
    jid: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  errorReply: (
    jurandir: WASocket,
    jid: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  waitReply: (
    jurandir: WASocket,
    jid: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  warningReply: (
    jurandir: WASocket,
    jid: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;

  // ========== MÍDIA COM QUOTED ==========
  sendImage: (
    jurandir: WASocket,
    jid: string,
    imagePath: string,
    caption?: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendVideo: (
    jurandir: WASocket,
    jid: string,
    videoPath: string,
    caption?: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendAudio: (jurandir: WASocket, jid: string, audioPath: string, ptt?: boolean) => Promise<any>;
  sendSticker: (
    jurandir: WASocket,
    jid: string,
    stickerPath: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendStickerFromUrl: (
    jurandir: WASocket,
    jid: string,
    url: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendDocument: (
    jurandir: WASocket,
    jid: string,
    documentPath: string,
    fileName: string,
    mimetype: string,
    caption?: string
  ) => Promise<any>;
  sendLocation: (
    jurandir: WASocket,
    jid: string,
    latitude: number,
    longitude: number,
    name?: string
  ) => Promise<any>;
  sendContact: (
    jurandir: WASocket,
    jid: string,
    contactJid: string,
    displayName: string
  ) => Promise<any>;

  // ========== VERSÕES SEM QUOTED (2) ==========
  sendText2: (jurandir: WASocket, jid: string, text: string, mentions?: string[]) => Promise<any>;
  reply2: (jurandir: WASocket, jid: string, text: string, mentions?: string[]) => Promise<any>;
  successReply2: (
    jurandir: WASocket,
    jid: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  errorReply2: (
    jurandir: WASocket,
    jid: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  waitReply2: (
    jurandir: WASocket,
    jid: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  warningReply2: (
    jurandir: WASocket,
    jid: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  sendImage2: (
    jurandir: WASocket,
    jid: string,
    imagePath: string,
    caption?: string
  ) => Promise<any>;
  sendVideo2: (
    jurandir: WASocket,
    jid: string,
    videoPath: string,
    caption?: string
  ) => Promise<any>;
  sendSticker2: (jurandir: WASocket, jid: string, stickerPath: string) => Promise<any>;
  sendStickerFromUrl2: (jurandir: WASocket, jid: string, url: string) => Promise<any>;

  // ========== INTERACTIVE MESSAGES ==========
  sendTextWithMedia: (
    jurandir: WASocket,
    to: string,
    mediaUrl: string,
    mediaType: MediaType,
    caption?: string,
    quotedMessage?: WAMessage
  ) => Promise<void>;
  sendButton: (jurandir: WASocket, to: string, payload: InteractivePayload) => Promise<void>;

  [key: string]: any;
}

export interface CommandContext {
  jurandir: WASocket;
  from: string;
  info: WAMessage;
  body: string;
  command: string;
  args: string[];
  prefix: string;
  userJid: string;
  isGroup: boolean;
  botConfig: BotConfig;
  os: typeof import('node:os');
  uptime: number;
  ramUsada: number;
  ramTotal: number;

  utils: CommandUtils;

  sleep: (ms: number) => Promise<void>;
  forward: (data: any) => void;

  [key: string]: any;
}

export interface CommandFunction {
  (ctx: CommandContext): Promise<void>;
  category?: string;
  description?: string;
  isAlias?: boolean;
}
