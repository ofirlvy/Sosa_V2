# Sosa — TODO (Active Work Tracker)

> **What this file is:** the live picture of *exactly* what we're working on right now. `PROGRESS.md` = full history; **this file = focused "what's next".**
> **New chat?** Read `PROGRESS.md` + project memory + this file + the plan at `~/.claude/plans/enumerated-percolating-hennessy.md`.

_Last updated: 2026-07-23 — Teams Phase 2 (Round 1): real cross-user brand sharing, view+comment, owner-authoritative (DONE; verify=0 errors, 168 tests; schema live; 2-account test pending user)_

## 🆕 2026-07-23 (34) — Teams Phase 2 Round 1: real cross-user sharing (view + comment) — DONE (schema live)
- [x] **Schema live** (ran in SQL Editor, verified): `shared_brands`, `brand_members`, `brand_invites`, `brand_data`, `brand_comments` + RLS + `accept_brand_invite` RPC + realtime. `sosa_data`/`profiles`/`brands` untouched.
- [x] **Owner:** `useOwnerMirror` publishes each shared brand's slice to `brand_data` after the blob save — additive; blob save path unchanged (zero risk to existing data).
- [x] **Invites:** MembersModal creates a real invite → **copyable `?invite=<token>` link**; shared-brand roster is DB-backed (`useSharedRoster`).
- [x] **Member:** "Shared with me" in the switcher → opens a **read-only** view (`SharedBrandView`): feed profile grid per channel + post preview modals + **comments** (brand_comments) with @mentions, live via realtime. Bypasses `useWorkspaces` — the member's own data is never touched. `?invite=token` accepted after sign-in.
- [x] `services/teamsBackend.ts` (all DB calls, discriminated) + 3 pure-mapper tests.

### 🔴 Cross-account test (for the user — needs 2 accounts)
1. Account A: open a brand → **Share** → invite an email as Commenter → **Copy link**.
2. Account B (separate browser/incognito): open the link → sign up/sign in → you should land in **"Acme… · Shared with you · view only"** showing the brand's feed.
3. Account A edits the feed (schedule/move a post) → Account B sees it update **live**.
4. Account B writes a comment + @mention → Account A… (comments show in the shared view; a shared board-chat surface for the owner is a follow-up).
5. Confirm in Supabase: `brand_data`/`brand_comments` fill; `sosa_data` for A is unchanged. Viewer role can't comment.

### Next round (deferred) — Teams Phase 2 Round 2
- Members with **Editor** role editing structural data (write-back + concurrency), viewing a shared brand's **whiteboard canvas** read-only, real **invite emails** (Edge Function), owner seeing member comments inside the board chat drawer, DB-level role enforcement for any structural writes.


## 🆕 2026-07-23 (32) — Teams: real people layer (Phase 1, client-side) — DONE
- [x] **Real card assignees** replace hardcoded JD/SS in all 5 cards — `AssigneeStack` (facepile + picker) from the active brand roster → `content.assignees`.
- [x] **@mentions in chat** — `@` picker (mirrors the `/` card picker); `mentions[]` stored on the message; green mention chips.
- [x] **Members / Share modal** — per-brand roster, 4 roles (Owner/Editor/Commenter/Viewer), invite-by-email (Pending), role change, remove. Opened from a **Share button + facepile on the home header** and **"Members & sharing"** in the brand-switcher curtain.
- [x] Additive data: `BrandMember`/`BrandRole` + `BrandSpace.members` (owner derived from account), `BoardChatMessage.mentions`, `assignees` on all content types. Pure `services/brandMembers.ts` (10 tests); `useBrandSpaces` member CRUD; roster via `BrandIdentity` context.
- [x] **Honest scope:** this is the people/assignment/mention/roster layer (real, single-account). Actual cross-user sign-in = a **backend round** (tables + RLS + per-brand data migration → needs explicit schema approval). Invitees show "Pending".

