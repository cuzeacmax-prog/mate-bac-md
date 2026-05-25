/**
 * block-parser.ts
 * Parsează răspunsurile AI care conțin markeri [[BLOCK:id:type]]..[[/BLOCK]].
 * Returneaza lista de blocuri separate pentru Block Selection UX.
 */

export interface MessageBlock {
  id: string;
  type: string;
  content: string;
  index: number;
}

export interface ParseResult {
  blocks: MessageBlock[];
  /** Conținut fără markeri (pentru fallback plain render) */
  rawContent: string;
  hasBlocks: boolean;
}

/**
 * IMPORTANT: regex-ul cu flag `g` este stateful (lastIndex).
 * Creăm o instanță nouă la fiecare apel pentru a evita bug-uri de re-utilizare.
 */
function createBlockRegex() {
  return /\[\[BLOCK:([^:\]]+):([^\]]+)\]\]([\s\S]*?)\[\[\/BLOCK\]\]/g;
}

export function parseBlocks(message: string): ParseResult {
  const blocks: MessageBlock[] = [];
  const regex = createBlockRegex();
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(message)) !== null) {
    blocks.push({
      id: match[1].trim(),
      type: match[2].trim(),
      content: match[3].trim(),
      index: index++,
    });
  }

  // Conținut fără markeri (fallback)
  const rawContent = message.replace(createBlockRegex(), (_full, _id, _type, content: string) => content);

  return {
    blocks,
    rawContent,
    hasBlocks: blocks.length > 0,
  };
}

export function getBlock(blocks: MessageBlock[], id: string): MessageBlock | undefined {
  return blocks.find((b) => b.id === id);
}

/** Determina culoarea de accent per tipul de bloc */
export function blockTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    DVA:       'border-orange-400 dark:border-orange-500',
    transform: 'border-blue-400 dark:border-blue-500',
    solve:     'border-purple-400 dark:border-purple-500',
    verify:    'border-green-400 dark:border-green-500',
    calculate: 'border-cyan-400 dark:border-cyan-500',
    deduce:    'border-indigo-400 dark:border-indigo-500',
    simplify:  'border-teal-400 dark:border-teal-500',
    factor:    'border-pink-400 dark:border-pink-500',
    substitute:'border-yellow-400 dark:border-yellow-500',
    final:     'border-emerald-500 dark:border-emerald-400',
    answer:    'border-emerald-500 dark:border-emerald-400',
    hint:      'border-gray-300 dark:border-gray-600',
  };
  return colorMap[type] ?? 'border-blue-400 dark:border-blue-500';
}
