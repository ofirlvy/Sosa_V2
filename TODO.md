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
- [x] **No grey backdrop, no device shadow.** The panel uses the Settings-modal surface (`bg-white rounded-2xl shadow-sm border border-[#5F2427]/10`) — deliberately a near-twin of the slot-grid card so the two read as a matched pair.
- [x] **Aligned to the grid:** the two are siblings in one row, so their **top and bottom edges line up exactly** (measured, not eyeballed). Opening Unscheduled pushes rather than covers — the grid shrinks and re-fits itself (grid 975px, preview stays 360px).
- [x] **Everything you built still works — driven and verified, not assumed:** tile → post modal · hover pencil → the real card editor · Edit profile → the edit sheet · New + → the highlight editor · drag a tile onto another → **dates swap** (order went 1,2,3,4 → 2,3,4,1). Scheduling, syncing and the modals are untouched; this was a pure UI change.

### Browser-test checklist (for the user)
- Feed page → the profile preview is simply there, to the right of the slots, in a white card matching the grid card.
- No phone frame, no clock/battery row, no Instagram hamburger bar.
- Open Unscheduled → it pushes in beside the preview; the preview never disappears.
- Click a tile, hover-pencil a tile, Edit profile, New + highlight, drag one tile onto another — all behave exactly as before.


## 🆕 2026-07-21 (24) — Caption height + canvas micro-interactions — DONE (verify green)
- [x] **The caption bug, root cause:** the autosize effect depended only on the *text*. A collapsed card's editor unmounts, so re-opening mounted a fresh textarea while the caption was unchanged — the effect never fired and **an existing 4-line caption opened clipped to one line**, snapping to full height only once you typed. New `useAutosizeRef` measures on attach. Empty caption = one line, grows line by line, no limit — exactly as you described. **Measured after the fix: a 4-line caption opens at 105px (one line ≈ 24px).**
- [x] **A click never opens a card any more.** Previously a second click on a selected card opened it, so you couldn't touch a card to move or re-select it without an editor popping open — that was the thing snagging your flow. Opening is now deliberate: **double-click, or Enter**.
- [x] **Keyboard:** Enter opens the selected card · **Escape peels one layer** (closes the editor but keeps the card selected; press again to deselect) · **arrows nudge 1px, Shift+arrow 10px** · **Cmd+D duplicates**. All routed through a new pure `services/boardKeys.ts` (11 tests) that guarantees the board never steals a keystroke while you're typing and never swallows unrelated Cmd shortcuts.
- [x] **Start typing immediately:** opening a card puts the caret in its title. New cards already opened automatically — now they're ready to type into. It will not steal focus if you're typing somewhere else.
- [x] **Escape cancels a drag in progress** — the card snaps back and nothing is written, so a mis-drag across a carefully arranged board costs nothing.
- [x] **Motion & touch polish:** no more text-selection flicker while dragging (plus a proper grabbing cursor), and the app now honours the OS **"reduce motion"** setting, which it ignored entirely before.
- [x] Space+drag panning already existed — left untouched.

### Browser-test checklist (for the user)
- Open a post with a long caption → it shows **all** the lines immediately; typing grows it line by line.
- Click a card, click it again → it stays closed. Double-click (or select + Enter) → opens, caret in the title.
- Escape once closes the card but keeps it selected; Escape again deselects.
- Select a card, tap arrows → moves 1px; with Shift → 10px; Cmd+D duplicates.
- Start dragging a card, press Escape before releasing → it returns to where it was.


## 🆕 2026-07-21 (23) — Sidebar brand switcher: height, yellow border, avatar, hover — DONE (verify green)
- [x] **Height 68px → 62px.** Worth knowing: removing the word "Brand" alone changed *nothing* — the 32px avatar set the height, not the text. Actually shrinking it took a smaller avatar (28px) and tighter padding.
- [x] **The word "Brand" is gone.**
- [x] **Yellow right border removed.** It was `border-r border-[#ffd753]` on the sidebar wrapper — invisible against the yellow body, but it painted a 1px yellow sliver down the side of the pink section. The pink now reaches the edge. (Removed from the collapsed rail too; no visual change there.)
- [x] **The "weird translucent layer" over the logo — found by inspecting the file itself:** your logo is a **transparent RGBA PNG whose artwork is dark** (luminance 55, 21% transparent pixels), and it was being drawn on the dark-green gradient meant for white initials. A real picture now sits on plain white; the green gradient is kept only for the emoji/initials fallback. Same fix applied to the brand rows inside the curtain.
- [x] **Hover is now literally the same treatment as the user row at the bottom** — outer padding + an inner `rounded-xl` pill with `hover:bg-[#F9E6D1]/60 border border-transparent transition-all`. Verified by measuring the live hovered element: `rgba(249,230,209,0.6)` at `12px` radius, identical utilities to the bottom row. The old full-width `hover:bg-black/[0.04]` (which washed over the avatar too) is gone.
- [x] Untouched: the curtain, rename, brand switching, avatar upload, and the bottom profile section.

### Browser-test checklist (for the user)
- The brand section is shorter, has no "Brand" caption, and no yellow line on its right edge.
- The logo sits clean on white — no greenish cast over it.
- Hovering the brand row looks **exactly** like hovering your name at the bottom.
- Clicking still opens the curtain; double-click still renames; switching brands still works.