### Browser-test checklist (for the user)
- Open a card → footer shows a real assignee "+" (no JD/SS) → assign a teammate → their avatar shows on the card.
- Home page → **Share** button (with facepile) opens Members; brand switcher → **Members & sharing** opens the same.
- Invite by email + role → they appear as **Pending**; change role / remove works; reload persists (on the brand).
- Board chat → type `@` → member picker → pick → the name becomes a green chip in the sent message.
- Different brand → its own separate roster (an individual can share ONE brand only).

### Next round (needs schema approval) — Teams backend
- `brand_members(brand_id,user_id,email,role,status)` + `brand_invites(brand_id,email,token,role,expires_at)` with RLS; move brand-scoped data to a per-brand store readable by members; invite-accept links user_id; role enforcement; realtime/last-write-wins; invite emails via Edge Function. Careful migration of the existing per-user blob. Present exact SQL first.


## 🆕 2026-07-22 (31) — Stories: schedule + view-by-day via a circle lane below the grid — DONE
- [x] **New lane** below the feed grid (IG-only): a scrollable **circle per day of the month**. Story days = IG ring + first frame + `•N` count; empty days = dashed drop-circles. `components/StoriesLane.tsx`.
- [x] **Stories never go into the rectangular grid** (correct IG model; grid stays pristine). Schedule = drag a story from Unscheduled onto a day-circle; verified an undated story → day 8.
- [x] **View by day** = click a filled circle → StoryPreviewModal with **that day's** frames only (not the whole month).
- [x] Pure helpers in `services/feedPlanner.ts` (`collectStoryItems`/`storyDayGroups`/`monthDays`/`dayStoryFrames`, 5 tests); stories ride the same getDate/place/finalize as posts, so they participate in **drafts** too. Grid/preview/`collectFeedItems` untouched.

### Browser-test checklist (for the user)
- Feed (Instagram) → a "Stories" row of day-circles appears below the grid; the grid still shows only posts/reels.
- Create a Story card on a board → it shows up undated in Unscheduled → drag it onto a day-circle → it schedules to that day (reload persists).
- A day with 2+ stories shows a count badge; click the circle → the story viewer plays **only that day's** stories.
- Switch to TikTok → the stories row disappears. In a draft, dragging stories edits the draft; Set as final commits them.


## 🆕 2026-07-22 (30) — Card preview (play icon) → brand-identity mockup; footer cleanup; chat polish — DONE
- [x] **Post/Reels/Story footer: one preview button = a play glyph only** (no "Preview" text), opens the mockup modal. `PreviewButton` in `cardKit`. PostCard gained an Instagram mockup (its old preview was a media lightbox).
- [x] **Mockups use the workspace's Feed profile** (handle/name/picture per channel), not "Orbit Brand". `contexts/BrandIdentity.tsx` (`useMockupProfile(channel)`), provided by `App` from the active brand. Harness confirmed all three render `my_brand_ig`, zero "Orbit Brand".
- [x] **Removed** the comments button (all cards) and the Google-Drive sync button (Post + Reference). Comments live in the chat drawer now.
- [x] **Chat drawer:** flat message bubbles (removed border/elevation); list bg pinned to the SettingsModal token `#F9F8F6`.

### Browser-test checklist (for the user)
- Open a Post/Reels/Story card → footer shows a burgundy **play** button (no label) + the schedule button; **no comments/Drive buttons**.
- Click play → the mockup opens showing **your Feed profile** (the handle/name/picture set for this brand+channel), not "Orbit Brand". Switch brands → the mockup identity changes.
- Chat drawer: message rectangles look flat (no shadow), background matches the user-settings modal. **If the color still looks off**, tell me the exact shade — I matched the settings token but couldn't see your screen.


