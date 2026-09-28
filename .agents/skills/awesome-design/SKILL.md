---
name: awesome-design
description: Create WOW-factor, visually stunning designs. Focus on modern trends, glassmorphism, dynamic gradients, bento grids, and high-impact visual aesthetics.
---

# Awesome Design (WOW Factor)

When the user asks for an "awesome", "stunning", or "premium" design, standard clean UI is not enough. You must elevate the aesthetic to a state-of-the-art, Dribbble/Awwwards level.

## 1. Visual Aesthetics
- **Glassmorphism:** Use translucent backgrounds with backdrop blurs (`bg-white/10 backdrop-blur-md`) combined with subtle 1px semi-transparent white/gray borders (`border border-white/20`) to create glass effects.
- **Mesh Gradients:** Instead of flat backgrounds or simple linear gradients, use complex, organic mesh gradients. Animate them slowly for a dynamic, "living" background.
- **Dark Mode by Default:** Premium tech designs often look best in dark mode. Use deep, rich blacks (e.g., `#09090b`) rather than pure black, and use glowing accents.

## 2. Structural Patterns
- **Bento Box Grids:** Organize features or metrics into asymmetrical, card-based grid layouts (Bento grids). Mix squares and rectangles. Give each card a distinct micro-interaction.
- **Hero Sections:** The hero should dominate the screen. Use massive, confident typography (`text-6xl md:text-8xl tracking-tighter`). Include a dynamic visual element (a 3D rendering, a glowing interactive component, or a highly polished mockup).

## 3. Delightful Details
- **Text Gradients & Shimmer:** Apply gradients to primary headings (`bg-clip-text text-transparent bg-gradient-to-r`). Add shimmer effects to call-to-action buttons.
- **Noise Textures:** Apply a very subtle SVG noise overlay to dark backgrounds to prevent banding and add a tactile, physical texture to the digital interface.
- **Magnetic Buttons:** (If writing JS) Add subtle physics to buttons where the icon or text slightly follows the cursor before snapping back.

*Rule of Thumb:* If the design looks like it could have been made in 2018, it's not "awesome". Push the boundaries of modern CSS (mask-images, mix-blend-modes, clip-paths).
