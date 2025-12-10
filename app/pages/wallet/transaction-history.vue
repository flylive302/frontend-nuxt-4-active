<script setup lang="ts">
import TransactionItem from '~/components/transaction-item.vue';
import type { BalanceChange, TransactionDay, WalletTransaction } from '@/types/wallet';

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
});

interface TabItem {
  label: string;
  slot: string;
}

type TransactionOverrides = Partial<Omit<WalletTransaction, 'coins' | 'diamonds' | 'wealthXp' | 'charmXp'>> & {
  coins?: Partial<BalanceChange>;
  diamonds?: Partial<BalanceChange> | null;
  wealthXp?: Partial<BalanceChange> | null;
  charmXp?: Partial<BalanceChange> | null;
};

const tabs: TabItem[] = [
  { label: 'Coins History', slot: 'coins-history' },
  { label: 'Diamonds History', slot: 'diamonds-history' },
];

const defaultBalance: BalanceChange = {
  before: '200',
  after: '- 350',
  total: '+150',
};

const createBalance = (overrides: Partial<BalanceChange> = {}): BalanceChange => ({
  ...defaultBalance,
  ...overrides,
});

const createOptionalBalance = (overrides?: Partial<BalanceChange> | null): BalanceChange | null => {
  if (overrides === null) {
    return null;
  }
  return createBalance(overrides ?? {});
};

const createTransaction = (overrides: TransactionOverrides = {}): WalletTransaction => {
  const { coins, diamonds, wealthXp, charmXp, ...rest } = overrides;

  return {
    time: '14:30PM',
    title: 'Coins Purchased',
    thumbnail: '/siteAssets/badges/badge-charm-level-1.webp',
    itemsInvolved: 'Purchase of Coins',
    initiator: '[userSignature]',
    concerned: '[userSignature]',
    coins: createBalance(coins ?? {}),
    diamonds: createOptionalBalance(diamonds),
    wealthXp: createOptionalBalance(wealthXp),
    charmXp: createOptionalBalance(charmXp),
    ...rest,
  };
};

const createTransactions = (count: number, overrides?: TransactionOverrides): WalletTransaction[] =>
  Array.from({ length: count }, () => createTransaction(overrides));

const history: TransactionDay[] = [
  {
    date: '03 June, 2025',
    transactions: [
      createTransaction({ time: '09:15AM', coins: { total: '+250' } }),
      ...createTransactions(3),
    ],
  },
  {
    date: '02 June, 2025',
    transactions: createTransactions(3, { diamonds: null }),
  },
  {
    date: '01 June, 2025',
    transactions: createTransactions(2, { wealthXp: null, charmXp: null }),
  },
];
</script>

<template>
  <main>
    <NavAlt back-to="/wallet/purchase-coins">Transaction History</NavAlt>
    <div class="h-10" />

    <UTabs class="mb-4 w-full" :content="false" :items="tabs" variant="link" />

    <UCollapsible
      v-for="day in history"
      :key="day.date"
      :default-open="true"
    >
      <div class="mb-2 mt-4 flex items-center justify-between px-3">
        <SectionTitle>{{ day.date }}</SectionTitle>
        <icon name="i-lucide-chevron-down" />
      </div>
      <template #content>
        <TransactionItem
          v-for="(transaction, index) in day.transactions"
          :key="`${day.date}-${index}`"
          v-bind="transaction"
        />
      </template>
    </UCollapsible>
  </main>
</template>
