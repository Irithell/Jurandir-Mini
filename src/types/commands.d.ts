import { WASocket, WAMessage, GroupMetadata, WAMessageContent } from '@whiskeysockets/baileys';
import Database from 'better-sqlite3';
import { InteractivePayload } from './buttons';
import { ExtractedMessageData } from './baileys';

export interface BotConfig {
  name: string;
  prefix: string;
  buttons: 0 | 1 | 2;
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
  wrapTextForDecoration: (text?: string | null, maxChars?: number, prefix?: string) => string;
  wrapQuotedText: (text?: string | null, maxChars?: number) => string;
  wrapPatternDecoration: (text?: string | null, maxChars?: number) => string;
  wrapBracketText: (text?: string | null, maxChars?: number) => string;
  wrapBracketDecoration: (text?: string | null, maxChars?: number) => string;

  logger: any;
  cache: any;

  sendTyping: (jurandir: WASocket, from: string) => Promise<void>;
  sendRecording: (jurandir: WASocket, from: string) => Promise<void>;

  sendText: (jurandir: WASocket, from: string, text: string, mentions?: string[]) => Promise<any>;
  reply: (
    jurandir: WASocket,
    from: string,
    text: string,
    quotedMessage: WAMessage,
    mentions?: string[]
  ) => Promise<any>;

  react: (jurandir: WASocket, from: string, emoji: string, messageKey: any) => Promise<any>;
  successReact: (jurandir: WASocket, from: string, messageKey: any) => Promise<any>;
  errorReact: (jurandir: WASocket, from: string, messageKey: any) => Promise<any>;
  waitReact: (jurandir: WASocket, from: string, messageKey: any) => Promise<any>;
  warningReact: (jurandir: WASocket, from: string, messageKey: any) => Promise<any>;

  successReply: (
    jurandir: WASocket,
    from: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  errorReply: (
    jurandir: WASocket,
    from: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  waitReply: (
    jurandir: WASocket,
    from: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;
  warningReply: (
    jurandir: WASocket,
    from: string,
    text: string,
    quotedMessage: WAMessage
  ) => Promise<void>;

  sendImage: (
    jurandir: WASocket,
    from: string,
    imagePath: string,
    caption?: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendVideo: (
    jurandir: WASocket,
    from: string,
    videoPath: string,
    caption?: string,
    quotedMessage?: WAMessage,
    gifPlayback?: boolean
  ) => Promise<any>;
  sendAudio: (
    jurandir: WASocket,
    from: string,
    audioPath: string,
    ptt?: boolean,
    mimetype?: string
  ) => Promise<any>;
  sendSticker: (
    jurandir: WASocket,
    from: string,
    stickerPath: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendStickerFromUrl: (
    jurandir: WASocket,
    from: string,
    url: string,
    quotedMessage?: WAMessage
  ) => Promise<any>;
  sendDocument: (
    jurandir: WASocket,
    from: string,
    documentPath: string,
    fileName: string,
    mimetype: string,
    caption?: string
  ) => Promise<any>;
  sendLocation: (
    jurandir: WASocket,
    from: string,
    latitude: number,
    longitude: number,
    name?: string
  ) => Promise<any>;
  sendContact: (
    jurandir: WASocket,
    from: string,
    contactJid: string,
    displayName: string
  ) => Promise<any>;

  sendText2: (jurandir: WASocket, from: string, text: string, mentions?: string[]) => Promise<any>;
  reply2: (jurandir: WASocket, from: string, text: string, mentions?: string[]) => Promise<any>;
  successReply2: (
    jurandir: WASocket,
    from: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  errorReply2: (
    jurandir: WASocket,
    from: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  waitReply2: (
    jurandir: WASocket,
    from: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  warningReply2: (
    jurandir: WASocket,
    from: string,
    text: string,
    messageKey: any,
    mentions?: string[]
  ) => Promise<void>;
  sendImage2: (
    jurandir: WASocket,
    from: string,
    imagePath: string,
    caption?: string
  ) => Promise<any>;
  sendVideo2: (
    jurandir: WASocket,
    from: string,
    videoPath: string,
    caption?: string,
    gifPlayback?: boolean
  ) => Promise<any>;
  sendSticker2: (jurandir: WASocket, from: string, stickerPath: string) => Promise<any>;
  sendStickerFromUrl2: (jurandir: WASocket, from: string, url: string) => Promise<any>;

  sendButton: (jurandir: WASocket, from: string, payload: InteractivePayload) => Promise<any>;

  [key: string]: any;
}

export interface CommandContext {
  sock: WASocket;
  client: WASocket;
  jurandir: WASocket;
  botName: string;
  prefix: string;
  config: BotConfig;
  botConfig: BotConfig;
  message: WAMessageContent | null;
  rawMessage: WAMessage;
  event: WAMessage;
  info: WAMessage;
  messageData: ExtractedMessageData;
  db: Database.Database;
  from: string;
  chat: string;
  userJid: string;
  sender: string;
  senderJid: string;
  clearLid: string;
  clearJid: string;
  senderAlt: string;
  recipientAlt: string;
  addressingMode: string;
  formattedSender: string;
  pushName: string;
  isOwner: boolean;
  isAdmin: boolean;
  isBotAdmin: boolean;
  isJurandir: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  isNewsletter: boolean;
  isStatus: boolean;
  groupMetadata: GroupMetadata | null;
  groupName: string;
  groupOwner: string;
  groupParticipants: any[];
  messageId: string;
  timestamp: number;
  serverId: number;
  type: string;
  category: string;
  mediaType: string;
  isEphemeral: boolean;
  isViewOnce: boolean;
  isEdit: boolean;
  isBotInvoke: boolean;
  isFromMe: boolean;
  isReply: boolean;
  replyJid: string | null;
  command: string;
  args: string[];
  fullArgs: string;
  body: string;
  os: typeof import('node:os');
  uptime: number;
  ramUsada: number;
  ramTotal: number;

  utils: CommandUtils;

  sleep: (ms: number) => Promise<void>;
  forward: (data: any) => void;

  [key: string]: any;
}

export interface CommandMetadata {
  name: string;
  category: string;
  description: string;
  aliases: string[];
  isSubmenu?: boolean;
}

export interface CommandEntry extends CommandMetadata {
  execute: CommandFunction;
}

export interface CommandFunction {
  (ctx: CommandContext): Promise<void>;
  category?: string;
  description?: string;
  isAlias?: boolean;
  name?: string;
  aliases?: string[];
  isSubmenu?: boolean;
}
