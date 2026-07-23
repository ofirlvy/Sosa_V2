# Sosa Design Constitution & Style Guide

## 1. Brand Philosophy: "Warm Luxury Utility"
Sosa is not a standard SaaS tool. It rejects the cold "System Gray" aesthetic of generic software.
*   **Vibe:** It feels like a physical workspace made of paper, stone, and glass.
*   **Keywords:** Tactile, Spatial, Warm, Bouncy, Unified.
*   **The "Pod" Rule:** Controls are not scattered buttons; they are grouped into floating white "Pods" (Pills) with internal dividers and subtle borders.

---

## 2. The Color Palette

### Base Surfaces
*   **Canvas (Warm Stone):** `#F9F8F6` (Use this instead of white/gray for backgrounds).
*   **Sidebar (Glassy Peach):** `bg-[#F9E6D1]/30` with `backdrop-blur-xl`.
*   **Cards (Pure White):** `#FFFFFF` with specific shadow stacks.

### Brand Colors
*   **Sosa Burgundy (Primary UI):** `#5F2427` 
    *   *Usage:* Headers, Active Tab Backgrounds (5% opacity), Borders (10% opacity), Primary Icons.
*   **Forest Green (Success/Action):** `#3A5C34`
    *   *Usage:* Primary Buttons, Selection Borders, Positive Data.
*   **Vibrant Yellow (Accent/Selection):** `#FFD753`
    *   *Usage:* Drag handles, Hover rings, Highlights, "Slash" separators.
*   **Soft Pink (Secondary):** `#FCCAE2`
    *   *Usage:* Secondary buttons, Panic/Exit buttons, decorative backgrounds.

### Text Hierarchy
*   **Headings:** `#5F2427` (Burgundy) - *Never use pure black for headers.*
*   **Body:** `#1C1C1E` (Soft Black) - For reading text.
*   **Meta/Labels:** `#8E8E93` (Gray) - Timestamps, small labels.

---

## 3. Component Architecture

### The "Control Bar" (Pod) Pattern
Used for the Header (Top Right) and Tab Navigation (Bottom Left).
*   **Container:** `h-10 bg-white rounded-xl shadow-sm border border-[#5F2427]/10`.
*   **Dividers:** Vertical separators between buttons: `border-r border-[#5F2427]/5`.
*   **Buttons inside Pods:** 
    *   Hover: `hover:bg-[#5F2427]/5`.
    *   Icon Size: `size={16}` or `size={18}` with `strokeWidth={2.5}`.

### Cards (The Atoms of Sosa)
*   **Shape:** `rounded-[24px]` (Super-ellipse feel).
*   **Border:** None by default. `ring-1 ring-black/5` for definition.
*   **Shadow:** `shadow-sm` (Resting) -> `shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)]` (Hover).
*   **Selected State:** `ring-2 ring-[#3A5C34]` + Resize handles in `#FFD753`.

### Buttons
*   **Primary (Forest):** `bg-[#3A5C34] text-white rounded-full shadow-sm hover:bg-[#2d4a29]`.
*   **Secondary (Burgundy/Pink):** `bg-[#5F2427] text-[#FCCAE2] rounded-xl hover:bg-[#4a1c1e]`.
*   **Ghost/Icon:** `bg-[#F2F2F7] text-gray-600 hover:bg-gray-200`.

---

## 4. Interaction Physics & Animation

### The "Press" Effect
Almost every interactive element (buttons, cards) must react to being clicked.
*   **Class:** `active:scale-95 transition-all duration-200`.

### The "Lift" Effect
Elements hovering over the canvas lift up.
*   **Class:** `hover:-translate-y-0.5` or `hover:scale-105`.

### Transitions
*   **Standard:** `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` (Apple-style spring).

---

## 5. Typography Rules (Inter / System)

*   **H1 (Page Titles):** `text-[32px] font-bold tracking-tight text-[#5F2427]`.
*   **H2 (Card Titles):** `text-[13px] font-semibold text-gray-500 tracking-tight`.
*   **Micro-Labels:** `text-[11px] font-bold uppercase tracking-wider`.
*   **Inputs:** Invisible until clicked. `bg-transparent border-none focus:ring-0`.

---

## 6. Implementation Checklist (The "Don'ts")

1.  **NO** System Gray backgrounds (`bg-gray-100`) for the main canvas. Always use **Warm Stone** (`#F9F8F6`).
2.  **NO** sharp corners. Minimum `rounded-xl`, usually `rounded-2xl` or `rounded-[24px]`.
3.  **NO** default blue focus rings. Use `focus:ring-[#3A5C34]/20`.
4.  **NO** pure black text for Headers. Use **Burgundy** (`#5F2427`).
5.  **NO** floating isolated buttons for main navigation. Group them into **Pods** (White pills with borders).

---

## 7. Dynamic Logic (Tabs)
When coloring tabs/elements based on user selection:
*   **Background:** 10% opacity of selected color (`#RRGGBB1A`).
*   **Text:** If color is light (Yellow/Pink), darken the text programmatically for contrast.
*   **Hover:** 5% opacity of selected color (`#RRGGBB0D`).
