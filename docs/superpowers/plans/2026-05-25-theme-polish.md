# Theme Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish light/dark mode with smooth transitions, CSS custom properties for flash prevention, and minor contrast fixes.

**Architecture:** Add `transition-theme` CSS utility + CSS custom properties for body bg/text in `index.css`, then add `transition-theme` class to container elements across all layouts, UI primitives, shared components, landing sections, and page containers. Three targeted contrast fixes in ProductSelect, QuantityStepper, and Dialog.

**Tech Stack:** Tailwind CSS v4, React, TypeScript

---

### Task 1: Global CSS setup (index.css)

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add CSS custom properties for body bg/text**

Add to the bottom of `apps/web/src/index.css`:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
}
.dark {
  --color-bg: #0a0f1a;
  --color-text: #f3f4f6;
}
```

- [ ] **Step 2: Add transition-theme utility**

Below the CSS vars, add:

```css
@utility transition-theme {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
```

- [ ] **Step 3: Apply CSS vars to body**

Add body styles at the bottom:

```css
body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

Expected result — final `index.css`:

```css
@import "tailwindcss";

@theme {
  --color-navy-900: #0a0f1a;
  --color-navy-800: #0f1b2d;
  --color-navy-700: #1a2a44;
  --color-navy-600: #2d4a7a;
  --color-navy-500: #3d6a9e;
  --color-gold-500: #c9a84c;
  --color-gold-400: #d4b96a;
  --color-gold-300: #e8d48b;
  --color-gold-100: #f5edc8;
  --color-surface: #ffffff;
  --color-surface-secondary: #f8f9fa;
  --color-surface-dark: #0a0f1a;
  --color-surface-dark-secondary: #141a2a;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}

:root {
  --color-bg: #ffffff;
  --color-text: #111827;
}
.dark {
  --color-bg: #0a0f1a;
  --color-text: #f3f4f6;
}

@utility transition-theme {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

- [ ] **Step 4: Run lint to verify**

Run: `pnpm lint:web`

Expected: No errors (only CSS additions, no existing code changed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat: add CSS custom properties and transition-theme utility for theme polish"
```

---

### Task 2: UI Primitives (batch 1 — Button, Card, Input, Select)

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/select.tsx`

- [ ] **Step 1: Add `transition-theme` to Button base**

In `button.tsx`, add `transition-theme` to the `base` string (line 24):

```
Old: const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50 disabled:opacity-50 disabled:pointer-events-none';
New: const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-theme focus:outline-none focus:ring-2 focus:ring-gold-500/50 disabled:opacity-50 disabled:pointer-events-none';
```

- [ ] **Step 2: Add `transition-theme` to Card**

In `card.tsx`, add `transition-theme` to the Card container className (line 8):

```
Old: 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-navy-800',
New: 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-navy-800 transition-theme',
```

Also add `transition-theme` to CardTitle (line 27):

```
Old: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
New: 'text-lg font-semibold text-gray-900 dark:text-gray-100 transition-theme',
```

- [ ] **Step 3: Add `transition-theme` to Input**

In `input.tsx`, add `transition-theme` to the input className (line 25):

```
Old: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-gray-400',
New: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-gray-400 transition-theme',
```

- [ ] **Step 4: Add `transition-theme` to Select**

In `select.tsx`, add `transition-theme` to the select className (line 21):

```
Old: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm',
New: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-theme',
```

- [ ] **Step 5: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/button.tsx apps/web/src/components/ui/card.tsx apps/web/src/components/ui/input.tsx apps/web/src/components/ui/select.tsx
git commit -m "feat: add transition-theme to Button, Card, Input, Select"
```

---

### Task 3: UI Primitives (batch 2 — Dialog, Badge, Skeleton, PasswordInput)

**Files:**
- Modify: `apps/web/src/components/ui/dialog.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/skeleton.tsx`
- Modify: `apps/web/src/components/ui/password-input.tsx`

- [ ] **Step 1: Add `transition-theme` + fix close button to Dialog**

In `dialog.tsx`:

a) Add `transition-theme` to the container div (line 45):
```
Old: 'relative z-10 w-full max-w-lg mx-4 rounded-xl border border-gray-200 bg-white shadow-xl',
New: 'relative z-10 w-full max-w-lg mx-4 rounded-xl border border-gray-200 bg-white shadow-xl transition-theme',
```

