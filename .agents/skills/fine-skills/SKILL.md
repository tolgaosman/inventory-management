---
name: fine-skills
description: Master the finest details of UI/UX implementation. Focus on 1px borders, subtle box-shadows, font-smoothing, perfect alignment, and micro-interactions that elevate a UI from good to flawless.
---

# Fine Skills & Micro-Aesthetics

> "The details are not the details. They make the design." — Charles Eames
> This skill enforces pixel-perfect, hyper-refined interface implementation.

## 1. Typography & Rendering
- **Font Smoothing:** Always apply `antialiased` and `subpixel-antialiased` appropriately. Dark text on light background can use standard rendering, but light text on dark backgrounds often looks too bold without `antialiased`.
- **Line Height (Leading):** Tighter line heights for headings (1.1 - 1.2), looser for body text (1.5 - 1.6). Never leave it at the browser default.
- **Letter Spacing (Tracking):** Slightly reduce tracking on large headings (`tracking-tight`), slightly increase it on all-caps subheadings or very small text (`tracking-widest text-xs uppercase`).

## 2. Borders & Separation
- **Subtle Borders:** Avoid harsh black or dark gray borders. Use incredibly subtle borders for separation (e.g., `border-gray-200` or `border-zinc-800` in dark mode). 
- **1px Inner Shadows:** Instead of flat borders on buttons, use a 1px inner shadow (inset) combined with a subtle drop shadow to create a tactile, premium feel. 
- **Dividers:** Use gradient dividers that fade out at the edges instead of solid lines for a softer, more modern look.

## 3. Shadows & Depth
- **Layered Shadows:** Never use a single, harsh drop shadow. Stack multiple shadows (a tight, dark shadow for contact + a large, diffuse shadow for ambient light) to create realistic depth.
- **Color-Tinted Shadows:** Shadows are never pure black. If the button is blue, the shadow should be a dark, translucent blue (`shadow-blue-900/20`).

## 4. Execution Checklist
- [ ] Is everything perfectly aligned on a 4px/8px grid?
- [ ] Are icons optically aligned with text (sometimes requires a `mt-[-1px]` or flex alignment tweaks)?
- [ ] Are hover states subtle and smooth (`transition-all duration-200`) rather than instant and jarring?
- [ ] Have you removed default browser focus rings and replaced them with custom, brand-aligned focus states (`focus-visible:ring-2 focus-visible:ring-offset-2`)?
