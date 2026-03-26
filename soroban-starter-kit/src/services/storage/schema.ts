/**
 * Database Schema Definition
 * Single source of truth for all IndexedDB object stores and their types.
 */

import { DBSchema } from 'idb';
import { Balance, EscrowData, CachedTransaction, UserPreferences } from './types';

export interface UserRecord {
  id: string;
  address: string;          // Stellar public key
  displayName?: string;
  network: 'testnet' | 'mainnet';
  createdAt: number;
  lastSeenAt: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface FidelisDBSchema extends DBSchema {
  balances: {
    key: string;
    value: Balance;
    indexes: { 'by-address': string; 'by-timestamp': number };
  };
  escrows: {
    key: string;
    value: EscrowData;
    indexes: { 'by-status': string; 'by-address': string };
  };
  pendingTransactions: {
    key: string;
    value: CachedTransaction;
    indexes: { 'by-status': string; 'by-timestamp': number };
  };
  syncedTransactions: {
    key: string;
    value: CachedTransaction;
    indexes: { 'by-timestamp': number };
  };
  preferences: {
    key: string;
    value: UserPreferences;
  };
  cache: {
    key: string;
    value: { data: unknown; timestamp: number; expiresAt: number };
  };
  users: {
    key: string;
    value: UserRecord;
    indexes: { 'by-address': string; 'by-createdAt': number };
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
}

export const DB_NAME = 'fidelis-soroban-db';
export const DB_VERSION = 2; // bump when adding migrations
