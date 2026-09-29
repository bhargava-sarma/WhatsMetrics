import { unzipSync } from 'fflate';
import { ChatParseError } from './types';

export interface ChatSource {
  text: string;
  fileName: string;
}

const isZip = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

function decode(bytes: Uint8Array): string {
  // UTF-16 exports exist on some Windows tools; WhatsApp itself writes UTF-8.
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Pull the chat transcript out of a WhatsApp export. Accepts the plain .txt or the
 * .zip WhatsApp produces (iOS always zips; Android zips when media is included).
 * Only .txt entries are decompressed, so large media archives stay cheap.
 */
export function extractChatText(bytes: Uint8Array, fileName: string): ChatSource {
  if (!isZip(bytes)) return { text: decode(bytes), fileName };

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: (f) => /\.txt$/i.test(f.name) && !/__MACOSX\//.test(f.name) });
  } catch {
    throw new ChatParseError('This .zip file could not be opened. Try exporting the chat again.');
  }
  const names = Object.keys(entries);
  if (names.length === 0) {
    throw new ChatParseError('No chat transcript (.txt) was found inside this .zip file.');
  }
  const preferred =
    names.find((n) => /(^|\/)_chat\.txt$/i.test(n)) ??
    names.find((n) => /whatsapp/i.test(n)) ??
    names.sort((x, y) => entries[y].length - entries[x].length)[0];
  // The zip's own name carries the chat title ("WhatsApp Chat - Friends.zip").
  return { text: decode(entries[preferred]), fileName };
}

export async function readChatFile(file: File): Promise<ChatSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return extractChatText(bytes, file.name);
}
