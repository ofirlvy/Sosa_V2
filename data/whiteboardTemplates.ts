import { Workspace, CardType, TaskList } from '../types';

export const DEFAULT_WHITEBOARD_DATA: Workspace[] = [
  { id: 'tab-1', name: 'Main Board', color: '#3A5C34', cards: [] }
];

export const TAB_COLORS = [
  '#3A5C34', '#FFD753', '#FCCAE2', '#5F2427', '#007AFF', '#FF9500', '#8E8E93'
];

/**
 * Builds the initial workspace data for a given template id.
 * Returns a fresh copy of DEFAULT_WHITEBOARD_DATA when no template matches.
 * `generateId` is injected so card ids stay consistent with the caller's scheme.
 */
export function buildTemplate(templateId: string | null, generateId: () => string): Workspace[] {
  if (templateId === 'monthly-plan') {
    const post1Id = generateId();
    const post2Id = generateId();
    const post3Id = generateId();
    return [{
      id: 'tab-1', name: 'Monthly Plan', color: '#3A5C34',
      cards: [
        // --- AREA 1: ESTABLISHED MOOD & VISUAL BRANDING ---
        { id: generateId(), type: CardType.ZONE, x: 100, y: 150, width: 420, height: 780, zIndex: 1, content: { title: "1. Brand Mood & Visual Vibe", color: "#FCCAE2" } },
        { id: generateId(), type: CardType.TEXT, x: 110, y: 70, width: 400, height: 60, zIndex: 2, content: { text: "1. ESTABLISHED MOOD & AESTHETIC", fontSize: 18, fontFamily: "Playfair Display", isBold: true, color: "#5F2427" } },
        { id: generateId(), type: CardType.STICKY, x: 130, y: 195, width: 170, height: 170, zIndex: 3, content: { text: "AESTHETIC & COLORS:\n- Retro warmth\n- Cinematic shadows\n- Film Grain", color: "#FCCAE2" } },
        { id: generateId(), type: CardType.STICKY, x: 310, y: 195, width: 170, height: 170, zIndex: 3, content: { text: "TONE & VOICE:\n- Elegant\n- Minimalist\n- Effortless beauty", color: "#FFD753" } },
        { id: generateId(), type: CardType.REFERENCE, x: 130, y: 390, width: 350, height: 490, zIndex: 3, content: { title: "Untitled Reference", mediaUrl: "", mediaType: "image" } },

        // --- AREA 2: STRATEGY & NARRATIVE STORYTELLING ---
        { id: generateId(), type: CardType.ZONE, x: 560, y: 150, width: 420, height: 780, zIndex: 1, content: { title: "2. Strategy & Monthly Themes", color: "#FFD753" } },
        { id: generateId(), type: CardType.TEXT, x: 570, y: 70, width: 400, height: 60, zIndex: 2, content: { text: "2. STRATEGY, NARRATIVE & STORY", fontSize: 18, fontFamily: "Playfair Display", isBold: true, color: "#5F2427" } },
        { id: generateId(), type: CardType.STRATEGY_AI, x: 590, y: 195, width: 360, height: 320, zIndex: 3, content: { title: "Untitled AI Strategy", prompt: "", result: "", status: "idle" } },
        { id: generateId(), type: CardType.DOC, x: 590, y: 535, width: 360, height: 350, zIndex: 3, content: { title: "Untitled Outline Draft", body: "" } },

        // --- AREA 3: PRODUCTION PIPELINE QUEUE ---
        { id: generateId(), type: CardType.ZONE, x: 1020, y: 150, width: 420, height: 780, zIndex: 1, content: { title: "3. Content Production Queue", color: "#3A5C34" } },
        { id: generateId(), type: CardType.TEXT, x: 1030, y: 70, width: 400, height: 60, zIndex: 2, content: { text: "3. PRODUCTION PIPELINE & QUEUE", fontSize: 18, fontFamily: "Playfair Display", isBold: true, color: "#5F2427" } },
        { id: post1Id, type: CardType.POST, x: 1060, y: 195, width: 340, height: 210, zIndex: 3, content: { sku: "POST-001 (Aesthetic)", title: "Untitled Post - Focus 1", status: "Idea", caption: "", references: [], finalAssets: [], taskLists: [] } },
        { id: post2Id, type: CardType.POST, x: 1060, y: 425, width: 340, height: 210, zIndex: 3, content: { sku: "POST-002 (Product)", title: "Untitled Post - Focus 2", status: "Idea", caption: "", references: [], finalAssets: [], taskLists: [] } },
        { id: post3Id, type: CardType.POST, x: 1060, y: 655, width: 340, height: 210, zIndex: 3, content: { sku: "POST-003 (Community)", title: "Untitled Post - Focus 3", status: "Idea", caption: "", references: [], finalAssets: [], taskLists: [] } },

        // --- AREA 4: INSTAGRAM FEED PLANNING & OPTIMIZATION ---
        { id: generateId(), type: CardType.ZONE, x: 1480, y: 150, width: 420, height: 780, zIndex: 1, content: { title: "4. Feed Planning & Optimization", color: "#5F2427" } },
        { id: generateId(), type: CardType.TEXT, x: 1490, y: 70, width: 400, height: 60, zIndex: 2, content: { text: "4. INSTAGRAM FEED CURATION", fontSize: 18, fontFamily: "Playfair Display", isBold: true, color: "#5F2427" } },
        { id: generateId(), type: CardType.GRID_PLANNER, x: 1520, y: 195, width: 340, height: 680, zIndex: 3, content: { title: "Untitled Grid Planner", config: { month: new Date().getMonth(), year: new Date().getFullYear(), logicType: 'count', value: 9 }, connections: { 0: post1Id, 1: post2Id, 2: post3Id } } }
      ]
    }];
  } else if (templateId === 'product-launch') {
    const teaserId = generateId();
    const revealId = generateId();
    const launchId = generateId();
    const socialProofId = generateId();
    const ctaId = generateId();
    return [{
      id: 'tab-1', name: 'Launch Campaign', color: '#FFD753',
      cards: [
        { id: teaserId, type: CardType.POST, x: 100, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Teaser', status: 'Scheduled', caption: 'Something big is coming...' } },
        { id: revealId, type: CardType.POST, x: 450, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Reveal', status: 'Scheduled', caption: 'Meet our new product!' } },
        { id: launchId, type: CardType.POST, x: 800, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Launch', status: 'Idea', caption: 'Available now.' } },
        { id: socialProofId, type: CardType.POST, x: 1150, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Social Proof', status: 'Idea', caption: 'See what others are saying.' } },
        { id: ctaId, type: CardType.POST, x: 1500, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'CTA', status: 'Idea', caption: 'Shop now.' } },
        { id: generateId(), type: CardType.GRID_PLANNER, x: 1900, y: 100, width: 400, height: 600, zIndex: 1, content: { title: 'Feed Planner', config: { month: new Date().getMonth(), year: new Date().getFullYear(), logicType: 'count', value: 5 }, connections: { 0: teaserId, 1: revealId, 2: launchId, 3: socialProofId, 4: ctaId } } }
      ]
    }];
  } else if (templateId === 'weekly-routine') {
    const monId = generateId();
    const wedId = generateId();
    const friId = generateId();
    const sunId = generateId();
    return [{
      id: 'tab-1', name: 'Weekly Routine', color: '#FCCAE2',
      cards: [
        { id: generateId(), type: CardType.STICKY, x: 100, y: 100, width: 200, height: 200, zIndex: 1, content: { text: 'Monday', color: '#FFD753' } },
        { id: monId, type: CardType.POST, x: 100, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Monday Post', status: 'Ready' } },
        { id: generateId(), type: CardType.STICKY, x: 450, y: 100, width: 200, height: 200, zIndex: 1, content: { text: 'Wednesday', color: '#FFD753' } },
        { id: wedId, type: CardType.POST, x: 450, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Wednesday Post', status: 'Ready' } },
        { id: generateId(), type: CardType.STICKY, x: 800, y: 100, width: 200, height: 200, zIndex: 1, content: { text: 'Friday', color: '#FFD753' } },
        { id: friId, type: CardType.POST, x: 800, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Friday Post', status: 'In Production' } },
        { id: generateId(), type: CardType.STICKY, x: 1150, y: 100, width: 200, height: 200, zIndex: 1, content: { text: 'Sunday', color: '#FFD753' } },
        { id: sunId, type: CardType.POST, x: 1150, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Sunday Post', status: 'Idea' } },
        { id: generateId(), type: CardType.GRID_PLANNER, x: 1550, y: 100, width: 400, height: 600, zIndex: 1, content: { title: 'Feed Planner', config: { month: new Date().getMonth(), year: new Date().getFullYear(), logicType: 'count', value: 4 }, connections: { 0: monId, 1: wedId, 2: friId, 3: sunId } } }
      ]
    }];
  } else if (templateId === 'brand-moodboard') {
    return [{
      id: 'tab-1', name: 'Brand Moodboard', color: '#5F2427',
      cards: [
        { id: generateId(), type: CardType.STICKY, x: -150, y: 100, width: 200, height: 200, zIndex: 1, content: { text: 'Color Palette', color: '#FCCAE2' } },
        { id: generateId(), type: CardType.STICKY, x: -150, y: 350, width: 200, height: 200, zIndex: 1, content: { text: 'Visual Direction', color: '#FCCAE2' } },
        { id: generateId(), type: CardType.STICKY, x: -150, y: 600, width: 200, height: 200, zIndex: 1, content: { text: 'Content Pillars', color: '#FCCAE2' } },
        { id: generateId(), type: CardType.POST, x: 100, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Post 1', status: 'Idea' } },
        { id: generateId(), type: CardType.POST, x: 450, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Post 2', status: 'Idea' } },
        { id: generateId(), type: CardType.POST, x: 800, y: 100, width: 320, height: 400, zIndex: 1, content: { title: 'Post 3', status: 'Idea' } },
        { id: generateId(), type: CardType.POST, x: 100, y: 550, width: 320, height: 400, zIndex: 1, content: { title: 'Post 4', status: 'Idea' } },
        { id: generateId(), type: CardType.POST, x: 450, y: 550, width: 320, height: 400, zIndex: 1, content: { title: 'Post 5', status: 'Idea' } },
        { id: generateId(), type: CardType.POST, x: 800, y: 550, width: 320, height: 400, zIndex: 1, content: { title: 'Post 6', status: 'Idea' } },
        { id: generateId(), type: CardType.GRID_PLANNER, x: 1150, y: 550, width: 400, height: 600, zIndex: 1, content: { title: 'Feed Planner', config: { month: new Date().getMonth(), year: new Date().getFullYear(), logicType: 'count', value: 6 }, connections: {} } }
      ]
    }];
  } else if (templateId === 'shooting-prep') {
    const buildShotTasks = (): TaskList[] => [{ id: generateId(), title: 'Production List', color: 'yellow', items: [{ id: generateId(), text: 'Location:', done: false }, { id: generateId(), text: 'Props needed:', done: false }, { id: generateId(), text: 'Talent/Model:', done: false }, { id: generateId(), text: 'Lighting setup:', done: false }, { id: generateId(), text: 'Shot description:', done: false }] }];
    return [{
      id: 'tab-1', name: 'Shooting Prep', color: '#FF9500',
      cards: [
        { id: generateId(), type: CardType.STICKY, x: 100, y: 100, width: 300, height: 150, zIndex: 1, content: { text: 'Shooting Day — [Date]', color: '#FFD753' } },
        { id: generateId(), type: CardType.POST, x: 100, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Shot 1', status: 'Idea', taskLists: buildShotTasks() } },
        { id: generateId(), type: CardType.POST, x: 450, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Shot 2', status: 'Idea', taskLists: buildShotTasks() } },
        { id: generateId(), type: CardType.POST, x: 800, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Shot 3', status: 'Idea', taskLists: buildShotTasks() } },
        { id: generateId(), type: CardType.POST, x: 1150, y: 350, width: 320, height: 400, zIndex: 1, content: { title: 'Shot 4', status: 'Idea', taskLists: buildShotTasks() } }
      ]
    }];
  }

  return JSON.parse(JSON.stringify(DEFAULT_WHITEBOARD_DATA));
}
