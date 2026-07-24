# Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [home.html](home.html) | Home — the hub. One continuous, scrollable page: a cover photo, a native Weekly Schedule, a native Subconscious Reprogramming section, then Main / Dream Board / Self-Care / Tasks & Notes / AI & Tech / Main Pillar / Household / Brain Dump embedded inline (each also still exists as its own standalone page below) |
| [index.html](index.html) | Main — Goals tracker (recurring habits + streaks, a freeform daily checklist, monthly/yearly goals with an allocation engine, a daily journal note) |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Fitness Studio — progressive overload gym tracker |
| [entertainment.html](entertainment.html) | Media — Spotify/YouTube link gallery |
| [braindump.html](braindump.html) | Brain Dump — freeform daily thoughts/emotions journal |
| [nutrition.html](nutrition.html) | Nutrition — My Kitchen / Grocery List |
| [household.html](household.html) | Household — Energy Beings roster, Inventory, Wishlist, Chores |
| [learning.html](learning.html) | Learning & Knowledge Hub — Topics gallery + Articles/Books/Videos/Posts/Notes |
| [selfcare.html](selfcare.html) | Self-Care — Journals, Meditations, Water tracker, Bucket List |
| [dreamboard.html](dreamboard.html) | Dream Board — a drag-and-drop vision board (checklists, calendar, photo/video grid, affirmations, and more) |
| [business.html](business.html) | Business Hub — content planning, a Writing Dashboard, and a YouTube channel-management dashboard |
| [aitech.html](aitech.html) | AI & Tech — an AI Models gallery + a linked Prompts database |
| [tasksnotes.html](tasksnotes.html) | Tasks & Notes — Links / Notes / Tasks |
| [mainpillar.html](mainpillar.html) | Main Pillar — gamified daily command center (Whoop biometrics, quest-style habits, tasks, AI journal/briefs, Weekly/Monthly/Year dashboards, Smart Goal Allocation, Favorites archive) |
| [system.html](system.html) | Build Your System — Top 10 Goals, a daily/weekly action system with a Minimum Viable Action per habit, Written/Visual/Mental Core Systems, and an Identity Shifting workspace (anchors, a Future Self Vision, install-through-action challenges) |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |
| [sync.js](sync.js) | Shared Supabase cloud-sync helper |

Each app stores its own state in browser `localStorage`. No accounts, no server.

Main, Main Pillar, Household, and Brain Dump were briefly removed, then
restored — every page listed above is real, live, and reachable both from
its own nav pill and from inside Home (which embeds all of them without
touching their data).

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `index.html` — paste it into Claude if you want to rebuild that page yourself.
