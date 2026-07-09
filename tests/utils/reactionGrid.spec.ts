import { describe, expect, it } from 'vitest';
import {
  buildFlatReactionRows,
  buildSectionedReactionRows,
  findSectionHeaderIndex,
} from '../../app/utils/reactionGrid';
import type { ReactionManifestEntry } from '../../app/constants/reactions-manifest';
import type { ReactionCatalogSection } from '../../app/composables/room/useReactionCatalog';

function entry(code: string, category = 'Smileys'): ReactionManifestEntry {
  return { code, name: code, category, tags: [] };
}

describe('buildFlatReactionRows', () => {
  it('chunks entries into fixed-width rows', () => {
    const entries = [entry('a'), entry('b'), entry('c'), entry('d'), entry('e')];
    const rows = buildFlatReactionRows(entries, 4);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'row', entries: [entry('a'), entry('b'), entry('c'), entry('d')] });
    expect(rows[1]).toMatchObject({ kind: 'row', entries: [entry('e')] });
  });

  it('returns no rows for an empty list', () => {
    expect(buildFlatReactionRows([], 4)).toEqual([]);
  });
});

describe('buildSectionedReactionRows', () => {
  it('inserts one header row before each section, then chunks its entries', () => {
    const sections: ReactionCatalogSection[] = [
      { category: 'Smileys', entries: [entry('a'), entry('b'), entry('c'), entry('d'), entry('e')] },
      { category: 'Animals', entries: [entry('f')] },
    ];
    const rows = buildSectionedReactionRows(sections, 4);

    expect(rows.map((r) => r.kind)).toEqual(['header', 'row', 'row', 'header', 'row']);
    expect(rows[0]).toMatchObject({ kind: 'header', category: 'Smileys' });
    expect(rows[3]).toMatchObject({ kind: 'header', category: 'Animals' });
  });
});

describe('findSectionHeaderIndex', () => {
  it('finds the header row index for a category', () => {
    const sections: ReactionCatalogSection[] = [
      { category: 'Smileys', entries: [entry('a')] },
      { category: 'Animals', entries: [entry('b')] },
    ];
    const rows = buildSectionedReactionRows(sections, 4);

    expect(findSectionHeaderIndex(rows, 'Animals')).toBe(2);
  });

  it('returns -1 when the category is not present', () => {
    expect(findSectionHeaderIndex([], 'Missing')).toBe(-1);
  });
});
