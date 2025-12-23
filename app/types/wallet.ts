export interface BalanceChange {
  before: string;
  after: string;
  total: string;
}

export interface WalletTransaction {
  time: string;
  title: string;
  thumbnail: string;
  itemsInvolved?: string;
  initiator: string;
  concerned: string;
  coins: BalanceChange;
  diamonds?: BalanceChange | null;
  wealthXp?: BalanceChange | null;
  charmXp?: BalanceChange | null;
}

export interface TransactionDay {
  date: string;
  transactions: WalletTransaction[];
}
