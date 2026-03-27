# Responsive Design System

Fidelis Soroban DApp — style guidelines and component reference.

---

## Breakpoints

| Token   | Value  | Target                        |
|---------|--------|-------------------------------|
| `xs`    | 480px  | Small phones (portrait)       |
| `sm`    | 640px  | Large phones / small tablets  |
| `md`    | 768px  | Tablets (portrait)            |
| `lg`    | 1024px | Tablets (landscape) / laptops |
| `xl`    | 1280px | Desktops                      |
| `2xl`   | 1536px | Wide desktops                 |

Use **mobile-first**: write base styles for mobile, then override upward with `min-width` queries.

```css
/* ✅ mobile-first */
.my-component { font-size: var(--text-sm); }
@media (min-width: 768px) { .my-component { font-size: var(--text-base); } }
```

---

## Design Tokens

All tokens live in `src/styles/responsive.css` (`:root`) and `src/theme/tokens.ts`.

### Fluid Typography
Scales smoothly between viewport sizes using `clamp()`. Never set raw `px` font sizes.

```css
font-size: var(--text-base);   /* clamp(0.875rem, 2vw, 1rem) */
font-size: var(--text-2xl);    /* clamp(1.25rem, 3.5vw, 1.5rem) */
```

| Token          | Range            |
|----------------|------------------|
| `--text-xs`    | 0.65 – 0.75 rem  |
| `--text-sm`    | 0.75 – 0.875 rem |
| `--text-base`  | 0.875 – 1 rem    |
| `--text-lg`    | 1 – 1.125 rem    |
| `--text-xl`    | 1.125 – 1.25 rem |
| `--text-2xl`   | 1.25 – 1.5 rem   |
| `--text-3xl`   | 1.5 – 2 rem      |
| `--text-4xl`   | 1.75 – 2.5 rem   |

### Fluid Spacing
Use `--space-*` instead of raw pixel values for consistent density scaling.

```css
padding: var(--space-4);   /* clamp(8px, 2vw, 16px) */
gap:     var(--space-6);   /* clamp(16px, 3vw, 24px) */
```

### Color Tokens (from `tokens.ts`)
| Token                    | Purpose                  |
|--------------------------|--------------------------|
| `--color-highlight`      | Primary CTA / accent     |
| `--color-bg-primary`     | Page background          |
| `--color-bg-secondary`   | Card / panel background  |
| `--color-bg-tertiary`    | Input / chip background  |
| `--color-text-primary`   | Body text                |
| `--color-text-secondary` | Secondary / label text   |
| `--color-text-muted`     | Placeholder / hint text  |
| `--color-border`         | Default border           |
| `--color-success/warning/error` | Status colors     |

---

## Layout System

### AppShell
Full-page grid shell. Use for every top-level page.

```tsx
import { AppShell, SkipLink } from './components/ResponsiveLayout';

<>
  <SkipLink />
  <AppShell
    header={<NavBar />}
    sidebar={<SideNav />}          // hidden on mobile, use Drawer instead
    footer={<Footer />}
  >
    <PageContent />
  </AppShell>
</>
```

Variants: `sidebarVariant="compact"` (64px icon-only), `"right"` (right-side panel).

### Containers
```html
<div class="container">      <!-- max 1280px, responsive padding -->
<div class="container-lg">   <!-- max 1024px -->
<div class="container-fluid"> <!-- full width -->
```

### Responsive Grid
```tsx
// Auto-fit: columns fill available space
<ResponsiveGrid minColWidth="240px">
  <Card /><Card /><Card />
</ResponsiveGrid>

// Fixed columns per breakpoint
<ResponsiveGrid cols={{ xs: 1, sm: 2, lg: 3, xl: 4 }}>
  ...
</ResponsiveGrid>
```

CSS-only equivalent:
```html
<div class="grid-auto-md">   <!-- auto-fit, min 240px -->
<div class="grid-cols-3">    <!-- 3 cols → 2 on tablet → 1 on mobile -->
```

### ResponsiveStack
Switches from column (mobile) to row (desktop) at a configurable breakpoint.
```tsx
<ResponsiveStack switchAt="md" gap="var(--space-4)">
  <Sidebar />
  <MainContent />
</ResponsiveStack>
```

---

## Navigation Patterns

### Desktop: Sidebar nav
Use `AppShell` with a `sidebar` prop. The sidebar is always visible.

### Mobile: Drawer + BottomTabBar
```tsx
const [drawerOpen, setDrawerOpen] = useState(false);

<Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
  <SideNav />
</Drawer>

<BottomTabBar
  items={[
    { id: 'home',     label: 'Home',     icon: '🏠' },
    { id: 'transfer', label: 'Transfer', icon: '↗️', badge: 3 },
    { id: 'history',  label: 'History',  icon: '📋' },
  ]}
  activeId={activeTab}
  onChange={setActiveTab}
/>
```

