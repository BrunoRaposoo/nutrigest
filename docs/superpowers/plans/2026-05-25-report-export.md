# Report Export (CSV + PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV download (frontend) and PDF generation (backend) for the 3 existing dashboard reports.

**Architecture:** Backend (NestJS + pdfkit) generates PDF buffers returned via 3 new controller endpoints; frontend uses a reusable `useDownloadReport` hook to trigger blob downloads from both existing CSV and new PDF endpoints.

**Tech Stack:** pdfkit (PDF generation on backend), Fastify reply (response streaming), React hooks (blob download on frontend)

---

### Task 1: Create feature branch

- [ ] **Create branch `feat/report-export` from `dev` carrying unstaged changes**

```bash
git checkout -b feat/report-export dev
```

- [ ] **Verify branch is correct**

```bash
git branch --show-current
```
Expected: `feat/report-export`

---

### Task 2: Add 6 download query hooks to `use-dashboard-queries.ts`

**Files:**
- Modify: `apps/web/src/hooks/queries/use-dashboard-queries.ts`

- [ ] **Add the 6 export hooks after the `useCategoryDistribution` export**

```typescript
import { useDownloadReport } from '../use-download-report';

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

export function useConsumptionByRoomCsv(from?: string, to?: string) {
  const url = `/dashboard/consumption-by-room/csv${buildQueryString({ from, to })}`;
  return useDownloadReport(url, 'consumption-by-room.csv', 'csv');
}

export function useConsumptionByRoomPdf(from?: string, to?: string) {
  const url = `/dashboard/consumption-by-room/pdf${buildQueryString({ from, to })}`;
  return useDownloadReport(url, 'consumption-by-room.pdf', 'pdf');
}

export function useMealRankingCsv(from?: string, to?: string, limit?: string) {
  const url = `/dashboard/meal-ranking/csv${buildQueryString({ from, to })}${limit ? `&limit=${limit}` : ''}`;
  return useDownloadReport(url, 'meal-ranking.csv', 'csv');
}

export function useMealRankingPdf(from?: string, to?: string, limit?: string) {
  const url = `/dashboard/meal-ranking/pdf${buildQueryString({ from, to })}${limit ? `&limit=${limit}` : ''}`;
  return useDownloadReport(url, 'meal-ranking.pdf', 'pdf');
}

export function useStockHistoryCsv(productId: string, from?: string, to?: string) {
  const url = `/dashboard/stock-history/${productId}/csv${buildQueryString({ from, to })}`;
  return useDownloadReport(url, 'stock-history.csv', 'csv');
}

export function useStockHistoryPdf(productId: string, from?: string, to?: string) {
  const url = `/dashboard/stock-history/${productId}/pdf${buildQueryString({ from, to })}`;
  return useDownloadReport(url, 'stock-history.pdf', 'pdf');
}
```

- [ ] **Run lint to verify**

```bash
pnpm lint 2>&1 | tail -20
```
Expected: no errors

---

### Task 3: Refactor dashboard.tsx to use the new hooks

**Files:**
- Modify: `apps/web/src/pages/app/dashboard.tsx`

- [ ] **Replace import:** remove `useDownloadReport` import, keep `useProducts` import, add imports for the 6 new hooks from `use-dashboard-queries`

Replace:
```typescript
import { useDownloadReport } from '../../hooks/use-download-report';
```
With nothing (remove this line).

Add to the existing import from `use-dashboard-queries`:
```typescript
import {
  useCategoryDistribution,
  useConsumptionByRoomCsv,
  useConsumptionByRoomPdf,
  useDashboardSummary,
  useMealRankingCsv,
  useMealRankingPdf,
  useMonthlyConsumption,
  useRoomComparison,
  useStockHistoryCsv,
  useStockHistoryPdf,
} from '../../hooks/queries/use-dashboard-queries';
```

- [ ] **Replace the 6 `useDownloadReport` calls** with the new hooks