## 🆕 2026-07-22 (29) — Feed Drafts (saved monthly plans + Set as final) — DONE (verify green, 150 tests)
- [x] **Save several monthly plans per (channel, month), edit them without touching the live schedule, commit one when ready.** A draft = an overlay of `{postId→date}` + its own cadence, stored on `BrandSpace.feedDrafts?` (additive, zero migration).
- [x] **Safe by construction:** editing a draft never touches posts or the calendar — proven in the harness (unscheduling a tile in a draft changed only the draft; live dates stayed intact). Only **Set as final** writes, via the existing `assignToDate → resolveDateWrites`.
- [x] **Set as final** makes the live schedule equal the draft: writes the draft's placements AND unschedules in-month live posts the draft omits (per your decision), after a confirm showing counts ("Schedules N, unschedules M"). Posts never deleted — only `content.date`.
- [x] **UI:** a Drafts dropdown (Live + saved plans, rename/delete, "Save current view as draft"), a burgundy draft banner (Set as final / Exit to live), a confirm modal. Cross-board by nature → the board filter is disabled in a draft. Changing channel/month drops back to Live.
- [x] Pure `services/feedDrafts.ts` + 8 tests; `buildFeedMonth`/`unplacedItems`/`orderedFeedItems` gained an optional `getDate` resolver so one grid renders Live or a draft.

### Browser-test checklist (for the user)
- Feed → Drafts dropdown → "Save current view as draft" → a "Draft 1" appears and you're in it (burgundy banner).
- Drag tiles / unschedule inside the draft → the live schedule and calendar don't change.
- Save a second draft, switch between them and Live from the dropdown; rename/delete work.
- "Set as final" → confirm shows the counts → the live schedule now matches the draft (missing posts go to Unscheduled), synced to the calendar.
- Switch channel or month → back to Live; a draft is only offered for its own (channel, month). Reload keeps drafts.


