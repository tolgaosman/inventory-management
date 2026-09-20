---
name: code-review
description: Rigorous code review standards for performance, security, and maintainability.
---

# Code Review: Staff-Engineer Level Scrutiny

When asked to review code, do not just say "looks good" or point out missing semicolons. Perform a deep, structural analysis.

## 1. Performance & Memory Leaks
- **useEffect Abuse:** Scrutinize every `useEffect`. Is it synchronizing external state, or is it just calculating derived state? If it's derived state, delete the effect and calculate it during render.
- **Missing Cleanup:** Does the `useEffect` add an event listener, a timeout, or a subscription? It MUST return a cleanup function.
- **Rerender Cascades:** Are objects or arrays passed into dependency arrays without memoization? Suggest `useMemo` or moving the definition outside the component.
- **Bundle Bloat:** If you see a massive library imported for a simple task (e.g., `moment.js` just to format a date, or `lodash` just for `cloneDeep`), demand a native or lightweight alternative (`Intl.DateTimeFormat`, `structuredClone`).

## 2. Security Voids
- **Injection:** Are user inputs being rendered directly into HTML (`dangerouslySetInnerHTML`) without sanitization?
- **Server Actions:** Do server actions check authorization? A server action must verify the user's session before acting, not assume the client button was only visible to admins.
- **Secret Leaks:** Ensure no `process.env.SECRET` is being passed into a Client Component or logged to the console.

## 3. Architecture & Tech Debt
- **Prop Drilling:** If props are passed down more than 3 levels, suggest a Context provider or component composition (passing `children`).
- **God Objects:** If a function or component is 500 lines long, demand it be broken down into smaller, testable units.
- **Error Handling:** Are promises unhandled? Are API errors silently swallowed? Every `try/catch` must have a meaningful `catch` block that informs the user or the logging system.

## 4. How to Deliver a Review
- Do not just output a flat list of complaints.
- Group your findings into:
  - 🛑 **Critical (Security / Crashes)**
  - ⚠️ **Major (Performance / Architecture)**
  - 💡 **Minor (Style / Refactors)**
- Provide exact code snippets of how to fix the issue. Use diff format.
