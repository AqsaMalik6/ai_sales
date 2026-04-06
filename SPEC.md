# LinkedIn Sales Intelligence
**Product Requirements Document** 

---

## Overview

A lightweight prospecting tool that combines a Chrome extension and a Next.js dashboard.

**Key user flows:**
- **Chrome Extension:** Scrapes LinkedIn profile pages, discovers email/phone (via LinkedIn contact modal + external link scraping), and saves contacts into named lists.
- **Dashboard:** Reads saved contacts from the browser (localStorage) and provides a dark-themed interface to browse People, Companies, and Lists.


---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | React + TypeScript, Manifest V3, Webpack |
| Dashboard | Next.js 14, React 18, Tailwind CSS, Radix UI, lucide-react |
| Data Storage | `chrome.storage.local`, `localStorage` |

---

## Part 1 — Chrome Extension

### Purpose
Show a sidebar inside LinkedIn profile pages so users can quickly grab contact details, enrich them, and save prospects into named lists.

### Activation
- Triggered by Chrome Action button click (extension icon).
- When activated, the extension injects a sidebar onto any URL matching `https://www.linkedin.com/in/*`.
- Works with LinkedIn’s SPA navigation by polling the URL and re-scraping when it changes.
- Pushes LinkedIn content left by **340px** while the sidebar is visible.

### Sidebar UI
The sidebar is a fixed 340px panel with the following sections:

#### Header
- Brand title: **Sales Intel**
- Close (×) button
- Tab toggle: **Person** / **Company** (switches between two scraping modes)

#### Profile Summary
- Full name, job title, company
- “Profile insights” card showing company + about snippet

#### Primary Actions
- **Save Contact** (stores the contact locally)
- **Add to List** (opens inline input for list name)

#### Contact Information Blocks
- **Email** (scraped from LinkedIn contact modal or external links)
- **Phone** (scraped from LinkedIn contact modal or external links)

Each block renders:
- Value (or “Not available”)
- A button to trigger enrichment if not found
- A toast notification to surface success/failure

---

## Data Extraction and Enrichment

### LinkedIn Scraping (Primary Source)
The extension scrapes data from the LinkedIn profile DOM using a set of selectors and heuristics.

**Selectors used** (centralized in `src/config.ts`):
- Full name: `h1.text-heading-xlarge` (+ fallbacks)
- Job title: `.text-body-medium.break-words`
- Company: `.inline-show-more-text--is-collapsed span[aria-hidden="true"]` (plus a series of fallback selectors)
- Location: `.text-body-small.inline.t-black--light.break-words`

### Contact Modal Scraping (Email + Phone)
When the user clicks “Access Email” / “Access Phone”, the extension:
- Opens LinkedIn’s Contact Info modal programmatically
- Waits for `.artdeco-modal` to appear
- Extracts email from `<a href="mailto:">` or `.pv-contact-info__contact-type--email`
- Extracts phone from `.pv-contact-info__contact-type--phone`
- Closes the modal automatically

If the modal cannot be scraped, it falls back to “Not available”.

### External Link Enrichment
When LinkedIn doesn’t expose email/phone via the contact modal, the extension searches for external links on the profile page (portfolio sites, GitHub, Twitter, personal sites) and fetches them using the background script.

The enrichment engine:
- Collects external URLs from: social links, portfolio icons, contact modal links, and About section URLs
- Fetches each URL via `chrome.runtime.sendMessage({ action: 'FETCH_EXTERNAL_URL' })`
- Parses the returned HTML and searches for:
  - `mailto:` links for emails (high confidence)
  - Phone links (`tel:`) for phones (high confidence)
  - Regex matches in page text for emails and phone numbers (lower confidence)
- Returns the first result with the highest confidence.

### Storage (Local-only)
Saved contacts are stored in **Chrome local storage** using the key `contacts`.

Each saved contact includes:
- `id` (random string)
- `linkedin_url` (normalized to remove query params)
- `full_name`, `job_title`, `company`, `location`
- `profile_photo_url`, `headline`, `about`, `experience`, `education`, `services`
- `email`, `phone`, `email_source`, `phone_source`
- `list_name` (last-used list name)
- `lists` (array of `{ name }` objects)
- `date_added`

