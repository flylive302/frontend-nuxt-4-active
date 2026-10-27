import { describe, it, expect } from 'vitest';
import {
  dropMainThreadWrapperIntegrations,
  DROPPED_SENTRY_INTEGRATIONS,
} from '~/utils/sentry-integrations';

describe('dropMainThreadWrapperIntegrations', () => {
  const defaults = [
    { name: 'InboundFilters' },
    { name: 'BrowserApiErrors' },
    { name: 'GlobalHandlers' },
    { name: 'BrowserTracing' },
  ];

  it('drops BrowserApiErrors and keeps everything else in order', () => {
    expect(dropMainThreadWrapperIntegrations(defaults).map(i => i.name)).toEqual([
      'InboundFilters',
      'GlobalHandlers',
      'BrowserTracing',
    ]);
  });

  it('keeps GlobalHandlers — the fallback error path once the wrapper is gone', () => {
    const kept = dropMainThreadWrapperIntegrations(defaults).map(i => i.name);
    expect(kept).toContain('GlobalHandlers');
    expect(DROPPED_SENTRY_INTEGRATIONS.has('GlobalHandlers')).toBe(false);
  });

  it('does not mutate the input', () => {
    const copy = defaults.map(i => ({ ...i }));
    dropMainThreadWrapperIntegrations(defaults);
    expect(defaults).toEqual(copy);
  });

  it('returns an empty list for an empty list', () => {
    expect(dropMainThreadWrapperIntegrations([])).toEqual([]);
  });
});
