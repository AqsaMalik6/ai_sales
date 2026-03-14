# LinkedIn Sales Intelligence
**Product Requirements Document** | v1.0

---

## Overview

A three-part sales prospecting tool inspired by Apollo.io. A Chrome Extension overlays a sidebar on any LinkedIn profile page, shows that person's email and phone number, and lets the user save them into named lists. A FastAPI backend stores everything in PostgreSQL. A Next.js dashboard displays all saved contacts, companies, and lists in Apollo.io's dark-theme style.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Chrome Extension | React + TypeScript, Manifest V3 |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL |
| Frontend Dashboard | Next.js 14, Tailwind CSS, shadcn/ui, Zustand |
| Data Enrichment | Apollo.io API (email + phone lookup) |

**Ports:** Backend runs on `localhost:8000`, Dashboard on `localhost:3000`.

---

## Part 1 — Chrome Extension

### Purpose
Inject a sidebar into LinkedIn profile pages so sales users can see contact data and save prospects to lists without leaving LinkedIn.

### Activation
- Auto-activates on any `linkedin.com/in/*` URL
- Re-initialises on LinkedIn's SPA navigation (URL changes without page reload)
- Pushes LinkedIn's page content left by 340px to make room for the sidebar

### Sidebar — Contact Card (top section)
Displays the following for the currently open LinkedIn profile:

- Profile photo (40px circle; show initials in a coloured circle if no photo)
- Full name, job title, current company
- Email address fetched from Apollo.io API
- Phone number fetched from Apollo.io API
- Copy-to-clipboard icon next to email and phone
- Loading spinner while Apollo.io data is being fetched
- "Not found" in grey text if Apollo.io returns no data

### Sidebar — Add to List (middle section)
- Text input with placeholder "Type list name... (e.g. CTO)"
- Autocomplete dropdown showing existing list names as the user types
- **Add** button that saves the current profile's contact data to the named list via the backend API
- Green toast notification: "Added to [List Name]" on success
- Orange toast: "Already in [List Name]" if the contact is already in that list
- Red toast: "Could not save. Try again." on error
- Toasts auto-dismiss after 3 seconds

### Sidebar — List Panel (bottom section)
- Shows all saved named lists with their contact count
- Each list is collapsible/expandable
- Expanded view shows each contact's name, email, a LinkedIn icon (opens their profile in a new tab), and a delete (✕) button to remove them from the list
- Delete List button at the bottom of an expanded list, requires confirm dialog

### Data Scraped from LinkedIn DOM
All selectors stored in a single `config.ts` file — update only that file if LinkedIn changes their markup.

| Field | Source |
|---|---|
| Full name | `h1.text-heading-xlarge` |
| Job title | `.text-body-medium.break-words` |
| Company | `.inline-show-more-text--is-collapsed span[aria-hidden="true"]` |
| Profile photo | `.pv-top-card-profile-picture__image` |
| LinkedIn URL | `window.location.href` |

### Apollo.io Enrichment API
- Called from the service worker (background script), never from the content script
- Request sends: first name, last name, company name, LinkedIn URL
- Response provides: email, phone number, professional headline
- If `person` is `null` in the response, show "Not found" gracefully — no crash
- API key stored in `chrome.storage.local`, never hardcoded
- User sets their Apollo.io API key in the extension's Settings popup

### Required Chrome Permissions
`activeTab`, `storage`, `scripting`, host permissions for `linkedin.com` and `api.apollo.io`

---

## Part 2 — FastAPI Backend

### Purpose
REST API that receives contact data from the Chrome Extension and serves it to the Next.js dashboard. All data persisted in PostgreSQL.

### Database Tables
Three tables: `contacts`, `lists`, and `list_contacts` (junction table linking contacts to lists).

**contacts** — one row per unique LinkedIn profile (deduplicated by `linkedin_url`)

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| linkedin_url | TEXT | Unique, not null |
| full_name | TEXT | Not null |
| first_name, last_name | TEXT | |
| job_title, company | TEXT | |
| company_website | TEXT | |
| email | TEXT | |
| email_source | TEXT | Default "Apollo" |
| phone, phone_type | TEXT | |
| profile_photo_url | TEXT | |
| headline, about | TEXT | |
| location | TEXT | |
| date_added | TIMESTAMPTZ | Default NOW() |

**lists** — one row per named list

| Column | Type |
|---|---|
| id | UUID |
| name | TEXT UNIQUE |
| created_at, updated_at | TIMESTAMPTZ |

**list_contacts** — junction table, composite primary key on `(list_id, contact_id)`

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/contacts` | All contacts with their list names |
| GET | `/api/contacts/{id}` | Single contact |
| POST | `/api/contacts` | Save contact + add to named list (upsert by linkedin_url) |
| DELETE | `/api/contacts/{id}/lists/{list_name}` | Remove contact from a list |
| GET | `/api/lists` | All lists with contact count |
| GET | `/api/lists/{name}` | Single list with all its contacts |
| DELETE | `/api/lists/{name}` | Delete a list (contacts remain) |
| GET | `/api/companies` | All companies derived from contacts (grouped by company field) |
| GET | `/api/companies/{name}/contacts` | All contacts at a given company |

### Key Backend Behaviours
- POST `/api/contacts` upserts — if `linkedin_url` already exists, update fields rather than duplicate
- Deleting a list removes only the list and junction rows; contact records are preserved
- Companies are not a separate table — derived at query time by grouping contacts by their `company` field
- CORS allows `http://localhost:3000` and any `chrome-extension://` origin
- Swagger UI auto-available at `http://localhost:8000/docs`

