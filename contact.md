## Project Context

I have a working Chrome Extension for LinkedIn sales intelligence that already:

* Scrapes LinkedIn profile data (name, company, job title)
* Has existing enrichment and scraping logic implemented in the first project — keep all existing logic exactly the same and do not modify it
* Has Phone Enrichment Engine for fallback phone scraping
* Saves contacts to localStorage + chrome.storage.local
* Shows everything in a Next.js dashboard

**DO NOT change any existing UI, storage logic, or working features.**
Also **DO NOT modify any of the previously implemented project logic — it must remain exactly the same.**

---

# Title: Email Pattern Generator + SMTP Verifier Module

## What I Need — 2 New Modules

### Module 1: Email Pattern Generator (emailPatternGenerator.ts)

When no email is available, auto-generate probable email addresses using this logic:

**Step 1 — Extract from LinkedIn profile:**

* First name
* Last name
* Company name
* Company website domain

If no company website → use Google search pattern:

```
site:linkedin.com/company/[name]
```

to find domain (background fetch only)

**Step 2 — Generate these 8 patterns:**

1. [firstname@domain.com](mailto:firstname@domain.com)
2. [lastname@domain.com](mailto:lastname@domain.com)
3. [firstname.lastname@domain.com](mailto:firstname.lastname@domain.com)
4. [f.lastname@domain.com](mailto:f.lastname@domain.com)
5. [firstnamelastname@domain.com](mailto:firstnamelastname@domain.com)
6. [flastname@domain.com](mailto:flastname@domain.com)
7. [firstname_lastname@domain.com](mailto:firstname_lastname@domain.com)
8. [firstname-lastname@domain.com](mailto:firstname-lastname@domain.com)

**Step 3 — Pass all generated emails to SMTP Verifier**

**Step 4 — Return only verified/probable ones**

**Output format:**

```json
{
  "generated_emails": [
    {
      "email": "john.smith@microsoft.com",
      "pattern": "firstname.lastname",
      "status": "valid | invalid | unknown",
      "confidence": "high | medium | low"
    }
  ],
  "best_guess": "john.smith@microsoft.com"
}
```

---

### Module 2: SMTP Verifier (smtpVerifier.ts)

Verify if an email address actually exists **without sending any email.**

**How it works:**

Step 1: DNS MX record lookup for the domain
Step 2: Connect to mail server on port 25
Step 3: Send EHLO → MAIL FROM → RCPT TO commands
Step 4: Read server response code:

```
250 = Valid (mailbox exists)
550 = Invalid (mailbox does not exist)
421 / 450 / 451 = Unknown (server busy / greylisted)
Timeout / refused = Unknown
```

Step 5: Send QUIT — never actually send any email

---

## Important constraints

This **CANNOT run inside a Chrome Extension** (browser blocks raw TCP).

Build this as a lightweight **local Python script (smtp_verifier.py)** that:

* Runs on localhost:8001 (separate from any other server)
* Accepts POST request:
  `{ "emails": ["john@company.com"] }`
* Returns:
  `{ "results": [{ "email": "...", "status": "valid|invalid|unknown" }] }`
* Uses only Python standard library (smtplib, dns.resolver, socket)
* Runs with single command:

```
python smtp_verifier.py
```

Chrome Extension calls this local script:

```
fetch("http://localhost:8001/verify", {...})
```

If local script not running → show badge **"SMTP offline"** in extension

If valid email found → show in extension with **valid badge**

If unknown → show with **warning badge**

If invalid → skip, try next pattern

---

## Integration Flow (end to end)

```
LinkedIn profile opened
↓
Check if email exists in current data → if yes → show it as verified
↓ (if no email)
Email Pattern Generator → generates 8 patterns
↓
SMTP Verifier (localhost:8001) → checks each pattern
↓
Best valid email shown in extension with source badge "via SMTP"
↓
Saved to contact with email_source: "Pattern+SMTP"
```

---

## Files to deliver

* emailPatternGenerator.ts — pattern generation module for extension
* smtp_verifier.py — local Python server (standard library only)
* Updated background.js — integration with both modules
* smtpClient.ts — fetch wrapper that calls localhost:8001
* Updated contact save logic — add `email_source: "Pattern+SMTP"` field
* README_SMTP.md — one command setup instructions

---

## Rules

* **DO NOT change any existing UI**
* **DO NOT change dashboard, storage, or existing enrichment logic already implemented in the project**
* SMTP verifier is **optional/additive** — if offline, existing flow continues normally
* **No paid APIs, no external services — fully local**
* All TypeScript files must have proper types