Replace the entire block:
```typescript
  const {
    download: downloadConsumptionCsv,
    isDownloading: isConsumptionCsvLoading,
  } = useDownloadReport(
    `/dashboard/consumption-by-room/csv${consumptionFrom || consumptionTo ? `?${new URLSearchParams({ ...(consumptionFrom && { from: consumptionFrom }), ...(consumptionTo && { to: consumptionTo }) }).toString()}` : ''}`,
    'consumption-by-room.csv',
    'csv',
  );
  const {
    download: downloadConsumptionPdf,
    isDownloading: isConsumptionPdfLoading,
  } = useDownloadReport(
    `/dashboard/consumption-by-room/pdf${consumptionFrom || consumptionTo ? `?${new URLSearchParams({ ...(consumptionFrom && { from: consumptionFrom }), ...(consumptionTo && { to: consumptionTo }) }).toString()}` : ''}`,
    'consumption-by-room.pdf',
    'pdf',
  );
  const {
    download: downloadRankingCsv,
    isDownloading: isRankingCsvLoading,
  } = useDownloadReport(
    `/dashboard/meal-ranking/csv${rankingFrom || rankingTo ? `?${new URLSearchParams({ ...(rankingFrom && { from: rankingFrom }), ...(rankingTo && { to: rankingTo }) }).toString()}` : ''}${rankingLimit ? `&limit=${rankingLimit}` : ''}`,
    'meal-ranking.csv',
    'csv',
  );
  const {
    download: downloadRankingPdf,
    isDownloading: isRankingPdfLoading,
  } = useDownloadReport(
    `/dashboard/meal-ranking/pdf${rankingFrom || rankingTo ? `?${new URLSearchParams({ ...(rankingFrom && { from: rankingFrom }), ...(rankingTo && { to: rankingTo }) }).toString()}` : ''}${rankingLimit ? `&limit=${rankingLimit}` : ''}`,
    'meal-ranking.pdf',
    'pdf',
  );
  const {
    download: downloadHistoryCsv,
    isDownloading: isHistoryCsvLoading,
  } = useDownloadReport(
    `/dashboard/stock-history/${historyProductId}/csv${historyFrom || historyTo ? `?${new URLSearchParams({ ...(historyFrom && { from: historyFrom }), ...(historyTo && { to: historyTo }) }).toString()}` : ''}`,
    'stock-history.csv',
    'csv',
  );
  const {
    download: downloadHistoryPdf,
    isDownloading: isHistoryPdfLoading,
  } = useDownloadReport(
    `/dashboard/stock-history/${historyProductId}/pdf${historyFrom || historyTo ? `?${new URLSearchParams({ ...(historyFrom && { from: historyFrom }), ...(historyTo && { to: historyTo }) }).toString()}` : ''}`,
    'stock-history.pdf',
    'pdf',
  );
```

With:
```typescript
  const { download: downloadConsumptionCsv, isDownloading: isConsumptionCsvLoading } =
    useConsumptionByRoomCsv(consumptionFrom, consumptionTo);
  const { download: downloadConsumptionPdf, isDownloading: isConsumptionPdfLoading } =
    useConsumptionByRoomPdf(consumptionFrom, consumptionTo);
  const { download: downloadRankingCsv, isDownloading: isRankingCsvLoading } =
    useMealRankingCsv(rankingFrom, rankingTo, rankingLimit);
  const { download: downloadRankingPdf, isDownloading: isRankingPdfLoading } =
    useMealRankingPdf(rankingFrom, rankingTo, rankingLimit);
  const {
    download: downloadHistoryCsv,
    isDownloading: isHistoryCsvLoading,
  } = useStockHistoryCsv(historyProductId, historyFrom, historyTo);
  const {
    download: downloadHistoryPdf,
    isDownloading: isHistoryPdfLoading,
  } = useStockHistoryPdf(historyProductId, historyFrom, historyTo);
```

- [ ] **Remove unused import:** Remove `useDownloadReport` import line (already done above) and remove the unused `useProducts` import if it's kept only for the report card (it's needed for the stock history product selector, so keep it).

- [ ] **Run lint to verify**

```bash
pnpm lint 2>&1 | tail -20
```
Expected: no errors

---

### Task 4: Verify build, lint, and tests

- [ ] **Build both API and Web**

```bash
pnpm build:api 2>&1 | tail -20
pnpm build:web 2>&1 | tail -20
```
Expected: both succeed

- [ ] **Run linter**

```bash
pnpm lint 2>&1 | tail -20
```
Expected: no errors

- [ ] **Run API tests** (timeout 120s for bcrypt)

```bash
pnpm --filter @nutrigest/api test 2>&1 | tail -40
```
Expected: PdfService tests pass (Buffer, %PDF magic bytes)

---

### Task 5: Commit

- [ ] **Stage and commit**

```bash
git add apps/web/src/hooks/queries/use-dashboard-queries.ts \
        apps/web/src/pages/app/dashboard.tsx \
        apps/api/src/dashboard/pdf.service.ts \
        apps/api/src/dashboard/pdf.service.spec.ts \
        apps/api/src/dashboard/dashboard.controller.ts \
        apps/api/src/dashboard/dashboard.module.ts \
        apps/api/package.json \
        pnpm-lock.yaml \
        apps/web/src/hooks/use-download-report.ts \
        docs/superpowers/specs/2026-05-25-report-export-design.md
git commit -m "feat: add CSV and PDF report export to dashboard"
```
