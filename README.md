# Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FRowanThistlebrooke%2FYTdashh1)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [home.html](home.html) | Home — the hub. One continuous, scrollable page: a cover photo, a native Weekly Schedule, a native Subconscious Reprogramming section, then Dream Board / Self-Care / Tasks & Notes / AI & Tech embedded inline (each also still exists as its own standalone page below) |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Fitness Studio — progressive overload gym tracker |
| [entertainment.html](entertainment.html) | Media — Spotify/YouTube link gallery |
| [nutrition.html](nutrition.html) | Nutrition — My Kitchen / Grocery List |
| [learning.html](learning.html) | Learning & Knowledge Hub — Topics gallery + Articles/Books/Videos/Posts/Notes |
| [selfcare.html](selfcare.html) | Self-Care — Journals, Meditations, Water tracker, Bucket List |
| [dreamboard.html](dreamboard.html) | Dream Board — a drag-and-drop vision board (checklists, calendar, photo/video grid, affirmations, and more) |
| [business.html](business.html) | Business Hub — content planning, a Writing Dashboard, and a YouTube channel-management dashboard |
| [aitech.html](aitech.html) | AI & Tech — an AI Models gallery + a linked Prompts database |
| [tasksnotes.html](tasksnotes.html) | Tasks & Notes — Links / Notes / Tasks |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |
| [sync.js](sync.js) | Shared Supabase cloud-sync helper |

Each app stores its own state in browser `localStorage`. No accounts, no server.

Main (the old Goals-tracker home page), Main Pillar, Household, and Brain
Dump were removed per an explicit request — Home (above) is now the hub.

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate the original `index.html` home page — kept for history, though that page was later removed (see above); paste it into Claude if you want to rebuild something similar yourself.
