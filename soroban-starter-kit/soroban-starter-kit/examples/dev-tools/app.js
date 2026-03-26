/**
 * app.js — Soroban Developer Tools main controller
 */

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initScaffolder();
  initDebugger();
  initProfiler();
  initAnalyzer();
  initDocs();
});

// ── Tabs ──────────────────────────────────────────────────────────────────────
function initTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

// ── Scaffolder ────────────────────────────────────────────────────────────────
function initScaffolder() {
  // Option card selection
  $$('.option-card').forEach(card => {
    card.addEventListener('click', () => {
      $$('.option-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      card.querySelector('input').checked = true;
      generateScaffold();
    });
  });

  // Live regen on config change
  ['sc-name', 'sc-author', 'sc-sdk-version', 'feat-events', 'feat-errors', 'feat-tests', 'feat-deploy']
    .forEach(id => $(`${id}`)?.addEventListener('change', generateScaffold));
  $('sc-name').addEventListener('input', generateScaffold);

  $('generate-btn').addEventListener('click', generateScaffold);
  $('copy-scaffold-btn').addEventListener('click', () => {
    copyText($('scaffold-output').textContent, 'copy-scaffold-btn');
  });

  generateScaffold(); // initial render
}

let scaffoldFiles = {};
let activeScaffoldFile = null;

function generateScaffold() {
  const type    = document.querySelector('input[name="contract-type"]:checked')?.value || 'blank';
  const name    = $('sc-name').value.trim().replace(/\s+/g, '_').toLowerCase() || 'my_contract';
  const author  = $('sc-author').value.trim();
  const sdkVer  = $('sc-sdk-version').value;
  const events  = $('feat-events').checked;
  const errors  = $('feat-errors').checked;
  const tests   = $('feat-tests').checked;
  const deploy  = $('feat-deploy').checked;

  scaffoldFiles = Scaffolder.generate(type, { name, author, sdkVersion: sdkVer, events, errors, tests, deploy });

  // Build file tabs
  const tabsEl = $('scaffold-file-tabs');
  tabsEl.innerHTML = '';
  Object.keys(scaffoldFiles).forEach((fname, i) => {
    const btn = document.createElement('button');
    btn.className = `file-tab${i === 0 ? ' active' : ''}`;
    btn.textContent = fname;
    btn.dataset.file = fname;
    btn.addEventListener('click', () => {
      $$('.file-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      activeScaffoldFile = fname;
      $('scaffold-output').querySelector('code').textContent = scaffoldFiles[fname];
    });
    tabsEl.appendChild(btn);
  });

  activeScaffoldFile = Object.keys(scaffoldFiles)[0];
  const codeEl = $('scaffold-output');
  codeEl.innerHTML = '<code></code>';
  codeEl.querySelector('code').textContent = scaffoldFiles[activeScaffoldFile] || '';
}

// ── Debugger ──────────────────────────────────────────────────────────────────
function initDebugger() {
  $('decode-btn').addEventListener('click', () => {
    const input = $('xdr-input').value.trim();
    const type  = $('xdr-type').value;
    if (!input) { showToast('Paste XDR or a transaction hash first', 'error'); return; }
    const result = SorobanDebugger.decodeXdr(input, type);
    showDebugOutput(result);
  });

  $('lookup-error-btn').addEventListener('click', () => {
    const contract = $('error-contract').value;
    const code     = $('error-code-input').value;
    const result   = SorobanDebugger.lookupError(contract, code);
    const box      = $('error-lookup-result');
    box.style.display = 'block';
    if (!result) {
      box.className = 'result-box error';
      box.innerHTML = `<strong>Unknown error code ${code}</strong> for ${contract} contract.`;
    } else {
      box.className = 'result-box success';
      box.innerHTML = `
        <strong>${result.name}</strong> (code ${code})<br/>
        <span style="color:var(--text-dim)">${result.desc}</span><br/>
        <span style="color:var(--accent);font-size:12px">Fix: ${result.fix}</span>`;
    }
  });

  $('parse-event-btn').addEventListener('click', () => {
    const input = $('event-input').value.trim();
    if (!input) { showToast('Paste event JSON first', 'error'); return; }
    const result = SorobanDebugger.parseEvent(input);
    showDebugOutput(result);
  });

  $('copy-debug-btn').addEventListener('click', () => {
    copyText($('debug-output').textContent, 'copy-debug-btn');
  });
}

function showDebugOutput(data) {
  $('debug-output').innerHTML = `<code>${JSON.stringify(data, null, 2)}</code>`;
}

// ── Profiler ──────────────────────────────────────────────────────────────────
function initProfiler() {
  const contractSel = $('prof-contract');
  const methodSel   = $('prof-method');

  function refreshMethods() {
    const methods = Profiler.getMethods(contractSel.value);
    methodSel.innerHTML = methods.map(m => `<option value="${m}">${m}</option>`).join('');
  }

  contractSel.addEventListener('change', refreshMethods);
  refreshMethods();

  $('profile-btn').addEventListener('click', () => {
    const result = Profiler.estimateOperation(contractSel.value, methodSel.value);
    if (!result) return;
    renderProfilerResults(result);
  });

  $('estimate-storage-btn').addEventListener('click', () => {
    const type  = $('storage-type').value;
    const count = parseInt($('entry-count').value) || 1;
    const size  = parseInt($('entry-size').value)  || 64;
    const result = Profiler.estimateStorage(type, count, size);
    renderStorageResults(result);
  });
}

function renderProfilerResults(r) {
  const f = r.fees;
  const u = r.utilization;

  $('profiler-results').innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Fee</div>
        <div class="metric-value">${f.totalStroops.toLocaleString()} stroops</div>
        <div class="metric-sub">${f.totalXlm.toFixed(7)} XLM</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Operation Type</div>
        <div class="metric-value" style="font-size:16px">${r.isReadOnly ? '📖 Read-only' : '✍ Write'}</div>
        <div class="metric-sub">${r.contract} → ${r.method}</div>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-label">CPU Utilization</div>
      <div class="metric-value">${r.profile.cpuUnits.toLocaleString()} instructions</div>
      <div class="metric-bar-wrap"><div class="metric-bar ${u.cpuPct > 80 ? 'red' : u.cpuPct > 50 ? 'yellow' : 'green'}" style="width:${u.cpuPct}%"></div></div>
      <div class="metric-sub">${u.cpuPct}% of limit · Fee: ${f.cpuFee} stroops</div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Memory</div>
      <div class="metric-value">${r.profile.memUnits.toLocaleString()} bytes</div>
      <div class="metric-bar-wrap"><div class="metric-bar ${u.memPct > 80 ? 'red' : u.memPct > 50 ? 'yellow' : 'green'}" style="width:${u.memPct}%"></div></div>
      <div class="metric-sub">${u.memPct}% of limit · Fee: ${f.memFee} stroops</div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Ledger Reads</div>
        <div class="metric-value">${r.profile.readEntries}</div>
        <div class="metric-sub">${r.profile.readBytes} bytes · ${f.readFee} stroops</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Ledger Writes</div>
        <div class="metric-value">${r.profile.writeEntries}</div>
        <div class="metric-sub">${r.profile.writeBytes} bytes · ${f.writeFee} stroops</div>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-label">Fee Breakdown</div>
      <div class="metric-sub" style="margin-top:6px;line-height:2">
        Base: 100 stroops &nbsp;|&nbsp;
        Inclusion: 100 stroops &nbsp;|&nbsp;
        CPU: ${f.cpuFee} &nbsp;|&nbsp;
        Mem: ${f.memFee} &nbsp;|&nbsp;
        Read: ${f.readFee} &nbsp;|&nbsp;
        Write: ${f.writeFee} &nbsp;|&nbsp;
        Events: ${f.eventFee}
      </div>
    </div>
  `;
}

function renderStorageResults(r) {
  $('profiler-results').innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Write Cost</div>
        <div class="metric-value">${r.writeFeeStroops.toLocaleString()} stroops</div>
        <div class="metric-sub">${(r.writeFeeStroops / 10_000_000).toFixed(7)} XLM</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Bytes</div>
        <div class="metric-value">${r.totalBytes.toLocaleString()}</div>
        <div class="metric-sub">${r.entryCount} entries × ${r.entrySize} bytes</div>
      </div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Storage Type</div>
      <div class="metric-value" style="font-size:15px;text-transform:capitalize">${r.storageType}</div>
      <div class="metric-sub" style="margin-top:4px">${r.ttlNote}</div>
    </div>
    ${r.rentFeeStroops > 0 ? `
    <div class="metric-card">
      <div class="metric-label">Rent Fee (100 ledger estimate)</div>
      <div class="metric-value">${r.rentFeeStroops.toLocaleString()} stroops</div>
    </div>` : ''}
  `;
}

// ── Analyzer ──────────────────────────────────────────────────────────────────
function initAnalyzer() {
  $('analyze-btn').addEventListener('click', () => {
    const code = $('analyzer-input').value.trim();
    if (!code) { showToast('Paste some contract code first', 'error'); return; }
    const { findings, counts } = Analyzer.analyze(code);
    renderAnalyzerResults(findings, counts);
  });

  $('load-token-sample').addEventListener('click', () => {
    $('analyzer-input').value = Analyzer.SAMPLES.token;
  });

  $('load-escrow-sample').addEventListener('click', () => {
    $('analyzer-input').value = Analyzer.SAMPLES.escrow;
  });
}

function renderAnalyzerResults(findings, counts) {
  const icons = { error: '✗', warning: '⚠', info: 'ℹ', pass: '✓' };

  const summary = `
    <div class="analysis-summary">
      ${counts.error   ? `<div class="summary-pill pill-error">${icons.error} ${counts.error} error${counts.error > 1 ? 's' : ''}</div>` : ''}
      ${counts.warning ? `<div class="summary-pill pill-warning">${icons.warning} ${counts.warning} warning${counts.warning > 1 ? 's' : ''}</div>` : ''}
      ${counts.info    ? `<div class="summary-pill pill-info">${icons.info} ${counts.info} suggestion${counts.info > 1 ? 's' : ''}</div>` : ''}
      ${counts.pass    ? `<div class="summary-pill pill-pass">${icons.pass} ${counts.pass} passed</div>` : ''}
    </div>`;

  const items = findings.map(f => `
    <div class="finding ${f.level}">
      <div class="finding-icon">${icons[f.level]}</div>
      <div class="finding-body">
        <div class="finding-title">${f.title}</div>
        <div class="finding-desc">${f.desc}</div>
        ${f.fix ? `<div class="finding-fix">→ ${f.fix}</div>` : ''}
      </div>
    </div>`).join('');

  $('analyzer-results').innerHTML = summary + items;
}

// ── Docs ──────────────────────────────────────────────────────────────────────
function initDocs() {
  const nav     = $('docs-nav');
  const content = $('docs-content');

  // Build nav
  const groups = {};
  DocsContent.SECTIONS.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  let navHtml = '';
  Object.entries(groups).forEach(([group, sections]) => {
    navHtml += `<div class="docs-nav-section">${group}</div>`;
    sections.forEach(s => {
      navHtml += `<div class="docs-nav-item" data-id="${s.id}">${s.label}</div>`;
    });
  });
  nav.innerHTML = navHtml;

  // Click handler
  nav.addEventListener('click', e => {
    const item = e.target.closest('.docs-nav-item');
    if (!item) return;
    $$('.docs-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    content.innerHTML = DocsContent.PAGES[item.dataset.id] || '<p>Coming soon.</p>';
  });

  // Load first page
  const first = DocsContent.SECTIONS[0];
  nav.querySelector(`[data-id="${first.id}"]`).classList.add('active');
  content.innerHTML = DocsContent.PAGES[first.id];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyText(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = $(btnId);
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function showToast(msg, type = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}
