/**
 * codegen.js
 * Generates code snippets for contract invocations in multiple languages.
 */

const CodeGen = (() => {
  function _buildParamList(params, values) {
    return params.map(p => {
      const val = values[p.name] || p.example || '';
      return { ...p, value: val };
    });
  }

  function _scValExpr(param, lang) {
    const v = param.value || param.example || '';
    switch (param.type) {
      case 'address':
        if (lang === 'typescript' || lang === 'javascript')
          return `nativeToScVal("${v}", { type: "address" })`;
        if (lang === 'python')
          return `Address("${v}").to_xdr_sc_val()`;
        return `"${v}"`;
      case 'i128':
        if (lang === 'typescript' || lang === 'javascript')
          return `nativeToScVal(BigInt("${v || '0'}"), { type: "i128" })`;
        if (lang === 'python')
          return `scval.to_int128(${v || '0'})`;
        return `"${v || '0'}"`;
      case 'u32':
        if (lang === 'typescript' || lang === 'javascript')
          return `nativeToScVal(${v || '0'}, { type: "u32" })`;
        if (lang === 'python')
          return `scval.to_uint32(${v || '0'})`;
        return `"${v || '0'}"`;
      case 'bool':
        if (lang === 'typescript' || lang === 'javascript')
          return `nativeToScVal(${v === 'true' ? 'true' : 'false'}, { type: "bool" })`;
        if (lang === 'python')
          return `scval.to_bool(${v === 'true' ? 'True' : 'False'})`;
        return `"${v}"`;
      case 'string':
        if (lang === 'typescript' || lang === 'javascript')
          return `nativeToScVal("${v}", { type: "string" })`;
        if (lang === 'python')
          return `scval.to_string("${v}")`;
        return `"${v}"`;
      default:
        return `"${v}"`;
    }
  }

  function typescript(contractId, method, spec, values) {
    const params = _buildParamList(spec.params, values);
    const paramsArr = params.length
      ? `[\n    ${params.map(p => `// ${p.name}: ${p.type}\n    ${_scValExpr(p, 'typescript')}`).join(',\n    ')}\n  ]`
      : '[]';

    return `import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { getPublicKey, signTransaction } from "@stellar/freighter-api";

const RPC_URL = "${_getRpc()}";
const CONTRACT_ID = "${contractId || '<CONTRACT_ID>'}";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new SorobanRpc.Server(RPC_URL);

async function ${_camel(method.label)}(${params.map(p => `${p.name}: ${_tsType(p.type)}`).join(', ')}) {
  const publicKey = await getPublicKey();
  const account = await server.getAccount(publicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "${method.label}",
        ...${paramsArr}
      )
    )
    .setTimeout(30)
    .build();

  // Simulate first
  const simResult = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }

  ${spec.type === 'read'
    ? `// Read-only — return simulation result\n  return simResult.result?.retval;`
    : `// Assemble and sign
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );
  return result;`}
}`;
  }

  function javascript(contractId, method, spec, values) {
    // Same as TS but without type annotations
    return typescript(contractId, method, spec, values)
      .replace(/: string/g, '')
      .replace(/: number/g, '')
      .replace(/: bigint/g, '')
      .replace(/: boolean/g, '')
      .replace(/: \w+/g, '');
  }

  function python(contractId, method, spec, values) {
    const params = _buildParamList(spec.params, values);
    const paramsLines = params.map(p =>
      `    # ${p.name}: ${p.type}\n    ${_scValExpr(p, 'python')},`
    ).join('\n');

    return `from stellar_sdk import (
    Keypair, Network, SorobanServer, TransactionBuilder, scval
)
from stellar_sdk.soroban_rpc import SendTransactionStatus

RPC_URL = "${_getRpc()}"
CONTRACT_ID = "${contractId || '<CONTRACT_ID>'}"
NETWORK_PASSPHRASE = Network.TESTNET_NETWORK_PASSPHRASE

server = SorobanServer(RPC_URL)

def ${method.label}(keypair: Keypair${params.map(p => `, ${p.name}`).join('')}):
    account = server.load_account(keypair.public_key)
    
    params = [
${paramsLines || '        # no parameters'}
    ]
    
    tx = (
        TransactionBuilder(account, network_passphrase=NETWORK_PASSPHRASE, base_fee=100)
        .append_invoke_contract_function_op(
            contract_id=CONTRACT_ID,
            function_name="${method.label}",
            parameters=params,
        )
        .set_timeout(30)
        .build()
    )
    
    sim = server.simulate_transaction(tx)
    ${spec.type === 'read'
      ? `# Read-only — return simulation result\n    return sim.results[0].xdr if sim.results else None`
      : `tx = server.prepare_transaction(tx, sim)
    tx.sign(keypair)
    response = server.send_transaction(tx)
    return response`}
`;
  }

  function curl(contractId, method, spec, values) {
    const params = _buildParamList(spec.params, values);
    const args = params.map(p => {
      const v = p.value || p.example || '';
      return `      { "type": "${p.type}", "value": "${v}" }`;
    }).join(',\n');

    return `# Soroban RPC — simulateTransaction
# Note: args must be XDR-encoded ScVal in production.
# This shows the logical structure for reference.

curl -X POST "${_getRpc()}" \\
  -H "Content-Type: application/json" \\
  -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "simulateTransaction",
  "params": {
    "transaction": "<base64-encoded-XDR-transaction>"
  }
}'

# Build the transaction XDR using stellar-sdk:
# contract: ${contractId || '<CONTRACT_ID>'}
# method:   ${method.label}
# params:
${args || '#   (none)'}

# Then submit with sendTransaction for write operations.`;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  function _getRpc() {
    const sel = document.getElementById('network-select');
    const custom = document.getElementById('custom-rpc');
    if (sel && sel.value === 'custom' && custom.value) return custom.value;
    if (sel && NETWORKS[sel.value]) return NETWORKS[sel.value].rpc;
    return NETWORKS.testnet.rpc;
  }

  function _camel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  function _tsType(sorobanType) {
    switch (sorobanType) {
      case 'address': return 'string';
      case 'i128':    return 'bigint';
      case 'u32':     return 'number';
      case 'bool':    return 'boolean';
      case 'string':  return 'string';
      default:        return 'string';
    }
  }

  return { typescript, javascript, python, curl };
})();
