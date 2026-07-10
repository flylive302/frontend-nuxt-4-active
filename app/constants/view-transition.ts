/**
 * View Transition Constants
 *
 * `view-transition-name` is a global namespace: at most ONE element may carry a
 * given name per snapshot, or the browser aborts the transition outright. The
 * home page renders many room cards, so ownership is arbitrated by
 * `useRoomExpandTransition` — see that file.
 */

/** Shared element: the room card grows into the room page, and shrinks back on leave. */
export const ROOM_EXPAND_VIEW_TRANSITION_NAME = 'room-card'
