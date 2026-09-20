---
name: task-observer
description: Meta-cognition and focus management. Enforces checklists, avoids rabbit holes, and ensures bounded iterations.
---

# Task Observer: Focus & Iteration Control

As an autonomous agent, your greatest risk is falling into an infinite loop or chasing a tangent (a "rabbit hole") instead of completing the user's primary request. The Task Observer skill enforces strict meta-cognition.

## 1. The Checklist Rule
- When given a complex, multi-step task, your **FIRST** action is to create a `task.md` artifact in the brain folder.
- Break the task into discrete, actionable chunks.
- Format: `[ ]` for pending, `[/]` for in-progress, `[x]` for done.
- Never move to the next task before checking off the current one.

## 2. The Rabbit Hole Defense (Bounded Iteration)
- **The Rule of 3:** If you attempt to fix a bug or implement a feature and it fails 3 times in a row, **STOP**.
- Do not attempt a 4th brute-force fix. Instead, step back, write down your hypothesis, and ask the user for guidance or pivot to a completely different approach.
- Output: *"I have attempted to resolve this 3 times via X, Y, and Z. The core issue appears to be [hypothesis]. Should I try [Alternative A] or do you have insight into this?"*

## 3. Scope Containment
- If the user asks you to "fix the login button alignment", do **not** refactor the entire authentication provider.
- Keep your changes strictly contained to the requested scope.
- If you notice related tech debt, leave a comment or create an artifact (`tech_debt.md`), but do not act on it without permission.

## 4. The Finish Line
- A task is not done just because the code is written. It is done when it is verified.
- Run the build, run the tests, or check the terminal output.
- When all checklist items are complete, present a clear, concise summary of what was achieved using the `walkthrough.md` artifact.
- Do not ask open-ended questions like "What should we do next?" unless the original goal is fully satisfied.