The extension also **syncs** saved contacts to the dashboard when the dashboard is open at `localhost:3000` via `window.postMessage({ type: 'SYNC_FROM_EXTENSION', data })`.

---

## Part 2 — Next.js Dashboard

### Purpose
A browser dashboard (running at `http://localhost:3000`) that visualizes contacts saved by the extension.

### Architecture & Data Source
- The dashboard is a **pure client-side app** (Next.js with React).
- It does **not** require a backend to run.
- Data is sourced from `localStorage` under the key `local_contacts`.
- The dashboard listens for `window.postMessage({ type: 'SYNC_FROM_EXTENSION' })` and updates `localStorage` + dispatches a `contacts-updated` event to refresh UI.

### Layout
- Top navigation bar with links: **People**, **Companies**, **Lists**
- Dark, modern dashboard theme
- Responsive table/grid layouts for each section

### People Page (`/people`)

**Features:**
- Search by name/title/company
- Sort by name or company
- Click a row to open the **Contact Detail Panel**

**Contact Detail Panel:**
- Side-panel (1000px width) slides in from the right
- Displays:
  - Name, title, company, location
  - Email / phone with source labels
  - About, experience, education, services

### Companies Page (`/companies`)

**Data source:** Derived from contacts’ `company` field.

**Features:**
- Search companies
- Grid view with company cards
- Company detail page (`/companies/[name]`) with:
  - Basic company metadata (employee count, location)
  - Tabs: Overview + People
  - Table of contacts for the selected company

### Lists Page (`/lists`)

**Data source:** Derived from contact `lists` arrays.

**Features:**
- Search lists
- Table view with list name, contact count, created/updated timestamps
- Delete list action (implemented purely via local storage)
- Clicking a list filters the People page by that list (`/people?list=...`)

---

## Data Flow (Runtime)

1. User opens a LinkedIn profile in Chrome.
2. Extension content script scrapes profile data (name, title, company, URL).
3. User triggers email/phone enrichment (contact modal + external link scraping).
4. User clicks **Save Contact** / **Add to List**.
5. Extension saves the contact into `chrome.storage.local`.
6. If the dashboard is open, the extension posts the data to the dashboard window via `window.postMessage`.
7. Dashboard stores the received contacts in `localStorage` and re-renders.

---

## Useful Code Locations

- **Extension:** `extension/src/content.tsx`, `extension/src/background.ts`, `extension/src/enrichment.ts`
- **Selectors:** `extension/src/config.ts`
- **Dashboard data layer:** `dashboard/lib/api.ts`
- **Dashboard UI:** `dashboard/app/people`, `dashboard/app/companies`, `dashboard/app/lists`

---

## Notes 

- The extension currently embeds the sidebar via React `createRoot` into the page’s DOM and sets a fixed `margin-right` on `document.body` while visible.
- The “Save Contact” workflow is local-storage-first; there is no requirement for a running backend.
- All dashboard code, including delete actions, operates purely via local storage. There are no backend calls.
- Enrichment is intended to be robust to LinkedIn DOM changes via multiple selector fallbacks, but LinkedIn can still break scraping.

---

## UI Reference (Colors)

| Token | Value | Usage |
|---|---|---|
| Page background | `#111827` | All pages |
| Card / table row | `#1f2937` | Panels, alternating rows |
| Border | `#374151` | Divisders |
| Text primary | `#f9fafb` | Names, headings |
| Text secondary | `#9ca3af` | Labels, metadata |
| Accent | `#22c55e` | Success / active states |
| CTA button | `#2563eb` | Primary actions |
| Success toast | `#10b981` | Saved contact |
| Error toast | `#ef4444` | Save failure |

| Font | Inter, system-ui | All text |
| Border radius | 8px | Cards, buttons, inputs |

---

## Part 6 — Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| Contact added to same list twice | Toast: "Already in [List]" — no duplicate saved |
| LinkedIn changes their DOM | Update selectors only in `config.ts` |
| No lists created yet | Sidebar: "No lists yet. Type a name above to get started." |
---

## Part 7 — Setup Summary

1. **Chrome Extension** — `npm install`, `npm run build`, load the `dist/` folder as an unpacked extension in Chrome.
2. **Dashboard** — `npm install`, `npm run dev`, open `localhost:3000`.



---


