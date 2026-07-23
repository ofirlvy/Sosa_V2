
export enum CardType {
  POST = 'POST',
  STRATEGY_AI = 'STRATEGY_AI',
  ANALYTICS = 'ANALYTICS',
  PERSONA = 'PERSONA',
  GRID_PLANNER = 'GRID_PLANNER',
  PINTEREST = 'PINTEREST',
  LINK = 'LINK',
  IMAGE = 'IMAGE',
  // New Creative Types
  TEXT = 'TEXT',
  STICKY = 'STICKY',
  STROKE = 'STROKE',
  // New Functional Types
  GANTT = 'GANTT',
  ADS_TEST = 'ADS_TEST',
  NEWSLETTER = 'NEWSLETTER', // New Type
  REFERENCE = 'REFERENCE', // New Type
  ZONE = 'ZONE', // New Type
  DOC = 'DOC', // New Type

  // --- NEW "SUPER-CARDS" ---
  
  // 1. Creative Bridge (Canva)
  BRAND_DOCK = 'BRAND_DOCK',
  DEVICE_FRAME = 'DEVICE_FRAME',
  REMOVE_BG = 'REMOVE_BG',
  PALETTE_EXTRACTOR = 'PALETTE_EXTRACTOR',
  TYPO_STYLER = 'TYPO_STYLER',

  // 2. Strategy Bridge (Miro)
  SMART_CONNECTOR = 'SMART_CONNECTOR',
  APPROVAL_STAMP = 'APPROVAL_STAMP',
  JOURNEY_MAP = 'JOURNEY_MAP',
  SPRINT_TIMER = 'SPRINT_TIMER',
  CURSOR_CHAT = 'CURSOR_CHAT',

  // 3. Knowledge Bridge (Notion)
  DATABASE = 'DATABASE',
  DOC_BLOCK = 'DOC_BLOCK',
  EMBED = 'EMBED',
  PDF_ANNOTATOR = 'PDF_ANNOTATOR',
  CHECKLIST = 'CHECKLIST',

  // 4. Growth Bridge (Hootsuite)
  OMNI_PREVIEW = 'OMNI_PREVIEW',
  HASHTAG_GEN = 'HASHTAG_GEN',
  FEED_SIM = 'FEED_SIM',
  COMPETITOR_WATCH = 'COMPETITOR_WATCH',
  TREND_WATCHER = 'TREND_WATCHER',

  // 5. Production Bridge (New)
  FILMSTRIP = 'FILMSTRIP',
  AV_SCRIPT = 'AV_SCRIPT',
  CALL_SHEET = 'CALL_SHEET',
  CASTING_BOARD = 'CASTING_BOARD',
  PROP_TABLE = 'PROP_TABLE',
  STORY = 'STORY',
  REELS = 'REELS'
}

export type ToolType = 'SELECT' | 'PAN' | 'TEXT' | 'STICKY' | 'PEN' | 'HIGHLIGHTER' | 'ERASER' | 'LASSO' | 'REFERENCE' | 'DOC';

export interface Position {
  x: number;
  y: number;
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskList {
  id: string;
  title: string;
  color: 'yellow' | 'blue' | 'red' | 'green' | 'gray';
  items: TaskItem[];
}

export interface MediaItem {
  id: string;
  type: 'image' | 'link' | 'video' | 'empty';
  url?: string;
  thumbnail?: string;
  sourceLink?: string;
  uploading?: boolean; // transient: true while a background Storage upload is in flight
  /** Persisted marker: the upload never finished (tab closed mid-upload), so the
   *  URL is empty on purpose. Renders an explicit "re-upload" state, not a blank. */
  uploadPending?: boolean;
}

export interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  timestamp: string;
  /** Resolved comments are excluded from card badge counts. undefined = open. */
  resolved?: boolean;
}

// --- Social publishing (scheduling engine) ---
export type PublishPlatform = 'instagram' | 'facebook' | 'tiktok' | 'pinterest';

