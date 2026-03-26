import { searchEngine } from '../searchEngine';
import { CachedTransaction, Balance, EscrowData } from '../../storage/types';
import { SearchQuery } from '../types';

describe('SearchEngine', () => {
  const mockTransactions: CachedTransaction[] = [
    {
      id: 'tx1',
      type: 'transfer',
      contractId: 'contract1',
      method: 'transfer',
      params: { to: 'user1', amount: '1000' },
      status: 'synced',
      createdAt: Date.now() - 1000000,
      retryCount: 0,
      localVersion: 1,
    },
    {
      id: 'tx2',
      type: 'mint',
      contractId: 'contract1',
      method: 'mint',
      params: { amount: '5000' },
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
      localVersion: 1,
    },
  ];

  const mockBalances: Balance[] = [
    {
      id: 'bal1',
      address: 'user1',
      contractId: 'contract1',
      tokenSymbol: 'USDC',
      amount: '10000',
      lastUpdated: Date.now(),
    },
  ];

  describe('search', () => {
    it('should find transactions by type', () => {
      const query: SearchQuery = {
        filters: { type: ['transfer'] },
      };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.items.length).toBe(1);
      expect(results.items[0].type).toBe('transfer');
    });

    it('should find transactions by status', () => {
      const query: SearchQuery = {
        filters: { status: ['synced'] },
      };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.items.length).toBe(1);
      expect(results.items[0].status).toBe('synced');
    });

    it('should perform full-text search', () => {
      const query: SearchQuery = {
        text: 'transfer',
        filters: {},
      };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.items.length).toBeGreaterThan(0);
    });

    it('should filter by date range', () => {
      const now = Date.now();
      const query: SearchQuery = {
        filters: {
          dateRange: {
            start: now - 2000000,
            end: now,
          },
        },
      };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.items.length).toBe(2);
    });

    it('should filter by amount range', () => {
      const query: SearchQuery = {
        filters: {
          amountRange: { min: 5000, max: 10000 },
        },
      };
      const results = searchEngine.search(mockBalances, query);
      expect(results.items.length).toBe(1);
    });

    it('should sort by date', () => {
      const query: SearchQuery = {
        filters: {},
        sortBy: 'date',
        sortOrder: 'asc',
      };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.items[0].createdAt).toBeLessThan(results.items[1].createdAt);
    });

    it('should return execution time', () => {
      const query: SearchQuery = { filters: {} };
      const results = searchEngine.search(mockTransactions, query);
      expect(results.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFacets', () => {
    it('should generate type facets', () => {
      const facets = searchEngine.getFacets(mockTransactions, {});
      const typeFacet = facets.find(f => f.name === 'type');
      expect(typeFacet).toBeDefined();
      expect(typeFacet?.options.length).toBe(2);
    });

    it('should generate status facets', () => {
      const facets = searchEngine.getFacets(mockTransactions, {});
      const statusFacet = facets.find(f => f.name === 'status');
      expect(statusFacet).toBeDefined();
      expect(statusFacet?.options.length).toBe(2);
    });

    it('should include result counts in facets', () => {
      const facets = searchEngine.getFacets(mockTransactions, {});
      const typeFacet = facets.find(f => f.name === 'type');
      const transferOption = typeFacet?.options.find(o => o.value === 'transfer');
      expect(transferOption?.count).toBe(1);
    });
  });
});
