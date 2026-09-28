---
name: image-to-code
description: Instructions for accurately translating visual mockups, screenshots, and designs into pixel-perfect, production-ready code.
---

# Image to Code Translation

When the user provides an image (screenshot, mockup, Figma export) and asks you to recreate it, you are acting as a Frontend Design Engineer. Accuracy is paramount.

## 1. Deconstruction & Analysis
Before writing code, visually dissect the image:
- **Determine the Grid:** Is it a 12-column layout? A flexbox sidebar + content area? A CSS grid bento box?
- **Identify Repeated Patterns:** Look for cards, lists, or buttons that share the same styling. Create a reusable abstraction (component or CSS class) for these rather than repeating code.
- **Color Extraction:** Guess the exact color codes. If a color is close to a Tailwind default (e.g., `#ef4444`), use the semantic class (`bg-red-500`). If it is a distinct brand color, define it precisely via arbitrary values (`bg-[#1a2b3c]`) or CSS variables.

## 2. Spatial Accuracy (Spacing & Proportions)
- **Padding & Margins:** Do not guess randomly. Observe the spatial relationships. If the padding inside a card looks roughly equal to the height of the button inside it, ensure your spacing classes reflect that proportion.
- **Font Sizing:** Distinguish between `text-sm`, `text-base`, `text-lg`, and `text-2xl`. Look at the visual weight. If a heading is massive, don't be afraid to use `text-5xl` or `text-6xl`.
- **Border Radii:** Match the exact curvature. A modern pill button is `rounded-full`, a standard card is often `rounded-xl` or `rounded-2xl`, a strict enterprise UI might be `rounded-sm`.

## 3. Pixel-Perfect Execution
- **Icons:** Infer what icons are used. Use standard SVG icon libraries (like Lucide or Heroicons) to match the visual semantics of the screenshot.
- **Shadows:** Look closely at the depth. Is it a sharp shadow (`shadow-md`) or a very soft, diffused shadow (`shadow-2xl`)? Is the light source coming from straight above?
- **Responsive Inference:** The image is static, but your code must not be. Infer how the layout should behave on mobile. A horizontal row of 4 cards in the screenshot MUST stack to 1 or 2 columns on mobile. DO NOT hardcode desktop-only layouts (`flex`, `grid-cols-4`) without their responsive counterparts (`flex-col md:flex-row`, `grid-cols-1 md:grid-cols-4`).
