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
  sender: string;
  senderJid: string;
  clearLid: string;
  clearJid: string;
  senderAlt: string;
  recipientAlt: string;
  addressingMode: string;
  formattedSender: string;
  pushName: string;
  isGroup: boolean;
  isPrivate: boolean;
  isNewsletter: boolean;
  isStatus: boolean;
  messageId: string;
  timestamp: number;
  serverId: number;
  isEphemeral: boolean;
  isViewOnce: boolean;
  isEdit: boolean;
  isBotInvoke: boolean;
  isFromMe: boolean;
  category: string;
  mediaType: string;
  messageType: string;
  messageContent: ExtractedMessageContent;
  rawMessage: WAMessage;
}