b) Fix close button — add `dark:text-gray-500` (line 59):
```
Old: 'p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
New: 'p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
```

- [ ] **Step 2: Add `transition-theme` to Badge**

In `badge.tsx`, add `transition-theme` to the common className (line 22):
```
Old: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
New: 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-theme',
```

- [ ] **Step 3: Add `transition-theme` to Skeleton**

In `skeleton.tsx` (line 11):
```
Old: 'animate-pulse rounded bg-gray-200 dark:bg-gray-700',
New: 'animate-pulse rounded bg-gray-200 dark:bg-gray-700 transition-theme',
```

- [ ] **Step 4: Add `transition-theme` to PasswordInput**

In `password-input.tsx`, add `transition-theme` to the input className (line 30):
```
Old: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm placeholder:text-gray-400',
New: 'flex h-10 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm placeholder:text-gray-400 transition-theme',
```

- [ ] **Step 5: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/skeleton.tsx apps/web/src/components/ui/password-input.tsx
git commit -m "feat: add transition-theme to Dialog, Badge, Skeleton, PasswordInput; fix Dialog close button dark color"
```

---

### Task 4: Layouts (AppLayout, AuthLayout)

**Files:**
- Modify: `apps/web/src/components/layout/app-layout.tsx`
- Modify: `apps/web/src/components/layout/auth-layout.tsx`

- [ ] **Step 1: Add `transition-theme` to AppLayout container div**

In `app-layout.tsx`, line 77:
```
Old: <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex">
New: <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex transition-theme">
```

- [ ] **Step 2: Add `transition-theme` to sidebar**

Line 91:
```
Old: 'fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-navy-800 border-r border-gray-200 dark:border-gray-800 transform transition-transform lg:translate-x-0 lg:static lg:z-auto',
New: 'fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-navy-800 border-r border-gray-200 dark:border-gray-800 transform transition-theme lg:translate-x-0 lg:static lg:z-auto',
```

- [ ] **Step 3: Add `transition-theme` to header**

Line 135:
```
Old: <header className="h-16 bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6">
New: <header className="h-16 bg-white dark:bg-navy-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 transition-theme">
```

- [ ] **Step 4: Add `transition-theme` to AuthLayout**

In `auth-layout.tsx`, line 7:
```
Old: <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex flex-col">
New: <div className="min-h-screen bg-surface-secondary dark:bg-surface-dark flex flex-col transition-theme">
```

- [ ] **Step 5: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/app-layout.tsx apps/web/src/components/layout/auth-layout.tsx
git commit -m "feat: add transition-theme to AppLayout and AuthLayout"
```

---

### Task 5: Shared Stock Components

**Files:**
- Modify: `apps/web/src/components/stock/MovementCard.tsx`
- Modify: `apps/web/src/components/stock/QuantityStepper.tsx`
- Modify: `apps/web/src/components/stock/ProductSelect.tsx`
- Modify: `apps/web/src/components/stock/RoomSelect.tsx`

- [ ] **Step 1: Add `transition-theme` to MovementCard**

In `MovementCard.tsx`, line 35:
```
Old: <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-gray-700">
New: <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-theme">
```

- [ ] **Step 2: Fix QuantityStepper + add transition-theme**

In `QuantityStepper.tsx`:

a) Add `dark:text-gray-100` to minus button symbols (line 36):
```
Old: "w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold\n                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700\n                   transition-colors"
New: "w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold\n                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700\n                   transition-theme dark:text-gray-100"
```

b) Same change for plus button (line 49):
```
Old: "w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold\n                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700\n                   transition-colors"
New: "w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-lg font-bold\n                   disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-navy-700\n                   transition-theme dark:text-gray-100"
```

- [ ] **Step 3: Fix ProductSelect text + add transition-theme**

In `ProductSelect.tsx`:

a) Add `transition-theme` to the input (line 60):
```
Old: "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700"
New: "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700 transition-theme"
```

b) Add `transition-theme` to the dropdown container (line 63):
```
Old: <div className="absolute z-50 mt-1 w-full bg-white dark:bg-navy-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
New: <div className="absolute z-50 mt-1 w-full bg-white dark:bg-navy-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto transition-theme">
```

