# Report Export (CSV + PDF)

## Summary

Add CSV download (frontend) and PDF generation (backend) for the 3 existing dashboard reports: Consumption by Room, Meal Ranking, and Stock History. Export buttons placed on the Dashboard page.

## Architecture

```
Frontend (React)                    Backend (NestJS)
┌──────────────────┐               ┌──────────────────────────────┐
│ Dashboard Page   │  GET /csv     │ DashboardController          │
│ ┌──────────────┐ │ ────────────► │  ┌───────────────────────┐   │
│ │ Consumption  │ │               │  │ getConsumptionByRoomCsv│   │
│ │ by Room      │ │ ◄──────────── │  └───────────────────────┘   │
│ │ [CSV] [PDF]  │ │  CSV string   │                              │
│ └──────────────┘ │              │  ┌───────────────────────┐   │
│ ┌──────────────┐ │  GET /pdf     │  │ getConsumptionByRoomPdf│   │
│ │ Meal Ranking │ │ ────────────► │  └───────────────────────┘   │
│ │ [CSV] [PDF]  │ │ ◄──────────── │         ↕                    │
│ └──────────────┘ │  PDF buffer   │  ┌──────────────────────┐   │
│ ┌──────────────┐ │               │  │ DashboardService    │   │
│ │ Stock History│ │               │  │ ┌────────────────┐  │   │
│ │ [CSV] [PDF]  │ │               │  │ │ getConsumption │  │   │
│ └──────────────┘ │               │  │ │ ByRoom()       │  │   │
│                  │               │  │ └────────────────┘  │   │
│ useDownloadReport│               │  │ ┌────────────────┐  │   │
│ (blob download)  │               │  │ │ getMealRanking │  │   │
└──────────────────┘               │  │ │ ()             │  │   │
                                   │  │ └────────────────┘  │   │
                                   │  │ ┌────────────────┐  │   │
                                   │  │ │ getStockHistory│  │   │
                                   │  │ │ ()             │  │   │
                                   │  │ └────────────────┘  │   │
                                   │  └────────────────────┘   │
                                   │         ↕                 │
                                   │  ┌──────────────────────┐  │
                                   │  │ PdfService           │  │
                                   │  │ ┌──────────────────┐ │  │
                                   │  │ │ generateXxxPdf() │ │  │
                                   │  │ └──────────────────┘ │  │
                                   │  └──────────────────────┘  │
                                   └──────────────────────────────┘
```

## Backend

### Dependency
- `pdfkit` + `@types/pdfkit`

### PdfService (`apps/api/src/dashboard/pdf.service.ts`)
3 public methods, each receiving the same data shape returned by `DashboardService` methods:
- `generateConsumptionByRoomPdf(data): Buffer` — table with room, product, quantity columns
- `generateMealRankingPdf(data): Buffer` — table with productName, category, totalQuantity
- `generateStockHistoryPdf(data): Buffer` — table with type, quantity, runningBalance, createdAt

Each PDF document includes: title, generation timestamp, formatted table with header row, and footer with page info.

### DashboardController — 3 new endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard/consumption-by-room/pdf` | PDF consumption by room |
| GET | `/dashboard/meal-ranking/pdf` | PDF meal ranking |
| GET | `/dashboard/stock-history/:productId/pdf` | PDF stock history for product |

Each endpoint reuses existing `DashboardService` methods for data, then calls `PdfService` and returns `application/pdf` with `Content-Disposition: attachment`.

### DashboardModule
Add `PdfService` to providers array.

### DashboardService — NO CHANGES
Existing CSV and JSON methods remain untouched.

### Tests
Unit tests for `PdfService`: verify each method returns a Buffer, verify Buffer starts with `%PDF` magic bytes. Tests use minimal/mock data.

## Frontend

### useDownloadReport (`apps/web/src/hooks/use-download-report.ts`)
Reusable hook for blob downloads:
- Accepts: `url`, `filename`, `format: 'csv' | 'pdf'`
- Uses existing axios `api` instance (preserves auth header)
- Sets `responseType: 'blob'`
- Creates Blob with correct MIME type
- Triggers download via `URL.createObjectURL` + temporary `<a>` click
- Returns: `{ download, isDownloading, error }` — `download()` triggers the fetch

### Dashboard Query Hooks — 6 new exports
Appended to existing `use-dashboard-queries.ts`:
- `useConsumptionByRoomCsv(from?, to?)`
- `useConsumptionByRoomPdf(from?, to?)`
- `useMealRankingCsv(from?, to?, limit?)`
- `useMealRankingPdf(from?, to?, limit?)`
- `useStockHistoryCsv(productId, from?, to?)`
- `useStockHistoryPdf(productId, from?, to?)`

### Dashboard Page — 3 report cards
Added after the existing charts section, before "Recent Movements":
- **Card: Consumption by Room** — date filter, CSV and PDF buttons
- **Card: Meal Ranking** — date filter, limit input (1-100), CSV and PDF buttons
- **Card: Stock History** — product selector, date filter, CSV and PDF buttons

Each button shows loading spinner while downloading.

Existing dashboard layout (summary cards, low stock alerts, charts, recent movements) is NOT modified.

### Types — NO CHANGES needed
Existing `dashboard.ts` types already cover the data shapes.

## Files Modified
- `apps/api/package.json` — add pdfkit + @types/pdfkit
- `apps/api/src/dashboard/dashboard.controller.ts` — add 3 PDF endpoints
- `apps/api/src/dashboard/dashboard.module.ts` — add PdfService to providers
- `apps/web/src/pages/app/dashboard.tsx` — add 3 report cards
- `apps/web/src/hooks/queries/use-dashboard-queries.ts` — add 6 download hooks

## Files Created
- `apps/api/src/dashboard/pdf.service.ts`
- `apps/api/src/dashboard/pdf.service.spec.ts`
- `apps/web/src/hooks/use-download-report.ts`

## Non-Goals (Out of Scope)
- XLSX export
- Email delivery of reports
- Scheduled/automated report generation
- PDF generation on the frontend (jsPDF etc.)
- Export from pages other than Dashboard (Products, StockMovements, etc.)