/**
 * One scheduled publish of a card to one platform. Phase B: semi-auto — at `at`
 * the app fires a reminder + Publish Kit; Phase C upgrades connected platforms
 * to true auto-publish (server cron). Additive: lives in content.publishTargets.
 */
export interface PublishTarget {
  id: string;
  platform: PublishPlatform;
  at: string; // ISO datetime
  status: 'scheduled' | 'needs_action' | 'published' | 'canceled';
  /** Per-platform caption override (defaults to the card's caption). */
  caption?: string;
  publishedAt?: string;
}

/** A message in the board-level chat drawer (stored on the whiteboard node). */
export interface BoardChatMessage {
  id: string;
  text: string;
  createdAt: string; // ISO
  user?: string;
  avatar?: string;
  /** Optional card/group reference — clicking it jumps the board to the card. */
  cardId?: string;
  resolved?: boolean;
  /** Member ids tagged with @ in this message. */
  mentions?: string[];
}

// --- Content Interfaces ---

export type PostStatus = 'Idea' | 'In Production' | 'Ready' | 'Scheduled' | 'Published' | 'Needs Review';

export interface PostCardContent {
  sku?: string;
  title?: string;
  date?: string;
  status?: PostStatus;
  caption?: string;
  references?: MediaItem[];
  finalAssets?: MediaItem[];
  taskLists?: TaskList[];
  comments?: Comment[];
  assignees?: string[];
  driveFolderId?: string;
  driveFolderUrl?: string;
  lastSynced?: string;
  /** Scheduled publishes to social platforms (see PublishTarget). */
  publishTargets?: PublishTarget[];
}

export interface StoryCardContent {
  title?: string;
  date?: string;
  status?: PostStatus;
  frames: MediaItem[]; // ordered story frames planned for that day
  comments?: Comment[];
  assignees?: string[]; // member ids (see BrandMember)
}

export interface ReelsCardContent {
  title?: string;
  date?: string;
  status?: PostStatus;
  platform?: 'instagram' | 'tiktok';
  cover?: MediaItem; // vertical 9:16 cover image or video
  caption?: string;
  hook?: string; // first-3-seconds idea
  soundName?: string;
  comments?: Comment[];
  /** Scheduled publishes to social platforms (see PublishTarget). */
  publishTargets?: PublishTarget[];
  assignees?: string[]; // member ids (see BrandMember)
}

export interface NewsletterCardContent {
  title: string;
  subject: string;
  previewText: string;
  designUrl?: string;
  segment: string;
  exclusion: string;
  sendTime: string;
  status: 'draft' | 'scheduled' | 'sent';
  senderName?: string;
  comments?: Comment[];
  assignees?: string[]; // member ids (see BrandMember)
}

export interface GridConfig {
  month: number;
  year: number;
  logicType: 'frequency' | 'count';
  value: number;
}

export interface GridPlannerContent {
  title?: string;
  config: GridConfig;
  connections: { [slotIndex: number]: string };
  // Explicit ISO-date override per slot index. Lets a slot sit on an arbitrary
  // date (e.g. when rescheduled from the calendar), and allows extra slots
  // beyond the config-generated set.
  slotDates?: { [slotIndex: number]: string };
}

// --- Account-level Feed Planner (cross-board, per brand-folder + channel) ---
// The cadence for the "ghost slots" on the Feed page (how many posts/period).
// Month/year come from the view's month navigation, not stored here.
export interface FeedCadence {
  // 'perWeek' → value = posts per week; 'everyNDays' → value = a slot every N days.
  mode: 'perWeek' | 'everyNDays';
  value: number;
}

