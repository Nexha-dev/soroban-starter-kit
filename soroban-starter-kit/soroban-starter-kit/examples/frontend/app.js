/**
 * app.js
 * Main application logic for the Soroban API Explorer.
 */

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  walletAddress: null,
  network: 'testnet',
  activeContract: null,
  activeMethod: null,
  activeLang: 'typescript',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindSidebar();
  bindNetwork();
  bindWallet();
  bindLangTabs();
  bindExecuteButtons();
  bindCopyButtons();
});

// ── Sidebar ───────────────────────────────────────────────────────────────────
function bindSidebar() {
  // Section collapse
  $$('.nav-section-title').forEach(title => {
    title.addEventListener('click', () => {
      const contract = title.dataset.contract;
      const list = $(`${contract}-methods`);
      const chevron = title.querySelector('.chevron');
      const collapsed = list.style.display === 'none';
      list.style.display = collapsed ? '' : 'none';
      chevron.textContent = collapsed ? '▾' : '▸';
    });
  });

  // Method selection
  $$('.method-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.method-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadMethod(item.dataset.contract, item.dataset.method);
    });
  });
}

// ── Network ───────────────────────────────────────────────────────────────────
function bindNetwork() {
  const sel = $('network-select');
  const customInput = $('custom-rpc');

  sel.addEventListener('change', () => {
    state.network = sel.value;
    customInput.style.display = sel.value === 'custom' ? 'block' : 'none';
    refreshCodeGen();
  });

  customInput.addEventListener('input', refreshCodeGen);
}

// ── Wallet ────────────────────────────────────────────────────────────────────
function bindWallet() {
  $('connect-wallet-btn').addEventListener('click', connectWallet);
}

async function connectWallet() {
  try {
    // Freighter API — loaded via CDN or extension injection
    if (typeof window.freighterApi === 'undefined' && typeof window.freighter === 'undefined') {
      // Attempt dynamic import from CDN
      const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/stellar-freighter-api/1.7.1/index.min.js')
        .catch(() => null);
      if (!mod) {
        showToast('Freighter not detected. Install the Freighter browser extension.', 'error');
        return;
      }
    }

    const api = window.freighterApi || window.freighter;
    const connected = await api.isConnected();
    if (!connected) {
      showToast('Please unlock Freighter and try again.', 'error');
      return;
    }

    const publicKey = await api.getPublicKey();
    state.walletAddress = publicKey;

    $('connect-wallet-btn').style.display = 'none';
    $('wallet-info').style.display = 'flex';
    $('wallet-address').textContent = truncateAddress(publicKey);
    $('wallet-address').title = publicKey;

    showToast('Wallet connected', 'success');
    refreshCodeGen();
  } catch (err) {
    showToast(`Wallet error: ${err.message}`, 'error');
  }
}

// ── Method loader ─────────────────────────────────────────────────────────────
function loadMethod(contractKey, methodKey) {
  state.activeContract = contractKey;
  state.activeMethod = methodKey;

  const spec = CONTRACT_SPECS[contractKey];
  const method = spec.methods[methodKey];

  $('welcome-screen').style.display = 'none';
  $('method-explorer').style.display = 'block';

  // Header
  const badge = $('method-type-badge');
  badge.textContent = method.type.toUpperCase();
  badge.className = `badge badge-${method.type}`;
  $('method-title').textContent = `${spec.label} → ${method.label}`;
  $('method-description').textContent = method.description;

  // Params form
  renderParamsForm(method);

  // Auth info
  renderAuthInfo(method);

  // Validation
  validateParams();

  // Code gen
  refreshCodeGen();

  // Hide response panel
  $('response-panel').style.display = 'none';
}

// ── Params form ───────────────────────────────────────────────────────────────
function renderParamsForm(method) {
  const form = $('params-form');
  const count = $('params-count');

  if (!method.params.length) {
    form.innerHTML = '<p class="muted">No parameters required.</p>';
    count.textContent = '0';
    return;
  }

  count.textContent = method.params.length;
  form.innerHTML = method.params.map(p => `
    <div class="param-row">
      <div class="param-meta">
        <label class="param-label" for="param-${p.name}">
          ${p.name}
          ${p.required ? '<span class="required">*</span>' : ''}
        </label>
        <span class="param-type">${p.type}</span>
      </div>
      <input
        id="param-${p.name}"
        class="input-full param-input"
        type="text"
        placeholder="${p.example || p.description}"
        data-param="${p.name}"
        data-type="${p.type}"
        autocomplete="off"
        spellcheck="false"
      />
      <p class="param-desc">${p.description}</p>
    </div>
  `).join('');

  // Live update code gen + validation on input
  $$('.param-input').forEach(input => {
    input.addEventListener('input', () => {
      refreshCodeGen();
      validateParams();
    });
  });
}

