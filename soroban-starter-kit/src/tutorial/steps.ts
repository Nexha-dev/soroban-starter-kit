export type StepTarget =
  | { type: 'element'; selector: string }
  | { type: 'modal' }; // no anchor, centered modal

export interface TutorialMedia {
  type: 'image' | 'video';
  src: string;
  alt?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target: StepTarget;
  /** Which step id to go to next. Defaults to next in array. */
  nextId?: string;
  /** Branching: show choices instead of a single Next button */
  branches?: { label: string; nextId: string }[];
  media?: TutorialMedia;
  /** aria-live region hint */
  ariaLive?: 'polite' | 'assertive';
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  /** Trigger automatically for new users */
  autoStart?: boolean;
}

export const MAIN_TUTORIAL: Tutorial = {
  id: 'main',
  title: 'Welcome to Fidelis',
  description: 'A quick tour of the Soroban DApp',
  autoStart: true,
  steps: [
    {
      id: 'welcome',
      title: '👋 Welcome to Fidelis',
      content:
        'This app lets you interact with Soroban smart contracts on Stellar — even when you\'re offline. Let\'s take a quick tour.',
      target: { type: 'modal' },
      branches: [
        { label: '🚀 Start Tour', nextId: 'header' },
        { label: '⏭ Skip Tour',  nextId: '__end__' },
      ],
    },
    {
      id: 'header',
      title: '🔐 App Header',
      content:
        'The header shows your connectivity status and lets you toggle dark/light mode or switch color schemes.',
      target: { type: 'element', selector: '.header' },
      ariaLive: 'polite',
    },
    {
      id: 'quick-actions',
      title: '⚡ Quick Actions',
      content:
        'Queue a transfer transaction or manually trigger a sync with the Stellar network from here.',
      target: { type: 'element', selector: '.card' },
    },
    {
      id: 'tabs',
      title: '📑 Navigation Tabs',
      content:
        'Switch between your cached balances, pending (queued) transactions, and synced history.',
      target: { type: 'element', selector: '.flex.gap-md.mb-lg' },
      branches: [
        { label: 'Tell me about offline mode', nextId: 'offline' },
        { label: 'Next →', nextId: 'sidebar' },
      ],
    },
    {
      id: 'offline',
      title: '📡 Offline Mode',
      content:
        'When you lose connectivity, transactions are queued locally and replayed automatically once you\'re back online. Your balances are cached so you always have a snapshot.',
      target: { type: 'modal' },
    },
    {
      id: 'sidebar',
      title: '📊 Sync Status',
      content:
        'The sidebar shows live sync state, storage usage, and offline mode tips.',
      target: { type: 'element', selector: '.grid' },
    },
    {
      id: 'done',
      title: '✅ You\'re all set!',
      content:
        'That\'s the tour. You can restart it anytime from the Help menu. Happy building on Soroban!',
      target: { type: 'modal' },
    },
  ],
};

export const TRANSFER_TUTORIAL: Tutorial = {
  id: 'transfer',
  title: 'Send a Token Transfer',
  description: 'Learn how to queue and submit a token transfer on Soroban.',
  steps: [
    {
      id: 'transfer-intro',
      title: '💸 Token Transfers',
      content: 'This guide walks you through queuing a token transfer — even while offline.',
      target: { type: 'modal' },
    },
    {
      id: 'transfer-tab',
      title: '📑 Open the Transfer Tab',
      content: 'Click the "Transfer" tab to open the token transfer wizard.',
      target: { type: 'element', selector: '.flex.gap-md.mb-lg' },
    },
    {
      id: 'transfer-form',
      title: '📝 Fill in the Form',
      content: 'Enter the recipient address and amount. The wizard validates inputs before queuing.',
      target: { type: 'element', selector: '.card' },
    },
    {
      id: 'transfer-done',
      title: '✅ Transfer Queued',
      content: 'Your transfer is queued and will be submitted automatically when you\'re online.',
      target: { type: 'modal' },
    },
  ],
};

export const CONTRACTS_TUTORIAL: Tutorial = {
  id: 'contracts',
  title: 'Interact with Contracts',
  description: 'Learn how to call Soroban smart contract functions.',
  steps: [
    {
      id: 'contracts-intro',
      title: '🔐 Smart Contracts',
      content: 'Soroban contracts live on Stellar. This guide shows you how to call them from the UI.',
      target: { type: 'modal' },
    },
    {
      id: 'contracts-build',
      title: '🔨 Build a Transaction',
      content: 'Use the "Build Transaction" tab to construct a contract call with custom parameters.',
      target: { type: 'element', selector: '.flex.gap-md.mb-lg' },
    },
    {
      id: 'contracts-queue',
      title: '⏳ Queue & Sync',
      content: 'Once built, the transaction is queued. Hit "Sync Now" to submit it to the network.',
      target: { type: 'element', selector: '.card' },
    },
    {
      id: 'contracts-done',
      title: '🎉 Done!',
      content: 'You can monitor the result in the Synced History tab.',
      target: { type: 'modal' },
    },
  ],
};

export const ALL_TUTORIALS: Tutorial[] = [MAIN_TUTORIAL, TRANSFER_TUTORIAL, CONTRACTS_TUTORIAL];

export const HELP_DOCS: { id: string; title: string; content: string; tutorialId?: string }[] = [
  {
    id: 'offline',
    title: 'Offline Mode',
    content:
      'Fidelis caches your balances and queues transactions locally when you lose connectivity. Everything syncs automatically when you reconnect.',
  },
  {
    id: 'transfer',
    title: 'Token Transfers',
    content:
      'Use the Transfer tab to send tokens. Transfers are validated locally and queued for submission. You can track them in the Pending tab.',
    tutorialId: 'transfer',
  },
  {
    id: 'contracts',
    title: 'Smart Contract Calls',
    content:
      'The Build Transaction tab lets you construct arbitrary Soroban contract calls. Select a contract, choose a function, and fill in the parameters.',
    tutorialId: 'contracts',
  },
  {
    id: 'sync',
    title: 'Syncing Data',
    content:
      'The Sync Status sidebar shows the last sync time and any pending items. Click "Sync Now" to force an immediate sync.',
  },
  {
    id: 'security',
    title: 'Security',
    content:
      'All sensitive data is stored encrypted in IndexedDB. The Security Dashboard shows active sessions and audit logs.',
  },
];
