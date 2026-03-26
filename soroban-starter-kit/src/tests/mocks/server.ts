import { setupServer } from 'msw/node';
import { sorobanHandlers } from './handlers';

export const server = setupServer(...sorobanHandlers);