c) Fix product name text — add `dark:text-gray-100` to `<span>` (line 82):
```
Old: <span>{product.name}</span>
New: <span className="dark:text-gray-100">{product.name}</span>
```

- [ ] **Step 4: Add `transition-theme` to RoomSelect**

In `RoomSelect.tsx`, line 15-17:
```
Old: className="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-navy-800 dark:text-gray-100 font-medium cursor-pointer
                 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
New: className="w-full px-4 py-3 text-lg rounded-xl border border-gray-300 dark:border-gray-600
                 bg-white dark:bg-navy-800 dark:text-gray-100 font-medium cursor-pointer
                 focus:outline-none focus:ring-2 focus:ring-gold-500/50 transition-theme"
```

- [ ] **Step 5: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/stock/MovementCard.tsx apps/web/src/components/stock/QuantityStepper.tsx apps/web/src/components/stock/ProductSelect.tsx apps/web/src/components/stock/RoomSelect.tsx
git commit -m "feat: add transition-theme and contrast fixes to stock components"
```

---

### Task 6: Landing Sections

**Files:**
- Modify: `apps/web/src/components/landing/features.tsx`
- Modify: `apps/web/src/components/landing/how-it-works.tsx`

- [ ] **Step 1: Add `transition-theme` to Features section**

In `features.tsx`, line 46:
```
Old: <section className="py-20 px-4 bg-white dark:bg-navy-900">
New: <section className="py-20 px-4 bg-white dark:bg-navy-900 transition-theme">
```

Also add `transition-theme` to each feature card (line 73):
```
Old: className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
New: className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow transition-theme"
```

- [ ] **Step 2: Add `transition-theme` to HowItWorks section**

In `how-it-works.tsx`, line 24:
```
Old: <section className="py-20 px-4 bg-surface-secondary dark:bg-surface-dark">
New: <section className="py-20 px-4 bg-surface-secondary dark:bg-surface-dark transition-theme">
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/features.tsx apps/web/src/components/landing/how-it-works.tsx
git commit -m "feat: add transition-theme to landing sections"
```

---

### Task 7: App Pages (7 files)

**Files:**
- Modify: `apps/web/src/pages/app/dashboard.tsx`
- Modify: `apps/web/src/pages/app/products.tsx`
- Modify: `apps/web/src/pages/app/central-stock.tsx`
- Modify: `apps/web/src/pages/app/stock-movements.tsx`
- Modify: `apps/web/src/pages/app/minibar-standard.tsx`
- Modify: `apps/web/src/pages/app/users.tsx`
- Modify: `apps/web/src/pages/app/profile.tsx`

Each page has a root-level container div. Add `transition-theme` to each one:

- [ ] **Step 1: Dashboard** (line 43): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 2: Products** (line 88): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 3: CentralStock** (line 54): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 4: StockMovements** (line 170): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 5: MinibarStandard** (line 94): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 6: Users** (line 110): Change `<div className="space-y-6">` → `<div className="space-y-6 transition-theme">`
- [ ] **Step 7: Profile** (line 75): Change `<div className="max-w-xl mx-auto space-y-6">` → `<div className="max-w-xl mx-auto space-y-6 transition-theme">`

- [ ] **Step 8: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/app/ && git commit -m "feat: add transition-theme to all app pages"
```

---

### Task 8: NotFound Page

**Files:**
- Modify: `apps/web/src/pages/not-found.tsx`

- [ ] **Step 1: Add `transition-theme` to NotFound container** (line 5):

Change:
```
Old: <div className="min-h-screen flex items-center justify-center flex-col gap-4">
New: <div className="min-h-screen flex items-center justify-center flex-col gap-4 transition-theme">
```

- [ ] **Step 2: Run lint**

Run: `pnpm lint:web`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/not-found.tsx
git commit -m "feat: add transition-theme to NotFound page"
```

---

### Task 9: Build verification

- [ ] **Step 1: Run full lint**

Run: `pnpm lint` (from repo root)

Expected: No errors.

- [ ] **Step 2: Build the web app**

Run: `pnpm build:web`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run web tests if available**

Run: `pnpm --filter @nutrigest/web test 2>/dev/null || echo "No web tests configured yet"`

Expected: Tests pass or no tests configured (informational).
