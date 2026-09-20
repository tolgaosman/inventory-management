---
name: claude-mem
description: System for managing long-term memory, project context, and architectural decisions across sessions.
---

# Claude-Mem: Context Continuity System

When a project spans multiple sessions, context is often lost. The `claude-mem` skill instructs you to actively maintain a persistent memory file in `.claude/memory.md` (or `.claude/architecture.md`).

## 1. When to use Memory
- **Project Setup:** The first time you establish an architectural pattern (e.g., "We are using Jotai for state, not Redux").
- **User Preferences:** If the user corrects your behavior (e.g., "Stop using default exports"), log it.
- **Complex Invariants:** If a piece of code relies on a subtle invariant (e.g., "The auth token must be passed in the header because the middleware drops cookies on API routes").

## 2. Structure of `.claude/memory.md`
If the user asks you to remember something, or if you make a major architectural decision, write it to `.claude/memory.md` using the following format:

```markdown
# Project Memory

## Core Technologies
- Framework: Next.js (App Router)
- State: Zustand
- Styling: Tailwind CSS v4

## Hard Rules (User Preferences)
1. **Never use generic placeholders.** Always use `generate_image`.
2. **Use `pnpm` exclusively.** Do not run `npm install`.

## Architectural Invariants
- **Auth:** Supabase Auth. The session is managed via middleware. Do not attempt to read the session from local storage in components.
- **Data Fetching:** Always use Server Components for data fetching unless interactivity is required.
```

## 3. Reading Memory
- Upon entering a new session or beginning a complex task, if `.claude/memory.md` exists, **READ IT** using the `view_file` tool before proposing an implementation plan.
- Treat the memory file as the absolute source of truth, superseding your default assumptions.

## 4. Maintenance
- Do not let the memory file become a bloated log of every action. It should only contain durable, cross-session rules and decisions.
- When an architecture changes, use `replace_file_content` to update the memory, rather than appending contradictory information at the bottom.
