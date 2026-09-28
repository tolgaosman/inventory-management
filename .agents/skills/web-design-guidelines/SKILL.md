---
name: web-design-guidelines
description: Core web design guidelines covering layout, color theory, typography hierarchy, responsive grids, and accessibility standards.
---

# Web Design Guidelines

This skill enforces universally accepted, high-quality web design guidelines. You must follow these principles when designing or refactoring layouts.

## 1. Layout & Grid Systems
- **Max-Width Containers:** Never let text run edge-to-edge on large screens. Constrain body content to max 65-75 characters per line (e.g., `max-w-3xl` or `prose` classes).
- **Whitespace & Rhythm:** Use whitespace as an active design element. Elements that belong together should be visually grouped with tighter spacing, while separate sections need massive breathing room (e.g., `py-24` or `py-32` between major landing page sections).
- **Responsive Behavior:** Design for mobile first, but don't just "stack" everything. Think about how horizontal lists on mobile can become grids on desktop, or how a bottom sheet on mobile becomes a sidebar on desktop.

## 2. Color Theory & Contrast
- **The 60-30-10 Rule:** 60% dominant color (usually background), 30% secondary color (cards, surfaces), 10% accent color (buttons, active states).
- **Accessibility (WCAG):** Text MUST have a minimum contrast ratio of 4.5:1 against its background. Do not use light gray text on a white background. 
- **Semantic Colors:** Ensure red is exclusively for destructive/error actions, green for success, yellow/orange for warnings. Do not use semantic colors for primary branding unless carefully balanced.

## 3. Typography Hierarchy
- **Scale:** Use a clear modular scale. An `h1` should be unmistakably the most important element on the page. 
- **Contrast through Weight/Color:** Distinguish a title from a subtitle not just by size, but by weight and color (e.g., `text-xl font-semibold text-gray-900` vs `text-sm font-normal text-gray-500`).

## 4. Interactive Elements
- **Hit Areas:** Buttons and links must have a minimum hit area of 44x44px for touch interfaces.
- **Feedback:** Every interactive element must have a clear `hover`, `active` (pressed), and `focus-visible` state.
- **Cursor:** Ensure `cursor-pointer` on buttons and links, and `cursor-not-allowed` on disabled elements (along with lowered opacity).
