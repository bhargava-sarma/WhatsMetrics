import { chatNameFromFileName, parseChat } from '../parser/parse';
import type { ParsedChat } from '../parser/types';
import { analyze } from '../analysis/analyze';
import type { AnalyzeOptions, Report } from '../analysis/types';

export type Stage = 'reading' | 'parsing' | 'analyzing' | 'rendering';

/** Holds the parsed chat so period / setting changes only re-run the analysis. */
export class EngineCore {
  private chat: ParsedChat | null = null;
  private fileName = '';
  private chatName = '';

  load(text: string, fileName: string, onStage: (s: Stage) => void): void {
    onStage('parsing');
    const chat = parseChat(text);
    this.chat = chat;
    this.fileName = fileName;
    this.chatName = chat.meta.chatName ?? chatNameFromFileName(fileName) ?? defaultName(chat);
  }

  analyze(options: AnalyzeOptions, onStage: (s: Stage) => void): Report {
    if (!this.chat) throw new Error('No chat loaded.');
    onStage('analyzing');
    return analyze(this.chat, this.fileName, this.chatName, options);
  }
}

function defaultName(chat: ParsedChat): string {
  const humans = chat.participants.filter((p) => !/^meta ai$/i.test(p));
  if (humans.length === 2) return `${humans[0]} & ${humans[1]}`;
  return 'Group chat';
}