## 🆕 2026-07-22 (28) — Cadence per (channel, month), auto-saved — DONE (verify green, 142 tests)
- [x] **Cadence now persists per (channel, month), independently** — July daily vs August 2/week; same month TikTok ≠ Instagram. **No Save button** — auto-saved on change (the smart alternative the user asked for).
- [x] **Root bug fixed:** cadence lived on `node.feedPlanner[channel]` → applied to all months, and in "All boards" (no node) wasn't saved at all. Moved to `BrandSpace.feedCadence[channel]["YYYY-MM"]` (additive, zero migration), auto-persisted by the existing gated+debounced brand save.
- [x] Pure helpers + 5 tests: `feedMonthKey` (LOCAL YYYY-MM), `resolveMonthCadence` (untouched month → neutral 3/week default, **no hidden inheritance**), `writeMonthCadence` (immutable deep-merge). `useBrandSpaces.updateBrandFeedCadence` deep-merges (anti-clobber, mistake #14). `FeedPlannerView` reads/writes a single source of truth from props — removed local `cadenceState` + node-reading effect.
- [x] **Harness test passed** (deleted before commit): stored map came out exactly `{instagram:{2026-07:daily, 2026-08:5/week}, tiktok:{2026-07:every-3-days}}` — each (channel, month) independent, each write on the right key.

### Browser-test checklist (for the user)
- In "All boards": set a cadence, reload → it persists (the central bug).
- Set July to daily, go to August → falls back to 3/week; back to July → still daily.
- Same month, switch Instagram ↔ TikTok → each keeps its own cadence.
- No Save button; the change just sticks.

### Next round (not built yet) — Drafts
- Multiple saved monthly arrangements per (channel, month): `BrandSpace.feedDrafts?: {id,name,channel,monthKey,cadence,dates:{postId:iso},createdAt}[]`. Live schedule = "draft zero"; loading a draft = preview overlay from its date-map (posts untouched); "Set as final" writes via existing `resolveDateWrites`. Dedicated round with tests.

## 🆕 2026-07-21 (27) — Feed slots: no clipping at edges, inset frames, pink today — DONE (verify green)
- [x] **Edge clipping fixed — one root cause.** The grid container is `overflow-hidden`, and the slot decorations grew *outward*: a Tailwind `ring` is an outside shadow (hover + today), and the drop target used `scale`. Both got cut off at the container edge and both ate into the gap between slots. **Everything is now inset** (or a border, which sits inside the box) — proven on a slot flush to the right edge: its ring is `inset` and there's no scale, so nothing can clip. Your instinct was exactly right.
- [x] **Today marker is now soft brand pink, inset, single-line** (was a green outside ring): an empty today gets a pink dashed border + faint pink wash; a today with a post gets a 2.5px pink inset ring. It reads clearly but gently, and never clips.
- [x] **Considered token pass** (chosen from screenshots, not guessed): gap 6→8px for more breathing room; corners `rounded-lg`→`rounded-xl` to match the app's buttons/panels; the empty-slot dashed border softened from raw gray to the brand token `#5F2427]/15`.
- [x] The fill from the previous round is unchanged; drag feedback stays (source dims, target gets a green inset ring) minus the clipping scale.

### Browser-test checklist (for the user)
- Hover a slot right at the left, right, top or bottom edge → the frame is drawn **inside** it and is never cut off.
- If today lands on an edge slot, its pink frame is whole.
- The gaps between slots stay perfectly even — no slot's outline bleeds into the gutter.
- Today's slot has a soft pink outline instead of the old green.


## 🆕 2026-07-21 (26) — Feed slots are genuinely responsive — DONE (verify green)
- [x] **Both holes explained and gone.** The old fitter capped cell width at 190px (→ ~110px dead strip on the right) and derived height from a fixed 4:5 ratio (→ ~127px dead strip below). New `services/feedGrid.ts` fills **both axes exactly**: it tries every column count, filling the box completely, and keeps whichever lands closest to a 4:5 post shape. 12 tests.
- [x] **Measured in a browser, not assumed:** slots now span **1175×800 of a 1175×800 box — leftover 0 on both axes** — at 2 rows, 3 rows and 4 rows. 2 rows fill the height just as completely as 4 or 8, exactly as you asked.
- [x] **Two CSS traps found on the way:** the cell's `aspectRatio: 4/5` lock was what stopped rows reaching the bottom; and setting `height` on a grid *item* doesn't size its row — the fix was `gridAutoRows` on the container.
- [x] **Outer frame removed** — the grid area keeps the exact same space but loses its border, rounded corners and shadow, since every slot already carries its own. The preview panel beside it keeps its card look.
- [x] Sanity bounds: a slot can't stretch past square or thinner than 1:2 (so one post in a huge month doesn't become a banner), and if a month is too dense to stay legible the area scrolls instead of shrinking to nothing.
- [x] **Micro-polish:** slots resize fluidly when cadence/month/drawer changes (transition switched off while you drag the window, so it never lags the cursor) · a short staggered fade-in on month change · a **ring on today's slot** for instant orientation · while dragging, the source slot dims and the drop target lifts slightly.
- [x] Bonus robustness: the container is now measured synchronously on mount, so the grid never renders a frame at zero size.

### Browser-test checklist (for the user)
- Wide screen → slots reach **both** the right edge and the bottom, no dead strips.
- Change the cadence up and down → the grid re-flows smoothly and still fills completely at every row count.
- Open Unscheduled → the grid re-fits into the narrower space, still edge to edge.
- Today's slot carries a subtle green ring.
- Drag a slot → the one you picked up dims, the one under the cursor lifts.


## 🆕 2026-07-21 (25) — Feed preview: permanent panel, no phone mockup — DONE (verify green)
- [x] **"View feed" button deleted** — the preview is always on screen, beside the slots. Its state is gone entirely (the old three-way `rightPanel` is now just a `showSources` boolean for the Unscheduled drawer).
- [x] **No phone, no chrome:** removed the iPhone frame, side buttons, Dynamic Island, the status bar (9:41 / wifi / battery) and the Instagram app bar (username + ＋ + hamburger) — in the TikTok skin too. The component was renamed `PhoneFeedMockup` → **`FeedProfilePreview`**, since it no longer mocks a device.
- [x] **No grey backdrop, no device shadow.** The panel uses the Settings-modal surface (`bg-white rounded-2xl shadow-sm bor