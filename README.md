# LofiStack Component Gallery

Thirty production-ready UI components for marketing, CRM, ads, SEO and AI teams — each a typed **React** component with its own page, live demo, props reference and copyable usage.

**Live:** https://lofistack-component-gallery.vercel.app

Built with **React 19**, **TypeScript**, **Tailwind CSS v4** and **Vite**. One small animation dependency: [`motion`](https://motion.dev) — used for the things CSS can't do well (layout re-ordering when lists sort or filter, exit animations, shared sliding indicators). Charts are hand-built SVG; there are no chart or UI-kit libraries.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build
```

## The 30 components

| # | Component | Category | URL |
|---|-----------|----------|-----|
| 01 | Agent Log Card | AI & Automation | `/components/agent-log-card` |
| 02 | Campaign Performance Snapshot | Ads & Campaigns | `/components/campaign-performance` |
| 03 | Pricing Comparison Card | Sales & Reporting | `/components/pricing-comparison` |
| 04 | Lead Funnel Analytics | Analytics | `/components/lead-funnel-analytics` |
| 05 | KPI Metrics Dashboard | Analytics | `/components/kpi-metrics-dashboard` |
| 06 | AI Prompt Card | AI & Automation | `/components/ai-prompt-card` |
| 07 | Client Overview Card | CRM & Clients | `/components/client-overview-card` |
| 08 | Task Progress Board | Operations | `/components/task-progress-board` |
| 09 | Ad Creative Performance | Ads & Campaigns | `/components/ad-creative-performance` |
| 10 | SEO Ranking Tracker | SEO | `/components/seo-ranking-tracker` |
| 11 | Conversion Rate Card | Analytics | `/components/conversion-rate-card` |
| 12 | Activity Timeline | CRM & Clients | `/components/activity-timeline` |
| 13 | Campaign Status Card | Ads & Campaigns | `/components/campaign-status-card` |
| 14 | Lead Source Breakdown | Analytics | `/components/lead-source-breakdown` |
| 15 | Revenue Growth Chart | Analytics | `/components/revenue-growth-chart` |
| 16 | Appointment Pipeline | CRM & Clients | `/components/appointment-pipeline` |
| 17 | Workflow Automation Card | AI & Automation | `/components/workflow-automation-card` |
| 18 | AI Agent Status Panel | AI & Automation | `/components/ai-agent-status-panel` |
| 19 | Notification Center | Operations | `/components/notification-center` |
| 20 | Client Health Score | CRM & Clients | `/components/client-health-score` |
| 21 | Ad Spend Budget Tracker | Ads & Campaigns | `/components/ad-spend-budget-tracker` |
| 22 | Form Conversion Card | Analytics | `/components/form-conversion-card` |
| 23 | SEO Audit Scorecard | SEO | `/components/seo-audit-scorecard` |
| 24 | Integration Status Grid | Operations | `/components/integration-status-grid` |
| 25 | Team Member Performance | Operations | `/components/team-member-performance` |
| 26 | Revenue Goal Tracker | Sales & Reporting | `/components/revenue-goal-tracker` |
| 27 | Webhook Event Monitor | Operations | `/components/webhook-event-monitor` |
| 28 | AI Usage Analytics | AI & Automation | `/components/ai-usage-analytics` |
| 29 | Customer Journey Map | CRM & Clients | `/components/customer-journey-map` |
| 30 | Weekly Marketing Report | Sales & Reporting | `/components/weekly-marketing-report` |

All demo data is example data with fictional clients, labelled on every page.

## Project structure

```
src/
├── main.tsx, App.tsx          # entry, routes, page transitions, ⌘K palette
├── styles.css                 # Tailwind + design tokens (light & dark), elevation, textures
├── lib/
│   ├── router.tsx             # tiny History-API router with scroll restoration
│   ├── hooks.ts               # reduced motion, preview mode, intervals, count-up, clipboard…
│   └── format.ts              # money / number / date formatting
├── ui/index.tsx               # accessible primitives: Segmented, Tabs, Tooltip, CountUp, CopyButton, Skeleton, Reveal…
├── gallery/
│   ├── registry.ts            # metadata for the 30 components + lazy loaders + module types
│   ├── Home.tsx               # homepage: search, category filters, live previews, Week 02 log
│   ├── ComponentPage.tsx      # component page: live stage, props, usage, prev / next
│   ├── Shell.tsx, load.tsx    # header, theme toggle, palette, footer, module loading, live preview
│   └── Week02.tsx             # the Week 02 Agent Log (content kept verbatim)
└── components/<slug>/         # one folder per component
    ├── <Name>.tsx             # the reusable component (named export, typed props)
    ├── data.ts                # types + example data
    └── index.tsx              # `Demo` (page / preview modes) + `docs`
```

Each component page loads only its own code (route-level code splitting). Homepage cards render the real component, scaled down, once they scroll into view.

## Using a component

Every component is a named export with typed props — see its page for the full props table and a copyable example:

```tsx
import { AgentLogCard } from "./components/agent-log-card/AgentLogCard";

<AgentLogCard
  task="Build the Agent Log Card"
  agent="Claude Code · Opus 5.5"
  type="UI Component"
  date="2026-09-25"
  status="draft"
  prompt="The exact prompt…"
  result={<p>What the agent produced…</p>}
/>
```

## Design system

- **Tokens** live in `src/styles.css` as CSS variables with light and dark values, exposed to Tailwind (`bg-surface`, `text-ink-2`, `border-line`, `elev-1…4`…). Each component layers its own palette on top as CSS variables, so components keep distinct identities on a shared foundation.
- **Dark mode** follows the OS by default; the header toggle saves a preference. `?theme=dark` / `?theme=light` forces one for a single view.
- **Responsive by container**: components use Tailwind container queries, so they adapt to the space they're placed in — desktop, tablet and 375px phones without horizontal scrolling.

## Accessibility & motion

- Keyboard support throughout (radio groups and tabs with arrow keys, Escape closes popovers and dialogs, focus is returned), visible focus rings, labelled controls, and data tables behind charts for screen readers.
- `prefers-reduced-motion` is respected everywhere: motion transforms become instant, decorative loops stop, live feeds keep updating data without animating, and auto-playing timers can be paused.

## Adding a component

1. Create `src/components/<slug>/` with the component, `data.ts` and an `index.tsx` that exports `Demo` and `docs` (see `ComponentModule` in `src/gallery/registry.ts`).
2. Add its metadata and loader to `COMPONENTS` / `loaders` in `registry.ts`. Navigation, search, filters, previews and prev/next links update automatically.

## Deploy

Vercel builds the project with `npm run build` and serves `dist/` (see `vercel.json`, which also adds the SPA fallback, redirects, security headers and long-term caching for hashed assets). Pushing to `main` deploys to production.

## Private files

`CLAUDE.md`, `logs/` and `submissions.md` hold the private LofiStack Agent Log. They are listed in `.gitignore` and `.vercelignore`, so they are never pushed or deployed.
