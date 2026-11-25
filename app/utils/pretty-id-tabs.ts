/**
 * Pretty ID tab bar order + landing route. Pure: the caller passes the
 * server's `pretty_id.auction_enabled` flag (bootstrap store).
 *
 * The order is load-bearing: plugins/nav-direction.client.ts derives the slide
 * direction between sibling tabs from it, so it must equal the on-screen
 * left → right order.
 *   auction off → [Choose ID, Rare Auction], lands on Choose
 *   auction on  → [Rare Auction, Choose ID], lands on the auction
 */
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'

export interface PrettyIdTab {
  to: string
  label: string
}

const CHOOSE_TAB: PrettyIdTab = { to: PRETTY_ID_ROUTES.choose, label: 'Choose ID' }
const AUCTION_TAB: PrettyIdTab = { to: PRETTY_ID_ROUTES.auction, label: 'Rare Auction' }

export function prettyIdTabs(auctionEnabled: boolean): readonly PrettyIdTab[] {
  return auctionEnabled ? [AUCTION_TAB, CHOOSE_TAB] : [CHOOSE_TAB, AUCTION_TAB]
}

/** The tab entering the event lands on. */
export function prettyIdDefaultRoute(auctionEnabled: boolean): string {
  return auctionEnabled ? PRETTY_ID_ROUTES.auction : PRETTY_ID_ROUTES.choose
}