The `Drawer` component automatically:
- Traps keyboard focus inside
- Closes on `Escape`
- Locks body scroll
- Handles `aria-modal` and `role="dialog"`

---

## Visibility Utilities

```html
<!-- CSS classes -->
<div class="mobile-only">  Visible only on mobile (<768px)  </div>
<div class="desktop-only"> Visible only on desktop (≥768px) </div>
<div class="tablet-only">  Visible only on tablet (640–1023px) </div>

<div class="hide-md">  Hidden below 768px  </div>
<div class="show-lg">  Shown at 1024px+    </div>
```

```tsx
// React components (CSS-class-based, no layout shift)
<Show above="md"><DesktopWidget /></Show>
<Hide below="sm"><MobileOnlyBanner /></Hide>
```

---

## Device-Specific Optimizations

### Touch devices (`pointer: coarse`)
All interactive elements automatically get `min-height: 44px` (Apple HIG / WCAG 2.5.5).
The `.touch-target` utility class enforces this explicitly.

### Landscape phones
When `orientation: landscape` and `max-height: 500px` (short landscape), vertical padding is reduced and the bottom tab bar is hidden to maximize content area.

### Tablet landscape
The sidebar widens to `--sidebar-width-wide` (280px) for better use of horizontal space.

### Notched devices (safe areas)
Use utility classes or CSS variables for safe area insets:
```css
padding-bottom: env(safe-area-inset-bottom, 0);
/* or */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
```
The `BottomTabBar` and `Drawer` apply these automatically.

---

## Accessibility

### Skip link
`<SkipLink />` renders a visually-hidden "Skip to main content" link that becomes visible on focus. Place it as the first element in the tree. The `AppShell` sets `id="main-content"` on `<main>` automatically.

### Focus management
- `Drawer` and `ResponsiveModal` trap focus and restore it on close.
- All interactive elements have visible `:focus-visible` outlines (from `a11y.css`).
- Keyboard navigation: `Escape` closes modals/drawers.

### ARIA
- `BottomTabBar` uses `aria-label`, `aria-current="page"`, and `aria-hidden` on decorative icons.
- `Drawer` uses `role="dialog"`, `aria-modal="true"`.
- `ResponsiveModal` uses `aria-labelledby` when a title is provided.

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
```
This is applied globally in `index.css`.

### Color contrast
The `high-contrast` color scheme (selectable via `ThemeCustomizer`) uses `#ffff00` / `#0000ff` accents and removes all box shadows.

---

## Responsive Modal

Bottom-sheet on mobile, centered dialog on desktop — automatically.

```tsx
<ResponsiveModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Transfer"
>
  <p>Are you sure?</p>
  <button onClick={confirm}>Confirm</button>
</ResponsiveModal>
```

---

## Responsive Table

```html
<!-- Scrollable on mobile -->
<div class="table-responsive">
  <table>...</table>
</div>

<!-- Card layout on mobile (add data-label to each td) -->
<table class="table-card-mobile">
  <thead>...</thead>
  <tbody>
    <tr>
      <td data-label="Amount">100 XLM</td>
      <td data-label="Status">Pending</td>
    </tr>
  </tbody>
</table>
```

---

## useResponsive Hook

```tsx
import { useResponsive } from '../hooks/useResponsive';

function MyComponent() {
  const { isMobile, isTablet, isDesktop, isLandscape, isTouch, isMin, breakpoint } = useResponsive();

  return (
    <div style={{ padding: isMin('lg') ? 'var(--space-8)' : 'var(--space-4)' }}>
      {isMobile && <MobileView />}
      {isTablet && <TabletView />}
      {isDesktop && <DesktopView />}
    </div>
  );
}
```

`useBreakpoint()` — returns just the current breakpoint string, lighter re-render footprint.
`useMediaQuery(query)` — reactive wrapper around `window.matchMedia`.

---

## Cross-Platform Checklist

Before shipping a new screen or component, verify:

- [ ] Renders correctly at 320px, 375px, 768px, 1024px, 1440px
- [ ] Portrait and landscape orientations on mobile/tablet
- [ ] Touch targets ≥ 44×44px on all interactive elements
- [ ] No horizontal scroll on any viewport
- [ ] Keyboard navigable (Tab, Shift+Tab, Enter, Escape, Arrow keys)
- [ ] Skip link visible on focus
- [ ] Works with `prefers-reduced-motion: reduce`
- [ ] Works with `prefers-color-scheme: dark` and light themes
- [ ] Safe area insets applied on notched devices
- [ ] Tested in Chrome, Firefox, Safari (desktop + mobile)
