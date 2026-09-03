# CI GitHub Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `.github/workflows/ci.yml` com 5 jobs paralelos (lint, build-api, build-web, test-api, test-web) rodando em todo `push`/`pull_request` qualquer branch, com `pnpm/action-setup` + `setup-node` cache pnpm, Node 24, cancel-in-progress, bloqueando PR se falhar.

**Architecture:** Single workflow `CI` com `concurrency: group ci-${{ref}} cancel-in-progress:true`. Cada job: checkout@v4 → pnpm/action-setup@v4@v9 → setup-node@v4@24 cache pnpm → install --frozen-lockfile → comando específico. Sem service Postgres (sem e2e).

**Tech Stack:** GitHub Actions, pnpm 9, Node 24, Biome 2, Jest 30, Vitest 4, actions/checkout@v4, pnpm/action-setup@v4, actions/setup-node@v4.

---

### Task 1: Criar workflow file

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create directory**

Run: `mkdir -p .github/workflows`
Expected: dir exists

- [ ] **Step 2: Write workflow**

```yaml
name: CI

on:
  push:
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: lint (biome ci)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint:ci

  build-api:
    name: build api
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:api

  build-web:
    name: build web
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build:web

  test-api:
    name: test api (unit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @nutrigest/api test
        env:
          JWT_SECRET: test-secret-for-ci-32-chars-minimum-xyz1234567890
          DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy

  test-web:
    name: test web (unit)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @nutrigest/web test
```

- [ ] **Step 3: Validate YAML**

Run: `pnpm dlx yaml-lint .github/workflows/ci.yml` or `cat .github/workflows/ci.yml | python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" .github/workflows/ci.yml`
Expected: valid YAML, no error

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint+build+unit, pnpm cache, parallel)"
```

---

### Task 2: Verificar local que CI passará

**Files:** none (read-only)

- [ ] **Step 1: Run lint:ci**

Run: `pnpm lint:ci`
Expected: PASS (Checked 177 files)

- [ ] **Step 2: Run builds**

Run: `pnpm build:api && pnpm build:web`
Expected: PASS

- [ ] **Step 3: Run units**

Run: `pnpm --filter @nutrigest/api test 2>&1 | tail -20`
Expected: PASS

Run: `pnpm --filter @nutrigest/web test 2>&1 | tail -20`
Expected: PASS (9 suites, protected-route fix)

- [ ] **Step 4: Push to GitHub and watch CI**

Run: `git push origin feat/remove-public-registration` (or current branch)
Expected: GitHub Actions tab shows 5 jobs green

---

### Task 3: (Manual) Ativar branch protection

**Files:** none (GitHub UI)

- [ ] **Step 1:** GitHub → Settings → Branches → Add rule → Branch name pattern `main` (repeat `dev`)
- [ ] **Step 2:** Check Require status checks to pass before merging → search and add `lint`, `build api`, `build web`, `test api (unit)`, `test web (unit)` (names from workflow)
- [ ] **Step 3:** Check Require branches to be up to date → Save

---

### Verification Final

Run: `cat .github/workflows/ci.yml`
Expected: 5 jobs, pnpm 9, node 24, concurrency

Run: `git log --oneline -1`
Expected: ci commit present

Check: GitHub Actions UI green on first push