// ── Auth info ─────────────────────────────────────────────────────────────────
function renderAuthInfo(method) {
  const panel = $('auth-info');
  const badge = $('auth-required-badge');

  if (!method.auth.length) {
    badge.textContent = 'None';
    badge.className = 'badge badge-sm badge-read';
    panel.innerHTML = '<p class="muted">This is a read-only function. No authentication required.</p>';
    return;
  }

  badge.textContent = 'Required';
  badge.className = 'badge badge-sm badge-write';

  const signers = method.auth.map(a => `<code>${a}</code>`).join(', ');
  const errors = method.errors.length
    ? `<div class="error-list"><strong>Possible errors:</strong><ul>${method.errors.map(e => `<li>${e}</li>`).join('')}</ul></div>`
    : '';

  panel.innerHTML = `
    <p>Requires signature from: ${signers}</p>
    <p class="muted">The signing account must call <code>require_auth()</code> on-chain. 
    Connect Freighter to sign transactions.</p>
    ${errors}
    <div class="returns-info">
      <strong>Returns:</strong> <code>${method.returns.type}</code>
      <span class="muted"> — ${method.returns.description}</span>
    </div>
  `;
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateParams() {
  const method = getActiveMethod();
  if (!method) return;

  const output = $('validation-output');
  const values = getParamValues();
  const errors = [];
  const warnings = [];

  method.params.forEach(p => {
    const val = values[p.name];
    if (p.required && !val) {
      errors.push(`<strong>${p.name}</strong> is required`);
      return;
    }
    if (!val) return;

    switch (p.type) {
      case 'address':
        if (!/^[GC][A-Z0-9]{54,55}$/.test(val))
          errors.push(`<strong>${p.name}</strong>: invalid Stellar address format`);
        break;
      case 'i128':
        if (!/^-?\d+$/.test(val))
          errors.push(`<strong>${p.name}</strong>: must be an integer`);
        else if (BigInt(val) < 0n)
          warnings.push(`<strong>${p.name}</strong>: negative amounts may cause errors`);
        break;
      case 'u32':
        if (!/^\d+$/.test(val))
          errors.push(`<strong>${p.name}</strong>: must be a non-negative integer`);
        else if (parseInt(val) > 4294967295)
          errors.push(`<strong>${p.name}</strong>: exceeds u32 max (4294967295)`);
        break;
      case 'bool':
        if (val !== 'true' && val !== 'false')
          errors.push(`<strong>${p.name}</strong>: must be "true" or "false"`);
        break;
    }
  });

  const contractId = $('contract-id-input').value;
  if (contractId && !/^C[A-Z0-9]{54,55}$/.test(contractId))
    errors.push('<strong>Contract ID</strong>: invalid format (should start with C)');

  if (!errors.length && !warnings.length) {
    output.innerHTML = '<p class="valid">✓ All parameters look valid</p>';
  } else {
    output.innerHTML = [
      ...errors.map(e => `<p class="error-msg">✗ ${e}</p>`),
      ...warnings.map(w => `<p class="warn-msg">⚠ ${w}</p>`),
    ].join('');
  }
}

// ── Code generation ───────────────────────────────────────────────────────────
function bindLangTabs() {
  $$('.lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.lang-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeLang = tab.dataset.lang;
      refreshCodeGen();
    });
  });
}

function refreshCodeGen() {
  const method = getActiveMethod();
  if (!method) return;

  const contractId = $('contract-id-input')?.value || '';
  const values = getParamValues();
  const spec = CONTRACT_SPECS[state.activeContract];
  const methodSpec = spec.methods[state.activeMethod];

  let code = '';
  switch (state.activeLang) {
    case 'typescript': code = CodeGen.typescript(contractId, method, methodSpec, values); break;
    case 'javascript': code = CodeGen.javascript(contractId, method, methodSpec, values); break;
    case 'python':     code = CodeGen.python(contractId, method, methodSpec, values); break;
    case 'curl':       code = CodeGen.curl(contractId, method, methodSpec, values); break;
  }

  $('code-output').querySelector('code').textContent = code;
}

// ── Execute ───────────────────────────────────────────────────────────────────
function bindExecuteButtons() {
  $('simulate-btn').addEventListener('click', () => executeMethod(true));
  $('invoke-btn').addEventListener('click', () => executeMethod(false));
  $('contract-id-input').addEventListener('input', () => {
    refreshCodeGen();
    validateParams();
  });
}

