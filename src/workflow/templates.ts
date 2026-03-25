import { required, stellarAddress, tokenAmount } from '../validation/rules';

const positiveAmount = tokenAmount();
import type { WorkflowTemplate } from './types';

export const deployContractTemplate: WorkflowTemplate = {
  id: 'deploy-contract',
  label: 'Deploy Contract',
  steps: [
    {
      id: 'network',
      title: 'Network',
      description: 'Choose the Stellar network to deploy to.',
      tooltip: 'Testnet is free and safe for development. Mainnet requires real XLM.',
      fields: {
        network: { initialValue: 'testnet', rules: [required()] },
        rpcUrl:  { rules: [required()] },
      },
    },
    {
      id: 'account',
      title: 'Account',
      description: 'Provide the deployer account credentials.',
      tooltip: 'The secret key is used to sign the deployment transaction.',
      fields: {
        publicKey: { rules: [required(), stellarAddress()] },
      },
    },
    {
      id: 'contract',
      title: 'Contract',
      description: 'Upload or specify the compiled WASM contract.',
      fields: {
        wasmPath: { rules: [required()] },
        contractName: { rules: [required()] },
      },
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Confirm deployment details before submitting.',
      optional: true,
      tooltip: 'You can skip this step to deploy immediately.',
      fields: {},
    },
  ],
};

export const tokenCreationTemplate: WorkflowTemplate = {
  id: 'token-creation',
  label: 'Create Token',
  steps: [
    {
      id: 'metadata',
      title: 'Metadata',
      description: 'Define your token name, symbol, and decimals.',
      fields: {
        name:     { rules: [required()] },
        symbol:   { rules: [required()] },
        decimals: { initialValue: '7', rules: [required()] },
      },
    },
    {
      id: 'supply',
      title: 'Supply',
      description: 'Set the initial supply and admin address.',
      fields: {
        initialSupply: { rules: [required(), positiveAmount] },
        adminAddress:  { rules: [required(), stellarAddress()] },
      },
    },
    {
      id: 'advanced',
      title: 'Advanced',
      description: 'Optional: configure mint/burn permissions.',
      optional: true,
      tooltip: 'Leave blank to use defaults.',
      fields: {
        mintCap: { rules: [] },
      },
    },
    {
      id: 'deploy',
      title: 'Deploy',
      description: 'Choose the network and deploy the token contract.',
      fields: {
        network: { initialValue: 'testnet', rules: [required()] },
      },
    },
  ],
};

export const escrowSetupTemplate: WorkflowTemplate = {
  id: 'escrow-setup',
  label: 'Setup Escrow',
  steps: [
    {
      id: 'parties',
      title: 'Parties',
      description: 'Enter buyer and seller Stellar addresses.',
      fields: {
        buyer:  { rules: [required(), stellarAddress()] },
        seller: { rules: [required(), stellarAddress()] },
      },
    },
    {
      id: 'terms',
      title: 'Terms',
      description: 'Set the escrow amount and deadline.',
      fields: {
        amount:   { rules: [required(), positiveAmount] },
        deadline: { rules: [required()] },
        token:    { rules: [required(), stellarAddress()] },
      },
    },
    {
      id: 'arbiter',
      title: 'Arbiter',
      description: 'Optionally add a third-party arbiter for dispute resolution.',
      optional: true,
      tooltip: 'An arbiter can release or refund funds if parties disagree.',
      condition: () => true,
      fields: {
        arbiterAddress: { rules: [stellarAddress()] },
      },
    },
    {
      id: 'confirm',
      title: 'Confirm',
      description: 'Review and submit the escrow contract.',
      fields: {},
    },
  ],
};

export const WORKFLOW_TEMPLATES = [
  deployContractTemplate,
  tokenCreationTemplate,
  escrowSetupTemplate,
] as const;
