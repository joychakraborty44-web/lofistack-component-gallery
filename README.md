# LofiStack Component Gallery

Reusable UI components for LofiStack, each built in plain HTML, CSS and JavaScript with its own page.

There's no framework, build step or package install. It is a static site that deploys to Vercel as it is.

| Component | URL |
| --------- | --- |
| Gallery homepage | `/` |
| 01 · Agent Log Card | `/components/agent-log-card` |
| 02 · Campaign Performance Snapshot | `/components/campaign-performance` |
| 03 · Pricing Comparison Card | `/components/pricing-comparison` |
| 04 · Lead Funnel Analytics | `/components/lead-funnel-analytics` |

## Project structure

```
.
├── index.html                          # Gallery homepage
├── 404.html                            # Not-found page (served automatically by Vercel)
├── components/
│   ├── agent-log-card/
│   │   └── index.html                  # 01 · Agent Log Card  → /components/agent-log-card
│   ├── campaign-performance/
│   │   └── index.html                  # 02 · Campaign Performance Snapshot → /components/campaign-performance
│   ├── pricing-comparison/
│   │   └── index.html                  # 03 · Pricing Comparison Card → /components/pricing-comparison
│   └── lead-funnel-analytics/
│       └── index.html                  # 04 · Lead Funnel Analytics → /components/lead-funnel-analytics
├── assets/
│   ├── gallery.css                     # Shared nav, footer and homepage styles (all classes prefixed lsg-)
│   ├── gallery.js                      # Scales the live previews on the homepage
│   ├── agent-log-card.css / .js        # Copy of the Agent Log Card, for the Week 02 log on the homepage
│   └── favicon.svg
├── vercel.json                         # Clean URLs, redirects, security headers
├── .gitignore
├── .vercelignore
└── README.md
```

Each component page is self-contained. The component's CSS and JavaScript live inside its own `index.html`. The shared `gallery.css` only adds the navigation bar and footer around it.

## Run it locally

Use a small local web server. Opening the files by double-clicking won't work, because the links use site paths like `/components/agent-log-card`.

With Node.js installed:

```bash
npx serve .
```

Then open http://localhost:3000.

Or with Python:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

### 1. Push to GitHub

Create an empty repository on GitHub, for example `lofistack-component-gallery`. Don't add a README, `.gitignore` or licence there. Then, from this folder:

```bash
git init
git add .
git commit -m "Initial LofiStack Component Gallery"
git branch -M main
git remote add origin https://github.com/<your-username>/lofistack-component-gallery.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com/new and import the GitHub repository.
2. **Framework Preset:** `Other`.
3. **Build Command:** leave empty. **Output Directory:** leave empty (the repository root is the site).
4. Click **Deploy**.

Every push to `main` then redeploys the site automatically.

You can also deploy from the command line with `npx vercel`, and `npx vercel --prod` for production.

## Adding a new component

1. Create `components/<slug>/index.html`. Copying an existing component page is the quickest start, since it already has the navigation bar, footer and embed script.
2. Add a link to it in the navigation bar (`<nav class="lsg-links">`) on every page: `index.html`, `404.html` and each component page.
3. Add a card for it to the grid in `index.html`. Point the preview `<iframe>` at `/components/<slug>?embed`.
4. Update the previous/next links in the component page footers.

Adding `?embed` to any component URL hides the gallery chrome and shows only the component. The homepage previews use this.

## Notes

- **Sample data:** the Campaign Performance Snapshot, Pricing Comparison Card and Lead Funnel Analytics show example figures only; each page labels them as such.
- **Fonts:** the Agent Log Card loads its typefaces from Google Fonts. Everything else uses system fonts.
- **Private files:** `CLAUDE.md`, `logs/` and `submissions.md` hold the private LofiStack Agent Log. They are listed in `.gitignore` and `.vercelignore`, so they are not pushed or deployed.
