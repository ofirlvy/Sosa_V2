
# Orbit Design System

## 1. Core Philosophy
*   **iOS-Spatial:** The interface mimics iOS system behaviors (fluidity, bounce, blur) but on an infinite spatial canvas.
*   **Object-Oriented:** Everything is a "Card" or an "Object" with physical presence. Items are not flat 2D divs; they have depth, z-index, and shadow.
*   **Tactile Interactions:** Buttons and cards react physically to clicks (scaling down) and hovers (lifting up).
*   **Clean & Minimal:** Content comes first. UI chrome (borders, scrollbars) is hidden or subtle gray until interacted with.

## 2. Color Palette

### Backgrounds
*   **App Canvas:** `#F2F2F7` (iOS System Gray 6)
*   **Card / Surface:** `#FFFFFF` (White)
*   **Glass Overlay:** `bg-white/80 backdrop-blur-xl`

### Text Colors
*   **Primary:** `#1C1C1E` (Almost Black - High Contrast)
*   **Secondary:** `#8E8E93` (System Gray - Labels, timestamps)
*   **Placeholders:** `text-gray-300` or `text-gray-400`

### Brand & Functional Colors
*   **Primary Action (Blue):** `#007AFF`
*   **Success (Green):** `#34C759`
*   **Destructive (Red):** `#FF2D55`
*   **Warning (Orange):** `#FF9500`
*   **Creative/AI (Indigo):** `#5856D6`

## 3. Typography (Inter / System Font)

| Role | Size | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **H1 (Card Title)** | `text-[28px]` | `font-bold` | `tracking-tight` | Input titles on Post cards |
| **H2 (Section)** | `text-[13px]` | `font-semibold` | `tracking-wide` | "REFERENCES", "CAPTION" labels (Uppercase) |
| **Body (Main)** | `text-[15px]` | `font-normal` | `leading-relaxed` | Textareas, list items |
| **Label (Small)** | `text-[13px]` | `font-medium` | `tracking-tight` | Button labels, secondary info |
| **Micro** | `text-[11px]` | `font-bold` | `tracking-tight` | Tags, status indicators |

## 4. Shapes & Radius

*   **Main Cards:** `rounded-[24px]` (Super-ellipse feel)
*   **Internal Blocks:** `rounded-xl` or `rounded-2xl` (e.g., Media previews, Task lists)
*   **Buttons:** `rounded-full` (Pill shapes)
*   **Inputs:** `rounded-xl`

## 5. Depth & Shadows

*   **Resting State:** `shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]`
*   **Hover State:** `shadow-[0_12px_24px_-8px_rgba(0,0,0,0.1)]` (Lifts up)
*   **Selected/Dragging:** `shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)]` (Floating)
*   **Glass Border:** `border border-white/60` (Used on floating menus)

## 6. Component Library

### Buttons
1.  **Icon Button:**
    *   `w-9 h-9 rounded-full bg-[#F2F2F7] text-gray-600 hover:bg-gray-200 hover:text-gray-900`
    *   Transition: `transition-all active:scale-95`
2.  **Primary Action:**
    *   `bg-[#007AFF] text-white hover:bg-[#0071E3]`
3.  **Dashed Slot (Add Button):**
    *   Border: `border border-dashed border-gray-300`
    *   Hover: `hover:border-[#007AFF] hover:bg-blue-50`
    *   Icon: Centered `w-8 h-8 rounded-full bg-white shadow-sm`

### Inputs
*   **Invisible Inputs:** Most inputs should look like plain text until clicked.
    *   `bg-transparent border-none focus:ring-0 p-0`
*   **Search/Form Inputs:**
    *   `bg-gray-50 border-none rounded-xl px-3 py-2.5`

### Lists & Grids
*   **Grids:** `gap-3` is the standard spacing for media grids.
*   **Lists:** `space-y-3` for vertical lists.

## 7. Animation & Motion
*   **Standard Duration:** `duration-300` or `duration-200`.
*   **Easing:** `ease-[cubic-bezier(0.16,1,0.3,1)]` (Apple-style spring).
*   **Entrances:** `animate-in fade-in slide-in-from-bottom-2`.
*   **Interactions:** `active:scale-95` (The "press" effect).

## 8. Iconography
*   **Library:** Lucide React (`lucide-react`).
*   **Stroke:** `strokeWidth={2}` for standard, `strokeWidth={2.5}` for bold/active states.
*   **Size:** Standard icon size is `size={16}` to `size={20}`. Large icons `size={24}`.

