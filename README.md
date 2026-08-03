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
| [index.html](index.html) | Main — a Morning Call Sheet ritual (Running Order, Beliefs, Today/Tonight journals), now combined with four tabs: Morning Ritual (the above — its "Move" step links out to the 4th tab), Your System (Top Goals, daily/weekly Actions, Written/Visual/Mental Core Systems), Subconscious Reprogramming (Identity Shifting — Anchors/Future Self Vision/Challenges — plus quick links back into the Ritual tab), Fitness Studio (Templates/Equipment/Current Week with pre-workout coaching + post-workout review/comparison — its own data, separate from the standalone gym.html page of the same name), and Self-Care (a checklist, a Journal with Brain Dump/Gratitude/Day Planner templates, and a Meditations + Breathwork page with an animated breathing pacer — its own data, separate from the standalone selfcare.html page of the same name; the Ritual tab's Breathe/Sit/Page steps link straight into it) |
| [finance.html](finance.html) | Finances |
| [gym.html](gym.html) | Fitness Studio — progressive overload gym tracker |
| [entertainment.html](entertainment.html) | Media — Spotify/YouTube link gallery |
| [ent-favorites.html](ent-favorites.html) | Entertainment folder → Favorites — live aggregation of every item starred on Podcasts/Stories/Playlists/Entertainment, filterable by page |
| [ent-podcasts.html](ent-podcasts.html) | Entertainment folder → Podcasts — Learning/Photography-Videography/True Crime/Business sub-pages, auto-filled gallery |
| [ent-stories.html](ent-stories.html) | Entertainment folder → Stories — Horror/Spicy/Immersive Experience sub-pages, auto-filled gallery |
| [ent-playlists.html](ent-playlists.html) | Entertainment folder → Playlists — Chill/Binaural Beats/Dark-Gothic-Horror-Romance/EDM-Electronic/Fantasy sub-pages, auto-filled gallery |
| [ent-entertainment.html](ent-entertainment.html) | Entertainment folder → Entertainment — Gaming/Scary Videos/Vlog-Like sub-pages, auto-filled gallery |
| [braindump.html](braindump.html) | Brain Dump — freeform daily thoughts/emotions journal |
| [nutrition.html](nutrition.html) | Nutrition — My Kitchen / Grocery List |
| [household.html](household.html) | Household — Energy Beings roster, Inventory, Wishlist, Chores |
| [learning.html](learning.html) | Learning folder → Topics gallery — Articles/Books/Videos/Posts/Notes, plus each topic's own dedicated page |
| [learning-topic.html](learning-topic.html) | Learning folder → a single Topic's own page (`#<topicId>`) — a Questions database, then that topic's resources, each with a two-column Content/My Notes section generated on demand |
| [learning-dashboard.html](learning-dashboard.html) | Learning Dashboard — a standalone daily-study command center (Home, topic cards, a weekly Gather/Organize/Integrate/Teach workflow, a Daily Study Widget, Research Library, Knowledge Maps, Personal Frameworks, Master Notes with backlinks, Analytics, Settings) — its own crimson/pink theme, genuinely separate from learning.html |
| [selfcare.html](selfcare.html) | Self-Care — Journals, Meditations, Water tracker, Bucket List |
| [dreamboard.html](dreamboard.html) | Dream Board — a drag-and-drop vision board (checklists, calendar, photo/video grid, affirmations, and more) |
| [business.html](business.html) | Content Hub — content planning (Content/Ideas/Platforms/Resources), still hosting its own Writing Dashboard and YouTube Dashboard tabs too — unchanged; now grouped under the "Business" nav folder |
| [business-overview.html](business-overview.html) | Business Overview — the "Business" nav folder's landing page: live stats connecting Content Hub, Writing Dashboard, and YouTube Dashboard, plus a rollup of every task any of them own |
| [business-writing.html](business-writing.html) | Writing Dashboard — its own top-level page in the "Business" folder (a thin, same-origin embed of business.html's own Writing Dashboard tab — same data, same features, nothing duplicated) |
| [business-youtube.html](business-youtube.html) | YouTube Dashboard — its own top-level page in the "Business" folder (a thin, same-origin embed of business.html's own YouTube Dashboard tab — same data, same features, nothing duplicated) |
| [fitnessstudio.html](fitnessstudio.html) | Fitness Studio — its own new nav folder between Business Dashboard and Entertainment. Genuinely separate from gym.html's own "Fitness Studio" and index.html's own embedded Fitness Studio tab. Hero, Today's Workout, a Live Workout Dashboard, Goal Center, Workout Programs, Weekly Schedule, a consistency heatmap, an AI Fitness Coach, Settings (Black/Red/Pink theme), and a music slide-out panel connected live to the Playlists page |
| [aitech.html](aitech.html) | AI & Tech — an AI Models gallery + a linked Prompts database |
| [tasksnotes.html](tasksnotes.html) | Tasks & Notes — Links / Notes / Tasks |
| [mainpillar.html](mainpillar.html) | Main Pillar — gamified daily command center (Whoop biometrics, quest-style habits, tasks, AI journal/briefs, Weekly/Monthly/Year dashboards, Smart Goal Allocation, Favorites archive) |
| [topbar.js](topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |
| [sync.js](sync.js) | Shared Supabase cloud-sync helper |
| [glass-theme.css](glass-theme.css) / [glass-theme.js](glass-theme.js) | Reusable "dark glass" page theme — background glow, glass cards, glare cards, border-beam cards, a cover-photo hero, and drag-reorderable "moveable" sections. Extracted from fitnessstudio.html; drop `<link>`/`<script>` tags into a new page to get the same look/feel (see glass-theme.css's own header comment for how) |

Each app stores its own state in browser `localStorage`. No accounts, no server.

Main, Main Pillar, Household, and Brain Dump were briefly removed, then
restored — every page listed above is real, live, and reachable both from
its own nav pill and from inside Home (which embeds all of them without
touching their data).

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `index.html` — paste it into Claude if you want to rebuild that page yourself.
