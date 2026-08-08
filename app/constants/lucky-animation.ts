// ============================================
// Lucky Gift Animation Configuration
// ============================================
// THE single configuration area for every Lucky Gift animation timing.
// No lucky animation timing may live anywhere else — components import from
// here. Units: durations/timeouts in milliseconds, distances in px, easing as
// CSS easing strings.

export const LUCKY_ANIMATION = {
  // ----------------------------------------
  // Center cashback animation (the win SVGA)
  // ----------------------------------------

  /**
   * How long the center cashback animation remains fully visible after the
   * most recent win before beginning its fade-out.
   * Increase to keep the animation on screen longer after activity stops.
   * Decrease for a snappier disappearance.
   * Affects: LuckyCashbackCenter. Unit: ms.
   */
  cashbackVisibleDuration: 5000,

  /**
   * How long the center cashback animation takes to fade out once its
   * visible window expires. A new win during the fade cancels it and
   * restores full visibility immediately.
   * Increase for a slower, softer fade. Decrease for a quicker exit.
   * Affects: LuckyCashbackCenter. Unit: ms.
   */
  cashbackFadeDuration: 3000,

  /**
   * Duration of one bounce cycle of the idle up/down motion the center
   * cashback plays while visible.
   * Increase for a slower, lazier bounce. Decrease for a livelier one.
   * Affects: LuckyCashbackCenter. Unit: ms.
   */
  cashbackBounceDuration: 1600,

  /**
   * Vertical travel of the idle bounce.
   * Increase for a taller bounce. Decrease for a subtler one.
   * Affects: LuckyCashbackCenter. Unit: px.
   */
  cashbackBounceDistancePx: 10,

  /**
   * Easing of the idle bounce (applied each half-cycle).
   * Affects: LuckyCashbackCenter. Unit: CSS easing.
   */
  cashbackBounceEasing: 'ease-in-out',

  /**
   * How far ABOVE exact screen center the cashback visual sits.
   * Increase to raise it higher; 0 = dead center.
   * Affects: LuckyCashbackCenter. Unit: vh (% of viewport height).
   */
  cashbackRaiseVh: 20,

  /**
   * Prize tiers whose .svga files are pre-loaded when the room opens, so the
   * first win of a burst renders instantly instead of waiting on the app-wide
   * serialized SVGA loader. Keep this to the common low tiers — every entry
   * costs one background download on room join.
   * Affects: useLuckyCashbackCenter pre-warm. Unit: tier numbers
   * (must exist in LUCKY_CASHBACK_SVGA_TIERS).
   */
  cashbackPrewarmTiers: [2, 5, 10, 25] as readonly number[],

  // ----------------------------------------
  // Sender activity band
  // ----------------------------------------

  /**
   * How long the band's fly-in (from bandEnterFromLeftPx to bandRestLeftPx)
   * takes when a sender's band first appears.
   * Increase for a slower entrance. Decrease for a snappier one.
   * Affects: LuckySenderBands. Unit: ms.
   */
  bandEntranceDuration: 450,

  /**
   * Easing of the band's fly-in.
   * Affects: LuckySenderBands. Unit: CSS easing.
   */
  bandEntranceEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',

  /**
   * How long a band stays after its sender's LAST activity (tap or win)
   * before it starts fading. Any new activity resets this timer.
   * Increase to keep idle bands visible longer. Decrease to free slots faster.
   * Affects: LuckySenderBands. Unit: ms.
   */
  bandInactivityTimeout: 5000,

  /**
   * How long a band's fade-out takes once its inactivity timeout expires.
   * New activity during the fade revives the band instantly.
   * Increase for a slower fade. Decrease for a quicker exit.
   * Affects: LuckySenderBands. Unit: ms.
   */
  bandFadeDuration: 3000,

  /**
   * X position a band enters from (distance from the LEFT screen edge).
   * Increase to start the fly-in further right.
   * Affects: LuckySenderBands. Unit: px.
   */
  bandEnterFromLeftPx: 250,

  /**
   * X position a band settles at (distance from the LEFT screen edge).
   * Affects: LuckySenderBands. Unit: px.
   */
  bandRestLeftPx: 8,

  /**
   * Vertical position of the FIRST band slot, as a percentage of screen
   * height from the top. Later slots stack downward from here.
   * Affects: LuckySenderBands. Unit: % of viewport height.
   */
  bandBaseTopPct: 50,

  /**
   * Vertical gap between stacked bands (slot pitch = band height + this gap).
   * Increase to spread bands out. Decrease to pack them tighter.
   * Affects: LuckySenderBands. Unit: px.
   */
  bandVerticalGapPx: 8,

  /**
   * Height of one band row, used to compute slot positions.
   * Must match the rendered band height or bands overlap.
   * Affects: LuckySenderBands. Unit: px.
   */
  bandHeightPx: 40,

  /**
   * Maximum bands visible at once. When all slots are taken, a NEW sender's
   * activity is held (no band) until a slot frees — existing bands are never
   * evicted mid-activity, and counters keep accumulating in state so a band
   * appearing late still shows correct totals.
   * Increase to show more simultaneous players (more DOM + animation cost).
   * Affects: LuckySenderBands / useLuckySenderBands. Unit: bands.
   */
  bandMaxVisible: 4,

  // ----------------------------------------
  // Floating lucky combo button
  // ----------------------------------------

  /**
   * Vertical position of the floating lucky combo button, measured from the
   * BOTTOM of the screen. The gift drawer closes while a lucky combo runs and
   * this big rounded button takes over; the drawer reopens when it ends.
   * Increase to move the button higher up the screen.
   * Affects: the lucky combo float in RoomGiftDrawer. Unit: % of viewport height.
   */
  comboFloatBottomPct: 10,

  // ----------------------------------------
  // Gift fan-out (sender → center → recipients)
  // ----------------------------------------

  /**
   * How long the flying gift image pauses at screen center before fanning
   * out to recipients. 0 restores the old straight-through behavior.
   * Increase for a more readable center moment. Decrease to speed the flight.
   * Affects: LuckyGiftFly. Unit: ms.
   */
  centerHoldDuration: 800,

  /**
   * Easing of the whole fan-out flight (appear → center → land → vanish).
   * Affects: LuckyGiftFly. Unit: CSS easing.
   */
  flyEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const
