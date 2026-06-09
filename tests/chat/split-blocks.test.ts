import { describe, it, expect } from 'vitest';
import { splitMarkdownBlocks } from '@/app/app/chat/_components/MessageRenderer';

describe('splitMarkdownBlocks (ETAPA 66 E1)', () => {
  it('paragrafe separate de linii goale → blocuri separate', () => {
    expect(splitMarkdownBlocks('unu\n\ndoi\n\ntrei')).toEqual(['unu', 'doi', 'trei']);
  });

  it('NU rupe display math $$...$$ cu linii goale înăuntru', () => {
    const md = 'text\n\n$$\nx^2\n\n+ 1\n$$\n\nfinal';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toContain('$$');
    expect(blocks[1]).toContain('+ 1');
  });

  it('NU rupe code fence cu linii goale înăuntru', () => {
    const md = 'a\n\n```\nlinia 1\n\nlinia 2\n```\n\nb';
    const blocks = splitMarkdownBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toContain('linia 2');
  });

  it('tabelele markdown rămân într-un singur bloc', () => {
    const md = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(splitMarkdownBlocks(md)).toHaveLength(1);
  });

  it('concatenarea blocurilor reconstituie conținutul (fără liniile goale separatoare)', () => {
    const md = 'unu\n\ndoi $x$\n\ntrei';
    expect(splitMarkdownBlocks(md).join('\n\n')).toBe(md);
  });

  it('string gol → zero blocuri', () => {
    expect(splitMarkdownBlocks('')).toEqual([]);
  });
});
