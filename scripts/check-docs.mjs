#!/usr/bin/env node
/**
 * Documentation coverage checker for TypeScript and Rust sources.
 *
 * Usage:
 *   node scripts/check-docs.mjs           # fail on violations
 *   node scripts/check-docs.mjs --report  # print JSON report and exit 0
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const REPORT_MODE = process.argv.includes('--report');

// ── helpers ──────────────────────────────────────────────────────────────────

function walk(dir, ext) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walk(full, ext));
    } else if (extname(full) === ext) {
      results.push(full);
    }
  }
  return results;
}

// ── TypeScript / TSX coverage ─────────────────────────────────────────────────

/**
 * Counts exported symbols and how many have a JSDoc comment immediately above.
 * This is a lightweight heuristic — ESLint provides the authoritative check.
 */
function checkTypeScript(srcDir) {
  const files = walk(srcDir, '.ts').concat(walk(srcDir, '.tsx'));
  const violations = [];
  let total = 0;
  let documented = 0;

  const exportRe = /^export\s+(async\s+)?(function|const|class|interface|type)\s+(\w+)/;
  const jsdocEndRe = /\*\//;

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(exportRe);
      if (!m) continue;
      total++;
      // Look back up to 10 lines for a closing */
      let hasDoc = false;
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        if (jsdocEndRe.test(lines[j])) { hasDoc = true; break; }
        if (lines[j].trim() && !lines[j].trim().startsWith('*') && !lines[j].trim().startsWith('/*')) break;
      }
      if (hasDoc) {
        documented++;
      } else {
        violations.push({ file, line: i + 1, symbol: m[3] });
      }
    }
  }

  return { total, documented, violations };
}

// ── Rust coverage ─────────────────────────────────────────────────────────────

/**
 * Checks that every `pub fn` inside a `#[contractimpl]` block has a `///` doc
 * comment on the line immediately above it.
 */
function checkRust(contractsDir) {
  let files;
  try {
    files = walk(contractsDir, '.rs');
  } catch {
    return { total: 0, documented: 0, violations: [] };
  }

  const violations = [];
  let total = 0;
  let documented = 0;

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let inContractImpl = false;
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('#[contractimpl]')) { inContractImpl = true; depth = 0; }
      if (inContractImpl) {
        depth += (line.match(/\{/g) || []).length;
        depth -= (line.match(/\}/g) || []).length;
        if (depth < 0) { inContractImpl = false; continue; }
      }

      if (!inContractImpl) continue;

      if (/^\s+pub fn /.test(line)) {
        total++;
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        if (prevLine.startsWith('///')) {
          documented++;
        } else {
          const fnName = (line.match(/pub fn (\w+)/) || [])[1] || '?';
          violations.push({ file, line: i + 1, symbol: fnName });
        }
      }
    }
  }

  return { total, documented, violations };
}

// ── main ──────────────────────────────────────────────────────────────────────

const root = new URL('..', import.meta.url).pathname;
const ts = checkTypeScript(join(root, 'src'));
const rust = checkRust(join(root, 'soroban-starter-kit', 'contracts'));

const tsCoverage = ts.total ? Math.round((ts.documented / ts.total) * 100) : 100;
const rustCoverage = rust.total ? Math.round((rust.documented / rust.total) * 100) : 100;

const report = {
  timestamp: new Date().toISOString(),
  typescript: { total: ts.total, documented: ts.documented, coverage: `${tsCoverage}%`, violations: ts.violations },
  rust: { total: rust.total, documented: rust.documented, coverage: `${rustCoverage}%`, violations: rust.violations },
};

if (REPORT_MODE) {
  const outPath = join(root, 'docs-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Documentation report written to docs-report.json`);
  console.log(`TypeScript: ${tsCoverage}% (${ts.documented}/${ts.total})`);
  console.log(`Rust:       ${rustCoverage}% (${rust.documented}/${rust.total})`);
  process.exit(0);
}

// Print summary
console.log(`\nDocumentation Coverage`);
console.log(`  TypeScript : ${tsCoverage}% (${ts.documented}/${ts.total} exported symbols)`);
console.log(`  Rust       : ${rustCoverage}% (${rust.documented}/${rust.total} public contract fns)\n`);

const allViolations = [...ts.violations, ...rust.violations];
if (allViolations.length) {
  console.error(`Missing documentation (${allViolations.length} violations):\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.symbol}`);
  }
  console.error('\nRun `npm run docs:report` to save a full JSON report.');
  process.exit(1);
}

console.log('All documented. ✓');
