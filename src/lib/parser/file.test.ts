import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { extractChatText } from './file';
import { ChatParseError } from './types';

describe('extractChatText', () => {
  it('passes plain text through', () => {
    const out = extractChatText(strToU8('1/1/24, 9:00 AM - A: hi'), 'WhatsApp Chat with A.txt');
    expect(out.text).toBe('1/1/24, 9:00 AM - A: hi');
  });

  it('strips a UTF-8 BOM only at parse time, keeping text intact here', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('x')]);
    expect(extractChatText(bytes, 'a.txt').text).toBe('x');
  });

  it('finds _chat.txt inside an iOS zip and ignores media', () => {
    const zip = zipSync({
      '_chat.txt': strToU8('[1/1/24, 9:00:00 AM] A: hi'),
      '00000001-PHOTO-2024-01-01-09-00-00.jpg': new Uint8Array(2048),
    });
    const out = extractChatText(zip, 'WhatsApp Chat - Crew.zip');
    expect(out.text).toBe('[1/1/24, 9:00:00 AM] A: hi');
    expect(out.fileName).toBe('WhatsApp Chat - Crew.zip');
  });

  it('falls back to any WhatsApp .txt in an Android zip', () => {
    const zip = zipSync({
      'WhatsApp Chat with Crew.txt': strToU8('1/1/24, 9:00 AM - A: hi'),
      'IMG-20240101-WA0001.jpg': new Uint8Array(16),
    });
    expect(extractChatText(zip, 'export.zip').text).toBe('1/1/24, 9:00 AM - A: hi');
  });

  it('errors when a zip has no transcript', () => {
    const zip = zipSync({ 'photo.jpg': new Uint8Array(16) });
    expect(() => extractChatText(zip, 'x.zip')).toThrow(ChatParseError);
  });
});
