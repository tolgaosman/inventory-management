---
name: security-guidance
description: Day-to-day secure coding practices, input sanitization, and secrets management.
---

# Security Guidance: Shift-Left Security

Do not wait for a dedicated audit to write secure code. Treat every line as a potential vulnerability.

## 1. Input Sanitization & Validation
- **Never Trust the Client:** Any data originating from the client (forms, URL params, headers) must be validated on the server.
- **Zod for Everything:** If the project uses TypeScript, use `zod` to validate all incoming payloads. Do not just cast payloads (`as UserData`). Parse them (`UserDataSchema.parse()`).
- **XSS Prevention:** In React, `dangerouslySetInnerHTML` should trigger an immediate alarm. If you must use it, you must wrap the input in `DOMPurify`.

## 2. Secrets Management
- **Environment Variables:** Never commit `.env` files. Ensure they are in `.gitignore`.
- **Prefixes:** If using Next.js, strictly separate `NEXT_PUBLIC_` variables (safe for client) from secret variables. Never prefix a database URL or API key with `NEXT_PUBLIC_`.
- **Logging:** Ensure that error loggers (like Sentry or Winston) strip out authorization headers, passwords, and PII before sending the payload.

## 3. Database Security
- **SQL Injection:** Always use parameterized queries or an ORM (Prisma, Drizzle) that sanitizes inputs automatically. Never concatenate strings into a SQL query.
- **Row-Level Security (RLS):** If using Supabase or Postgres, ensure RLS policies are enabled and strictly scoped to `auth.uid() = user_id`.

## 4. Auth & Session
- **Cookies over LocalStorage:** For session tokens, use HTTP-only, secure cookies. Do not store JWTs in `localStorage` where they can be stolen via XSS.
- **CSRF:** If using cookie-based auth, ensure CSRF tokens are implemented for mutating requests.
