# GigBPM Hosting Design

**Date:** 2026-04-16  
**Status:** Approved

## Context

GigBPM is a pure static PWA — 192 KB total output, no backend, no API calls, no environment variables. All data lives in `localStorage`. The app needs a host that provides:

- HTTPS (mandatory for service workers and PWA install)
- SPA routing fallback (serve `index.html` for unknown paths)
- Auto-deploy on `git push main`
- Free tier sufficient for "ship and see" scale

## Decision: Vercel

Vercel is the chosen host. It auto-detects Vite projects, provides a global CDN, handles HTTPS automatically, and deploys on every push to `main`. PRs get preview deployment URLs at no extra cost. Free tier includes 100 GB bandwidth/month — sufficient until the app proves popular with musicians.

## Configuration

### `vercel.json` (repo root)

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
    },
    {
      "source": "/workbox-(.*)\\.js",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

**Rewrite rule:** Svelte uses client-side routing. Without the rewrite, navigating directly to any route returns a 404. The wildcard rewrite sends all unmatched paths to `index.html`, letting the Svelte router take over.

**Service worker headers:** `sw.js` and the Workbox runtime (`workbox-*.js`) must never be cached by the browser. If they are cached with a long TTL, deployed updates won't reach users — the old service worker stays active and continues serving stale precached assets. `no-store` prevents any caching; `must-revalidate` is belt-and-suspenders.

**Asset headers:** Vite content-hashes all files in `assets/` (e.g., `index-BxK2a9f1.js`). The filename changes on every build, so cached copies are never stale. `max-age=31536000, immutable` tells browsers and CDN edges to cache these forever and never revalidate — maximum performance, zero risk.

## Deployment Flow

1. **One-time setup:** `vercel login` → `vercel link` (connects GitHub repo, sets build command `npm run build`, output dir `dist`)
2. **Every push to `main`:** Vercel detects the push, runs `npm run build`, deploys `/dist` to CDN
3. **Every PR:** Vercel creates a preview URL (e.g., `gigbpm-git-feature-xyz.vercel.app`) for testing before merge
4. **Custom domain (future):** Add domain in Vercel dashboard → update DNS to Vercel nameservers → TLS issued automatically

## What Vercel Handles Automatically

- TLS certificate provisioning and renewal
- HTTP → HTTPS redirect
- Brotli/gzip compression
- Global CDN distribution
- Build caching (faster rebuilds)
- `manifest.webmanifest` served with correct MIME type (`application/manifest+json`)

## Alternatives Considered

| Option | Why not chosen |
|---|---|
| Cloudflare Pages | Better bandwidth limits but rougher DX; viable migration path if traffic grows |
| GitHub Pages | SPA routing requires 404.html hack; no custom HTTP headers for service worker cache control |
| AWS S3 + CloudFront | Overkill for current scale; no git-push auto-deploy without additional setup |

## Verification

After the first deploy:
1. Visit `gigbpm.vercel.app` — app loads and is functional
2. Open DevTools → Application → Service Workers — service worker registered with correct scope
3. Open DevTools → Application → Manifest — manifest parsed, icons loaded
4. Install to home screen on mobile — app opens in standalone mode (no browser chrome)
5. Toggle airplane mode — app still fully functional (Workbox precache serves all assets offline)
6. Deploy a change — within ~30 seconds the new version is live; autoUpdate prompts silently refresh
