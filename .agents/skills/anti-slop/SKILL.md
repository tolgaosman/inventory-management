---
name: anti-slop
description: Strict skill to ban lazy LLM defaults (AI-purple gradients, generic bento boxes, boilerplate copy, fake-screenshot divs). Enforces distinct, purpose-driven UI over templated generation.
---

# Anti-Slop Discipline

> **Slop** is the default output of LLMs when asked to generate UI: templated, thoughtless, generic, relying on tired tropes rather than specific, context-aware design.
> This skill gives you explicit instructions to **REFUSE** producing slop and instead produce high-craft, deliberate code.

## 1. THE BANNED DEFAULTS (Pre-Flight Checks)

Before you generate ANY frontend code, run these checks against your plan. If your plan contains any of these, **it is slop. Start over.**

### A. The "AI Purple" Glow Ban
- **What is it:** Using a purple/indigo radial gradient blur behind a dark-mode element (`bg-purple-500/20 blur-3xl`).
- **Why it's slop:** It's the most common LLM fallback for "modern tech design."
- **The Fix:** Use neutral, contextual highlights (zinc, slate) or pick a bold, brand-specific accent (e.g., electric blue, deep rose, burnt orange). If the brand is actually purple, execute it intentionally across the whole palette, not just as a generic glow.

### B. The 3-Column Feature Card Ban
- **What is it:** `grid-cols-1 md:grid-cols-3` containing three identical cards (Icon + H3 + `text-sm text-gray-500` paragraph).
- **Why it's slop:** It is the absolute default "feature section" filler. It shows no hierarchy.
- **The Fix:** Introduce asymmetry. Use a 2+1 grid, a horizontal bento, an interactive tab layout, or an editorial layout (large typography on the left, staggered cards on the right).

### C. The "Fake Screenshot" Div Ban
- **What is it:** Building a fake dashboard or code snippet inside a `div` just to have an image placeholder in the hero. (e.g. A div with a header that has 3 colored dots like macOS, and empty boxes inside).
- **Why it's slop:** It looks cheap, adds no value, and screams "AI-generated filler."
- **The Fix:** EITHER use a real image via the `generate_image` tool (if available), OR use bold typography and layout instead of a fake graphic, OR build a genuine, interactive mini-component that actually demonstrates the product's value.

### D. The Cliche Copy Ban
- **What is it:** Phrases like "Unleash the power of...", "Elevate your workflow", "Seamlessly integrate", "Empowering teams."
- **Why it's slop:** It is meaningless, high-level corporate jargon.
- **The Fix:** Write specific, mechanical, true statements. "Deploy to Vercel in 2 seconds" instead of "Seamlessly integrate with modern hosting." "Zero-config analytics" instead of "Empowering data-driven decisions."

## 2. HOW TO BUILD DISTINCTIVE UI

### Architecture & DOM
- **Semantic HTML over Div Soup:** Never nest 8 divs just to center a button. Use Grid.
- **Tailwind Restraint:** Do not write a 250-character `className` string. If a component is that complex, abstract its parts logically or use CSS variables to clean up the markup.
- **Spacing Scale:** Do not mix `gap-2`, `gap-3`, `gap-5` randomly. Pick a rhythmic scale (e.g., multiples of 4: `4, 8, 16, 24, 32`) and stick to it universally.

### Component Hygiene
- **Empty States:** A table with no data shouldn't just be an empty header. Design a beautiful empty state with an actionable CTA.
- **Loading States:** No generic spinning circles. Use skeletal loaders that match the geometry of the arriving content.
- **Error States:** Errors should tell the user *exactly* how to recover, not just say "Something went wrong."

## 3. ENFORCEMENT

When the user asks you to "design a landing page" or "build a component":
1. **Self-Audit:** "Am I about to write a 3-column feature grid with a purple glow?"
2. **Pivot:** "No, I am going to write an editorial layout using CSS Grid, stark typography, and a single high-contrast accent color."
3. **Commit:** Ship the distinctive version. If you are unsure, err on the side of brutalist simplicity rather than complex, generic slop.
