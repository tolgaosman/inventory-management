---
name: anthropic-security-audit
description: >-
  A comprehensive skill for conducting detailed security audits on applications, 
  with a focus on LLM integrations (like Anthropic Claude) and general web application 
  security (OWASP). Use this skill when asked to perform a security audit, threat modeling, 
  or vulnerability assessment.
---

# Anthropic Security Audit & Assessment Guide

This skill provides a structured methodology for performing a thorough security audit on a codebase, especially those integrating with Large Language Models (LLMs) such as Anthropic's Claude API, alongside standard web application security checks.

When a user requests a security audit, follow the steps and checklists below to ensure a comprehensive assessment.

## 1. LLM Security Assessment (OWASP Top 10 for LLMs)

If the application integrates with Anthropic or other LLMs, evaluate the following critical vectors:

- **Prompt Injection (LLM01):** 
  - Are user inputs directly concatenated into prompts without sanitization or sandboxing? 
  - *Recommendation:* Enforce strict system prompts, use XML tags to delineate user input (as recommended by Anthropic), and validate output constraints.
- **Insecure Output Handling (LLM02):**
  - Is the output from the LLM trusted blindly by the application? (e.g., executing code, rendering raw HTML, executing SQL queries).
  - *Recommendation:* Treat all LLM outputs as untrusted user input. Sanitize, encode, and validate before rendering or execution.
- **Training Data Poisoning (LLM03):** 
  - If fine-tuning or RAG (Retrieval-Augmented Generation) is used, is the source data sanitized?
- **Model Denial of Service (LLM04):**
  - Are there rate limits in place for users invoking LLM operations to prevent cost-exhaustion and API throttling?
- **Supply Chain Vulnerabilities (LLM05):**
  - Are third-party LLM orchestrators (e.g., LangChain, LlamaIndex) up to date?
- **Sensitive Information Disclosure (LLM06):**
  - Is PII, PHI, or sensitive financial data being sent to external APIs (like Anthropic) without consent or anonymization?
  - *Recommendation:* Implement PII masking before sending data to the LLM API.
- **Insecure Plugin Design (LLM07):**
  - If the LLM has tools/plugins, are permissions scoped correctly using the principle of least privilege?
- **Excessive Agency (LLM08):**
  - Does the LLM have permission to execute destructive actions (DELETE, UPDATE, system commands) without human-in-the-loop validation?
  - *Recommendation:* Require explicit user confirmation for high-risk actions.
- **Overreliance (LLM09):**
  - Is the LLM used for mission-critical logic (e.g., authentication, authorization) where deterministic code should be used instead?
- **Model Theft (LLM10):**
  - Are system prompts or proprietary weights exposed? (Focus on system prompt leakage).

## 2. API & Secrets Management

- **Hardcoded Secrets:** Scan for `.env` files committed to version control, hardcoded Anthropic API keys (`sk-ant-api03-*`), database credentials, or JWT secrets.
- **Key Rotation & Scope:** Ensure API keys are scoped to the least privilege necessary.
- **Client-side API Calls:** Ensure no Anthropic API calls are made directly from the frontend (e.g., React, Next.js client components). All LLM API calls must be proxied through a secure backend to hide the API key.

## 3. General Web Application Security (OWASP Top 10)

- **Broken Access Control:** 
  - Are endpoints verifying user authorization? 
  - Are Direct Object References (IDOR) prevented?
- **Cryptographic Failures:** 
  - Is sensitive data (passwords) hashed using strong algorithms (Argon2, bcrypt)? 
  - Is HTTPS enforced?
- **Injection Flaws (SQLi, XSS, Command Injection):** 
  - Are parameterized queries used for all database interactions? 
  - Is user input sanitized before being rendered in the DOM?
- **Security Misconfiguration:** 
  - Are detailed error messages hidden in production? 
  - Are security headers present (CSP, X-Frame-Options, HSTS)?
- **Vulnerable and Outdated Components:** 
  - Check `package.json` or `requirements.txt` for known vulnerable dependencies.

## 4. Execution Methodology

When you invoke this skill to audit a repository:
1. **Reconnaissance:** Understand the architecture (Frontend, Backend, Database, LLM API usage).
2. **Static Code Analysis:** Use `grep_search` to find common vulnerability patterns (`eval(`, `dangerouslySetInnerHTML`, `sk-ant-`, `SELECT * FROM`).
3. **LLM Integration Review:** Trace the data flow from User Input -> Backend -> Anthropic API -> Backend -> User Output. Look for Prompt Injection vulnerabilities and Insecure Output Handling.
4. **Reporting:** Generate a structured Markdown artifact named `security_audit_report.md`. Group findings by severity (Critical, High, Medium, Low) and provide actionable remediation steps.

## Deliverables
- **Vulnerability Matrix:** A clear table mapping the vulnerability, location, severity, and impact.
- **Remediation Code:** Provide the exact code snippets to fix identified vulnerabilities.
