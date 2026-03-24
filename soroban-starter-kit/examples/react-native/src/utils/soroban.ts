import { SorobanRpc, TransactionBuilder, Networks, Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';

const SERVER_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const server = new SorobanRpc.Server(SERVER_URL);

export async function buildAndSend(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  publicKey: string,
  signFn: (xdr: string) => Promise<string>
) {
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signed = await signFn(prepared.toXDR());
  return server.sendTransaction(
    TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE)
  );
}

export function addressVal(addr: string) {
  return nativeToScVal(addr, { type: 'address' });
}

export function i128Val(n: string) {
  return nativeToScVal(BigInt(n), { type: 'i128' });
}
