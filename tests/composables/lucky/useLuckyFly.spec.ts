/**
 * useLuckyFly — concurrency cap (gift-burst-seat-drop).
 *
 * A lucky combo fires one fly per un-seen leg. Each fly costs two forced
 * layouts plus a 2 s concurrent Web Animation; uncapped, a 500-tap combo jammed
 * a low-end phone long enough to miss the Socket.IO heartbeat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { readonly, ref } from 'vue';

// Nuxt auto-imports the composable relies on — stub BEFORE importing it.
vi.stubGlobal('ref', ref);
vi.stubGlobal('readonly', readonly);
vi.stubGlobal('useFxPreferencesStore', () => ({ muteGiftAnimations: false }));
// Node test env has no DOM: seat lookup misses → bottom-center fallback.
vi.stubGlobal('document', { querySelector: () => null });
vi.stubGlobal('window', { innerWidth: 400, innerHeight: 800 });

const { LUCKY_FLY_MAX_CONCURRENT } = await import('../../../app/constants/gift');
const { useLuckyFly } = await import('../../../app/composables/lucky/useLuckyFly');

vi.mock('../../../app/stores/fxPreferences', () => ({
  useFxPreferencesStore: () => ({ muteGiftAnimations: false }),
}));

describe('useLuckyFly concurrency cap', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const { flyItems, removeFlyItem } = useLuckyFly();
    for (const item of [...flyItems.value]) removeFlyItem(item.id);
  });

  it('drops flies past LUCKY_FLY_MAX_CONCURRENT instead of queueing them', () => {
    const { flyItems, triggerFly } = useLuckyFly();
    for (let i = 0; i < LUCKY_FLY_MAX_CONCURRENT * 50; i++) {
      triggerFly('https://cdn.test/g.png', 1, 2);
    }
    expect(flyItems.value).toHaveLength(LUCKY_FLY_MAX_CONCURRENT);
  });

  it('accepts new flies again once one finishes', () => {
    const { flyItems, triggerFly, removeFlyItem } = useLuckyFly();
    for (let i = 0; i < LUCKY_FLY_MAX_CONCURRENT; i++) triggerFly('https://cdn.test/g.png', 1, 2);
    const first = flyItems.value[0]!;
    removeFlyItem(first.id);
    triggerFly('https://cdn.test/g.png', 1, 3);
    expect(flyItems.value).toHaveLength(LUCKY_FLY_MAX_CONCURRENT);
    expect(flyItems.value.some((i) => i.id === first.id)).toBe(false);
  });
});
