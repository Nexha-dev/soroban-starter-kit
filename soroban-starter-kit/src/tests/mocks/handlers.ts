import { http, HttpResponse } from 'msw';

export const sorobanHandlers = [
  http.post('https://soroban-testnet.stellar.org', () =>
    HttpResponse.json({ jsonrpc: '2.0', id: 1, result: { status: 'SUCCESS', ledger: 100 } })
  ),
  http.get('https://horizon-testnet.stellar.org/accounts/:id', () =>
    HttpResponse.json({ balances: [{ asset_type: 'native', balance: '100.0000000' }] })
  ),
];