async function executeMethod(simulateOnly) {
  const method = getActiveMethod();
  if (!method) return;

  const contractId = $('contract-id-input').value.trim();
  if (!contractId) {
    showToast('Enter a contract ID first', 'error');
    return;
  }

  if (!simulateOnly && !state.walletAddress) {
    showToast('Connect Freighter to invoke transactions', 'error');
    return;
  }

  const btn = simulateOnly ? $('simulate-btn') : $('invoke-btn');
  btn.disabled = true;
  btn.textContent = simulateOnly ? 'Simulating…' : 'Invoking…';

  try {
    const result = await callContract(contractId, method, simulateOnly);
    showResponse(result, simulateOnly ? 'SIMULATED' : 'SUCCESS');
  } catch (err) {
    showResponse({ error: err.message }, 'ERROR');
  } finally {
    btn.disabled = false;
    btn.textContent = simulateOnly ? 'Simulate' : 'Invoke';
  }
}

async function callContract(contractId, method, simulateOnly) {
  // Dynamic import of stellar-sdk from CDN
  const sdk = await loadStellarSdk();
  if (!sdk) throw new Error('Failed to load @stellar/stellar-sdk');

  const { SorobanRpc, TransactionBuilder, Networks, Contract, nativeToScVal, BASE_FEE } = sdk;

  const networkCfg = NETWORKS[state.network] || NETWORKS.testnet;
  const rpcUrl = state.network === 'custom'
    ? $('custom-rpc').value
    : networkCfg.rpc;

  const server = new SorobanRpc.Server(rpcUrl);
  const spec = CONTRACT_SPECS[state.activeContract].methods[state.activeMethod];
  const values = getParamValues();

  // Build ScVal params
  const scParams = spec.params.map(p => {
    const val = values[p.name] || '';
    return buildScVal(nativeToScVal, p, val);
  });

  let publicKey = state.walletAddress;
  if (!publicKey) {
    // Use a dummy account for simulation
    publicKey = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  }

  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkCfg.passphrase,
  })
    .addOperation(contract.call(method.label, ...scParams))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(simResult.error);
  }

  if (simulateOnly || spec.type === 'read') {
    return {
      type: 'simulation',
      cost: simResult.cost,
      result: simResult.result?.retval?.toXDR('base64') || null,
      latestLedger: simResult.latestLedger,
    };
  }

  // Sign and submit
  const api = window.freighterApi || window.freighter;
  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await api.signTransaction(preparedTx.toXDR(), {
    networkPassphrase: networkCfg.passphrase,
  });

  const submitted = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, networkCfg.passphrase)
  );

  return {
    type: 'transaction',
    hash: submitted.hash,
    status: submitted.status,
    latestLedger: submitted.latestLedger,
  };
}

function buildScVal(nativeToScVal, param, value) {
  switch (param.type) {
    case 'address': return nativeToScVal(value, { type: 'address' });
    case 'i128':    return nativeToScVal(BigInt(value || '0'), { type: 'i128' });
    case 'u32':     return nativeToScVal(parseInt(value || '0'), { type: 'u32' });
    case 'bool':    return nativeToScVal(value === 'true', { type: 'bool' });
    case 'string':  return nativeToScVal(value, { type: 'string' });
    default:        return nativeToScVal(value, { type: 'string' });
  }
}

// ── Response panel ────────────────────────────────────────────────────────────
function showResponse(data, status) {
  const panel = $('response-panel');
  const statusBadge = $('response-status');
  const output = $('response-output').querySelector('code');

  panel.style.display = 'block';
  statusBadge.textContent = status;
  statusBadge.className = `badge ${status === 'ERROR' ? 'badge-write' : 'badge-read'}`;
  output.textContent = JSON.stringify(data, null, 2);

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Copy buttons ──────────────────────────────────────────────────────────────
function bindCopyButtons() {
  $('copy-code-btn').addEventListener('click', () => {
    const text = $('code-output').querySelector('code').textContent;
    copyToClipboard(text, 'copy-code-btn');
  });

  $('copy-response-btn').addEventListener('click', () => {
    const text = $('response-output').querySelector('code').textContent;
    copyToClipboard(text, 'copy-response-btn');
  });
}

function copyToClipboard(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = $(btnId);
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getActiveMethod() {
  if (!state.activeContract || !state.activeMethod) return null;
  return CONTRACT_SPECS[state.activeContract].methods[state.activeMethod];
}

function getParamValues() {
  const values = {};
  $$('.param-input').forEach(input => {
    values[input.dataset.param] = input.value.trim();
  });
  return values;
}

function truncateAddress(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function showToast(msg, type = 'info') {
  const toast = $('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type}`;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Lazy-load stellar-sdk from CDN
let _sdkCache = null;
async function loadStellarSdk() {
  if (_sdkCache) return _sdkCache;
  try {
    // stellar-sdk exposes a UMD global when loaded via CDN script tag
    if (window.StellarSdk) {
      _sdkCache = window.StellarSdk;
      return _sdkCache;
    }
    // Attempt ESM import from CDN
    const mod = await import('https://cdnjs.cloudflare.com/ajax/libs/stellar-sdk/12.3.0/stellar-sdk.min.js');
    _sdkCache = mod.default || mod;
    return _sdkCache;
  } catch {
    return null;
  }
}
