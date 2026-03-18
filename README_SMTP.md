# SMTP Email Verifier Setup

This module adds advanced email pattern generation and SMTP verification to the Sales Intelligence extension.

## 1. SMTP Verifier Server (Local Python)

The SMTP verifier must run locally because browsers block raw TCP connections.

**Prerequisites:**
- Python 3.x installed

**To Start the Server:**
```bash
python smtp_verifier.py
```
*Note: This server runs on `http://localhost:8001`.*

## 2. Extension Setup

1. The extension will automatically detect if the SMTP server is running.
2. If the server is offline, a red "SMTP OFFLINE" badge will appear in the Email section.
3. If online, the extension will attempt to generate 8 probable email patterns when an email isn't found on LinkedIn.
4. Each pattern is verified against the mail server without sending an actual email.

## 3. Verification Badges

- **VALID**: High confidence. The mailbox exists on the server.
- **PROBABLE**: Medium/Low confidence. The server is catch-all or greylisted, but the pattern is standard.

## 4. Integration Details
- **Modules**: `emailPatternGenerator.ts`, `smtpClient.ts`, `smtp_verifier.py`
- **Updated**: `content.tsx` (UI), `background.ts` (Domain Search)
