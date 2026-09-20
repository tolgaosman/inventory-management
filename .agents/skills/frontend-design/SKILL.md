---
name: frontend-design
description: Master-level frontend component architecture, responsive design, a11y, and styling.
---

# Frontend Design: Master-Level Architecture

This skill dictates how to build robust, scalable, and maintainable frontend architectures. Forget "quick hacks"—build for scale.

## 1. Component Architecture
- **Single Responsibility:** A component should do one thing well. Do not write a 500-line `Dashboard.tsx` file. Extract complex interactive areas into their own files.
- **Server vs Client Components (RSC):** Default to Server Components. Add `"use client"` **only** at the deepest possible leaf node where interactivity (`useState`, `useEffect`, `onClick`) is absolutely required. Do not slap `"use client"` on a layout or a whole page just because one button needs an onClick.
- **Data Fetching:** Fetch data on the server in Server Components. Pass plain JSON data down as props. Do not pass complex objects, classes, or functions across the Server/Client boundary.

## 2. CSS & Styling Discipline
- **Tailwind Restraint:** Do not write a 30-class long string inline if you are using it in a `.map()`. Extract to a local variable or a separate component.
- **Responsive by Default:** Always test and build mobile-first. If a layout breaks at `sm` (640px), it is broken. Use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` explicitly.
- **CSS Variables:** For highly dynamic values (like user-customized colors), use CSS variables inline (`style={{ '--brand-color': brandColor }}`) rather than attempting to generate dynamic Tailwind classes. Tailwind does not support dynamic string interpolation well.

## 3. Accessibility (A11y)
- **Semantic Tags:** Use `<nav>`, `<main>`, `<article>`, `<section>`, and `<aside>`. A page built entirely out of `<div>` tags is a failure.
- **Buttons vs Links:** 
  - If it navigates to a new URL, use `<a>` (or Next.js `<Link>`).
  - If it performs an action on the page (opens modal, submits form), use `<button type="button">` (or `type="submit"`). NEVER use `<div onClick={...}>`.
- **Focus Rings:** Never use `outline-none` without providing a custom `:focus-visible` state. Keyboard users must know where they are.
- **Aria Labels:** If a button contains only an icon, it MUST have an `aria-label` or visually hidden text (`sr-only`).

## 4. Theming and Dark Mode
- Dark mode is not just "invert the colors". It requires a specific palette.
- Do not use `bg-black` everywhere in dark mode. Use elevated grays (`bg-zinc-950`, `bg-zinc-900`, `bg-zinc-800`) to show depth.
- If the project uses a theme system (like `next-themes` or Radix), strictly adhere to CSS variables (`var(--bg-primary)`) rather than hardcoding `bg-white dark:bg-black` everywhere.
