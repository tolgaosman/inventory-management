---
name: ui-ux-pro-max
description: The ultimate UI/UX skill combining behavioral psychology, spatial consistency, micro-interactions, and premium aesthetics.
---

# UI/UX Pro Max: Beyond the Surface

This skill elevates you from a "frontend developer" to a "Product Designer." The goal is not just to make things look pretty, but to reduce cognitive load, guide behavior, and create an emotional connection with the user.

## 1. Cognitive Load Reduction
- **Hick's Law:** Minimize choices. A page with 10 primary CTAs is a failure. Define the **one** primary action you want the user to take and visually diminish the rest.
- **Progressive Disclosure:** Do not show every setting at once. Use "Advanced Settings" accordions, multi-step wizards, and contextual popovers to keep the initial UI clean.
- **Spatial Memory:** Keep navigation, search, and user profiles in their globally expected locations (top right, left sidebar). Do not invent a new mental model for basic navigation.

## 2. Micro-Copy & Tone
- **Speak Human, Not Machine:** "Authentication Failed: Code 403" is unacceptable. Use "We couldn't log you in. Please check your password and try again."
- **Action-Oriented Buttons:** "Submit" or "OK" are banned. Buttons should describe the action: "Create Account," "Delete Project," "Send Message."
- **Empty States:** An empty state is an onboarding opportunity. Instead of "No projects found," use an illustration, a short explanation of what projects are for, and a giant "Create your first project" button.

## 3. Feedback Loops & Affordances
- **Instant Response:** Every interactive element must have a `:hover` and `:active` state. The UI must instantly acknowledge the user's intent.
- **Optimistic UI:** When a user clicks "Like," update the UI immediately before the server responds. Roll back only if it fails.
- **Destructive Actions:** Any action that deletes data must require confirmation (a modal, or a typed "DELETE" prompt). It must be styled dangerously (red).

## 4. The "Pro Max" Polish Details
- **Optical Alignment:** Sometimes mathematical center is not visual center (especially with icons next to text). Adjust margins manually if it looks off.
- **Subtle Depth:** Use multiple layered box-shadows (e.g., `shadow-sm shadow-black/5`) instead of one harsh shadow to simulate ambient light.
- **Typography Hierarchy:** Scale is not enough. Use font weight and color contrast to establish hierarchy. A subhead should be lighter in color (`text-gray-500`) and slightly bolder to separate it from the body text.
- **Skeleton Loaders:** Do not flash a blank white screen. Show a skeleton that perfectly matches the geometric layout of the arriving content.
