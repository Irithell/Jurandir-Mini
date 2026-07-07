import { proto } from '@whiskeysockets/baileys';
import { WASocket, WAMessage } from '@whiskeysockets/baileys';

export type MediaType = 'image' | 'video';

export interface CleanReplyButton {
  type: 'reply';
  id: string;
  text: string;
}

export interface CleanListButton {
  type: 'list';
  text: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface CleanUrlButton {
  type: 'url';
  text: string;
  url: string;
}

export interface CleanCopyButton {
  type: 'copy';
  text: string;
  payload: string;
  id?: string;
}

export type CleanButton = CleanReplyButton | CleanListButton | CleanUrlButton | CleanCopyButton;

export interface InteractiveCard {
  header?: {
    mediaUrl?: string;
    mediaBuffer?: Buffer;
    mediaType?: 'image' | 'video';
    isGif?: boolean;
  };
  body: string;
  footer?: string;
  buttons: CleanButton[];
}

export interface InteractivePayload {
  bodyText?: string;
  cards: InteractiveCard[];
  quotedMessage?: proto.IWebMessageInfo;
  mentions?: string[];
}
