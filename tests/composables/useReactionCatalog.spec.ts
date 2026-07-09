import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

beforeEach(() => {
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useReactionCatalog', () => {
  it('groups entries by category, preserving manifest order', async () => {
    const { useReactionCatalog } = await import('../../app/composables/room/useReactionCatalog');
    const { REACTIONS } = await import('../../app/constants/reactions-manifest');

    const { sections, categories } = useReactionCatalog();

    const expectedOrder: string[] = [];
    for (const entry of REACTIONS) {
      if (!expectedOrder.includes(entry.category)) expectedOrder.push(entry.category);
    }

    expect(categories.value).toEqual(expectedOrder);
    expect(sections.value.reduce((sum, s) => sum + s.entries.length, 0)).toBe(REACTIONS.length);
  });

  it('is not searching when the query is empty', async () => {
    const { useReactionCatalog } = await import('../../app/composables/room/useReactionCatalog');
    const { isSearching, searchResults } = useReactionCatalog();

    expect(isSearching.value).toBe(false);
    expect(searchResults.value).toEqual([]);
  });

  it('filters by name substring, case-insensitively', async () => {
    const { useReactionCatalog } = await import('../../app/composables/room/useReactionCatalog');
    const { query, isSearching, searchResults } = useReactionCatalog();

    query.value = 'SMILE';

    expect(isSearching.value).toBe(true);
    expect(searchResults.value.length).toBeGreaterThan(0);
    expect(searchResults.value.every((e) => e.name.toLowerCase().includes('smile') || e.tags.some((t) => t.toLowerCase().includes('smile')))).toBe(true);
  });

  it('filters by tag substring', async () => {
    const { useReactionCatalog } = await import('../../app/composables/room/useReactionCatalog');
    const { REACTIONS } = await import('../../app/constants/reactions-manifest');
    const { query, searchResults } = useReactionCatalog();

    const taggedEntry = REACTIONS.find((e) => e.tags.length > 0 && !e.name.toLowerCase().includes(e.tags[0]!.toLowerCase()));
    expect(taggedEntry).toBeDefined();

    query.value = taggedEntry!.tags[0]!;

    expect(searchResults.value.some((e) => e.code === taggedEntry!.code)).toBe(true);
  });
});
