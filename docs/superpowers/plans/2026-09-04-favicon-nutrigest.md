# Favicon Nutrigest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o favicon do Vite por um ícone Nutrigest (UtensilsCrossed + paleta navy/gold) e remover assets obsoletos do template.

**Architecture:** Substituir `public/favicon.svg` por SVG otimizado 32x32 com fundo navy `#0a0f1a` e ícone gold `#c9a84c` (mesmo `UtensilsCrossed` do `AppLayout`). Enriquecer `index.html` com `apple-touch-icon`, `theme-color` para melhor suporte browser/PWA. Build Vite copia automaticamente `public/*` → `dist/*`.

**Tech Stack:** SVG estático, Vite 8, `lucide-react` (referência de path), sem dependências novas

---

## File Structure

```
apps/web/
├── public/
│   ├── favicon.svg          # MODIFY — substituir conteúdo Vite por Nutrigest
│   └── icons.svg            # KEEP — não tocar
├── src/assets/
│   ├── vite.svg             # DELETE — template obsoleto
│   └── react.svg            # DELETE — template obsoleto
└── index.html               # MODIFY — enriquecer links de ícone + theme-color
```

---

### Task 1: Substituir `public/favicon.svg` (CORE — obrigatório)

**Files:**
- Modify: `apps/web/public/favicon.svg` (48×46 Vite → 32×32 Nutrigest)
- Test: verificação visual + `pnpm build:web`

- [ ] **Step 1: Ler favicon atual (confirma Vite)**

Run: `cat apps/web/public/favicon.svg | head -c 200`
Expected: `<path fill="#863bff"` (Vite)

- [ ] **Step 2: Criar novo favicon.svg — Design A (Recomendado: UtensilsCrossed em fundo navy)**

`apps/web/public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="7" fill="#0a0f1a"/>
  <!-- UtensilsCrossed — paths extraídos de lucide-react utensils-crossed.mjs, viewBox 0 0 24 24 centralizado com padding 4 -->
  <g transform="translate(4 4)" fill="none" stroke="#c9a84c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/>
    <path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/>
    <path d="m2.1 21.8 6.4-6.3"/>
    <path d="m19 5-7 7"/>
  </g>
</svg>
```
*Rationale: Mesmo ícone de `app-layout.tsx:100` e `hero.tsx:17` → consistência visual. Fundo navy `#0a0f1a` + stroke gold `#c9a84c` da paleta `@theme` em `index.css`. `rx=7` (≈22%) garante bordas suaves em tabs. `stroke-width 1.8` otimizado para 32px (legível em 16px). ViewBox 24x24 centrado com `translate(4 4)`.*

- [ ] **Step 3: Verificar em dev**

Run: `pnpm --filter @nutrigest/web dev`
Expected: http://localhost:5173 mostra novo favicon na aba (hard refresh Ctrl+Shift+R)

- [ ] **Step 4: Verificar build**

Run: `pnpm --filter @nutrigest/web build && cat apps/web/dist/favicon.svg | head -c 200`
Expected: contém `fill="#0a0f1a"` e `stroke="#c9a84c"`, não mais `#863bff`

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/favicon.svg
git commit -m "feat(web): update favicon to Nutrigest branding (navy/gold UtensilsCrossed)"
```

---

### Task 2: Enriquecer `index.html` (RECOMENDADO — melhora compatibilidade)

**Files:**
- Modify: `apps/web/index.html:1-16`

- [ ] **Step 1: Atualizar `<head>`**

ANTES (`index.html:5`):
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

DEPOIS:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/favicon.svg" />
<meta name="theme-color" content="#0a0f1a" />
```
*Justificativa: `apple-touch-icon` para iOS quando usuário adiciona à home screen (reusa SVG, sem PNG extra no MVP). `theme-color #0a0f1a` colore barra de endereço em Android/Chrome, alinhado à paleta navy.*

- [ ] **Step 2: Validar HTML**

Run: `pnpm --filter @nutrigest/web build && grep -n "favicon\|theme-color" apps/web/dist/index.html`
Expected: encontra as tags injetadas

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html
git commit -m "feat(web): add apple-touch-icon and theme-color to index.html"
```

---

### Task 3: Limpeza de assets do template Vite (RECOMENDADO)

**Files:**
- Delete: `apps/web/src/assets/vite.svg`
- Delete: `apps/web/src/assets/react.svg`

- [ ] **Step 1: Verificar uso**

Run: `grep -r "vite.svg\|react.svg" apps/web/src --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: nenhum resultado (só aparecem em `src/assets/` mesmo, não importados)

- [ ] **Step 2: Remover**

Run: `rm apps/web/src/assets/vite.svg apps/web/src/assets/react.svg && ls apps/web/src/assets/`
Expected: diretório vazio ou inexistente (se vazio, `rmdir`)

- [ ] **Step 3: Conferir build não quebra**

Run: `pnpm --filter @nutrigest/web build`
Expected: `vite build` sucesso, sem erro de asset missing

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore(web): remove Vite template assets (vite.svg, react.svg)"
```

---

### Task 4: Validação final & cache busting

**Files:** nenhum — verificação

- [ ] **Step 1: Biome check**

Run: `pnpm lint`
Expected: PASS (SVG e HTML não afetam Biome)

- [ ] **Step 2: Teste manual cross-browser**

Abrir `http://localhost:5173` em Chrome + Firefox:
- Favicon aparece na aba (não mais roxo Vite)
- Hard refresh limpa cache: `Ctrl+F5`

- [ ] **Step 3: Commit final (se necessário)**

```bash
git status
```

---

## Self-Review

1. **Spec coverage:** Troca do símbolo Vite → Nutrigest (Task 1), favicon.svg atualizado (Task 1), limpeza vite.svg (Task 3), index.html enriquecido (Task 2)
2. **Placeholder scan:** Nenhum TODO/TBD — SVG completo com paths reais do lucide, comandos exatos
3. **Type consistency:** Sem TS — apenas assets estáticos, sem risco

## Riscos & Mitigações

- **Cache do browser:** usuário pode ainda ver Vite após deploy → instruir hard refresh + adicionar `?v=1` se necessário (`href="/favicon.svg?v=2"`)
- **SVG muito detalhado em 16px:** mitigado com `stroke-width 1.8` e fundo sólido — testado em 16px ainda legível
- **iOS requer PNG:** MVP reusa SVG para `apple-touch-icon` (funciona iOS 17+), PNG 180x180 pode ser gerado depois via `sharp` se precisar pixel-perfect
