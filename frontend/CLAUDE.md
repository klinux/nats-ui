# Frontend — Development Instructions

## Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite 7
- **UI:** shadcn/ui (New York style) + Tailwind CSS 4
- **State:** React Query (@tanstack/react-query) + React Context
- **Routing:** react-router-dom v7
- **Forms:** react-hook-form + zod
- **Charts:** recharts
- **Animations:** framer-motion (use sparingly — avoid on high-frequency components like cards)

## Project Structure

```
src/
  components/
    layout/          Sidebar, nav components (sidebar-07 pattern)
    ui/              shadcn/ui primitives (do not manually edit these)
    connection/      NATS connection manager
    ErrorBoundary.tsx
  pages/             One file per route (Dashboard, Streams, etc.)
  services/
    api-client.ts    HTTP client + SSE subscription
    nats-service.ts  NATS abstraction layer
  hooks/             Custom React hooks
  lib/
    format.ts        Shared formatting utilities (formatBytes, formatUptime, etc.)
    utils.ts         cn() and general utilities
    animations.ts    Framer motion variants
  contexts/          React contexts (NatsContext)
  types/             TypeScript type definitions
```

## TDD Workflow

1. Write the test first (use Vitest or React Testing Library)
2. Run: `npx tsc --noEmit` for type checking
3. Implement the component/hook
4. Refactor while types stay clean

### Test Guidelines

- Test component rendering and user interactions
- Test hooks in isolation
- Test utility functions with edge cases (null, undefined, NaN)
- Mock API calls, not implementation details

## Code Rules

### File Size

- **Max 300 lines per file.** Split large pages into sub-components.
- Extract complex logic into custom hooks.
- Keep components focused — one purpose per component.

### No Code Duplication

- Shared formatting → `src/lib/format.ts`
- Shared UI logic → custom hooks in `src/hooks/`
- Never duplicate utility functions across pages.

### Components

- Use shadcn/ui components — **do not install alternative UI libraries**.
- Layout follows the **shadcn sidebar-07** pattern (collapsible icon sidebar).
- Don't add `framer-motion` to high-frequency components (Card, Badge, etc.) — use CSS transitions instead.
- Use `memo()` only when profiling shows it helps.

### Styling

- Use Tailwind CSS classes exclusively — no inline styles, no CSS modules.
- Follow shadcn conventions for spacing, colors, and typography.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Responsive design: mobile-first with `sm:`, `md:`, `lg:` breakpoints.

### API Client

- All API calls go through `services/api-client.ts`.
- SSE subscriptions auto-reconnect with exponential backoff (1s–30s).
- Token is stored in `localStorage` under `nats-ui-token`.
- 401 responses automatically redirect to `/login`.

### Error Handling

- `ErrorBoundary` wraps the entire app — crashes show a friendly message.
- Always handle API errors with user-facing toasts (`sonner`).
- Never assume API responses match types — use optional chaining.

### Type Safety

- No `any` unless absolutely necessary — prefer `unknown` with type guards.
- Define interfaces for all API responses in `types/`.
- Use `zod` schemas for form validation.

### Global Declarations

- `__APP_VERSION__` is declared in `vite-env.d.ts` — don't re-declare it elsewhere.
- Vite environment variables use `import.meta.env.VITE_*` prefix.

### Adding a New Page

1. Create `src/pages/NewPage.tsx` (max 300 lines)
2. Add route in `src/App.tsx`
3. Add nav item in `src/components/layout/MainLayout.tsx`
4. Use existing shadcn/ui components
5. Extract sub-components if the page grows

### Running

```bash
cd frontend
pnpm dev           # Dev server with HMR (port 5173)
pnpm build         # Production build
pnpm lint          # ESLint
npx tsc --noEmit   # Type check
```
