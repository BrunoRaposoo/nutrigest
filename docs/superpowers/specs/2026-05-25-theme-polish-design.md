# Theme Polish — Light/Dark Mode

## Objetivo

Polir o suporte a light/dark mode no frontend web do Nutrigest, adicionando:
1. Transições suaves ao alternar entre temas
2. CSS custom properties globais para evitar flash de tema incorreto no carregamento
3. Pequenos fixes de contraste e cor em componentes específicos

## Abordagem: Conservadora

Manter o paradigma existente de `dark:` classes do Tailwind, adicionando apenas os
refinamentos necessários. Sem refatoração massiva para CSS custom properties.

## 1. CSS Custom Properties Globais (index.css)

Adicionar tokens mínimos no `:root` e `.dark` para prevenir flash de tema incorreto
antes da hidratação do JS:

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

Aplicar no `body`:
```css
body {
  background-color: var(--color-bg);
  color: var(--color-text);
}
```

Isso garante que o fundo correto apareça antes do ThemeProvider executar.

## 2. Utility Customizada transition-theme

Criar no `index.css` para evitar repetição:

```css
@utility transition-theme {
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}
```

Aplicar `transition-theme` nos containers-chave em todo o app.

## 3. Componentes a Modificar

### UI Primitives (adicionar `transition-theme`)
- `components/ui/button.tsx` — todas as variantes
- `components/ui/card.tsx` — container e title
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/dialog.tsx` — container + fix close button color (`dark:text-gray-500`)
- `components/ui/badge.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/password-input.tsx`

### Layouts (adicionar `transition-theme`)
- `components/layout/app-layout.tsx` — sidebar, header, main content
- `components/layout/auth-layout.tsx`

### Shared Components (adicionar `transition-theme`)
- `components/stock/MovementCard.tsx`
- `components/stock/QuantityStepper.tsx` — fix dark symbols (+`dark:text-gray-100`)
- `components/stock/ProductSelect.tsx` — fix dark text (`dark:text-gray-100` no `<span>`)
- `components/stock/RoomSelect.tsx`

### Landing Sections (adicionar `transition-theme`)
- `components/landing/features.tsx`
- `components/landing/how-it-works.tsx`

### Pages (adicionar `transition-theme` nos containers)
- `pages/app/dashboard.tsx`
- `pages/app/products.tsx`
- `pages/app/central-stock.tsx`
- `pages/app/stock-movements.tsx`
- `pages/app/minibar-standard.tsx`
- `pages/app/users.tsx`
- `pages/app/profile.tsx`
- `pages/auth/login.tsx`
- `pages/auth/register.tsx`
- `pages/auth/forgot-password.tsx`
- `pages/auth/reset-password.tsx`
- `pages/not-found.tsx`

## 4. Fixes de Contraste

- **ProductSelect** (`components/stock/ProductSelect.tsx:82`): `<span>{product.name}</span>` — adicionar `dark:text-gray-100`
- **QuantityStepper** (`components/stock/QuantityStepper.tsx:36-38,49-51`): símbolos `−` e `+` — adicionar `dark:text-gray-100`
- **Dialog** (`components/ui/dialog.tsx:59`): botão fechar — adicionar `dark:text-gray-500`

## 5. Arquivos Modificados

~22-25 arquivos. Todas as mudanças são **aditivas** (nenhuma `dark:` classe removida).
Risco muito baixo.

## Não Escopo

- Refatoração para CSS custom properties em componentes (manter `dark:` classes)
- Mudanças no Hero da Landing Page (intencionalmente sempre dark)
- Mudanças no Footer da Landing Page (intencionalmente sempre dark)
- Comportamento funcional do theme toggle
