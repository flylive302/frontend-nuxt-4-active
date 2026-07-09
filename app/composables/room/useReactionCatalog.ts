/**
 * Reaction Catalog Composable (ADR 0015 / seat-reactions slice 03)
 *
 * Data/Query composable: derives category sections (manifest order preserved)
 * and a client-side search filter (name + tags) over the generated Reaction
 * Manifest. Pure derived state only — no sockets, no store writes.
 */
import { REACTIONS, type ReactionManifestEntry } from '~/constants/reactions-manifest';
import { REACTION_SEARCH_MIN_CHARS } from '~/constants/reactions';

export interface ReactionCatalogSection {
  category: string;
  entries: ReactionManifestEntry[];
}

export interface UseReactionCatalogReturn {
  /** Search query, bindable to a search box. */
  query: Ref<string>;
  /** All categories in manifest order, each with its entries. */
  sections: ComputedRef<ReactionCatalogSection[]>;
  /** Category labels only, manifest order — for the tab strip. */
  categories: ComputedRef<string[]>;
  /** True while a non-empty search query is active (flat-grid mode). */
  isSearching: ComputedRef<boolean>;
  /** Flat, filtered entries when searching (name + tags substring match). */
  searchResults: ComputedRef<ReactionManifestEntry[]>;
}

function matchesQuery(entry: ReactionManifestEntry, needle: string): boolean {
  if (entry.name.toLowerCase().includes(needle)) return true;
  return entry.tags.some((tag) => tag.toLowerCase().includes(needle));
}

/** Group manifest entries by category, preserving first-seen (manifest) order. */
function groupByCategory(entries: readonly ReactionManifestEntry[]): ReactionCatalogSection[] {
  const order: string[] = [];
  const byCategory = new Map<string, ReactionManifestEntry[]>();

  for (const entry of entries) {
    if (!byCategory.has(entry.category)) {
      byCategory.set(entry.category, []);
      order.push(entry.category);
    }
    byCategory.get(entry.category)!.push(entry);
  }

  return order.map((category) => ({ category, entries: byCategory.get(category)! }));
}

export function useReactionCatalog(): UseReactionCatalogReturn {
  const query = ref('');

  const sections = computed<ReactionCatalogSection[]>(() => groupByCategory(REACTIONS));

  const categories = computed<string[]>(() => sections.value.map((section) => section.category));

  const normalizedQuery = computed(() => query.value.trim().toLowerCase());

  const isSearching = computed(() => normalizedQuery.value.length >= REACTION_SEARCH_MIN_CHARS);

  const searchResults = computed<ReactionManifestEntry[]>(() => {
    if (!isSearching.value) return [];
    const needle = normalizedQuery.value;
    return REACTIONS.filter((entry) => matchesQuery(entry, needle));
  });

  return {
    query,
    sections,
    categories,
    isSearching,
    searchResults,
  };
}
