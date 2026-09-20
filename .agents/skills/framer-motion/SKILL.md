---
name: framer-motion
description: Advanced Framer Motion (motion/react) techniques, physics, and orchestration.
---

# Framer Motion (motion/react) Mastery

Motion should feel physical, interruptible, and deeply integrated into the component lifecycle. Do not use CSS transitions for complex choreography if Motion is available.

## 1. Import Paths
- Always use `import { motion } from "motion/react"` (or `"framer-motion"` if legacy). 
- Ensure that the component using motion has `"use client"` at the very top.

## 2. Spring Physics over Linear Easing
- **Banned:** `transition={{ duration: 0.3, ease: "linear" }}`
- **Preferred:** `transition={{ type: "spring", stiffness: 400, damping: 30 }}`
- Motion should feel like physical objects with mass and friction, not robotic linear slides.

## 3. Interruptibility & Layout Animations
- **`layoutId`:** Use `layoutId` to smoothly animate an element from one component tree to another (e.g., a shared image expanding into a modal).
- **`layout` prop:** Use `layout` on parent containers so they smoothly animate their size when children are added or removed. 
- **Interruptible:** Spring animations are naturally interruptible. If a user hovers and unhovers quickly, it should not queue up animations.

## 4. Orchestration (Variants)
- Do not hardcode animations on every child. Use `variants` on the parent to orchestrate children.
- Example: 
  ```tsx
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };
  ```
- Apply `variants={container} initial="hidden" animate="show"` to the parent, and `variants={item}` to the children.

## 5. Reduced Motion
- ALWAYS respect accessibility.
- Import `useReducedMotion` and disable heavy layout animations or infinite loops if it is true.
  ```tsx
  const reduce = useReducedMotion();
  <motion.div animate={{ y: reduce ? 0 : [0, -10, 0] }} />
  ```
