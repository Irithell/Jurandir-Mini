import { proto, WASocket, WAMessage } from '@whiskeysockets/baileys';

export type MediaType = 'image' | 'video' | 'document';

export type ButtonType =
  | 'reply'
  | 'list'
  | 'url'
  | 'webview'
  | 'open_webview'
  | 'copy'
  | 'call'
  | 'catalog'
  | 'location'
  | 'pix'
  | 'pix_static'
  | 'boleto'
  | 'payment_link'
  | 'card_pay'
  | 'reminder'
  | 'cta_reminder'
  | 'cancel_reminder'
  | 'cta_cancel_reminder'
  | 'mpm'
  | 'catalog_message'
  | 'view_catalog'
  | 'automated_greeting_message_view_catalog'
  | 'transaction_details'
  | 'wa_payment_transaction_details'
  | 'galaxy'
  | 'galaxy_message'
  | 'flow';

export interface NativeButton {
  name: string;
  buttonParamsJson: string;
}

export interface CleanReplyButton {
  type: 'reply';
  id: string;
  text: string;
  icon?: string;
}

export interface CleanListSection {
  title: string;
  highlight_label?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export interface CleanListButton {
  type: 'list';
  text: string;
  sections: Array<CleanListSection>;
  icon?: string;
}

export interface CleanUrlButton {
  type: 'url';
  text: string;
  url: string;
  icon?: string;
}

export interface CleanWebviewButton {
  type: 'webview' | 'open_webview';
  text: string;
  url: string;
  title?: string;
  displayText?: string;
  inAppWebview?: boolean;
  fullScreen?: boolean;
  link?: {
    url: string;
    in_app_webview?: boolean;
    full_screen?: boolean;
  };
  icon?: string;
}

export interface CleanCopyButton {
  type: 'copy';
  text: string;
  payload: string;
  id?: string;
  icon?: string;
}

export interface CleanCallButton {
  type: 'call';
  text: string;
  phone: string;
  icon?: string;
}

export interface CleanCatalogButton {
  type: 'catalog';
  text: string;
  phone: string;
  icon?: string;
}

export interface CleanLocationButton {
  type: 'location';
  text?: string;
  icon?: string;
}

export interface CleanPixButton {
  type: 'pix';
  referenceId: string;
  amount: number;
  merchantName: string;
  pixCode: string;
  pixKey: string;
  keyType: 'PHONE' | 'CPF' | 'CNPJ' | 'EMAIL' | 'EVP';
}

export interface CleanStaticPixButton {
  type: 'pix_static';
  referenceId: string;
  amount: number;
  merchantName: string;
  pixKey: string;
  keyType: 'PHONE' | 'CPF' | 'CNPJ' | 'EMAIL' | 'EVP';
  itemName?: string;
}

export interface CleanBoletoButton {
  type: 'boleto';
  referenceId: string;
  amount: number;
  digitableLine: string;
}

export interface CleanPaymentLinkButton {
  type: 'payment_link';
  referenceId: string;
  amount: number;
  uri: string;
}

export interface CleanCardPayButton {
  type: 'card_pay';
  referenceId: string;
  amount: number;
  lastFourDigits: string;
  credentialId: string;
}

export interface CleanReminderButton {
  type: 'reminder' | 'cta_reminder';
  text: string;
  icon?: string;
}

export interface CleanCancelReminderButton {
  type: 'cancel_reminder' | 'cta_cancel_reminder';
  text: string;
  icon?: string;
}

export interface CleanMpmButton {
  type: 'mpm';
  text?: string;
  title?: string;
  sections: Array<{
    title: string;
    highlight_label?: string;
    rows: Array<{
      id?: string;
      product_retailer_id?: string;
      title?: string;
      description?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  icon?: string;
}

export interface CleanCatalogMessageButton {
  type: 'catalog_message';
  text?: string;
  businessPhoneNumber?: string;
  icon?: string;
}

export interface CleanAutomatedGreetingButton {
  type: 'view_catalog' | 'automated_greeting_message_view_catalog';
  text?: string;
  businessPhoneNumber: string;
  catalogProductId: string;
  icon?: string;
}

export interface CleanWaPaymentTransactionDetailsButton {
  type: 'transaction_details' | 'wa_payment_transaction_details';
  text?: string;
  transactionId: string;
  icon?: string;
}

export interface CleanGalaxyButton {
  type: 'galaxy' | 'galaxy_message' | 'flow';
  text?: string;
  flowCta?: string;
  flowAction?: 'navigate' | 'data_exchange';
  flowMessageVersion?: string;
  flowScreen?: string;
  flowPayload?: Record<string, unknown>;
  icon?: string;
}

export type CleanButton =
  | CleanReplyButton
  | CleanListButton
  | CleanUrlButton
  | CleanWebviewButton
  | CleanCopyButton
  | CleanCallButton
  | CleanCatalogButton
  | CleanLocationButton
  | CleanPixButton
  | CleanStaticPixButton
  | CleanBoletoButton
  | CleanPaymentLinkButton
  | CleanCardPayButton
  | CleanReminderButton
  | CleanCancelReminderButton
  | CleanMpmButton
  | CleanCatalogMessageButton
  | CleanAutomatedGreetingButton
  | CleanWaPaymentTransactionDetailsButton
  | CleanGalaxyButton;

export interface InteractiveCardHeader {
  title?: string;
  subtitle?: string;
  mediaUrl?: string;
  mediaPath?: string;
  mediaBuffer?: Buffer;
  mediaType?: MediaType;
  isGif?: boolean;
  fileName?: string;
  mimetype?: string;
}

export interface InteractiveCard {
  header?: InteractiveCardHeader;
  body: string;
  footer?: string;
  buttons: Array<CleanButton>;
}

export interface BottomSheetConfig {
  inThreadButtonsLimit?: number;
  dividerIndices?: number[];
  listTitle?: string;
  buttonTitle?: string;
}

export interface MessageParamsConfig {
  bottomSheet?: BottomSheetConfig;
  [key: string]: any;
}

export interface InteractivePayload {
  bodyText?: string;
  asCarousel?: boolean;
  aimode?: boolean;
  legacy?: boolean;
  messageParams?: MessageParamsConfig;
  messageParamsJson?: string | Record<string, any>;
  cards: Array<InteractiveCard>;
  quotedMessage?: WAMessage;
  mentions?: Array<string>;
}

export interface InteractiveButton {
  name?: string;
  buttonParamsJson?: string;
  id?: string;
  text?: string;
  displayText?: string;
  buttonId?: string;
  buttonText?: { displayText: string };
}

export interface InteractiveContent {
  text?: string;
  body?: string;
  footer?: string;
  title?: string;
  subtitle?: string;
  image?: { url: string } | { buffer: Buffer };
  video?: { url: string } | { buffer: Buffer };
  document?: { url: string } | { buffer: Buffer };
  fileName?: string;
  mimetype?: string;
  isGif?: boolean;
  aimode?: boolean;
  interactiveButtons?: Array<InteractiveButton>;
  buttons?: Array<InteractiveButton>;
}

export interface InteractiveMessageOptions {
  messageId?: string;
  additionalNodes?: Array<unknown>;
  additionalAttributes?: Record<string, string>;
  aimode?: boolean;
  useCachedGroupMetadata?: boolean;
  statusJidList?: Array<string>;
}

export interface LegacyButton {
  id?: string;
  buttonId?: string;
  text?: string;
  displayText?: string;
  buttonText?: { displayText: string };
}

export interface LegacyButtonsLocation {
  degreesLatitude?: number;
  degreesLongitude?: number;
  name?: string;
  address?: string;
  jpegThumbnail?: string | Buffer | ArrayBufferLike | Uint8Array;
}

export interface LegacyButtonsPayload {
  text: string;
  footer?: string;
  buttons: Array<LegacyButton>;
  location?: LegacyButtonsLocation;
  contextInfo?: proto.IContextInfo;
}
