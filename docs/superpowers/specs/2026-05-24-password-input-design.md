# PasswordInput Component — Design Spec

**Date:** 2026-05-24
**Status:** Approved

## Problem

Os formulários de login, register, reset-password e profile possuem campos de senha sem toggle de visibilidade. O usuário não consegue ver o que digitou antes de submeter.

## Solution

Criar um componente `PasswordInput` que renderiza um input do tipo password com um botão de toggle (ícone `Eye`/`EyeOff`) para mostrar/esconder a senha.

## Architecture

### Component: `PasswordInput`

**File:** `apps/web/src/components/ui/password-input.tsx`

**Props:** Reusa `InputProps` (`label`, `error`, `id`, `placeholder`, `className`, + todos os atributos HTML de input).

**State interno:** `show: boolean` — controla se o input é `type="text"` (mostrando) ou `type="password"` (oculto).

**Estrutura:**
```
<div space-y-1.5>           ← mesmo layout do Input
  <label />                  ← mesmo estilo do Input
  <div relative>
    <input pr-10 />          ← padding extra à direita para o botão
    <button absolute>         ← posicionado à direita, centro vertical
      <Eye /> ou <EyeOff />  ← lucide-react icons
    </button>
  </div>
  <p error>                  ← mesmo estilo do Input
```

### Files affected

| File | Change |
|------|--------|
| `components/ui/password-input.tsx` | **NEW** — PasswordInput component |
| `pages/auth/login.tsx` | Replace `<Input type="password">` → `<PasswordInput>` |
| `pages/auth/register.tsx` | Replace 2× `<Input type="password">` → `<PasswordInput>` |
| `pages/auth/reset-password.tsx` | Replace 2× `<Input type="password">` → `<PasswordInput>` |
| `pages/app/profile.tsx` | Replace 3× `<Input type="password">` → `<PasswordInput>` |

### Behavior

- Botão com `type="button"` — não submete formulário
- `aria-label` dinâmico: "Mostrar senha" / "Esconder senha"
- `tabIndex={-1}` — não atrapalha navegação por teclado nos inputs
- Toggle de ícone: `Eye` (senha oculta) → `EyeOff` (senha visível)
- Input ganha `pr-10` para o botão não sobrepor o texto

### Testing

- Renderiza com label e error
- Exibe ícone Eye inicialmente (senha oculta)
- Clique no botão alterna entre Eye/EyeOff e entre type=password/type=text
- Input type começa como "password"

## Git Workflow

1. Desenvolvimento na branch `feat/frontend-foundation`
2. Commits convencionais (ex: `feat: add PasswordInput component with show/hide toggle`)
3. Usuário faz push manual
4. Usuário abre PR manualmente
5. Usuário faz merge em `dev` manualmente
6. Após merge, continuar próximo desenvolvimento

## Rejected Alternatives

- **Prop `showPasswordToggle` no Input (A):** Polui componente genérico com lógica específica de senha.
- **Slot `rightElement` no Input (C):** Over-engineering, força cada formulário a gerenciar estado show/hide.
