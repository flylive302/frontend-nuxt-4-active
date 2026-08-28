import { describe, expect, it } from 'vitest';
import { isExitRoute, resolveBackAction, type BackContext } from '~/utils/backNavigation';
import { BACK_PRESS_COOLDOWN_MS, EXIT_CONFIRM_WINDOW_MS } from '~/constants/navigation';

const NOW = 1_000_000;

/** A press on an ordinary screen with history behind it and nothing open. */
function ctx(overrides: Partial<BackContext> = {}): BackContext {
  return {
    now: NOW,
    lastHandledAt: null,
    hasRegisteredOverlay: false,
    hasDialogLayer: false,
    canGoBack: true,
    routePath: '/mall',
    exitPromptedAt: null,
    ...overrides,
  };
}

describe('isExitRoute', () => {
  it('treats the home tab as an exit route', () => {
    expect(isExitRoute('/')).toBe(true);
  });

  it('treats every other screen as ordinary', () => {
    for (const path of ['/mall', '/room/42', '/profile', '/inbox']) {
      expect(isExitRoute(path)).toBe(false);
    }
  });
});

describe('resolveBackAction — cooldown', () => {
  it('ignores a press inside the cooldown', () => {
    const action = resolveBackAction(
      ctx({ lastHandledAt: NOW - (BACK_PRESS_COOLDOWN_MS - 1), hasDialogLayer: true }),
    );
    expect(action).toBe('ignore');
  });

  it('handles a press exactly at the cooldown boundary', () => {
    const action = resolveBackAction(
      ctx({ lastHandledAt: NOW - BACK_PRESS_COOLDOWN_MS, hasDialogLayer: true }),
    );
    expect(action).toBe('dismiss-dialog');
  });

  it('handles the very first press', () => {
    expect(resolveBackAction(ctx({ lastHandledAt: null }))).toBe('navigate-back');
  });
});

describe('resolveBackAction — overlay priority', () => {
  it('closes a registered overlay before anything else', () => {
    const action = resolveBackAction(
      ctx({ hasRegisteredOverlay: true, hasDialogLayer: true, routePath: '/' }),
    );
    expect(action).toBe('dismiss-registered');
  });

  it('closes a dialog layer before navigating', () => {
    expect(resolveBackAction(ctx({ hasDialogLayer: true }))).toBe('dismiss-dialog');
  });

  it('closes a dialog layer instead of exiting from the home tab', () => {
    const action = resolveBackAction(ctx({ hasDialogLayer: true, routePath: '/', canGoBack: false }));
    expect(action).toBe('dismiss-dialog');
  });

  it('navigates once every overlay is gone', () => {
    expect(resolveBackAction(ctx())).toBe('navigate-back');
  });
});

describe('resolveBackAction — navigation', () => {
  it('goes back when there is history', () => {
    expect(resolveBackAction(ctx({ canGoBack: true }))).toBe('navigate-back');
  });

  it('goes home rather than quitting on a cold-opened screen', () => {
    const action = resolveBackAction(ctx({ canGoBack: false, routePath: '/room/42' }));
    expect(action).toBe('navigate-home');
  });

  it('leaves the room by ordinary history back, so the minimize middleware runs', () => {
    expect(resolveBackAction(ctx({ routePath: '/room/42', canGoBack: true }))).toBe('navigate-back');
  });
});

describe('resolveBackAction — exit confirmation', () => {
  it('prompts on the first press from the home tab', () => {
    expect(resolveBackAction(ctx({ routePath: '/', exitPromptedAt: null }))).toBe('prompt-exit');
  });

  it('exits on the second press inside the window', () => {
    const action = resolveBackAction(
      ctx({ routePath: '/', exitPromptedAt: NOW - (EXIT_CONFIRM_WINDOW_MS - 1) }),
    );
    expect(action).toBe('exit-app');
  });

  it('re-prompts once the window has lapsed', () => {
    const action = resolveBackAction(
      ctx({ routePath: '/', exitPromptedAt: NOW - EXIT_CONFIRM_WINDOW_MS }),
    );
    expect(action).toBe('prompt-exit');
  });

  it('prefers exiting over history back on the home tab', () => {
    // Home is the exit point even with history behind it — the two-press
    // confirmation is what makes that safe.
    const action = resolveBackAction(ctx({ routePath: '/', canGoBack: true }));
    expect(action).toBe('prompt-exit');
  });
});