// A saved monthly plan for one (channel, month): which post sits on which day,
// plus that plan's own cadence. The LIVE schedule (post.content.date) is
// "draft zero"; a draft is an overlay you can edit/preview WITHOUT touching the
// posts, then "Set as final" commits its dates to the real posts. `dates` keys
// are postIds; a missing key = unscheduled in that draft. Stored on the brand.
export interface FeedDraft {
  id: string;
  name: string;
  channel: string;                     // 'instagram' | 'tiktok'
  monthKey: string;                    // "YYYY-MM" (LOCAL, feedMonthKey)
  cadence: FeedCadence;                // the draft's own ghost-slot cadence
  dates: { [postId: string]: string }; // postId → ISO date (scheduled in this draft)
  createdAt: string;
  updatedAt?: string;
}

export interface PinItem {
  id: string;
  imageUrl: string;
  link: string;
  description: string;
}

export interface PinterestCardContent {
  isConnected: boolean;
  username?: string;
  pins?: PinItem[];
}

export interface LinkCardContent {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  images?: string[]; // For collages (Pinterest)
  siteName?: string;
  favicon?: string;
  platform?: 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'linkedin' | 'pinterest' | 'generic';
  // Social specific
  author?: string;
  likes?: number;
  commentsCount?: number;
  loading?: boolean;
  isVideo?: boolean; // reel / video → show a Play overlay (opens on the platform)
}

export interface ImageCardContent {
  url: string;
  /** Poster frame for video (Storage URL) — lets thumbnails paint instantly. */
  thumbnail?: string;
  alt?: string;
  mimeType?: string;
  mediaType?: 'image' | 'video';
  naturalWidth?: number;
  naturalHeight?: number;
  loading?: boolean;
  uploading?: boolean; // transient: background Storage upload in flight
  /** Persisted marker: the upload never finished (tab closed mid-upload). */
  uploadPending?: boolean;
  maxFitDim?: number;  // cap for auto-fit longest side (smaller for multi-drop tiling; default 800)
}

// New Creative Content Types

export type TextShape = 'none' | 'rectangle' | 'rounded' | 'pill' | 'diamond' | 'parallelogram';

export interface TextCardContent {
  text: string;
  /** Rich HTML body (canonical once edited). Falls back to `text` for old cards. */
  html?: string;
  fontSize: number;
  fontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  color: string;
  highlightColor?: string; // Box/Shape Background Color
  textHighlightColor?: string; // Text Highlighter Color
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  shape?: TextShape;
  opacity?: number;
}

export interface StickyCardContent {
  text: string;
  /** Rich HTML body (canonical once edited). Falls back to `text` for old cards. */
  html?: string;
  color: string; // Background color
  textColor?: string; // Text color
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  shape?: 'square' | 'wide' | 'tall';
}

export interface StrokePoint {
  x: number;
  y: number;
  p?: number; // Pressure
}

export interface StrokeCardContent {
  points: StrokePoint[];
  color: string;
  width: number;
  isHighlighter: boolean;
}

// --- New Features Interfaces ---

export type GanttViewMode = 'month' | 'quarter' | 'year';

export interface GanttTrack {
  id: string;
  name: string;
  color: string;
}

export interface GanttCardContent {
  title: string;
  viewMode: GanttViewMode;
  startDate: string; // ISO Date
  tracks: GanttTrack[];
}

export interface AdVariation extends MediaItem {
  status: 'active' | 'winner' | 'loser';
  ctr?: number;
  notes?: string;
}

export interface AdRound {
  id: string;
  name: string; // e.g., "Round 1: Hooks"
  variations: AdVariation[];
}

export interface AdsTestCardContent {
  title: string;
  rounds: AdRound[];
}

// --- Production Suite Interfaces ---

export interface FilmstripFrame extends MediaItem {
  note?: string;
  transition?: 'cut' | 'dissolve' | 'fade' | 'whip';
}

export interface FilmstripContent {
  title?: string;
  frames: FilmstripFrame[];
}

export interface ScriptLine {
  id: string;
  visual: string;
  audio: string;
}

export interface AvScriptContent {
  title?: string;
  lines: ScriptLine[];
  estimatedDuration: number;
}

export interface CrewMember {
  id: string;
  role: string;
  name: string;
  avatar: string; // Initials
  status: 'confirmed' | 'pending';
}

