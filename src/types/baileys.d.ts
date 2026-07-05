import { WAMessage } from '@whiskeysockets/baileys';

export interface ExtractedMessageContent {
  type: string;
  content: any;
  metadata?: any;
  isViewOnce: boolean;
}

export interface ExtractedMessageData {
  args: string[];
  body: string;
  command: string;
  from: string;
  fullArgs: string;
  isReply: boolean;
  prefix: string;
  replyJid: string | null;
  userJid: string;
  isGroup: boolean;
  messageType: string;
  messageContent: ExtractedMessageContent;
  rawMessage: WAMessage;
}
