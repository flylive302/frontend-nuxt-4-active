/**
 * Reaction Grid Utils (ADR 0015 / seat-reactions slice 03)
 *
 * Pure functions that chunk manifest entries into fixed-column rows for the
 * virtualized Reaction Drawer grid, interleaving sticky section-header rows
 * when grouped by category. No Vue reactivity, no store imports.
 */
import type { ReactionManifestEntry } from '~/constants/reactions-manifest';
import type { ReactionCatalogSection } from '~/composables/room/useReactionCatalog';

export type ReactionGridRow =
  | { key: string; kind: 'header'; category: string }
  | { key: string; kind: 'row'; entries: ReactionManifestEntry[] };

/** Chunk a flat entry list into fixed-width rows (no section headers). */
export function buildFlatReactionRows(
  entries: readonly ReactionManifestEntry[],
  columns: number,
): ReactionGridRow[] {
  const rows: ReactionGridRow[] = [];
  for (let i = 0; i < entries.length; i += columns) {
    rows.push({ key: `row-${i}`, kind: 'row', entries: entries.slice(i, i + columns) });
  }
  return rows;
}

/** Chunk sections into rows, inserting a sticky header row before each section. */
export function buildSectionedReactionRows(
  sections: readonly ReactionCatalogSection[],
  columns: number,
): ReactionGridRow[] {
  const rows: ReactionGridRow[] = [];
  for (const section of sections) {
    rows.push({ key: `header-${section.category}`, kind: 'header', category: section.category });
    for (let i = 0; i < section.entries.length; i += columns) {
      rows.push({
        key: `row-${section.category}-${i}`,
        kind: 'row',
        entries: section.entries.slice(i, i + columns),
      });
    }
  }
  return rows;
}

/** Find the row index of a category's header row, for tab jump-to-section. */
export function findSectionHeaderIndex(rows: readonly ReactionGridRow[], category: string): number {
  return rows.findIndex((row) => row.kind === 'header' && row.category === category);
}
