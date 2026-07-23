# Sosa (Orbit) — Engineering Guide for Claude

Spatial marketing OS: an infinite canvas of cards for brand marketing teams and individual social-media managers (posts, feed planners, docs, stories, reels, calendars, strategy). Goal: a usable, shippable product. **Reply to the user in Hebrew (RTL).**

> New chat? Read this file + `PROGRESS.md` + `TODO.md` (repo root) + project memory, then continue the plan→implement→verify loop.

> **STRICT RULE — TODO.md upkeep:** At the end of every successful task or before ending a session, you MUST automatically update the `TODO.md` file. Check off completed items, document partially built features, and define the immediate next steps for the next session.

> **STRICT RULE — auto-verify code:** Every time you write or modify code, you MUST automatically run the linter and type-checker scripts defined in package.json (`npm run verify`) to verify your work. If the tests fail, you must fix the errors before returning control to the user. (A `Stop` hook in `.claude/settings.json` enforces this by running `npm run verify` before each turn ends; treat its failures as blocking. ESLint *warnings* are allowed — only **errors** and any tsc error must be fixed.)

---

## 1. Tech Stack & Libraries

- **React 19** + **TypeScript ~5.8** + **Vite 6** (`npm run dev` = `vite`, port 3000).
- **Runtime modules via esm.sh importmap in `index.html`** (NOT bundled): react, react-dom, lucide-react, @supabase/supabase-js@2.39.7, recharts, @google/genai, jspdf@2.5.2, docx@8.5.0, html2canvas@1.4.1, firebase (present but UNUSED — Supabase is the real backend).
- **Tailwind via CDN** (`cdn.tailwindcss.com`) — utility classes only; **Tailwind preflight resets lists** (`<ul>/<ol>`) so rich-text editors add local CSS for `list-disc/decimal`.
- **Type-checking is now trustworthy.** `@types/react` + `@types/react-dom` are installed; `npm run typecheck` (`tsc --noEmit`) is the authority on type errors and the baseline is green. The curl/HTTP-200 dev-server check (see bottom) remains a complementary **runtime** smoke test (catches esm.sh/importmap + transform issues tsc can't see).
- Backend: **real Supabase** (auth + Postgres). AI: **Google Gemini** (`@google/genai`). Charts: recharts. Export: docx + jspdf + html2canvas.
- Fonts: many Google Fonts (Latin + Hebrew) loaded in `index.html`. Body font = iOS system stack. Brand bg `#F2F2F7`.

---

## 2. Architecture & File Structure

Entry: `index.tsx` → `<AppErrorBoundary><App/></AppErrorBoundary>` (StrictMode). `App.tsx` is orchestration glue.

**Hooks (`hooks/`):**
- `useAuth` — Supabase session, onboarding gate, profile + brand. Owns the auth listener.
- `useFileSystem` — the node tree (folders/pages/whiteboards), active node, **persistence** (load-on-auth, debounced save, localStorage mirror, flush-on-close, sanitize, `nodesLoaded` gate). **Most critical file for data safety.**
- `useWorkspaces` — workspaces (tabs) + cards of the active whiteboard. `writeCards()` is the **single chokepoint** for all card mutations → mirrors to nodes → runs `reconcileCards`.
- `useCanvasHistory` — undo/redo snapshots.

**Services (`services/`):**
- `supabase.ts` — client + `saveNodesToSupabase` (returns bool, never saves `{}`) + `loadNodesFromSupabase` (discriminated `{status:'ok'|'empty'|'error'}`) + auth/profile/brand helpers + `signOut`.
- `gridPlanner.ts` — Feed-Planner slot↔date logic + **`reconcileCards`/`syncLinkedDates`** (derive linked posts' `content.date`).
- `dateUtils.ts` — `toISODate`/`parseISODate` using **LOCAL** dates. **Never use `toISOString()` for calendar dates.**
- `docExport.ts` — DOCX (DOM-walk)/PDF (html2canvas+jspdf)/Print(iframe)/TXT, Hebrew-aware.
- `fileService.ts` — `fileToDataUrl` (base64) + `isWithinSizeLimit` (2MB guard).
- `soundService.ts`, `linkService.ts`.

**Components (`components/`):**
- `cards/BaseCard.tsx` — wraps EVERY card: drag/select/resize/fullscreen/lock/grouping/context-menu/collapse chrome. Variants `default | minimal | sticky`.
- `cards/cardKit.tsx` — shared design primitives: `STATUS_COLORS`, `CARD_STATUSES`, `StatusPill`, `StatusChip`, `DateChip`, `CardActionBar`, `FullscreenFooterRow`, `useAutosize`, `FullscreenContext`/`useIsCardFullscreen`.
- `cards/` content cards: `PostCard`, `StoryCard`, `ReelsCard`, `DocCard`, `GridPlannerCard` (Feed Planner), `ZoneCard` (group), `TextCard`, `StickyCard`, plus others (Gantt, CallSheet, Newsletter, Reference, Pinterest, …).
- `ui/FloatingToolbar.tsx` (card-anchored, flips above/below), `ui/SelectionPopover.tsx` (text-selection-anchored, DocCard), `ui/toolbarKit.tsx` (`ToolButton/ToolSelect/ToolSwatch/ToolDivider/ToolMenuItem` — Sticky/Text toolbars), `ErrorBoundary.tsx` (`CardErrorBoundary` red + `AppErrorBoundary` app-level).
- `Canvas.tsx` — the whiteboard surface: render cards, marquee, grouping, context menu, `updateCardPosition`, lock cascade.
- `CalendarView.tsx`, `Sidebar.tsx`, `PageView.tsx`, `OnboardingFlow`, `LoginForm`/`RegisterForm`, `modals/*` (Instagram/Story/Reels previews, etc.).

**Data files:** `data/whiteboardTemplates.ts` (`DEFAULT_WHITEBOARD_DATA`, `TAB_COLORS`). Types: `types.ts` (`CardType` enum, `CardData`, all `*Content` types). Plan/continuity: `PROGRESS.md`.

---

## 3. State Management

**The model (most important thing to understand):**
```
nodes: Record<id, FileSystemNode>          // file tree (folders, pages, whiteboards)
  └─ whiteboard node .whiteboardData: Workspace[]   // tabs
        └─ Workspace.cards: CardData[]               // the cards on a board
```
- `nodes` lives in `useFileSystem`. A whiteboard's live cards live in `useWorkspaces` and are **mirrored back into `nodes[activeNodeId].whiteboardData`** on every change (`writeCards` calls `setNodes`).
- **`writeCards` (useWorkspaces) is the single funnel** for card edits (updateCards w/ history, updateCardsSilent, undo/redo, addCard). It (a) runs `reconcileCards`, (b) sets workspaces, (c) mirrors to nodes.
- `App.tsx handleNavigate` persists the current whiteboard into nodes before switching, and centers the viewport on the busiest workspace's cards on open.

**Canvas geometry:** `screen = world * scale + pan`. Cards store `x,y,width,height` in world coords.

**Card collapse / gesture model (BaseCard):**
- `collapsed = !isSelected && !card.alwaysExpanded` (content cards only). Collapsed = compact overview (no footer, name+date+status chip in header, `compact` shrinks height). Selected = full editor.
- **Gesture = Figma-style:** mousedown starts a *potential* drag; **selection (which expands) happens only on a click = mouse-up WITHOUT moving** (threshold 4px). Dragging a card to reposition it never expands/selects it. Locked cards never move. `toggleFullscreen` selects first so fullscreen renders the expanded view.
- `card.alwaysExpanded` (CardData flag) = "Keep expanded" via right-click; never auto-collapses.

**Cross-card derived state:** computed centrally in `reconcileCards` (see §4 sync), NOT at component render.

---

## 4. Database Rules (Supabase)

- Project ref **`dczhrnenedtudwultavb`**. Tables: `profiles`, `brands`, **`sosa_data`**. RLS enforces per-user. Profile-on-signup trigger.
- **The ENTIRE node tree is stored as ONE JSON blob:** `sosa_data (user_id, key='file_system', data jsonb)`, keyed `(user_id, 'file_system')`, upsert `onConflict: 'user_id,key'`.
- **There is NO per-card / per-type DB schema.** Cards, content, new card types, new fields = just new JSON shapes inside the blob. **Adding a card type or field needs NO migration.**
- Onboarding state persists: `profiles.onboarding_complete` written `true` by OnboardingFlow.
- Admin SQL via Supabase **Management API**: `POST https://api.supabase.com/v1/projects/dczhrnenedtudwultavb/database/query` with `Authorization: Bearer $SUPABASE_ACCESS_TOKEN` (token in `.env.local`, gitignored). **Live schema changes need explicit user approval.** Never paste service_role key / DB password in chat.

### Persistence invariants (CRITICAL — never regress; caused a full data-wipe before)
1. **Never seed/save `DEFAULT_FOLDERS` unless load returned `empty`.** Load `error` (no userId / network) must NEVER overwrite → retry w/ backoff, fall back to localStorage cache.
2. **Never write before you read:** saving gated on `loadedUserIdRef.current === userId`.
3. **Never persist an empty tree** (`saveNodesToSupabase` no-ops on `{}`); save effect skips empty/unchanged.
4. **Load once per user id** (effect keyed on `session?.user?.id`, not the session object) so token refreshes don't re-load/clobber.
5. **localStorage mirror** `sosa_fs_<userId>` on every save + flush — offline-resilient + recovery.
6. **Flush on tab hide/close** (`visibilitychange`/`pagehide`/`beforeunload`). Debounce 800ms.
7. **`sanitizeNodes` on load** — keep only valid nodes (object with string `type` AND `name`); strip junk that would crash views. If it removed something, force one clean re-save.
8. **`nodesLoaded` gate** in App so the home page never flashes empty during the async load (pre-hydrate from cache when present).

### Sync invariants (cross-card)
- Derived cross-card fields are reconciled centrally in `writeCards` → `reconcileCards` (pure fns in `gridPlanner.ts`). Every view reads the same persisted field; never derive cross-view/persisted data at render time.
- Current: `syncLinkedDates` sets each Feed-Planner-connected post's `content.date` from its slot → Calendar/Unscheduled stay in sync instantly, regardless of render. **New cross-card feature → add its derivation to `reconcileCards`.**

---

## 5. Coding Conventions

- **Reply in Hebrew (RTL).** UI strings are English. Hebrew text uses `dir="auto"`.
- **Brand palette:** pink `#FCCAE2`, yellow `#FFD753`, green `#3A5C34`, burgundy `#5F2427`, peach `#F9E6D1`; + blue `#007AFF`, gray `#8E8E93`. Soft shadows, rounded (cards `24px`).
- **Card design language** (read memory `card_design_language.md`): every content card = `BaseCard variant="default"` (gives `px-5 pb-5`, small icon+label header, `#FFD753` hover ring, auto-height + `minHeight: card.height`). Title 28px input. Meta row = date + `StatusPill`, `justify-between`. Footer = `CardActionBar`. Status = `STATUS_COLORS` map. Auto-grow textareas via `useAutosize`. **Build new cards from `cardKit`, don't fork.**
- **Toolbars:** unified look. DocCard = selection-anchored `SelectionPopover` (per-selection formatting). Sticky/Text = whole-card formatting via `FloatingToolbar` + `toolbarKit` primitives. New toolbars use `toolbarKit`.
- **Dates:** always `dateUtils` LOCAL (`toISODate`/`parseISODate`). Never `toISOString()` for calendar dates.
- **Context provider scope:** a card's own body is the PARENT of `BaseCard`'s providers (e.g. `FullscreenContext`). **Consume such context only from child components rendered inside `BaseCard`'s `children`**, never in the card body (it returns the default).
- **CSS transitions:** transition `transform`/`box-shadow`, **NOT `left`/`top`** (animating position makes grouped children "chase" during drag).
- **Images/media:** base64 via `fileService` (2MB guard); persists inside the JSON blob. (Future: move to Supabase Storage.)
- Loop: **plan-mode → implement → verify (curl HTTP 200) → update `PROGRESS.md` + memory** each meaningful round.

---

## 6. Past Mistakes — NEVER repeat

1. **Full data wipe on reload** — `loadNodesFromSupabase` returned `null` for both "no data" and "load failed"; loader treated null as first-run and seeded `DEFAULT_FOLDERS` over real data. → discriminated load + gated save + cache (§4 invariants).
2. **"Recents" gray/blank screen** — corrupt junk keys (`status`,`nodes`) in the node map → `n.name.toLowerCase()` crashed the whole app (no boundary). → `sanitizeNodes`, `getSortedChildren` filters `n.type`, `(n.name||'')`, `AppErrorBoundary`.
3. **Empty home flash on load** — UI rendered with `nodes={}` before async load. → `nodesLoaded` gate + cache pre-hydrate.
4. **Timezone date bug** — `toISOString()` on local-midnight shifted the day (calendar/feed/post disagreed). → `dateUtils` LOCAL everywhere.
5. **PostCard images vanish on leave/return** — debounced content write killed by unmount on navigate. → immediate `commitContent` on media change.
6. **DocCard fullscreen erased text** — portal toggle remounts the uncontrolled editor empty. → seed innerHTML via callback ref + flush on blur.
7. **Context-scope bug** — `useIsCardFullscreen()` called in a card BODY (parent of the provider) always returns `false`. → consume context only in child components under `BaseCard`'s children (e.g. `DocToolbar`, `CardActionBar`, `FullscreenFooterRow`).
8. **Sign-out did nothing** — `signOut()` not awaited before `window.location.reload()`. → `await signOut()` first.
9. **Grouped children "chase" during drag** — `transition-all` animated `left/top`. → `transition-[transform,box-shadow]`.
10. **Calendar desync** — linked date derived at PostCard render → stale when card not mounted. → central `reconcileCards` in `writeCards`.
11. **Drag expands collapsed card** — selection happened on mousedown. → select on click (no-move) only; 4px drag threshold.
12. **Zone frame collapsed** — `w-full h-full` vs auto-height parent. → `absolute inset-0`.
13. **Card-add overwrite** — stale `useMemo` captured an old `addCard`. → correct deps.
14. **Edit-from-Feed erased post media (DATA LOSS)** — an off-canvas editor (the Feed page's pencil→fullscreen card) held the card as a **frozen snapshot** in state; the card's debounced/commit write sent `{...snapshot.content, localState}` and `onUpdateCard` **blind-replaced** the content — reverting/erasing any field (media, date, publishTargets) that changed since it opened. → (a) off-canvas editors MUST resolve the **LIVE card from `nodes` by id every render**, never edit a snapshot; (b) `onUpdateCard` **merges** (`content:{...c.content,...content}`), never blind-replaces. See §4 persistence invariants + memory `persistence_invariants`.

---

## How to run / verify
- Dev: `npx vite --port 3000` (background). Browser checks (visual/drag/export) = user's job.
- **Verify code:** `npm run verify` (= `npm run typecheck` + `npm run lint`) → must exit 0. tsc errors and ESLint **errors** block; ESLint warnings are allowed. This runs automatically via the `Stop` hook (`.claude/settings.json`).
- **Runtime smoke test:** `curl -s -w "%{http_code}" http://localhost:3000/<path>` → expect `200` and no "Transform failed" (catches esm.sh/importmap + transform issues tsc can't).
- End of each round: update `PROGRESS.md` + `TODO.md` + the relevant memory file.
