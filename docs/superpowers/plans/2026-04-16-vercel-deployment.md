# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy GigBPM to Vercel with auto-deploy on every push to `main`.

**Architecture:** Push the static Vite build output (`/dist`) to Vercel's CDN via CLI project linking. GitHub integration handles all future deploys automatically after the one-time setup.

**Tech Stack:** Vercel CLI, Vite, Svelte 5, vite-plugin-pwa

**Spec:** `docs/superpowers/specs/2026-04-16-hosting-design.md`

---

## Chunk 1: CLI Setup and First Deploy

### Task 1: Install Vercel CLI

**Files:** none

- [ ] **Step 1: Check if Vercel CLI is already installed**

  Run: `vercel --version`

  - If output shows a version (e.g. `Vercel CLI 39.x.x`) → skip to Task 2
  - If `command not found` → continue to Step 2

- [ ] **Step 2: Install Vercel CLI globally**

  Run: `npm install -g vercel`

  Expected: installs without errors, `vercel --version` then returns a version string.

---

### Task 2: Authenticate with Vercel

**Files:** none  
**Note:** This step opens a browser. The user must complete it interactively — it cannot be automated.

- [ ] **Step 1: Log in**

  Run: `! vercel login`

  Vercel will prompt for an email or ask you to choose a provider (GitHub, GitLab, etc.). Complete the browser flow.

  Expected: terminal prints `Congratulations! You are now logged in.`

- [ ] **Step 2: Confirm login**

  Run: `vercel whoami`

  Expected: prints your Vercel username/email.

---

### Task 3: Link the Project to Vercel

**Files:** creates `.vercel/project.json` (gitignored)  
**Note:** `vercel link` is interactive. Answer the prompts as shown below.

- [ ] **Step 1: Run link from the project root**

  ```bash
  cd /Volumes/ExternalMBox/Workspace/gigbpm
  vercel link
  ```

- [ ] **Step 2: Answer the prompts**

  | Prompt | Answer |
  |--------|--------|
  | Set up and deploy? | `Y` |
  | Which scope? | Select your personal account |
  | Link to existing project? | `N` (create new) |
  | What's your project's name? | `gigbpm` |
  | In which directory is your code located? | `./` (default, press Enter) |
  | Want to modify these settings? | `N` |

  Vercel auto-detects Vite and sets:
  - Build command: `npm run build`
  - Output directory: `dist`
  - Install command: `npm install`

  Expected: `✅ Linked to <your-username>/gigbpm`

- [ ] **Step 3: Verify `.vercel/` is gitignored**

  Run: `cat .gitignore | grep vercel`

  Expected: `.vercel` appears in output (already added to `.gitignore` in the repo).

- [ ] **Step 4: Verify GitHub integration is active**

  Open the Vercel dashboard → select the `gigbpm` project → **Settings → Git**.

  Confirm: the repository `gigbpm` is listed under "Connected Git Repository". If it is not connected, click **Connect Git Repository** and authorise the Vercel GitHub App on your account/org. This is required for push-triggered auto-deploy to work.

---

### Task 4: First Production Deploy

**Files:** none (deploys existing `/dist` output from `npm run build`)

- [ ] **Step 1: Deploy to production**

  Run: `vercel --prod`

  Vercel runs `npm install && npm run build` remotely, then deploys `/dist` to CDN.

  Expected output (last lines):
  ```
  ✅ Production: https://gigbpm[-<hash>].vercel.app [3s]
  ```

  The exact URL depends on name availability — Vercel prints it at the end of the output. Copy it for the next step.

- [ ] **Step 2: Open the deployment URL in a browser and verify the app loads**

  The app should open on the setlist screen (dark background, "GigBPM" header).

---

### Task 5: Verify PWA Install and Offline Behaviour

- [ ] **Step 1: Open DevTools → Application → Service Workers**

  Confirm: service worker status is `activated and is running`, scope is `/`.

- [ ] **Step 2: Open DevTools → Application → Manifest**

  Confirm: name is `GigBPM`, icons load (192×192 and 512×512), display mode is `standalone`.

- [ ] **Step 3: Check Cache-Control headers**

  In DevTools → Network, reload the page and inspect:
  - `sw.js` → response header `Cache-Control: no-cache, no-store, must-revalidate`
  - Any file under `/assets/` → response header `Cache-Control: public, max-age=31536000, immutable`

- [ ] **Step 4: Test offline mode**

  DevTools → Network → throttle to `Offline`. Reload the page.

  Expected: app loads fully from Workbox precache. No network errors.

- [ ] **Step 5: Test mobile home-screen install**

  Open the deployment URL on an iPhone or Android device.

  - **iOS Safari:** tap the Share button → "Add to Home Screen" → "Add"
  - **Android Chrome:** tap the three-dot menu → "Add to Home screen" → "Add", or accept the install banner if it appears

  Launch the app from the home screen icon. Expected: app opens in standalone mode (no browser address bar or navigation chrome), dark background, portrait orientation.

- [ ] **Step 6: Test auto-deploy**

  Make a trivial change to a tracked file, commit, and push to `main`.

  ```bash
  # vite.config.ts is tracked and safe to touch
  echo "// deploy test $(date)" >> vite.config.ts
  git add vite.config.ts && git commit -m "chore: trigger vercel deploy test"
  git push origin main
  # Revert immediately after confirming deploy triggered
  git revert HEAD --no-edit
  git push origin main
  ```

  Watch the Vercel dashboard — a new deployment should start within ~10 seconds and complete within ~60 seconds.

---

## Post-Setup Reference

### Useful Vercel CLI commands

| Command | Purpose |
|---------|---------|
| `vercel` | Deploy to preview URL |
| `vercel --prod` | Deploy to production |
| `vercel ls` | List recent deployments |
| `vercel logs <url>` | View build/runtime logs |
| `vercel domains add <domain>` | Add a custom domain |

### Custom domain (future)

1. Buy domain (e.g. `gigbpm.app`)
2. Vercel dashboard → Project → Settings → Domains → Add
3. Update DNS at registrar to point to Vercel nameservers
4. TLS certificate issued automatically within minutes