export interface CallSheetContent {
  title?: string;
  shootDate: string;
  location: string;
  callTime: string;
  status: 'pre-pro' | 'on-set' | 'wrapped';
  crew: CrewMember[];
}

export interface TalentCandidate {
  id: string;
  name: string;
  handle: string;
  platform: 'ig' | 'tiktok' | 'yt';
  followers: string;
  status: 'scouted' | 'contacted' | 'booked' | 'passed';
  imageUrl?: string;
}

export interface CastingBoardContent {
  title?: string;
  candidates: TalentCandidate[];
}

export interface PropItem {
  id: string;
  name: string;
  status: 'need' | 'have' | 'packed';
  imageUrl?: string;
}

export interface PropTableContent {
  title?: string;
  items: PropItem[];
}

export interface ReferenceCardContent {
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'url';
  title: string;
  whyILoveIt: string;
  whatToTake: string;
  source: string;
  vibeTags: string[];
  expandedSize?: { width: number; height: number };
  comments?: Comment[];
  driveFolderId?: string;
  driveFolderUrl?: string;
  assignees?: string[]; // member ids (see BrandMember)
}

export interface StrategyAiContent {
  title?: string;
  prompt?: string;
  result?: string;
  status?: 'idle' | 'loading' | 'done' | 'error';
}

export interface ZoneCardContent {
  title: string;
  color: string;
  childIds: string[];
}

export interface DocCardContent {
  title: string;
  body: string; // rich HTML
  author?: string;
  date?: string;
  comments?: Comment[];
  assignees?: string[]; // member ids (see BrandMember)
}

export interface CardData {
  id: string;
  type: CardType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isLocked?: boolean;
  alwaysExpanded?: boolean; // pinned "keep expanded" — never auto-collapses
  content: PostCardContent | GridPlannerContent | PinterestCardContent | TextCardContent | StickyCardContent | StrokeCardContent | LinkCardContent | GanttCardContent | AdsTestCardContent | FilmstripContent | AvScriptContent | CallSheetContent | CastingBoardContent | PropTableContent | ImageCardContent | NewsletterCardContent | ReferenceCardContent | ZoneCardContent | DocCardContent | StoryCardContent | ReelsCardContent | StrategyAiContent;
}

// --- Connectors (Miro-style arrows between elements; opt-in) ---
export type ConnectorRouting = 'bezier' | 'straight' | 'orthogonal';
export type ConnectorLineStyle = 'solid' | 'dashed' | 'dotted';

export interface Connector {
  id: string;
  from: string;   // element id (card or zone) — endpoint geometry is derived at render
  to: string;     // element id
  color?: string; // brand palette; defaults applied at render
  width?: number; // stroke px
  lineStyle?: ConnectorLineStyle;
  routing?: ConnectorRouting;
  label?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean; // defaults to true at render
}

export interface Workspace {
  id: string;
  name: string;
  cards: CardData[];
  color?: string;
  connectors?: Connector[];
  /** Locked sheet: read-only (no edits/drag/add). */
  isLocked?: boolean;
}

// --- Calendar Events (brand-wide "marketing gantt" milestones; NOT cards) ---
export type CalendarEventCategory =
  | 'launch' | 'campaign' | 'promotion' | 'holiday' | 'deadline'
  | 'review' | 'shoot' | 'event' | 'milestone' | 'custom';

export interface CalendarEvent {
  id: string;
  title: string;
  category: CalendarEventCategory;
  startDate: string;      // ISO LOCAL (dateUtils.toISODate) — required
  endDate?: string;       // ISO LOCAL — if set and > start ⇒ multi-day range
  color?: string;         // brand-palette override; defaults from category
  description?: string;
  owner?: string;         // responsible person/team (free text)
  important?: boolean;    // pin / "must-see" flag
  meta?: Record<string, any>; // type-specific extra fields (time, location, offer, channels…)
  createdAt?: string;
  /** Which Brand this event belongs to. Missing = the default brand (no migration). */
  spaceId?: string;
}

export interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  scale: number;
  pan: Position;
}

// --- Navigation / File System Types ---

export type NodeType = 'folder' | 'page' | 'whiteboard';

export interface FileSystemNode {
  id: string;
  type: NodeType;
  name: string;
  parentId: string | null;
  description?: string; // New: Description for context
  children?: string[]; // IDs of children
  isExpanded?: boolean;
  isFavorite?: boolean;
  lastEdited?: string;
  icon?: string; // Emoji or custom icon
  order?: number; // Order index for sorting
  
  // Only for Whiteboards
  whiteboardData?: Workspace[]; // The internal tabs/cards
  /** Board-level chat messages (chat drawer). Card-anchored comments stay on the cards. */
  boardChat?: BoardChatMessage[];
  /** Feed page cadence per channel (e.g. instagram → 3/week), stored on the scoped
   *  node — a whiteboard (board scope) or a folder. Rides normal node save; no migration. */
  feedPlanner?: { [channel: string]: FeedCadence };
  /** Which Brand (workspace) this node belongs to. Missing = the default brand,
   *  so all pre-brands data keeps working with zero migration. */
  spaceId?: string;
}

// --- Brands (workspaces) ---
// One primitive that scales from a solo user (one brand, switcher invisible)
// to a multi-client social manager (hard separation per client) to teams
// (Phase 2: shared brands). Each brand owns its tree, calendar+events and feed.
export interface BrandSpace {
  id: string;
  name: string;
  icon?: string;      // emoji fallback
  avatarUrl?: string; // uploaded brand picture (Storage URL) — takes priority over icon
  color?: string;     // brand-palette accent
  createdAt?: string;
  /** Editable social-profile mockups (Feed page → "View feed"), per channel. */
  socialProfiles?: { [channel: string]: MockupProfile };
  /** Feed cadence, remembered independently per channel AND per month
   *  (monthKey "YYYY-MM"). So July can differ from August, and IG from TikTok
   *  in the same month. Auto-saved; supersedes the legacy node.feedPlanner. */
  feedCadence?: { [channel: string]: { [monthKey: string]: FeedCadence } };
  /** Saved monthly plans (multiple per channel+month), each an overlay of
   *  post→date + cadence. The live schedule stays the source of truth until
   *  a draft is "set as final". See FeedDraft. */
  feedDrafts?: FeedDraft[];
  /** People invited to this brand (the OWNER is derived from the account, not
   *  stored here). Card assignees + @mentions reference these ids. Real
   *  cross-user sign-in access is a backend round — see services/brandMembers. */
  members?: BrandMember[];
}

/** Access level within a brand (per-brand, never account-wide). */
export type BrandRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface BrandMember {
  id: string;            // member id (Phase 2: maps to a Supabase user_id)
  name: string;
  email: string;
  avatarUrl?: string;
  role: BrandRole;
  /** 'active' once they can sign in (backend round); 'invited' = pending. */
  status: 'active' | 'invited';
  addedAt?: string;
}

// --- Social profile mockup (Feed page phone preview) ---
// The user fills these in by hand today so the phone mockup looks like their
// real account. The field names deliberately mirror the Instagram Graph API
// (`GET /me?fields=username,name,biography,profile_picture_url`) so a future
// "connect Instagram" in settings can populate the same record instead.
// EVERY field is optional: a blank one falls back to the brand's own identity,
// so an untouched brand renders exactly like it did before this existed.

export interface MockupHighlight {
  id: string;
  title: string;
  coverUrl?: string;
  /** Optional uploaded content — tapping a highlight with frames plays them. */
  frames?: MediaItem[];
}

export interface MockupProfile {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  link?: string;
  highlights?: MockupHighlight[]; // Instagram only
}

// --- User & Auth Types ---

export interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  account_type?: 'individual' | 'team';
  onboarding_complete: boolean;
  tour_completed?: boolean;
}

export interface Brand {
  id: string;
  owner_id: string;
  name: string;
  logo_url?: string;
}