## 🆕 2026-07-21 (22) — FIX: video aspect ratio in the post mockup — DONE (verify green)
- [x] **I caused this in round 20, and here is the exact mechanism.** The modal sizes its frame from `mediaRatio`, which **starts at 4:5** and only corrected once the `<video>` reported its metadata — **measured at 1.0–2.4s** on your files (the trailing-moov problem). Before I added the poster there was nothing on screen during that wait, so nobody noticed; once the poster painted instantly, `object-cover` cropped it into the wrong 4:5 frame. Three of your videos are 1080×1920 (0.563), so the crop was severe.
- [x] **The frame now knows the ratio before it paints.** New `useAssetRatio` picks the cheapest source: session cache → **the poster image** (an `<img>` reports in ~50ms, and the poster is scaled proportionally from the video so its ratio *is* the video's) → video metadata as the authoritative backstop.
- [x] **Ratios are now remembered for free:** the poster capture already read `videoWidth/Height` and threw them away — it now caches `url → ratio`. Since the Feed grid and board cards warm that cache, opening a post is **correct on the very first frame**.
- [x] **Killed a bug I introduced with sound-on:** the hidden `opacity-0` ratio reporter was autoplaying item 1 **audibly and invisibly** while you viewed another carousel slide. It's deleted — verified that slide 2 now contains zero video elements.
- [x] Carousel behaviour unchanged and confirmed: **the frame follows the first item**.
- [x] **Untouched:** autoplay, sound-on-by-default, all UI, Reels/Story (fixed 9:16), and **every byte of your data** — the ratio cache is in-memory only.

### Browser-test checklist (for the user)
- Open a post whose video is 9:16 → the frame is **tall and uncropped immediately**, no jump from square to tall.
- Carousel with a 9:16 video first → frame is 9:16; moving to slide 2 keeps it and there is **no audio from an unseen video**.
- A 4:5 video still shows as 4:5. Sound is on, playback is automatic.


## 🆕 2026-07-21 (21) — Board thumbnail: a real miniature of the board — DONE (verify green)
- [x] **Two reasons the old preview looked bad:** (1) it cropped to the *densest 800px grid cell*, so you saw an arbitrary corner instead of the board; (2) every card became a single flat colored rectangle — no images, no structure.
- [x] **Now it's a real miniature**, Figma-style: **fit ALL the content** (`computeThumbFrame`, padded + letterboxed to 4:3), then draw each card with its actual anatomy — zones as their tinted dashed frame with the title pill, posts as a white card with a header row, a grid of their **real photos**, and caption lines; stickies in their real color; image cards filled by the photo; docs/text/planner with their own skeletons.
- [x] Video assets use the poster added in stage 48 (`thumbnail || url`), so a video shows a frame rather than a blank square.
- [x] Text is drawn as gray bars, not glyphs — at this scale (a ~2000px board inside ~250px) real type is sub-pixel noise; bars read as "there's writing here", which is what Figma's smudged text conveys. Bars are skipped entirely on cards too small to read.
- [x] **Image budget of 14** per thumbnail (largest cards win), so a Home page full of boards doesn't pull dozens of full-size images.
- [x] **Frame matches the empty state exactly** (follow-up): the grey canvas tint inside the SVG was removed and the wrapper moved to `inset-6`, so a board with content and an empty board are the *same* floating white card with the same shadow — only the contents differ.
- [x] **Untouched, as asked:** the empty-board thumbnail, `PageView`'s wrapper and condition, and every real card. This component is a pure read — it never writes.

### Browser-test checklist (for the user)
- Home → the **"lunch social"** board now shows the pink zone with its title, the athlete photos, and the cards laid out as they really are — recognisable at a glance without reading the name.
- An **empty** board's thumbnail is **exactly as before**.
- Boards with docs/text/planner cards show a sensible skeleton rather than blank rectangles.
- Opening any board → the cards themselves are unchanged.

## 🆕 2026-07-21 (20) — Video thumbnails: real poster frames, instant paint, sound-on in mockups — DONE (verify green)
- [x] **Root cause (measured, not guessed):** every uploaded video is a **QuickTime container (`ftypqt`) whose `moov` atom sits at the END of the file** — verified by range-requesting the real files (absent from the first 300KB, present in the last). The codec is fine (H.264/AAC). A browser can't paint one frame, or even read the dimensions, until the **entire** file has downloaded. Measured in-browser on a 5MB clip: `<video preload="metadata">` first painted at **1.8s** — that's the gray box; on bigger/slower files it never paints, which is the white thumbnail.
- [x] **New uploads store a real poster.** `beginMediaUpload` also returns `posterPromise`, captured from the **local file** (no network) and persisted to `MediaItem.thumbnail` / `ImageCardContent.thumbnail`. Thumbnails become plain `<img>` — instant, forever, no video download at all.
- [x] **`components/media/VideoThumb.tsx`** is now the only way to show a still for a video (replaced **12** ad-hoc `<video>` thumbnails): stored thumbnail → session-cached poster → `<video …#t=0.1>` while capturing a poster in the background.
- [x] **Existing videos: zero writes**, per your decision. They get an in-memory, session-only poster — the first view still pays the download, but it resolves to a real frame instead of staying white, and it's instant for the rest of the session.
- [x] **Sound ON by default** in the preview modals, with automatic fallback to muted if the browser blocks unmuted autoplay (otherwise it wouldn't play at all). `MockupVideo` also got `preload="auto"` and a poster.
- [x] Storage cache header fixed: `max-age=3600` → **`31536000, immutable`** (the path is a fresh UUID, so the file can never change). New uploads only.
- [x] Verified end-to-end in a real browser against your actual `.mov`: canvas capture succeeds (Storage sends `access-control-allow-origin: *`, so no tainting), producing a 93KB 512×640 JPEG.

### Browser-test checklist (for the user)
- **Upload a new video** (ideally a heavy `.mov` from the iPhone) → its thumbnail appears as a real frame almost immediately, in the board card, the Feed grid and the phone mockup — and still does after a reload and after closing the browser.
- **An existing video** → first view takes a moment (the file must download; nothing was written to your data), but it now **fills in with a frame instead of staying white**, and is instant everywhere afterwards in that session.
- Open a post/reel/story mockup with video → **sound is on**, the pill shows the speaker icon, clicking it mutes.
- **Nothing existing disappeared or changed** — no media, no cards.

## 🆕 2026-07-21 (19) — Unschedule: drag an item out of the Feed / Calendar — DONE (verify green)
- [x] **The gap:** you could place a post on a date but never take it off. Now: drag a placed post onto the **Unscheduled** drawer/tray, or click the **`CalendarOff`** button that appears on hover. The date is cleared, the item leaves the grid + phone mockup + calendar and returns to Unscheduled — **the card on the board is untouched**.
- [x] **One shared writer:** `resolveDateWrites(wsCards, card, dateStr, contentBase?, dateField?)` in `services/gridPlanner.ts` (+6 tests) is now the only place a scheduled date is written, used by both `FeedPlannerView.assignToDate` and `CalendarView.assignToDate`. `dateStr = undefined` ⇒ unschedule, which **also unlinks the planner slot** — without that, `syncLinkedDates` re-derives the date and the post snaps straight back.
- [x] **Two Calendar bugs fixed by the unification:** its linked-post branch wrote `content.date` hardcoded (ignoring `DATE_FIELD`, so a Newsletter/Gantt would be written to the wrong field), and it never unlinked a planner slot at all.
- [x] The drawer/tray **auto-opens when you start dragging a dated item** (a drop target must be visible to be usable) and highlights with a green ring + "Drop here to unschedule". Dragging an already-unscheduled item onto it is a no-op.
- [x] Icon choice is deliberate: `CalendarOff`, **not** `X` — an `X` reads as "delete" and would make a reversible action feel dangerous.

### Browser-test checklist (for the user)
- Feed → drag a placed tile onto the Unscheduled drawer ⇒ it leaves the grid and reappears in the list; the card still exists on its board; reload persists.
- Same tile → hover ⇒ the **CalendarOff** button (top-left) does it in one click.
- **The important case:** a post that's linked to a board Feed-Planner card — after unscheduling it must NOT jump back onto the grid by itself (that's the `unlinkPost` path).
- The unscheduled item disappears from the phone mockup and from the Calendar too; re-scheduling it puts it back everywhere.
- Calendar → drag a post from a day onto the Unscheduled tray ⇒ same result; the hover CalendarOff on the pill works too.

## 🆕 2026-07-21 (18) — Feed mockup: editable profile + real highlights — DONE (verify green)
- [x] **Model (additive, zero migration):** `MockupProfile {username, displayName, avatarUrl, bio, link, highlights?}` + `MockupHighlight {id, title, coverUrl?, frames?}`; stored per channel on `BrandSpace.socialProfiles[channel]` (rides the existing `brand_spaces` blob). Field names mirror the IG Graph API so a future "connect Instagram" in settings fills the same record instead of the user typing it.
- [x] **`services/mockupProfile.ts` (+8 tests)** — one fallback chain replacing four copy-pasted ones (PhoneFeedMockup + the 3 preview modals). Blank field ⇒ falls back to the brand's name/picture. The 3 modals now accept a resolved `username` so an opened post matches the profile above it.
- [x] **`updateBrandProfile(id, channel, patch)`** in `useBrandSpaces` — **merges**, never blind-replaces (a late-resolving avatar upload must not drop the other fields).
- [x] **Edit UI inside the phone** (`components/mockup/`): `EditProfileSheet` = IG-style "Edit profile" (Name, Username, Bio, Link + Change profile photo; Cancel/Done, but the photo commits immediately so a late upload isn't stranded). `HighlightEditor` = title + cover + content strip (multi-file image/video), **commits on every change** since media is async; delete highlight included.
- [x] **Real highlights** replace the hardcoded `['New','Team','BTS','Press','FAQ']`: rendered from the profile with covers, hover-pencil to edit, "New +" to add. Tapping one with content plays it in the existing `StoryPreviewModal` (via a documented synthetic-card shim); an empty one opens its editor.
- [x] Bio/link now render only when set (no more hardcoded "Planning the feed with Orbit ✨" / `linktr.ee/…`). Follower counts stay decorative and are seeded on the **brand** name, so renaming the profile doesn't reshuffle them.
- [x] Fixed in passing: `App.tsx` passed `avatarUrl=undefined` for any non-default brand, so a brand's uploaded picture never reached the Feed page.

### Browser-test checklist (for the user)
- Feed → **View feed** → "Edit profile" → change username / name / bio / link + upload a profile photo ⇒ updates in the mockup immediately; **the sidebar brand is unchanged**; reload → persists.
- Clear a field ⇒ it falls back to the brand's name/picture (not blank).
- "New +" in the highlights row → give it a name, a cover, and a few images/videos ⇒ appears in the row; tap it ⇒ story viewer plays the content; hover-pencil re-opens the editor; Delete removes it.
- Switch channel to TikTok ⇒ its own separate profile. Switch brand ⇒ a completely different profile.
- Open a post from the mockup ⇒ same handle + picture as the profile.

## 🆕 2026-07-20 (17) — Data reliability: "breaks after 10-15 min", heavy videos, server-side version history — DONE (verify green)
- [x] **🔴 ROOT CAUSE of "the app suddenly breaks and new things are missing after refresh":** `onAuthStateChange` re-ran `checkOnboarding` on EVERY auth event (incl. `TOKEN_REFRESHED`, ~hourly), and `getUserProfile` returned `null` on any error → `onboardingComplete` flipped to `false` → the OnboardingFlow screen rendered mid-session **and every save effect silently gated off**. Fixed in `hooks/useAuth.ts`: profile is resolved **once per user id** (`checkedUserIdRef`), and the gate may only ever change from a **successful** fetch (`resolveOnboardingGate`, pure + tested) — a fetch error retries with backoff and keeps the last known value.
- [x] Save reliability: `currentUserId()` now prefers the local auto-refreshing session over a network `getUser()`; a 15s watchdog retries any unsaved tree; `saveError` surfaces a burgundy "Can't reach the server — retrying" banner instead of failing silently.
- [x] Heavy uploads: `persistMedia` retries 3× with backoff and only falls back to base64 **below 2MB** (a 100MB video as base64 would have broken every subsequent save of the whole blob); `beginMediaUpload` runs through a 3-way concurrency pool; `beforeunload` warns while uploads are in flight; `stripBlobUrls` now marks in-flight media `uploadPending` instead of blanking `url` to `''` (which produced permanently black cards), and `ImageCard` renders an explicit "Upload didn't finish — drop it here again" state.
- [x] **DB version history (schema applied to live DB, additive):** `supabase/history.sql` → new `sosa_data_history` table + index + RLS (select-own only; writes only via the SECURITY DEFINER trigger) + `sosa_data_archive BEFORE UPDATE` trigger that archives the previous `data` and prunes to the newest 20 per (user,key). **Throttled to one version per 10 minutes** so a burst of debounced saves can't flush the history window. Verified live: trigger archives correctly (tested inside a rolled-back transaction; production rows untouched — 4 rows, 0 history rows, blob 2.61MB).
- [x] +8 tests pinning the new invariants (gate never lowered on error, no base64 above the limit, `uploadPending` instead of `url:''`).

### Browser-test checklist (for the user)
- Stay in the app **>20 minutes** (past a token refresh) → it must NOT jump to the onboarding screen, and edits made late in the session must still be there after a refresh.
- Upload a very heavy video → the card shows a preview immediately, "Uploading…" while it persists, then loads from `…supabase.co/storage/…` after a reload; come back days later → it still plays (no black square).
- Close the tab mid-upload → a warning appears; if you close anyway, the card shows "Upload didn't finish" rather than a black box.
- Kill the network briefly while editing → the burgundy "Can't reach the server — retrying" banner appears and clears once it reconnects; the edit survives a refresh.

## 🆕 2026-07-19 (16) — Feed mockup: true aspect, IG-2026 video controls, edit-from-Feed — DONE (verify green)
- [x] New shared `components/media/MockupVideo.tsx`: autoplay/muted/loop + bottom-right mute/unmute pill (`Volume2`/`VolumeX`) + tap-to-play/pause with fading center glyph; reports natural aspect.
- [x] `InstagramPreviewModal` / `ReelsPreviewModal` / `StoryPreviewModal` render video via `MockupVideo fit="contain"` + images `object-contain` → **no crop** (4:5 stays 4:5, 1:1 video letterboxes, never forced to 9:16/16:9). Small feed grid tiles left as `object-cover` (IG-profile look) by design.
- [x] Edit-from-Feed: pencil button on hover (grid cell + Unscheduled row + phone-mockup `Tile`) → `FeedCardEditor` opens the real Post/Reels/Story card in BaseCard controlled-fullscreen, writing via existing `onUpdateCard`; Escape/minimize closes. Added `onFullscreenChange?` to the 3 card prop interfaces.
- [x] **Follow-up:** Instagram post mockup frame now **height-follows-media** (`mediaRatio` state → `aspectRatio`, no `min-h`/phantom) → no gray letterbox at any ratio. All 3 modals take `avatarUrl?`; `FeedPlannerView` passes real `brandName` + `avatarUrl` → mockup shows the brand's name + profile picture.
- [x] **Carousel 1:1 like IG 2026** (`InstagramPreviewModal.tsx`): frame ratio from item[0], every slide `object-cover` (fill/crop) — item 0 exact, rest cropped; single item still fills with no bars. Fixed invisible arrows (added `group` to media container) + added `1/N` counter pill top-right. Browser test (behind login): open a post with 3 images of different ratios → arrows/dots work, all slides cropped to frame.
- [x] **🔴 DATA-LOSS FIX:** edit-from-Feed was erasing post media (frozen-snapshot write + blind-replace). Fixed: `FeedCardEditor` reads the **live card by id** from `nodes` each render; `onUpdateCard` (both handlers in `App.tsx`) now **merges** content. Documented in CLAUDE.md §6 #14 + memory `persistence_invariants` #8. **User:** try `?recover=1` to restore lost media from the local snapshot ring (last 10, act fast).

### Browser-test checklist (for the user — app is auth-gated so run these after signing in)
- Feed → click a post whose media is 4:5 or a 1:1 video → mockup shows it **in full, no crop**; a portrait 4:5 image is not squared.
- Video mockup: **mute/unmute** pill toggles real audio; **tap** the video toggles play/pause with the center glyph. Same UI in Post, Reels, Story, TikTok.
- Caption appears in the opened Instagram/Reels preview.
- Hover a Feed card (grid / Unscheduled / phone mockup) → **pencil** → the real card opens fullscreen; edit caption/title → close → change is saved on the source board (reopen to confirm) without entering the whiteboard.

## 🆕 2026-07-08 (15) — Feed: event-aware slots + multiple posts/day + open drawer from slot — DONE
`buildFeedMonth` guarantees a slot on each event day (smart ±1 merge with cadence); Unscheduled drops STACK onto a day (swap only for grid reordering) → multiple posts/day without changing cadence; clicking a ghost slot's + opens the Unscheduled drawer. +3 tests. verify 0 errors, 73 tests. Detail: PROGRESS stage 44.

## 🆕 2026-07-08 (14) — Connectors default OFF on boards — DONE
`showConnectors` (App.tsx) now defaults to `false`. Toggle button/Canvas wiring unchanged. verify 0 errors, 70 tests. Detail: PROGRESS stage 43.

## 🆕 2026-07-08 (13) — Brand Switcher UI polish — DONE
Own themed section (pink bar over a burgundy curtain, mirrors the bottom Profile & Curtain mechanism exactly) replacing the floating popover; same green repeating-gradient divider; per-brand avatar upload (camera-overlay → `beginMediaUpload`, new `BrandSpace.avatarUrl` + `updateBrandAvatar`); double-click-to-rename on both the compact row and curtain rows. verify 0 errors, 70 tests. Detail: PROGRESS stage 42.

## 🆕 2026-07-08 (12) — Brands: one primitive for individual vs teams — DONE (Phase 1)
Product decision from brainstorm: no Individual/Teams modes — a **Brand** (workspace) owns its tree, calendar+events, feed, queue. Legacy data = default brand (zero migration; missing `spaceId` ⇒ 'default'). New `services/brandSpaces.ts` (+8 tests) + `hooks/useBrandSpaces.ts` (calendar_events safety pattern, key `brand_spaces`) + Sidebar Brand Switcher + App-level `visibleNodes`/`visibleEvents` (views filtered; mutations on full maps). verify 0 errors, 70 tests. Detail: PROGRESS stage 41.
**Phase 2 (later, needs schema approval):** teams = sharing a brand (`spaces`+`space_members` tables, invites, roles). **Backlog:** cross-brand calendar lens, per-brand social accounts (Phase C), brand templates/duplication, client read-only share.

## 🆕 2026-07-08 (11) — Feed grid slot UI polish — DONE
Grid now flush to the frame (no padding), top-aligned instead of centered; ghost-slot dashed border thickened (border-2, longer dash/gap as a natural side effect); empty-slot "+" wrapped in the same circular button as PostCard's References/Final-Assets AddMediaButton. CSS/JSX only. verify 0 errors, 62 tests. Detail: PROGRESS stage 40.

## 🆕 2026-07-08 (10) — Unified "Unscheduled" naming + Feed drawer closed by default — DONE
Feed page's "To schedule" renamed to "Unscheduled" (matches Calendar's name for the same concept). Feed's sources drawer now starts closed (`rightPanel=null`), matching Calendar's `showTray=false` — both open only on click. verify 0 errors, 62 tests. Detail: PROGRESS stage 39.

## 🆕 2026-07-08 (9) — Fix: dated post reappeared in Feed "To schedule" on month change — DONE
`unplacedItems` returned undated OR out-of-month items, so a scheduled post came back to "To schedule" when navigating months. Now returns undated-only (dropped month/year). Calendar `unscheduled` was already correct. verify 0 errors, 62 tests. Detail: PROGRESS stage 38.

## 🆕 2026-07-08 (8) — Social LinkCard: clean single-state (no placeholder/chrome/2-stage) — DONE
Pasted IG/TikTok/Pinterest links now render header + cover at native aspect, single state; reel/video → Play; click/Play opens the post on the platform (no live embed → no chrome, no 2-stage). Reliable IG cover via /p/{code}/media/?size=l (+ isVideo). New pure helpers instagramShortcode/instagramCoverUrl/isVideoLinkUrl (+tests). verify 0 errors, 62 tests. Keyless limit: single cover only (carousel arrows / inline video = Phase C API). Detail: PROGRESS stage 37.

## 🆕 2026-07-08 (7) — Fix: paste on-board media made a new card instead of filling the slot — DONE
Root cause: `[data-paste-zone]` only wrapped the References/Final-Assets sections (expanded only); pasting over the title/caption or a collapsed card found no zone → new canvas card. Fix: card-wide fallback paste-zone on each card's content root (Post→references, Story→frames, Reels→cover) via React-19 ref-cleanup listeners; specific inner sections keep precedence via `closest`. verify 0 errors, 59 tests. Detail: PROGRESS stage 36.

## 🆕 2026-07-08 (6) — "View feed" iPhone + IG/TikTok profile mockup — DONE
The Feed page "View feed" drawer is now a realistic iPhone (Dynamic Island, status bar) with a 1:1 Instagram profile (avatar/bio/highlights/stats/tabs) + the scheduled posts grid; tap a tile → preview modal. TikTok channel → TikTok profile. New `PhoneFeedMockup.tsx` + pure `mockupStats.ts` (formatCount/stableCountFromSeed, +tests); drawer widened to 420px; App passes brandName/avatarUrl. verify 0 errors, 59 tests. Detail: PROGRESS stage 35.

## 🆕 2026-07-08 (5) — Paste on-board media into card slots — DONE
Copy an image/video card from the board → paste over a slot → media lands in the slot (Post refs/finals, Story frames, Reels cover), no new canvas card, no re-upload. Extended `sosa:paste-media` to carry `items` (URL) + Canvas routing via `isAllMediaClipboard`/`imageCardsToMediaItems` (clipboardService, +tests). verify 0 errors, 56 tests. Detail: PROGRESS stage 34.

## 🆕 2026-07-08 (5) — Instant multi-media drop (no infinite spinner / "Failed") — DONE
Dropping many files at once no longer stalls/fails. Roots fixed: (1) concurrency limiter `createLimiter(3)` in fileService so compression/upload doesn't choke the main thread (preview stays instant); (2) ImageCard renders the blob preview immediately + auto-sizes from the real element `onLoad`/`onLoadedMetadata` (no blocking spinner, no double decode); (3) Canvas revokes the blob only after the URL swap + 15s delay (never on rejection) and ImageCard resets `error` on url change → no sticky "Failed to load image". verify 0 errors, 54 tests. Detail: PROGRESS stage 33.

## 🆕 2026-07-08 (4) — Multi-media drag/paste grid + precise bounding box — DONE
Dragging several images/videos from a folder (or multi-paste) now adds all of them and tiles them in a centered non-overlapping grid (`services/mediaLayout.ts` `tileGrid` + shared `addMediaFiles` in Canvas; `maxFitDim` caps multi-drop tiles). Bounding box: `ImageCard` switched to `object-cover` + an aspect-snap so the card box always equals the media → selection ring/handles/connector dots are exact for every card type. verify 0 errors, 52 tests. Detail: PROGRESS stage 32. **The "bounding box letterbox" TODO item is now resolved.**

## 🆕 2026-07-08 (3) — Feed page v2: dynamic fit-grid + events-on-slots + View-feed drawer + board filter — DONE
6 precision fixes: (1) grid is now **dynamic fit-to-container** (`computeFit`+`useContainerSize`, no scroll — whole month visible), (2) **calendar events render on their slots** (adaptive chips/dots via `getEventConfig`, new `events` prop), (3) removed "Today", (4) **"View feed"** right drawer = scrollable IG/TikTok profile-grid mockup (`orderedFeedItems`) with click→preview modal, (5) filter is now **by board** (all whiteboards, "All boards" default; `isInScope`) with all "brand" wording gone, (6) no visible scrollbars. verify 0 errors, 48 tests. Detail: PROGRESS stage 31.
Note: folders are NOT necessarily brands — app also serves a single brand where folders = campaigns/social/etc.

## 🆕 2026-07-08 (2) — Feed page: UI aligned to Calendar + cadence fixed + drag-to-swap — DONE
Rewrote `FeedPlannerView` as a structural copy of `CalendarView` (same shell/toolbar/tray/tokens) for app-wide uniformity. Cadence reworked to `{mode:'perWeek'|'everyNDays', value}` (`normalizeCadence`+`cadenceStepDays` in feedPlanner.ts) and now actually works (fixed inverted +/- and the All-brands no-op; local state + persist-to-folder). Added **drag-to-swap** between grid slots that reschedules both posts' dates via the shared `assignToDate` path. verify 0 errors, 47 tests. Detail: PROGRESS stage 30.

## 🆕 2026-07-08 — Account-level Feed page (cross-board, brand+channel) — DONE
New Sidebar **Feed** page = a third lens over the same posts (Calendar=timeline, Feed=channel grid, board card=local). Source of truth stays `post.content.date` + channel target. `services/feedPlanner.ts` (pure, 5 tests) + `components/FeedPlannerView.tsx` (split screen: 3-col grid w/ real posts + ghost cadence slots, drag-from-rail assign routed through the calendar's `assignToDate` path). Additive `FeedCadence` + `folder.feedPlanner`. Board planner card untouched. Full detail + browser-test checklist in `PROGRESS.md` stage 29.

> **Verify before handing back:** `npm run verify` (typecheck + lint + **test**) must exit 0 (warnings OK). Enforced by the `Stop` hook.

---

## 🆕 2026-07-05 — Social engine Phase A+B (DONE; verify=0 errors, 40 tests; awaiting browser test)
Plan: `~/.claude/plans/enumerated-percolating-hennessy.md`. The "most important engine": live social content + a real scheduling system — **all without any platform registration** (honest research summary in the plan; no ToS-violating automation).

**Phase A — everything renders LIVE on the board (keyless official embeds):**
- `services/embedService.ts` (new) — script-loader singleton + embed builders: IG blockquote+embed.js (public posts), TikTok blockquote+embed.js (+ official keyless oEmbed for metadata), Pinterest pinit.js. `mountEmbed(el, platform, url)`.
- `LinkCard` — the YouTube overlay pattern generalized: View/Play button on IG/TikTok/Pinterest cards → full-card live embed overlay (scrollable, ✕ to close). TikTok logo+platform added ('tiktok' in LinkCardContent.platform union). TikTok preview aspect 9:14.
- `linkService` — TikTok handler (official oEmbed, proxy fallback), single-pin Pinterest handler (og-tags), `guessUrlPlatform`.
- `Canvas` — `cardForUrl` factory: per-platform paste sizes (YT 480×380, TikTok 300×580, IG 360×560, Pin 300×480); **drag-from-web**: dropping a link/image from another browser tab (e.g. a Pinterest pin) creates the right card at the drop point (`text/uri-list`/`text/html` parsing in `urlFromDrag`).

**Phase B — scheduling + semi-auto publish kit (Later/Buffer-style):**
- types: `PublishPlatform`, `PublishTarget {id, platform, at(ISO datetime), status: scheduled|needs_action|published|canceled, caption?, publishedAt?}`; `publishTargets?` on Post+Reels content (additive).
- `services/publishReminders.ts` (new) — pure `collectQueue(nodes)` / `dueTargets(items, now)` / `markTargetsNeedAction` / `setTargetStatus` (+4 tests in `tests/publishTargets.test.ts`), `PLATFORM_META` (labels, composer deep-links, caption limits), `notifyDue` (Web Notifications).
- `PublishModal` (new) — from the Send button on Post/Reels footers (badge shows open count): platforms, datetime-local, caption w/ per-platform char counters, media validation warnings.
- `CalendarView` — **Publish queue tray** (mirrors Unscheduled tray; mutual-exclusive), overdue "ready!" highlight, click → navigate to board.
- `App` — minute tick: due targets → `needs_action` + notification + **PublishKitModal** (new): media download grid, one-tap caption copy, deep link to the platform composer, "Mark as published". `updateCardAnywhere` helper (active board via workspaces state, others via node patch).

**Phase C (next session) — real auto-publish blueprint ready in the plan:** Supabase Edge Functions + `social_accounts`/`scheduled_posts` + pg_cron; registration checklists (Meta dev-mode = full auto-publish to OWN account, no review; Pinterest Trial→Standard; TikTok drafts mode). User confirmed willing to register; Instagram first.

### Browser-test checklist — social engine A+B
- Paste an IG post URL / TikTok video URL / Pinterest pin URL → card in the right ratio; click View/Play → the real content renders & plays inside the card; ✕ restores the thumbnail; YouTube unchanged.
- Drag a pin from a pinterest.com tab onto the board → card appears at the drop point.
- On a Post: Send button → schedule to 2 platforms 2 minutes from now → badge shows 2; Calendar → Queue tray lists both; when due → notification + Publish Kit (download media, copy caption, open composer) → Mark as published → queue shows published, badge drops.
- Reload → targets persist. Old boards unaffected.

---

## 🆕 2026-07-04 — Data-integrity safety net (#4) + git  (DONE; verify green, 36 tests)
Plan: `~/.claude/plans/enumerated-percolating-hennessy.md`. The app had **no git and no tests** under a "never lose data" mandate. Built the net:
- **git**: repo initialized, baseline commit; `.gitignore` already covers `.env.local`/`node_modules`/`dist` (secrets safe).
- **Vitest** added (`npm test` = `vitest run`); folded into `verify` so the Stop hook now runs typecheck + lint + **tests**. `vitest.config.ts` (node env, dummy `VITE_SUPABASE_*` so importing supabase-backed modules doesn't throw).
- **Testability extractions (behavior-preserving):** `services/persistenceDecision.ts` — the ok/empty/error load branching (the exact seam of the historical data wipe) pulled out of `useFileSystem.attempt()` into pure `resolveLoadDecision()` + moved `sanitizeNodes` there. `services/coords.ts` — `toLocal`/`localToWorld`/`worldToLocal`/`screenToWorld` pulled out of Canvas (Canvas now imports thin wrappers).
- **Invariant tests (`tests/*.test.ts`, 36):** persistenceDecision (error NEVER writes defaults to DB; empty+cache/empty+seed; sanitize+re-save), stripBlobUrls, reconcile idempotence + POST/REELS slot dates + `scheduleLinkedPost↔findSlotForDate`, dateUtils LOCAL round-trip, materializePaste full id-remap + no shared refs + envelope round-trip, coords offset round-trip, computeSnap threshold, snapshot ring (bound/dedup/skip-empty).
- **Recovery / snapshot ring:** `services/snapshotRing.ts` — on each confirmed save + flush, `useFileSystem` pushes a bounded (10), deduped JSON snapshot to `localStorage` `sosa_snap_<uid>` (media is on Storage → cheap). Guarded restore overlay at **`?recover=1`** lists snapshots and restores through the normal gated save path (`getSnapshots`/`restoreFromSnapshot`).
- **Proof:** deliberately reintroduced the wipe bug (`saveToDb: defaults` on exhausted error) → the CRITICAL test failed as designed; reverted → green. The net catches the real regression.

### Next candidates (from the Fable-5 curation, not yet built)
#3 AI board co-pilot (highest product leverage), #1 realtime collab (+#2 storage sharding), #5 product spine (unified status/date + ⌘K). See plan history / memory.

---

## 🆕 2026-07-03 — Board Chat Drawer (comments V1, implemented; awaiting user browser test)
Plan: `~/.claude/plans/enumerated-percolating-hennessy.md`. verify = 0 errors; all changed modules 200 on dev server.

**What it is:** one chat per whiteboard replacing the per-card comments panel. Trigger = square MessageSquare button next to the sheets bar (bottom-left, pink/burgundy like exit); opening it shrinks the board into a rounded "window" (my-4 mr-4 rounded-3xl) and slides a 380px drawer in from the LEFT.
- **Data:** `FileSystemNode.boardChat?: BoardChatMessage[]` (board messages, ISO timestamps) + card comments stay in `content.comments` (+ new optional `resolved`). Both aggregated in the drawer. All additive — persistence untouched.
- **Cards:** the 6 commentable cards (Post/Doc/Story/Reels/Newsletter/Reference) lost their comments panel + local `comments` state (CRITICAL: prevents stale-copy clobber of drawer edits) and got `CommentBadge` (cardKit) showing OPEN count → opens drawer filtered to the card.
- **Canvas:** offset-aware coords (`toLocal`/`localToWorld`; screenToWorld now safe when the board window is offset) — zoom-to-pointer, marquee, paste all fixed for the windowed mode; zero behavior change when drawer closed.
- **Drawer:** `components/BoardChatDrawer.tsx` — list (aggregated, chronological; legacy string timestamps render as-is), resolve toggle, filters All/Unresolved/per-card, card-reference chips (click → switches tab + centers + selects card via `handleJumpToCard`), composer with `+`/`/` card picker, Hebrew RTL.
- **UI redesign (2026-07-03b)** — first pass felt like a foreign element (cool `#F2F2F7` bg, floating white bubble-cards w/ shadows, dark burgundy icon block, pink filter pills). Rewritten to match the app's native language, modeled on the calendar **Unscheduled tray**: white panel, `border-b`/`border-t border-gray-100`, gray text hierarchy (gray-900 title / gray-400 meta), **green `#3A5C34/10` accent chips** (icon box, active filter pills, card chips), **warm-stone `#F9F8F6` message scroll area** (ties to board bg) with flat `border border-gray-100` message cards (no drop shadows), composer input shell `bg-[#F9F8F6] rounded-2xl border` w/ green focus ring + green send button. Layout: drawer is now a **floating rounded-3xl "twin window"** of the board (both get `my-4` + gap, shadow, `#5F2427/10` border), easing `cubic-bezier(0.16,1,0.3,1)` matching the tray.
- Deferred: @person mentions, realtime, notifications.

### Browser-test checklist — chat drawer
- Drawer closed: full regression of pointer ops (marquee/zoom/paste land under cursor).
- Open drawer → board shrinks into rounded window; ALL pointer ops still land correctly inside it.
- Card with old comments → badge count; click → drawer filtered; old comments show with their original text/timestamps.
- Send message with `/`-picked card → chip click jumps (switches sheet, centers, selects).
- Resolve → badge + trigger-bubble counts drop; Unresolved filter hides.
- Reload → chat + resolves persist; existing boards unchanged.

---

## 🆕 2026-07-02 — Big UX/feature batch (25 notes, ALL implemented; awaiting user browser test)
Plan: `~/.claude/plans/enumerated-percolating-hennessy.md`. `npm run verify` = 0 errors; dev-server smoke = 200 on all changed modules. **Data-safe:** all changes additive/backward-compatible; persistence code (`useFileSystem`, `supabase.ts`, `DEFAULT_WHITEBOARD_DATA`, `writeCards` invariants) untouched.

**Shared infra (new files):**
- `services/snapService.ts` — pure magnetic-snap math (edges/centers, guide lines).
- `services/clipboardService.ts` — copy/paste/duplicate: id-remap, zone-children, connectors, free-spot placement, system-clipboard envelope (`sosa:cards:v1`).
- `services/textDirection.ts` — Hebrew/RTL auto-detect (`detectDirection`, `defaultAlignFor`).
- `components/cards/richtext/richtext.tsx` — shared rich-text engine extracted from DocCard (commands, checklist, fixed `applyFontSize`, `RichTextControls`, styles). DocCard now consumes it.
- `components/cards/cardKit.tsx` `CardMeasureContext` + BaseCard `ResizeObserver` → Canvas `measuredSizesRef`/`effectiveRect` (real DOM sizes for connectors/zones/groupBounds).
- `components/BoardThumbnail.tsx` — real board mini-preview (SVG of busiest area).

**Implemented items:**
- [x] 1 Snap/align guides while dragging (burgundy `#5F2427`, 1px-at-any-zoom; Cmd/Ctrl disables) — `Canvas.handleDragMove` + snapService
- [x] 2 Sidebar collapse → 64px icon rail (localStorage `sosa_sidebar_collapsed`), button by mute — `Sidebar.tsx`
- [x] 3 Rename via dblclick + drag-drop in sidebar & PageView — already present (TreeItem/onMoveNode); verified covers folders+whiteboards
- [x] 4 Real board thumbnails for non-empty boards; **empty boards keep the exact static hint** — `PageView.tsx` + `BoardThumbnail.tsx`
- [x] 5 TextCard Miro-like: uncontrolled editor, edit-only-when-expanded, rich toolbar, shapes/fill — `TextCard.tsx`
- [x] 6 Sticky RTL auto (align computed per-language; stopped persisting default align) — `StickyCard.tsx`
- [x] 7 Cmd+C/X/V + right-click Copy/Duplicate/Paste for single & multi; free-spot placement; zones+connectors — `Canvas.tsx` + clipboardService
- [x] 8 Context-menu overhaul (empty/single/multi/zone/locked/connector; Group, Align row, Copy/Paste, Open link) — `Canvas.tsx`
- [x] 9 Feed Planner accepts Reels (filter + syncLinkedDates + linkedDate prop + cover) — `GridPlannerCard`, `gridPlanner.ts`, `Canvas`, `ReelsCard`
- [x] 10 Connector dots use real rendered height (measured); arrows already behind cards (z-5) — `Canvas.effectiveRect`
- [x] 11 Workspace tabs: drag-reorder + Duplicate + Lock (readOnly board) — `useWorkspaces.ts`, `App.tsx`, `types.ts`
- [x] 12 Drop-into-zone auto-grows frame + magic no-overlap placement; measured heights for media — `Canvas.withZoneMembership`/`fitZoneToChildren`
- [x] 13 Collapsed-card gesture: click selects, dblclick/second-click expands; multi-select never expands — `BaseCard` + Canvas `expandedCardId`
- [x] 14 Calendar quarter aligned to real quarters (`Q2 2026`, ±1 quarter nav; per-mode header) — `CalendarView.tsx`
- [x] 15 Day-click modal: schedule unscheduled item onto date + create event — `CalendarView.tsx`
- [x] 16 DocCard fullscreen no longer collapses (fullscreen lifted to Canvas; forces expanded) — `BaseCard`/`Canvas`/`DocCard`
- [x] 17 YouTube link cards: inline embed on Play + chrome-hide animation, 16:9 on paste; chromeless link cards (all platforms) — `LinkCard.tsx`, `linkService.ts`, `Canvas` paste
- [x] 18 Zone tag counter-scales in zoom-out; emptied name no longer snaps back to "Untitled Group" — `ZoneCard.tsx`
- [x] 19 Share button recolor (burgundy bg / pink icon, thin border) — `App.tsx`
- [x] 20 Zoom-to-pointer — `Canvas.handleWheel`
- [x] 21 Card position locked while its editor is focused (no drag from padding) — `BaseCard.handleMouseDown`
- [x] 22 DocCard checkbox duplication on font-size fixed (list-aware `applyFontSize`) — `richtext.tsx`
- [x] 23 Paste plain text → TextCard sized to content, Hebrew→RTL — `Canvas` paste
- [x] 24 Text + Sticky toolbars get full Doc-parity rich formatting (bullets/checkbox/etc.) via shared engine; `html?` field additive, old plain-text renders identical — `TextCard`/`StickyCard`/types
- [ ] **Comments/chat drawer** — brainstorm only (user's explicit request); see brainstorm notes below, NOT implemented

### Browser-test checklist (for the user) — 2026-07-02 batch
See the 6 phase groups in the plan file. Key things to verify with the REAL user data:
- Old Text/Sticky notes render **exactly** as before; editing them round-trips; undo works.
- Every card type: single-click selects (no expand), dbl-click opens; marquee never expands.
- Drag shows burgundy snap lines; Cmd disables snapping; dropping into/out of zones still works.
- Copy/paste a group (with a connector) → pasted copy is independent (ungroup/undo clean).
- YouTube paste → 16:9 card; Play → inline video + chrome hides; other link cards unchanged, no white box.
- Locked tab = view-only; tab drag-reorder smooth; duplicate tab independent.
- Empty boards' thumbnails **unchanged**; boards with cards show a real mini-preview.

---

## 🗺️ Active roadmap — 21 fixes/features from the user's notes (6 phases)
Full detail in the approved plan: `~/.claude/plans/we-need-to-set-frolicking-turtle.md`.
**Decisions:** media → Supabase Storage; sharing → read-only link; priority big-features → calendar events, media-on-board, comments+cards (dashboard later).

### ✅ Phase 0 — Critical bugs & quick wins  (DONE, compile+lint verified; awaiting user browser test)
- [x] 0.1 **CRITICAL** new-whiteboard duplication + delete-wipe — `handleNavigate` now takes the fresh node (no stale `nodes` read) + deep-copy on load ([App.tsx](App.tsx))
- [x] 0.2 onboarding re-asks every login — `updateUserProfile` returns success; OnboardingFlow only completes on confirmed write ([services/supabase.ts](services/supabase.ts), [components/auth/OnboardingFlow.tsx](components/auth/OnboardingFlow.tsx), [hooks/useAuth.ts](hooks/useAuth.ts)). (DB rows were already correct → was a silent-write-failure risk.)
- [x] 0.3 feed-linked PostCard collapsed black square (video) → real frame/thumbnail + symmetric padding ([components/cards/PostCard.tsx](components/cards/PostCard.tsx))
- [x] 0.4 multi-select no longer changes collapse state — `collapsed = (!isSelected || isMultiSelect) && !alwaysExpanded` in PostCard/StoryCard/ReelsCard
- [x] 0.5 docs marker dropdown transparency → solid swatches (highlight stays translucent) ([components/cards/DocCard.tsx](components/cards/DocCard.tsx))
- [x] 0.6 sticky notes RTL — `dir="auto"` ([components/cards/StickyCard.tsx](components/cards/StickyCard.tsx))
- [x] 0.7 new card from menu opens EXPANDED — `addCard` returns id; App→Canvas one-shot `selectCardId` auto-selects it ([hooks/useWorkspaces.ts](hooks/useWorkspaces.ts), [App.tsx](App.tsx), [components/Canvas.tsx](components/Canvas.tsx))

### 🔄 Phase 1 — Media + Supabase Storage  [priority]  (1.1–1.3 DONE, awaiting browser test)
- [x] 1.1 Supabase Storage migration — public `media` bucket (100MB) + RLS created (user-approved); `uploadMedia`/`deleteMediaByUrl` in [services/supabase.ts](services/supabase.ts); `persistMedia` (Storage + base64 fallback) + `isWithinMediaLimit` in [services/fileService.ts](services/fileService.ts); 8 upload sites migrated (Canvas paste, PostCard, ReelsCard, StoryCard, ReferenceCard, NewsletterCard, AdsTestCard, FilmstripCard). OnboardingFlow logo left on base64 (tiny). Legacy base64 still renders.
- [x] 1.2 video on board — `ImageCard` renders video with poster + inline Play overlay (no modal); paste video → video card ([components/cards/ImageCard.tsx](components/cards/ImageCard.tsx), `mediaType` on `ImageCardContent`)
- [x] 1.3 drag images/videos from computer onto board — Canvas `onDragOver`/`onDrop` + drop overlay ([components/Canvas.tsx](components/Canvas.tsx))
- [x] 1.5 **media performance & optimistic UX** (user feedback: 30–60s freeze on upload, video stalls): instant local preview via `beginMediaUpload` (objectURL) + background upload + swap; client-side image compression (`compressImage` in [services/fileService.ts](services/fileService.ts)); `InlineVideo` stable src (no reload-on-play) + buffering spinner; `stripBlobUrls` guards the save path ([hooks/useFileSystem.ts](hooks/useFileSystem.ts)); "Uploading…" indicator. Optimistic on board paste/drop, PostCard slots, Reels cover, Story frames. (Ads/Filmstrip/Newsletter still block but get compression.)
- [x] 1.6 **buttery drag + uniform selection** (user feedback: dragging flickered/"resisted", esp. video; selection inconsistent): transform-based drag (composited `translate3d`, no per-move history/reconcile/nodes-mirror/save/reflow) committed once on drop with zone-membership folded in ([components/cards/BaseCard.tsx](components/cards/BaseCard.tsx), [components/Canvas.tsx](components/Canvas.tsx)); unified selection "lift" + yellow hover ring across all variants (image/video/text/sticky now match PostCard); ZONE/STROKE keep their own treatment (no extra box). Group bounds hidden during drag.
- [x] 1.4 paste image into reference/final-asset slot by pointer proximity — note 3: Canvas paste hit-tests `document.elementFromPoint(cursor)` for `[data-paste-zone]`; if over a PostCard References/Final Assets area it dispatches `sosa:paste-media` to that zone → PostCard adds via `handleMediaUpload` (optimistic, like a manual upload). Over empty canvas → ImageCard as before. ([components/Canvas.tsx](components/Canvas.tsx), [components/cards/PostCard.tsx](components/cards/PostCard.tsx))
- [ ] 1.5 follow-up (optional): make Ads/Filmstrip/Newsletter uploads optimistic too
- [x] 1.6a video card draggable (Play button was full-card `no-drag`; now `<video>` is click-through until play + small centered Play button) ([components/cards/ImageCard.tsx](components/cards/ImageCard.tsx))
- [x] 1.6b video drag-after-pause (real `isPlaying` state via onPlay/onPause/onEnded → draggable whenever not actively playing) + media bounding box/proportional resize (minimal container now `flex flex-col` so media is exactly card-sized; box + `lockAspectRatio` handles line up) ([components/cards/ImageCard.tsx](components/cards/ImageCard.tsx), [components/cards/BaseCard.tsx](components/cards/BaseCard.tsx))
- [ ] 1.6 follow-up (only if big boards still jank): wrap card components in `React.memo` (safe comparator ignoring fn props) so non-moving cards skip re-render during drag

### 🔄 Phase 2 — Comments unification + card improvements  [priority]
- [ ] 2.1 one shared CommentPanel for ALL cards — note 8
- [x] 2.2 DocCard checkbox list — note 15: third list button (ListChecks) → `ul.doc-checklist`; CSS checkbox (burgundy border, fills brand-green + white check + strikethrough when checked); click checkbox zone toggles `data-checked` (RTL-aware); state persists in body HTML ([components/cards/DocCard.tsx](components/cards/DocCard.tsx))
- [ ] 2.3 text tool Miro-like (drag + toolbar + fill shapes) — note 12-text

### 🔄 Phase 3 — Calendar events ("marketing gantt")  [priority]  (DONE, awaiting browser test)
- [x] 3.1 data + persistence: `CalendarEvent` type ([types.ts](types.ts)); `loadCalendarEvents`/`saveCalendarEvents` (sosa_data key `calendar_events`) ([services/supabase.ts](services/supabase.ts)); `useCalendarEvents` hook (same safety as useFileSystem) ([hooks/useCalendarEvents.ts](hooks/useCalendarEvents.ts)); wired in [App.tsx](App.tsx) → CalendarView
- [x] 3.2 `EventModal` (title, category pills, start + multi-day end, notes, owner, important, color override; create/edit/delete) ([components/modals/EventModal.tsx](components/modals/EventModal.tsx)) + "Add event" button + Events toggle + day-cell hover "+"
- [x] 3.3 rendering: distinct event band above card pills in month/week/quarter; multi-day connected gantt segments (rounded start/end, title once, ▸ continuation); full event list in Day view ([components/CalendarView.tsx](components/CalendarView.tsx))
- [x] 3.4 drag event to another day → reschedule (single moves; multi-day shifts whole range preserving duration)
- [x] 3.5 polish: **type-specific fields** (config-driven `CATEGORY_EXTRAS` → meta: timeRange/location/url/channels/budget/offer/promoCode/goal/deliverable per category; surfaced as time-hint on bars + meta in Day view) ([components/modals/EventModal.tsx](components/modals/EventModal.tsx), [components/CalendarView.tsx](components/CalendarView.tsx)); **top-bar restructure** (View · Nav+Today · Filter▾ popover/Events/Unscheduled/Add); **Add event CTA** = burgundy bg + yellow text
- [ ] 3.x optional follow-ups: category legend; absolute spanning bars w/ stacking lanes; reminders; recurring

### ⏭️ Phase 4 — Canvas UX polish
- [ ] 4.1 copy/paste card (Ctrl+C/V + right-click) → nearest free spot — note 16
- [ ] 4.2 magnetic snap/align guides while dragging — note 2
- [x] 4.3 recent-tools quick row in empty-canvas right-click menu — note 19: `components/toolVisuals.tsx` (shared icon+brand-color map + DEFAULT_RECENT_TOOLS); App tracks `recentTools` (localStorage) via `recordToolUsed` in handleAddCard; Canvas `addCardAtPoint` adds the card at the cursor + selects it; quick row of 4 colored tool buttons atop the empty-area menu ([components/Canvas.tsx](components/Canvas.tsx), [App.tsx](App.tsx))
- [ ] 4.4 live board thumbnail on home (keep default for empty boards) — note 18
- [ ] 4.5 sidebar collapse-to-icons + confirm rename/drag-nest — note 12

### ⏭️ Phase 5 — Account-aware dashboard + sharing (heaviest, last)
- [ ] 5.1 dashboard individual vs team — note 1
- [ ] 5.2 read-only public share link (routing + share_links table + RLS) ⚠️ schema → user OK — note 11

---

## ⏭️ Immediate Next Steps
1. [ ] **User browser-tests the new Feed page** (Sidebar → Feed) — checklist in `PROGRESS.md` stage 29.
2. [x] **Bounding box letterbox — RESOLVED (stage 32):** ImageCard now uses `object-cover` + aspect-snap so the box always equals the media; frame/handles/connector dots are exact for all card types.
3. [ ] Social **Phase C** (real auto-publish) when the user registers API keys — blueprint in memory `social_engine.md` + plan file.
4. [ ] **User browser-tests Phase 1.1–1.3** + Phase 0 (older, below).

### Phase 1 browser-test checklist (for the user)
- Drag/paste a large video onto the board → the card appears **instantly** with a preview (no 30–60s freeze); it shows "Uploading…" briefly, then silently switches to the Storage URL; reload → loads from `…supabase.co/storage/…`.
- Click a video → plays **inline** smoothly (no reload stall, no popup); brief buffering spinner if needed.
- Add a large photo to a Post slot → near-instant (compressed) and optimistic.
- Reload mid-upload is the only edge case where an in-flight asset may not persist (rare).

### Phase 0 browser-test checklist (for the user)
- Create board A + cards → create board B → **B is empty** (not a copy of A); edit B → A unchanged; delete all of B's cards → B stays an empty board, A intact; reload → both persist.
- Sign out/in → **no** individual/team prompt.
- Link a post (with a video first-asset) to a feed planner → collapsed card shows a real thumbnail (no black square); top/bottom padding even.
- Marquee-select several cards → none of them expand; single-click one → it expands.
- DocCard highlight menu → swatches look solid/opaque.
- Sticky note in Hebrew → RTL; in English → LTR.
- Add a card from the drawer → it appears **expanded**; click empty canvas → it collapses.

---

### Phase 3 browser-test checklist (for the user)
- Click **Add event** → create a single-day "Launch"; create a multi-day "Campaign" (toggle Multi-day, set end) → both appear; multi-day reads as a connected bar across days.
- Hover a day cell → "+" → quick-add on that date.
- Drag a single event to another day (moves); drag a multi-day event (whole range shifts, keeps length).
- Click an event → edit (change category/color/range/owner/important) or delete.
- Events show on every board's calendar; folder/status filters don't hide them; toggle **Events** off/on.
- Reload → events persist (separate `calendar_events` row).

## 🕰️ Older (pre-roadmap) — awaiting user browser test
- [ ] Stages 16+17 (Story/Reels cards, Unscheduled-for-all, focused whiteboard open) — compile-verified earlier; live behavior still unconfirmed by user.

_(Full backlog: memory `roadmap_backlog.md`.)_