---

## Part 3 — Next.js Dashboard

### Purpose
Browser-based dashboard at `localhost:3000` that displays all data from the backend. Styled in Apollo.io's dark theme.

### Layout
- Left sidebar navigation (240px, dark background `#111827`)
- Navigation items: **People**, **Companies**, **Lists**
- Active item has a blue left border highlight
- Main content area fills the rest of the viewport

### People Page (`/people`)

Displays all saved contacts in a sortable, searchable table.

**Columns:** checkbox · profile photo + name · job title · company · email · phone · LinkedIn icon · list(s) · date added

- Search bar filters by name, title, or company
- Columns sortable by name, title, company, date added
- Clicking a row opens a **Contact Detail Panel** sliding in from the right (420px wide)

**Contact Detail Panel** matches Apollo.io's layout exactly:

- Header: initials circle, full name, job title, company, location
- Action icon row (phone, email, calendar, etc.)
- **Contact information** section: email with Primary badge and "Source: Apollo" label; phone with Default badge
- **Account** section: company name, website URL
- **Person activity** section: created date
- **Additional information** section: professional headline
- Tabs at top: Person · Company

### Companies Page (`/companies`)

All companies auto-derived from saved contacts, grouped by the `company` field.

**Columns:** checkbox · company logo/initials + name · website link · location · number of people saved

Clicking a row opens the **Company Detail Page** (full page, not a panel).

**Company Detail Page (`/companies/[name]`):**

- Left panel (300px): company name, description if available, industry tags, location, website, employee count, founding year if available
- Right panel with tabs: **Overview** · **People**
  - Overview: score, relevant jobs, technologies, personas (show dash if no data)
  - People tab: table of all saved contacts at that company

### Lists Page (`/lists`)

Table of all named lists.

**Columns:** list name · contact count · date created · last updated

- Clicking a list navigates to `/people` filtered by that list
- **+ New List** button adds an inline input to create a new empty list
- Delete icon on each row with a confirm dialog

---

## Part 4 — Data Flow

```
User opens a LinkedIn profile in Chrome
        ↓
Content script scrapes: name, title, company, photo, URL
        ↓
Service worker calls Apollo.io API → returns email + phone
        ↓
Sidebar displays contact data
        ↓
User types list name "CTO" and clicks Add
        ↓
Service worker POSTs to FastAPI: POST /api/contacts
        ↓
FastAPI upserts contact in PostgreSQL, creates list if new, links them
        ↓
Next.js dashboard fetches from FastAPI and displays everything
```

---

## Part 5 — UI Design Reference

All UI colours and style based on Apollo.io's dark theme.

| Token | Value | Usage |
|---|---|---|
| Page background | `#111827` | All pages |
| Card / table row | `#1f2937` | Panels, alternating rows |
| Border | `#374151` | Dividers |
| Text primary | `#f9fafb` | Names, headings |
| Text secondary | `#9ca3af` | Labels, metadata |
| Blue accent | `#0077b5` | LinkedIn blue, active nav |
| CTA button | `#1d4ed8` | Add to list, primary actions |
| Success toast | `#10b981` | Added to list |
| Warning toast | `#f59e0b` | Already in list |
| Error toast | `#ef4444` | Save failed |
| Font | Inter, system-ui | All text |
| Border radius | 8px | Cards, buttons, inputs |

---

## Part 6 — Edge Cases

| Scenario | Expected Behaviour |
|---|---|
| Apollo.io returns null | Show "Email not found" and "Phone not found" in grey — no crash |
| Contact added to same list twice | Toast: "Already in [List]" — no duplicate saved |
| LinkedIn changes their DOM | Update selectors only in `config.ts` |
| Apollo.io API key not set | Sidebar banner: "Set your Apollo API key in Settings" |
| Apollo.io returns 429 rate limit | Sidebar message: "Rate limit reached. Try again later." |
| No lists created yet | Sidebar: "No lists yet. Type a name above to get started." |
| No profile photo on LinkedIn | Show initials in a coloured circle |
| Company field is empty | Group under "Unknown Company" in Companies view |

---

## Part 7 — Setup Summary

1. **PostgreSQL** — create database `linkedin_sales`, run schema migrations
2. **Backend** — create Python virtual environment, install dependencies from `requirements.txt`, add `.env` file with `DATABASE_URL` and `APOLLO_API_KEY`, run with `uvicorn app.main:app --reload --port 8000`
3. **Chrome Extension** — `npm install`, `npm run build`, load the `dist/` folder as an unpacked extension in Chrome, paste Apollo.io API key in extension Settings popup
4. **Dashboard** — `npm install`, `npm run dev`, open `localhost:3000`

**Apollo.io API key:** Log in to apollo.io → Settings → Integrations → API → copy key.

---

## Out of Scope (v1)

- User authentication or login
- Email sending or outreach sequences
- CRM integrations (Salesforce, HubSpot, etc.)
- AI-generated content or summaries
- Automated LinkedIn scraping or bot behaviour
- Mobile layout
- Multi-user or team features
- Payments
