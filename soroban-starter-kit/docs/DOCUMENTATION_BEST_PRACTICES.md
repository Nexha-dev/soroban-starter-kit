# Documentation Best Practices & Training

## Why Documentation Matters

Good documentation:
- Lets new contributors onboard in hours, not days
- Prevents misuse of contract functions (especially auth-sensitive ones)
- Serves as the first line of security review for smart contracts

---

## Quick-Start Checklist for New Contributors

1. Read `docs/DOCUMENTATION_STANDARDS.md` before writing any code.
2. Install the project: `npm ci`
3. Run `npm run docs:check` — fix any reported gaps before opening a PR.
4. Use the templates below as copy-paste starting points.

---

## Templates

### TypeScript utility function
```ts
/**
 * <One-line summary>.
 *
 * @param paramName - Description.
 * @returns Description of return value.
 *
 * @example
 * const result = myFunction(arg);
 */
export function myFunction(paramName: Type): ReturnType { ... }
```

### React component
```tsx
/**
 * <One-line summary>.
 *
 * @param props.foo - Description.
 * @param props.bar - Description.
 */
export function MyComponent({ foo, bar }: MyComponentProps) { ... }
```

### Rust contract function
```rust
/// <One-line summary>.
///
/// # Arguments
/// * `param` - Description.
///
/// # Errors
/// Returns [`ContractError::Variant`] when <condition>.
///
/// # Authorization
/// Requires auth from `<address>`.
pub fn my_fn(env: Env, param: Type) -> Result<(), ContractError> { ... }
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Empty doc comment `/** */` | Write at least a one-line summary |
| `@param x` with no description | Add a meaningful description after the name |
| Missing `# Errors` on fallible Rust fns | List every error variant that can be returned |
| Missing `# Authorization` on auth-gated fns | State which address must sign |
| Documenting implementation details instead of behaviour | Describe *what*, not *how* |

---

## Automated Checks

`npm run docs:check` runs two validators:

1. **TypeScript** — `eslint-plugin-jsdoc` enforces JSDoc on all exported symbols.
2. **Rust** — `scripts/check-rust-docs.sh` scans `pub fn` lines in `#[contractimpl]` blocks and reports missing doc comments.

Both checks run in CI on every PR. A failing check blocks merge.

---

## Documentation Review Process

1. Author runs `npm run docs:check` locally and fixes all issues.
2. Reviewer uses the checklist in `DOCUMENTATION_STANDARDS.md`.
3. If a doc comment is unclear, the reviewer leaves a comment — the author must update the doc (not just the code).
4. Docs-only PRs (fixing or adding comments) are fast-tracked and need only one approval.
