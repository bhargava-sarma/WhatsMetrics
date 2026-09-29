export type MessageKind =
  | 'text'
  | 'media'
  | 'deleted'
  | 'poll'
  | 'event'
  | 'location'
  | 'contact'
  | 'call';

export type MediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'sticker'
  | 'gif'
  | 'document'
  | 'other';

export interface PollOption {
  label: string;
  votes: number;
}

export interface Poll {
  question: string;
  options: PollOption[];
}

export interface ChatMessage {
  /**
   * Wall-clock time of the message encoded as a UTC epoch (ms).
   * Exports carry no time zone, so always read it back with getUTC* methods.
   */
  ts: number;
  /** Index into `ParsedChat.participants`. */
  author: number;
  kind: MessageKind;
  /** Message text with WhatsApp markers stripped (captions for media, title for events). */
  text: string;
  edited: boolean;
  media?: MediaKind;
  poll?: Poll;
}

export type SystemEventKind =
  | 'encryption'
  | 'created'
  | 'added'
  | 'removed'
  | 'left'
  | 'joined'
  | 'subject'
  | 'icon'
  | 'description'
  | 'pinned'
  | 'security'
  | 'number'
  | 'admin'
  | 'disappearing'
  | 'call'
  | 'other';

export interface SystemEvent {
  ts: number;
  kind: SystemEventKind;
  text: string;
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD';

export interface ParsedChat {
  messages: ChatMessage[];
  participants: string[];
  system: SystemEvent[];
  meta: {
    platform: 'android' | 'ios';
    dateOrder: DateOrder;
    clock: '12h' | '24h';
    /** Group name recovered from system messages (created group / subject changes). */
    chatName: string | null;
    lineCount: number;
    /** Lines before the first recognizable message header. */
    skippedLines: number;
  };
}

export class ChatParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatParseError';
  }
}
