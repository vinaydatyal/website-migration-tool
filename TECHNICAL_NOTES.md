# Technical Developer Notes: Website Migration Tool

## 1. Project Overview & Architecture
The **Website Migration Tool** is a full-stack SEO parity and URL redirect mapping suite designed for complex website migrations (domain changes, CMS migrations, site restructures).

### Core Stack
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, React Router v7, Lucide Icons, Sonner toasts, Recharts, LocalForage (IndexedDB).
  - Dev server port: `4000` (per project rule: `http://localhost:4000`).
  - API Proxy: `/api` forwarded to `http://localhost:3001`.
- **Backend**: Node.js, Express (running on port `3001`).
  - Web scraping & crawler integration: Puppeteer (concurrency-managed, timeout-resilient).
  - Integrations: Google Search Console (OAuth & Search Console API), DNS/SSL auditor (`dns/promises`, `tls`), robots.txt parser, XML sitemap validator, PDF generation.
  - Storage: IndexedDB via LocalForage for client-side project persistence and snapshots; optional Supabase integration for cloud sync.

---

## 2. Directory & Component Breakdown

```
Website Migration Tool/
├── server/
│   └── index.js                   # Express server (Port 3001) - Puppeteer, DNS/SSL, Robots, Sitemaps, PDF, GSC
├── src/
│   ├── components/
│   │   ├── ArchitectureView.tsx    # Visual system/site structure view
│   │   ├── CrawlDataView.tsx       # Raw crawl data inspection & filtering
│   │   ├── DashboardOverview.tsx   # Migration KPI summary cards & graphs
│   │   ├── DataSourcesModal.tsx    # Source ingestion (CSV, Live Crawl, GSC)
│   │   ├── DeltaReportModal.tsx    # Incremental update comparison
│   │   ├── DomainSwapModal.tsx     # One-click source/target domain replacement
│   │   ├── ExportModal.tsx         # Redirect rules (Nginx, Apache, Cloudflare, CSV, PDF)
│   │   ├── HistorySidebar.tsx      # Version history & undo/redo tracking
│   │   ├── ImportMapModal.tsx      # Existing redirect map imports
│   │   ├── InfrastructureAuditorView.tsx # DNS, SSL, Robots.txt, Sitemap verification
│   │   ├── KnowledgeBaseSidebar.tsx# Migration playbooks & SEO guidance
│   │   ├── LinkAuditorView.tsx     # Internal link & anchor text validation
│   │   ├── MigrationChecklist.tsx  # Interactive migration launch checklist
│   │   ├── Navbar.tsx              # Navigation, project selector, action triggers
│   │   ├── ProjectManagerModal.tsx # Project management & IndexedDB switching
│   │   ├── RegexSynthesizerView.tsx# Automatic regex pattern generator for redirects
│   │   ├── RestartPipelineModal.tsx# Pipeline reset and re-matching
│   │   ├── SeoParityView.tsx       # Meta title, description, H1, canonical parity auditor
│   │   ├── UploadZone.tsx          # Initial file drag & drop onboarding
│   │   ├── UrlMappingTable.tsx     # Virtualized URL mapping table with overrides
│   │   ├── UrlMappingTableRow.tsx  # URL mapping row with inline status ping
│   │   └── ValidationView.tsx      # Pre-launch and post-launch validation suites
│   ├── types/
│   │   └── migration.ts            # Type definitions for CrawlEntry, UrlMapping, Stats, etc.
│   ├── utils/
│   │   ├── matcher.ts              # Async matching algorithm (exact path, slug, Levenshtein, semantic)
│   │   ├── parityAuditor.ts        # SEO parity discrepancies & scoring
│   │   ├── exporters.ts            # Format converters for Apache, Nginx, CSV, Cloudflare
│   │   ├── storage.ts              # LocalForage / IndexedDB persistence layer
│   │   └── text.ts                 # String distance & normalization utilities
│   ├── App.tsx                     # Top-level state orchestrator and routing
│   └── main.tsx                    # React DOM entry point
├── vite.config.ts                  # Vite config (Port 4000, /api proxy to localhost:3001)
├── package.json                    # Project metadata and run scripts
└── TECHNICAL_NOTES.md              # Technical Developer Notes (continuously maintained)
```

---

## 3. Development Setup & Port Rules
- **Frontend**: Must run on `http://localhost:4000`.
- **Backend**: Runs on `http://localhost:3001`.
- **Scripts**:
  - `npm run dev`: Runs both frontend and backend concurrently.
  - `npm run dev:frontend`: Starts Vite on port 4000.
  - `npm run dev:backend`: Starts Express backend on port 3001.

---

## 4. Current Work & Status
- **Pending Git Changes**:
  - `src/components/ExportModal.tsx`: Converted `/api/generate-pdf` from absolute to relative URL to use Vite proxy.
  - `src/components/InfrastructureAuditorView.tsx`: Converted DNS, robots, and sitemap check endpoints to relative URLs.
  - `src/components/UrlMappingTableRow.tsx`: Converted `/api/ping-url` to relative URL.
  - `src/components/ErrorBoundary.tsx`: Added global ErrorBoundary with recovery actions (reload, clear cache & reset, home).
  - `src/main.tsx`: Wrapped root application in `GlobalErrorBoundary` and added startup purge for legacy oversized `uploadZone_draft`.
  - `src/components/UploadZone.tsx`: Excluded `sourceEntries` and `targetEntries` from `uploadZone_draft` in `localStorage`; added QuotaExceededError purge handler.
  - `src/contexts/ThemeContext.tsx`, `DataSourcesModal.tsx`: Guarded `localStorage` against `SecurityError` and storage quota limits.
- **Server Status**:
  - Production deployment live on Railway.

---

## 5. Blank Screen Diagnostics & Root Causes
When users encounter a blank/black screen at `.../untitled-project/dashboard`:

### Root Causes
1. **`QuotaExceededError` in `UploadZone.tsx` (CONFIRMED)**:
   - `UploadZone.tsx` was saving the full `sourceEntries` and `targetEntries` arrays into `localStorage.setItem('uploadZone_draft', ...)`.
   - Screaming Frog crawl files contain thousands of detailed URL objects with inlinks, outlinks, canonicals, H1s, titles, and word counts.
   - This easily exceeded the browser's hard **5MB `localStorage` limit**, throwing an unhandled `QuotaExceededError: Failed to execute 'setItem' on 'Storage'`.
   - Because it ran inside a top-level `useEffect` in React without a try/catch or error boundary, React unmounted the entire app tree into a blank black screen.
2. **Stale Deployment Chunk Hash**:
   - When new builds are pushed to production (Railway), Vite assigns new content hashes to JS chunks. If a browser has cached the previous `index.html` referencing an old chunk that was deleted on the server, a 404/ChunkLoadError occurs, preventing the React bundle from running.
3. **Storage Access Permission Restrictions**:
   - Browser extensions (privacy/adblockers) or third-party storage restrictions can cause `localStorage.getItem()` or `localStorage.setItem()` to throw a `SecurityError: The operation is insecure`, crashing React if unguarded.

### Implemented Safeguards
- **Excluded Large Datasets from `localStorage`**: `UploadZone.tsx` now only stores lightweight configuration (URLs, project name, crawl settings) in `localStorage`. Raw crawl datasets belong exclusively in IndexedDB.
- **Auto-Purge on Quota Error**: If `localStorage.setItem` ever throws a `QuotaExceededError`, `uploadZone_draft` is automatically removed to free space.
- **Startup Self-Healing in `main.tsx`**: Checks on launch for legacy oversized drafts (>500KB) and removes them before mounting React.
- **Global Error Boundary**: `<GlobalErrorBoundary>` catches any uncaught runtime exceptions and displays a recovery UI with "Reload Page" and "Clear Cache & Reset" options.
- **Vite Chunk Preload Listener**: Added `window.addEventListener('vite:preloadError')` in `main.tsx` to automatically reload the page if a user attempts to load a chunk replaced by a new deployment.
- **Centralized Safe Storage Utility**: Implemented `src/utils/safeStorage.ts` enforcing a 250 KB per-key ceiling on `localStorage`.

---

## 6. Guidelines to Prevent Storage & Blank Screen Failures
1. **Strict Storage Tiering**:
   - `localStorage`: Only for primitive, low-cardinality state (< 50 KB): active theme, user preferences, last visited project ID.
   - `IndexedDB` (via `LocalForage`): All structured data, crawl rows, URL mappings, redirect lists, and snapshot histories.
2. **Never Call Raw `localStorage.setItem` for Complex Objects**:
   - Use `safeStorage.setItem()` from `src/utils/safeStorage.ts`. It prevents serialization of payloads > 250 KB, captures quota errors, and protects React lifecycle hooks from uncaught crashes.
3. **Always Keep `GlobalErrorBoundary` Active**:
   - Never remove `GlobalErrorBoundary` from `main.tsx`. Any unexpected rendering fault must be caught and presented with a user-facing reset option rather than unmounting the React root.

---

## 7. Crawl Metrics & Progress Tracking (Discovered vs. Crawled)
Previously, the crawler UI only showed a transient `0 / 0 pages` counter while discovering sitemaps, and once finished, simply replaced the view with `{sourceEntries.length} URLs Crawled`, hiding how many URLs were in the sitemap/queue versus how many were actually crawled.

### Enhancements
1. **Real-Time Queue & Discovered Counters**:
   - `server/crawler.js`: Tracks `visited.size + toVisit.length` as `totalDiscovered`, along with `queued` (`toVisit.length`) and `crawledCount`.
   - Replaced initial misleading `0 / 0 pages` with an active `Scanning Sitemaps...` state that transitions into `{current} / {total} pages` as URLs are queued from XML sitemaps or link extraction.
2. **Comprehensive Crawl Summary Card**:
   - When a crawl finishes, instead of merely showing a flat count, the UI displays a dual-metric summary card:
     - **Pages in Crawl**: Total discovered in sitemaps and site links (`totalDiscovered`).
     - **Actually Crawled**: Pages visited and parsed (`crawledCount`).
     - **Coverage Status**: Displays `100% Crawled` if all discovered pages were fetched, or `Limit Capped (N max)` if the crawl stopped due to the `maxPages` limit.
     - **Contextual Notice**: If discovered pages were left in queue uncrawled, a helpful warning explains: `⚠️ {queuedCount} discovered pages were left uncrawled because the crawl reached your limit of {maxPages} pages.`
3. **Components Updated**:
   - `server/crawler.js`: Returns `{ results, summary }` with `totalDiscovered`, `crawledCount`, `queuedCount`, `maxPagesReached`, and `maxPages`.
   - `server/index.js`: Dispatches the structured `summary` object in the SSE `done` event.
   - `src/components/UploadZone.tsx` & `src/components/DataSourcesModal.tsx`: Render the real-time queue badge and dual-metric completion card for both Source (Old Site) and Target (New Site) crawls.

---

## 8. Crawler Resilience & "Execution Context Destroyed" Prevention
During concurrent site crawling (e.g., e-commerce sites like `blinkesim.com` with multilingual routing, currency selectors, trailing-slash redirects, or anti-bot protections), crawls previously failed with:
`Error crawling <URL>: Execution context was destroyed, most likely because of a navigation.`

### Root Cause Analysis
1. **In-Browser Execution Context Holding**:
   - `workerPage.evaluate(() => new Promise(r => setTimeout(r, 1500)))` previously executed inside the page's JavaScript environment.
   - When a site issues a trailing-slash 301/302, localized redirect (`/en/pais/` -> `/en/country/`), or client-side router transition while this evaluate call is pending, Chromium destroys the execution context of the previous document, immediately throwing an unhandled `Execution context was destroyed` error.
2. **Race Condition in `evaluate` Metadata Extraction**:
   - If `workerPage.evaluate()` was called right as a client-side script or meta refresh triggered navigation, the context was destroyed without retry or recovery.
3. **Bot Challenge & Headless User-Agent Detection**:
   - Headless Chrome's default User-Agent (`HeadlessChrome/...`) triggers anti-bot challenges and redirect loops on security-hardened portals (Cloudflare, Wordfence).
4. **Crawl Result Drops**:
   - Any thrown error in the crawl loop was previously logged and discarded without recording the URL into `results`, leading to discrepancies between `crawledCount` and returned datasets.

### Architectural Solution & Safeguards
1. **Zero-Lock Node.js Delays**:
   - Replaced in-browser `evaluate(setTimeout)` with a Node.js-level sleep (`new Promise(r => setTimeout(r, 600))`) paired with `workerPage.waitForNetworkIdle({ idleTime: 500, timeout: 2500 })`. This gives asynchronous SPAs time to hydrate without tying execution to the browser's transient V8 context.
2. **Self-Healing `safeExtractMetadata`**:
   - Wrapped DOM evaluation in a 3-tier retry loop. If `Execution context was destroyed` or `navigation` is caught, it waits for `waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 })` and re-evaluates the fresh document.
3. **CDP-Level HTML Parsing Fallback (`extractMetadataFromHtml`)**:
   - If in-page JS evaluation fails repeatedly, the crawler calls `workerPage.content()` to pull the raw HTML snapshot over Chrome DevTools Protocol (CDP) and parses `<title>`, `<meta name="description">`, `<h1>`, `<h2>`, word count, and internal links using regex/string parsing without running code in the browser context.
4. **Desktop User-Agent & Navigation Headers**:
   - Configured modern Chrome desktop User-Agent (`Chrome/122.0.0.0`) and standard client headers (`Accept-Language`, `Sec-Ch-Ua`, platform headers) on every worker page, preventing anti-bot redirect loops.
5. **Redirect Tracking & Visited Deduplication**:
   - Normalizes and compares `workerPage.url()` with the requested URL. Redirect targets are added to `visited` to prevent duplicate crawls, and `redirectUrl` is stored in results.
6. **Guaranteed URL Retention**:
   - The outer `catch (error)` block ensures any page encountering an issue is still registered in `results` with its status code or error metadata, preventing dropped pages.

---

## 9. Crawl Persistence & Single-Site Audit Architecture ("0 URLs" Bug Fix)
Users reported: *"why old crawls are not being saved?"* and the Project Manager modal displayed:
`Blink E-sim ACTIVE | Saved: Sep 11, 5:56 PM • 0 URLs`

### Root Cause Analysis
1. **Mandatory Dual-Dataset Gate in `UploadZone`**:
   - The button to proceed and finalize the project (`handleStartAnalysis`) was strictly conditioned on `!sourceEntries || !targetEntries`.
   - When a user crawled only the Source website (`https://blinkesim.com`), `targetEntries` remained `null`. The button remained permanently disabled, leaving the user unable to proceed, create the migration pipeline, or save the project.
2. **Component-Isolated React State**:
   - When the live crawler completed, `UploadZone` stored `entries` solely in local React state (`const [sourceEntries, setSourceEntries] = useState(...)`). It was never persisted to IndexedDB or passed up to the global application state until both datasets were submitted.
3. **Empty Project Auto-Save Overwrites**:
   - In `App.tsx`, whenever a project name was set (e.g. "Blink E-sim"), the debounced auto-saver wrote to the database. Since `sourceEntries` and `targetEntries` had not been submitted by `UploadZone`, it saved an empty project with `sourceEntries: []` and `totalSourceUrls: 0`.
4. **Cloud-Only Storage Single Point of Failure**:
   - `storage.ts` previously bypassed local browser IndexedDB entirely and called `supabase.from('migrationProjects').upsert(...)`. If network latency occurred, anon key limits applied, or connection drops happened, the data was never retained locally.

### Implemented Solutions
1. **Offline-First Dual Persistence (`localforage` + Supabase)**:
   - Configured `localforage` instances (`MigrateShieldDB` / `migrationProjects` and `projectSnapshots`) to store projects and crawl records directly in browser IndexedDB first.
   - Saves succeed instantly with zero quota errors (unlike 5MB `localStorage`) and work completely offline. Supabase cloud synchronization runs asynchronously in the background.
2. **Single-Site & Source-Only Audit Support**:
   - Removed the artificial requirement for both source and target datasets to exist before proceeding.
   - Users can now audit a single site (`Audit Source Site (X URLs)` or `Audit Target Site (X URLs)`). Unmapped source URLs are populated into mappings with baseline risk scoring, enabling full access to Crawl Data View, Architecture View, Infrastructure Auditor, and Exports without waiting for a staging site.
3. **Immediate Uncommitted Crawl Caching**:
   - As soon as a live crawl finishes or a file is parsed in `UploadZone`, the raw entries are cached into `localforage` (`uploadZone_sourceEntries` / `uploadZone_targetEntries`). If a user accidentally closes or reloads the tab, the crawled URLs are instantly restored.
4. **Immediate Project Persistence in Pipeline**:
   - `runPipeline` immediately saves the project with the full dataset into IndexedDB upon completing analysis, guaranteeing that the Project Manager displays the accurate URL count (e.g. `• 683 URLs`).
5. **Bidirectional DataSourcesModal Support**:
   - `DataSourcesModal` now passes a `type` parameter (`'source'` or `'target'`), allowing users to update their source audit or add staging target data at any time without data corruption.

---

## 10. Crawler Concurrency Pool Refactoring (`RangeError: Maximum call stack size exceeded` Fix)
During extensive multi-lingual / currency variant crawls (e.g. `blinkesim.com` with `?wmc-currency=EUR` variants):
```
Exception in PromiseRejectCallback:
file:///app/server/crawler.js:517
RangeError: Maximum call stack size exceeded
```

### Root Cause Analysis
1. **Recursive `processNext` Function Chaining**:
   - The worker pool previously relied on recursive function calls: `processNext()` calling itself when an item failed `shouldCrawl`, when a worker finished, or when spawning concurrent workers.
   - For websites with extensive internal link structures (e.g. currency selectors, country filters, footers with 2,000+ links), `toVisit` accumulated thousands of links that had already been visited or were filtered.
   - `processNext()` synchronously popped invalid/visited items and immediately called `processNext()` again in the same tick without awaiting or yielding to the event loop.
   - When the synchronous recursion chain exceeded Node.js V8 call stack limits (~10,000 frames), V8 threw `RangeError: Maximum call stack size exceeded`.
2. **Missing Queue Deduplication (`enqueued` Set)**:
   - Previously, discovered links were only checked against `visited.has(nLink)`. If multiple pages linked to the same URL, that URL was queued into `toVisit` repeatedly before being crawled, causing `toVisit` to bloat into tens of thousands of duplicate entries.

### Implemented Solutions
1. **Bounded Iterative Worker Pool ($O(1)$ Stack Depth)**:
   - Replaced recursive `processNext()` chaining with long-running, iterative `runWorker` `while` loops.
   - Workers run concurrently using `Promise.all(workers)` with zero recursion. Call stack depth remains constant $O(1)$ throughout the entire crawl lifecycle.
   - Filtered/visited candidates are skipped in an internal iterative `while (toVisit.length > 0)` loop rather than via recursive calls.
   - Idle workers await briefly with `setTimeout` if other workers are active, terminating cleanly once all workers are idle and the queue is completely drained.
2. **In-Flight Queue Deduplication (`enqueued` Set)**:
   - Added an `enqueued` Set in `crawlSite` tracking all URLs currently in the queue or already processed.
   - Newly discovered links from HTML pages and sitemaps are checked against `!enqueued.has(nLink)` before insertion, preventing exponential queue inflation.
3. **Guarded Recursive Sitemap Parsing**:
   - Added `depth <= 5` and a `fetched` URL Set to `fetchSitemap` to prevent infinite loops on circular or malformed sitemap indexes.

---

## 11. GSC & GA4 OAuth Connection Fixes

### Root Causes (both `UploadZone.tsx` and `DataSourcesModal.tsx`)

1. **Popup Blocked by Browser**:
   - The previous `handleOAuth` called `fetch('/api/gsc/auth?service=...')` **before** calling `window.open()`. Modern browsers require popups to be opened synchronously during a direct user click event. Waiting for the async `fetch` to resolve caused the browser to silently block the popup — no error is thrown, the window simply never appears.

2. **Redirect URI Mismatch**:
   - `server/gsc.js` hardcoded `REDIRECT_URI` to `http://localhost:3001/api/auth/google/callback`. In Railway production, the app serves traffic through the Railway domain. The OAuth popup redirected to `3001` (backend port), but the `window.opener` lived on a different origin (`4000` or the Railway hostname), causing `postMessage` to fail silently.
   - Additionally, the Google Cloud Console OAuth client must have `https://<your-railway-domain>/api/auth/google/callback` registered as an **Authorized Redirect URI** (not just the root `/`).

3. **No Session Restoration on Mount**:
   - Previously, `gscConnected` and `ga4Connected` always defaulted to `false` on component mount, even if valid tokens existed from a previous session in `.gsc_tokens.json`. Users had to re-authenticate on every page load.

### Implemented Solutions

1. **Popup Opened Synchronously** (`UploadZone.tsx`, `DataSourcesModal.tsx`):
   - `handleOAuth` now opens `window.open('', 'GoogleAuth', ...)` synchronously in the click handler (with no `await`), **then** navigates the popup to the OAuth URL once the fetch resolves. This satisfies the browser's user-gesture popup policy.

2. **Dynamic `redirect_uri` Generation** (`server/gsc.js`):
   - `getOAuthClient(req)` now reads `req.headers['x-forwarded-proto']` and `req.headers.host` to dynamically build the redirect URI, matching wherever the app is deployed (local, Railway, Vercel, etc.).

3. **Session Restore on Mount** (`UploadZone.tsx`, `DataSourcesModal.tsx`):
   - On mount (and when the modal opens), both components silently ping `/api/gsc/sites` and `/api/ga4/properties`. A successful response (non-401) means active tokens exist, so `gscConnected`/`ga4Connected` are set to `true` and the dropdowns are populated automatically — no re-authentication needed.

### Google Cloud Console Requirement
- Under **Authorized Redirect URIs**, you must add the exact callback path:
  - `https://website-migration-tool.up.railway.app/api/auth/google/callback`
  - `http://localhost:3001/api/auth/google/callback`

---

## 12. E-Commerce Crawl Resilience & Cross-Project Demo Data Isolation

### Root Cause Analysis (Stale Demo URLs in New Projects)
1. **Stale Cache Fallthrough on Failed Crawls**:
   - In `UploadZone.tsx`, starting a live crawl did not invalidate existing in-memory `sourceEntries`.
   - When an e-commerce site returned HTTP 403 (Cloudflare/Akamai bot detection), redirected to Shopify `/password`, or timed out, the crawl errored out, but `sourceEntries` remained populated with whatever was previously staged (e.g. 10 Apex demo URLs).
   - Because `sourceEntries.length > 0`, the main action button `Audit Source Site (10 URLs)` remained enabled. Clicking it submitted the stale demo URLs under the newly named project (e.g., "RWO").
2. **Unscoped Persistent Drafts**:
   - `handleReset()` wiped component state but did not remove `uploadZone_draft` or `localforage` crawl caches (`uploadZone_sourceEntries`). Navigating back to `/` silently re-hydrated the previous entries.
3. **Missing Domain Previews**:
   - The UI previously only displayed a count (e.g. `10 URLs`) without revealing the domain (`apexathletics.com`), obscuring that stale demo URLs were active.

### Implemented Solutions & Safeguards
1. **Immediate State & Cache Invalidation on Crawl**:
   - `handleCrawl()` in `UploadZone.tsx` immediately resets `sourceEntries`/`targetEntries` to `null` and purges their `localforage` records so failed or in-progress crawls can never fall back to stale or demo data.
2. **Full Storage Purge on "New Blank Project"**:
   - `handleReset()` in `App.tsx` explicitly purges `uploadZone_draft`, `uploadZone_sourceEntries`, and `uploadZone_targetEntries` from both `localStorage` and `localforage`.
3. **Staged Domain Chips & Clear Buttons**:
   - Both CSV and Crawl cards now display the detected primary domain (e.g., `Domain: apexathletics.com`), provide a dedicated **"🗑️ Clear"** button, and display a prominent warning banner if the staged domain does not match the entered crawl URL.
4. **Demo Dataset Isolation**:
   - Demo projects are flagged with `isDemo: true`.
   - The Navbar renders a persistent `DEMO DATASET` badge instead of `AUTOSAVED`.
   - Attempting to run analysis with demo data under a custom project name presents an explicit confirmation dialog.
   - The onboarding demo button is renamed from generic `"Load E-Commerce Demo Dataset"` to `"Load Demo Sample (New Folder)"`.
5. **Dedicated New Project Folder / Window Isolation**:
   - **No In-Place Overwrites**: Clicking "Load Demo Sample (New Folder)" (in `UploadZone.tsx`) or "Load Demo (New Folder)" (in `Navbar.tsx`) no longer overwrites the active React state or staged workspace in the current window.
   - **Synchronous New Window Spawning**: Invokes `window.open('/apex-athletics-demo/dashboard', '_blank')` directly within the user click gesture event to bypass aggressive browser popup blockers.
   - **Standalone Project Persistence (`createOrGetDemoProject`)**: Pre-computes full matching mappings, regex patterns, and parity stats for the sample dataset and saves it to IndexedDB as an isolated `Apex Athletics Demo` project entity (`isDemo: true`).
   - **On-Demand Demo Restoration**: If any tab navigates to `/apex-athletics-demo/dashboard`, `restore()` in `App.tsx` automatically resolves or creates the demo project on the fly without touching any other active tab or session.
   - **Root URL Auto-Restore Protection**: On visiting the root URL `/`, `restore()` explicitly filters out demo projects when selecting the most recent project candidate. This guarantees that real user projects (e.g. "RWO") are always restored on root, completely preventing sample demo data from hijacking the user's workspace.
   - **Project Manager ("Folder") Multitasking**: Every project row in `ProjectManagerModal.tsx` now displays a `Demo` badge and an `Open in new window` button, allowing users to keep multiple project folders open simultaneously in separate browser tabs without cross-contamination.
6. **Crawler Hardening for E-Commerce**:
   - **Cloudflare / 403 Bot Detection**: Emits an actionable event advising users to export from Screaming Frog and upload CSV if automated crawling is blocked.
   - **Shopify `/password` Detection**: Alerts users when a storefront is password-gated.
   - **Built-in Faceted Parameter Exclusions**: Automatically excludes query parameter loops (`cart`, `checkout`, `sort_by`, `add-to-cart`, `variant=`) from exploding crawl depth.

---

## 13. Clean-Slate "New Blank Project" Lifecycle & State Invalidation

### Root Cause Analysis (Stale Crawl Residue in New Blank Projects)
When creating a "New Blank Project", users encountered a state where the project name was "Untitled Project", but the target URL input still showed the previous site (`https://blinkesim-next-ikxr.vercel.`), the action button displayed "Restart Crawl", and the Crawl Summary box still showed previous stats ("Pages in Crawl: 735 found, Actually Crawled: 734 pages").

1. **Component Instance Preservation (Missing `key={projectId}`)**:
   - In `App.tsx`, `<UploadZone>` was rendered conditionally without a `key` prop tied to the active project.
   - When `handleReset()` generated a new `projectId` via `crypto.randomUUID()`, React detected the same component type at the same JSX position and preserved the mounted `UploadZone` component instance.
   - All internal `useState` hooks (`targetUrl`, `sourceUrl`, `crawlProgress`, `targetEntries`, `inputMode`) were retained in memory.
2. **Auto-Save Draft Race Condition**:
   - `handleReset()` called `localStorage.removeItem('uploadZone_draft')` and set `projectName = 'Untitled Project'`.
   - In `UploadZone.tsx`, `projectName` was a dependency of the auto-save `useEffect`. When `projectName` changed, this effect fired immediately, re-serializing the lingering in-memory state (`targetUrl: 'https://blinkesim-next-ikxr.vercel.'` and the 734-page `crawlProgress`) right back into `localStorage`.
3. **Unscoped `localforage` Storage**:
   - Uncommitted crawl arrays were saved under global keys (`uploadZone_targetEntries`) without project isolation.
4. **Lingering EventSource SSE Connections**:
   - Active crawl connections lacked lifecycle ref tracking, potentially leaking background events across resets.

### Implemented Solutions & Architecture Safeguards
1. **Key-Driven Remounting (`key={projectId}`)**:
   - Rendered `<UploadZone key={projectId} projectId={projectId} ... />` in `App.tsx`.
   - When `handleReset()` generates a new `projectId`, React unmounts the previous component instance completely, wiping all internal state and mounting a pristine instance with clean initial defaults (`sourceUrl: ''`, `targetUrl: ''`, `targetEntries: null`, `crawlProgress: {}`, `inputMode: 'csv'`).
2. **Project-Scoped IndexedDB Caches**:
   - `localforage` cache keys are now isolated by project ID: `uploadZone_sourceEntries_${projectId}` and `uploadZone_targetEntries_${projectId}`.
   - A new project receives a fresh UUID and will never read uncommitted entries from another project.
3. **Draft Validation & Stale Legacy Purge on Mount**:
   - In `UploadZone.tsx`, the mount effect checks draft provenance: if `parsed.projectId !== projectId`, or if an `Untitled Project` draft lacks a matching `projectId`, it immediately purges `uploadZone_draft` and all cached crawl entries, preventing stale data hydration.
4. **Guarded Auto-Save**:
   - `UploadZone` auto-save suppresses writing empty/blank drafts for `Untitled Project`, preventing ghost draft generation.
5. **Lifecycle-Aware EventSource Management**:
   - Added `eventSourceRef` in `UploadZone.tsx` to automatically close any active Server-Sent Events stream when the component unmounts or resets.
6. **Comprehensive `handleReset` Cleanup**:
   - `handleReset()` in `App.tsx` cleans both global (`uploadZone_draft`, `dataSources_draft`) and project-scoped storage before dispatching state resets and returning execution status to modals.

---

## 14. Scope & Reference Safety: `setActiveFilteredMappings` & State Invocations

### Problem Statement
In the production environment (`website-migration-tool.up.railway.app`), navigating to the URL mapping view or triggering project render resulted in an immediate unhandled runtime exception:
```
ReferenceError: setActiveFilteredMappings is not defined
    at Swe (https://website-migration-tool.up.railway.app/assets/index-CxJTJ8YX.js:950:94279)
    at N9 (https://website-migration-tool.up.railway.app/assets/index-CxJTJ8YX.js:60:8139)
```

### Root Cause
1. During earlier refactorings of `src/App.tsx`, the `const [activeFilteredMappings, setActiveFilteredMappings] = useState<UrlMapping[]>([]);` state hook was inadvertently omitted from the top-level declarations.
2. Downstream in the JSX tree, `<UrlMappingTable onFilteredMappingsChange={setActiveFilteredMappings} />` and `<ExportModal mappings={activeFilteredMappings.length > 0 ? activeFilteredMappings : mappings} />` still referenced `setActiveFilteredMappings` and `activeFilteredMappings`.
3. Because `npm run build` runs `vite build` (which relies on esbuild for JSX transpilation without strict static `tsc` type checking by default), missing variable references in JSX slipped through bundle compilation into minified production assets.
4. Similarly, `isDataSourcesOpen` and `setIsDataSourcesOpen` had been referenced in modal rendering and navigation callbacks without an explicit `useState` hook declaration in `App.tsx`.

### Solution & Verification
1. **Restored State Hooks**:
   - Re-declared `const [activeFilteredMappings, setActiveFilteredMappings] = useState<UrlMapping[]>([]);` in `src/App.tsx`.
   - Re-declared `const [isDataSourcesOpen, setIsDataSourcesOpen] = useState<boolean>(false);` in `src/App.tsx`.
2. **ProjectMetadata & Toast Normalization**:
   - Added `description?: string;` to the `ProjectMetadata` interface in `src/types/migration.ts`.
   - Standardized `toast()` custom action handlers to use Sonner's type-safe `action: { label, onClick }` API in `handleLoadSample`.
3. **Browser Environment Variable Polyfill & Safety**:
   - Replaced un-guarded `process.env` references in `src/utils/supabaseClient.ts` with `import.meta.env` and runtime existence checks.
   - Configured `define: { 'process.env': {} }` in `vite.config.ts` to prevent any third-party dependencies from throwing `ReferenceError: process is not defined` in browser contexts.
4. **Verification**:
   - Full static analysis pass executed via `npx tsc --noEmit`, resolving with 0 errors across all files.
   - Production bundle compilation executed via `npm run build`, producing clean minified bundles without errors.
   - Live end-to-end browser inspection executed on `http://localhost:4000/`, validating clean UI render with 0 runtime exceptions.

---

## 15. Multi-Source Crawl Coordination & "Smart Merge" Pipeline Architecture

### Problem Statement & Symptoms
When users crawled both the Old Site (`roofwindowoutlet.co.uk`, 475 pages) and the New Site (`fhfw1x-yz.myshopify.com`, 302 pages) in the `Manage Data Sources` modal:
1. The modal UI showed both sites crawled to 100% (475 source pages and 302 target pages).
2. However, the Dashboard displayed:
   - `Running Source-Only Audit: 0 Target URLs were provided. All 475 URLs will be marked as UNMAPPED.`
   - Total Crawled Pages: 475, Successfully Mapped: 0, Unmapped: 475.
   - SEO Readiness Score: 5 (Grade D - High Risk).

### Root Cause Analysis
1. **Premature Auto-Close on Single Crawl Completion**:
   - In `DataSourcesModal.tsx`, when an SSE crawl completed (`data.type === 'done'`), a timer (`setTimeout(() => onDataParsed(entries, type), 500)`) immediately invoked the parent callback and closed the modal via `setIsDataSourcesOpen(false)`.
   - When the Source crawl finished first, `onDataParsed(entries, 'source')` triggered `handleUpdateSourceData(entries)`.
   - Because the Target crawl had not yet completed or was not in parent state (`targetEntries = []`), `runPipeline` executed a Source-Only audit, marking all 475 URLs as UNMAPPED.
   - Simultaneously closing the modal unmounted the Target crawl stream and discarded in-flight target URLs.
2. **Lack of Staged Crawl State & Missing CTA**:
   - `DataSourcesModal` did not retain crawled entries in persistent state or `localforage`. It only saved summary counters in `localStorage('dataSources_draft')`.
   - When users re-opened `Manage Data Sources`, the modal displayed the previous counts ("475 found" and "302 found") from `localStorage`, but had no entries in memory and had no bottom action button to submit or merge them into the active project.
3. **Unsaved Target Updates in IndexedDB**:
   - `handleUpdateTargetData` in `App.tsx` updated React state but omitted `saveProjectToIndexedDB(...)`, risking state rollback on page refresh.
4. **Accidental Source-Only Audits in UploadZone**:
   - In `UploadZone.tsx`, if a user entered a Target URL but did not click its crawl button before clicking the main action button, the app ran a Source-Only audit without notifying the user that the Target site had been omitted.

### Solutions Implemented
1. **Persistent Staged Entries & Recovery**:
   - Introduced `stagedSourceEntries` and `stagedTargetEntries` in `DataSourcesModal.tsx`, backed by project-scoped `localforage` storage (`dataSources_sourceEntries_${projectId}`).
   - Added a dedicated `/api/crawl/results?jobId=...` endpoint in `server/index.js` allowing the modal to recover full crawled entries from completed jobs on mount.
2. **Eliminated Premature Auto-Close & Added Smart Merge Action Bar**:
   - Removed auto-closing `setTimeout` on crawl completion in `DataSourcesModal.tsx`.
   - Added a sticky bottom Action Bar with real-time URL counters for Source and Target, and a primary CTA:
     `"Run Smart Merge (${sourceCount} Source vs ${targetCount} Target)"`.
3. **Unified Source & Target Pipeline Handshake**:
   - Added `handleMergeSources(src, tgt)` in `App.tsx`, executing `runPipeline` with both populated datasets to generate accurate matches, confidence scores, and SEO parity audits.
   - Ensured `handleUpdateTargetData` explicitly calls `saveProjectToIndexedDB`.
4. **UploadZone Target Crawl Safeguard**:
   - Added confirmation safeguard in `UploadZone.tsx` alerting users if a Target URL is entered but not crawled before starting analysis.

---

## 8. Bug Fix: "Source-Only Audit" Toast Despite Completed Target Crawl (Sep 2026)

### Symptoms
- Dashboard showed: `"Running Source-Only Audit: 0 Target URLs were provided. All 475 URLs will be marked as UNMAPPED."`
- Target crawl showed as completed (382 pages) in the Manage Data Sources modal.
- Closing the modal via the **X button** discarded staged target data silently.

### Root Cause
- The X (close) button in `DataSourcesModal.tsx` called `onClose()` directly without checking if there was uncommitted staged data.
- A completed live crawl stores results in `stagedTargetEntries` (modal-local state). This data is only committed to the app when the user explicitly clicks **"Run Smart Merge"** in the action bar.
- When the user closed the modal using X after a crawl, `stagedTargetEntries` was discarded. The app's `targetEntries` remained empty → Source-Only Audit triggered on next run.

### Fix (`src/components/DataSourcesModal.tsx`)
- Added `hasPendingUncommittedData()` helper comparing staged vs. committed entry counts.
- Added `handleCloseWithGuard()` which intercepts the X button: if uncommitted data exists, displays a `window.confirm()` prompt offering to auto-apply (Smart Merge) before closing.
- Cancel on the prompt discards the staged data and closes normally.

---

## 9. Bug Fix: "Actually Crawled" > "Pages in Crawl" Discrepancy (Sep 2026)

### Symptoms
- Crawl summary in the modal showed impossible values: "313 Pages in Crawl" / "382 Actually Crawled"
- `crawledCount` (number of pages the crawler attempted) > `totalDiscovered` (unique URLs found).

### Root Cause
1. **Server-side (`server/crawler.js`)**: `totalDiscovered = visited.size + toVisit.length`. At crawl end, `toVisit` is empty, so `totalDiscovered = visited.size`. However, `crawledCount` can exceed `visited.size` because the error path (lines ~527-541) pushes failed URLs into `results` without adding them to `visited`, creating a mismatch.
2. **Client-side display**: The "Pages in Crawl" stat used raw `totalDiscovered` / `summary.totalDiscovered`, while "Actually Crawled" used `crawledCount` / `summary.crawledCount` — so the impossible state was shown verbatim.

### Fix
- **`server/crawler.js`**: Changed `totalDiscovered = visited.size + toVisit.length` to `Math.max(visited.size + toVisit.length, crawledCount)` ensuring `totalDiscovered >= crawledCount` always.
- **`src/components/DataSourcesModal.tsx`**: Both source and target "Pages in Crawl" now use `Math.max(summary.totalDiscovered, summary.crawledCount, stagedEntries?.length)` — the actual `results` array length (stored in `stagedEntries`) is the most reliable ground truth. "Actually Crawled" uses `stagedEntries.length` as primary source.

---

## 10. Bug Fix: Source-Only Audit from SSE Large Payload Data Loss (Sep 2026)

### Symptoms
- Dashboard showed: `"Running Source-Only Audit: 0 Target URLs were provided. All 475 URLs will be marked as UNMAPPED."`
- Target crawl showed "100% Crawled / 382 pages" in the modal summary
- Action bar showed "Target: 0 URLs" despite the crawl being complete
- Only happened on large crawls (300+ pages), not small test crawls

### Root Cause
The SSE `done` event in `server/index.js` included the **full results array** (`results: entries`) embedded in the event payload. For large crawls (300–500+ pages), this creates a 1–5MB+ JSON string in a single `res.write()` call.

Browsers and proxy layers (especially Railway's reverse proxy) **silently truncate or drop oversized SSE event payloads**. The client receives the `done` event but `JSON.parse(event.data)` either fails silently OR parses successfully but `data.results` is `undefined` (truncated mid-array).

Result: the `summary` object (which is tiny) is parsed correctly — crawl counts look right — but `entries` falls back to `data.results || []` → empty array → `stagedTargetEntries` is never populated → Source-Only Audit.

### Fix

**`server/index.js`**:
- Removed `results` from the SSE `done` event payload entirely.
- SSE `done` now only sends `{ type: 'done', summary }` (tiny payload, always succeeds).
- Full results remain available in `activeJobs` for the `/api/crawl/results` HTTP endpoint.

**`src/components/DataSourcesModal.tsx`** (`connectToCrawlJob`):
- When `done` event fires, immediately triggers a separate `fetch('/api/crawl/results?jobId=...')` HTTP request to download full results.
- Shows a `fetching_results` intermediate state with a spinner ("Downloading 382 crawl results...").
- On HTTP success, populates `stagedEntries` and saves to localforage normally.
- On HTTP failure (server restarted, job gone), resets `crawlProgress` to null and shows the stale warning.

**Stale State Detector** (`src/components/DataSourcesModal.tsx`):
- Added `staleWarning` state and a `useEffect` that runs 2.5s after `draftRestored`.
- If `crawlProgress[type].status === 'done'` but `stagedEntries` is still empty, resets progress to null and sets `staleWarning[type] = true`.
- Shows an amber warning box: "Previous crawl data was lost. Please run a new crawl."
- This handles the case where the user reopens the modal after a server restart.

---

## 11. Bug Fix: Changing One 301 Target Changed All URLs (Sep 2026)

### Symptoms
- Editing any row's 301 Target URL caused all 475 rows to show the same target
- Every row displayed "Mapped to 475 source URLs" badge
- Screenshot showed all rows with `targetUrl: '/'` (homepage) and `MANUAL OVERRIDE` status

### Root Cause
**`src/workers/matcher.worker.ts` line 288:**
```js
// BEFORE (bug):
const targetUrl = bestTarget ? bestTarget.url : '/';
```
When the matcher found no suitable match for a source URL (i.e., `bestTarget = null`), the mapping's `targetUrl` was set to `'/'` (the homepage) instead of `''` (empty/unmapped).

**Effect**: All 475 source URLs that had no match (a common case when the target site has very different URL structure, or after a Source-Only Audit) got `targetUrl: '/'`. The `targetCount` map in `UrlMappingTable.tsx` then counted all 475 mappings pointing to `'/'`, displaying the "Mapped to 475 source URLs" badge on every row. The user's edit to one row looked like it was "changing all rows" — in reality, all rows already had the same broken initial value.

### Fix
```js
// AFTER (fix):
const targetUrl = bestTarget ? bestTarget.url : '';
```
Empty string correctly represents an unmapped URL. The `strategy: 'UNMAPPED'` flag already indicates the mapping has no target. Setting `targetUrl: ''` prevents false conflicts and ensures the Conflicts tab, targetCount badge, and action bar all show accurate data.

### File Changed
- `src/workers/matcher.worker.ts` — line 288

---

## 12. Algorithm Improvement: H1 Scoring + Unicode Dash Normalization (Sep 2026)

### Problem 1: H1 Was Indexed But Never Scored

The `TargetCandidateIndex` indexed H1s (`exactH1Map`) and used them for candidate retrieval (`getCandidates`), but the actual scoring in Tier 3 only compared **path (50 pts)** and **title (40 pts)**. H1 was invisible to the score.

The worker also never called `index.findExactH1()` despite the method existing.

### Problem 2: Unicode Dash Mismatch Breaking Matches

Old websites commonly use **en-dash `–` (U+2013)** or **em-dash `—` (U+2014)** in their page titles, meta tags, or even URL slugs copied from CMS content. New sites typically use regular **ASCII hyphen `-`**.

In `stringSimilarity`, raw strings were compared character-by-character via Levenshtein. `"Roof–Windows"` vs `"Roof-Windows"` has an edit distance of 1 per dash character difference, which inflated the distance and lowered the similarity score below the matching threshold.

In `extractTokens`, the regex `[^a-z0-9\s-_/]` strips non-ASCII characters to space — so tokens ended up the same (`["roof", "windows"]`). But Levenshtein on raw path/title strings was still affected.

### Fixes

**`src/utils/matcher.ts`**:
- Added `normalizeDashes(text)` function that maps all Unicode dash variants (`–`, `—`, `‒`, `―`, `﹘`, `－`) to regular ASCII hyphen `-` before any comparison.
- Applied in `extractTokens()` (pre-processing step before tokenizing).
- Applied in `stringSimilarity()` (before Levenshtein computation).
- Exported for use in the worker.

**`src/workers/matcher.worker.ts`**:
- **Tier 2b added**: After exact title match, now checks `index.findExactH1()`. If the source H1 exactly matches a target's H1, assigns confidence 96 with strategy `EXACT_TITLE_H1`.
- **Tier 3 H1 score**: H1 Jaccard + Levenshtein similarity added as a **10-point signal** (path=50, title=40, H1=10 → max 100). Only fires when both source and target have an H1.
- **Tier 4 TF-IDF**: Source token set now includes H1 tokens so semantic cosine similarity also leverages H1 content.
- **Dash normalization in WASM calls**: `normalizeDashes()` applied to all strings passed to `wasmStringSimilarity()` for paths, titles, and H1s.

### Scoring Breakdown (Updated)

| Signal | Points | Notes |
|---|---|---|
| Path (Jaccard + Levenshtein) | 0–50 | Primary signal |
| Title (Jaccard + Levenshtein) | 0–40 | Strong signal for CMS migrations |
| H1 (Jaccard + Levenshtein) | 0–10 | Tiebreaker; especially useful when title has site name suffix |
| **Max possible** | **100** | |
| Geo penalty | −45 | Location mismatch |
| Pagination mismatch | −35 | Page N mismatch |
| Depth mismatch ≥2 levels | −15 | Structural mismatch |

### Why No Meta Description?
Meta descriptions are not included because they are frequently rephrased, A/B tested, or auto-generated from body content. They share vocabulary with many pages and would create false positive matches. H1 is a much stronger signal as it's typically the most literal representation of the page topic.

---

## 13. Bug Fix: All Rows Entering Edit Mode Simultaneously (Sep 2026)

### Symptom
Clicking the edit (pencil) button on any single row caused ALL 475 rows to simultaneously enter edit mode, showing input fields for every mapping. Saving one row's target URL appeared to change all rows.

### Root Cause — Missing `id` Field in Crawler Output

**`server/crawler.js`** — The `results.push({...})` call that builds each crawl entry never included an `id` field. The entry objects had `url`, `title`, `h1`, etc., but no `id`.

**`src/workers/matcher.worker.ts`** — Each mapping is created with:
```js
id: `map_${source.id}`
```
Since `source.id` was `undefined` for every entry, **all 475 mappings received the identical ID: `"map_undefined"`**.

**`src/components/UrlMappingTable.tsx`** — Edit mode is determined by:
```js
const isEditing = editingMappingId === m.id;
```
When any row's edit button was clicked, `editingMappingId` was set to `"map_undefined"`. Since every mapping had `id: "map_undefined"`, the condition returned `true` for all 475 rows simultaneously.

### Secondary Bug — GET /api/crawl/results Returning Empty

An earlier fix removed `results` from the SSE `done` event (Bug Fix #10) to avoid payload size limits. But `GET /api/crawl/results` still read from `doneEvent.results`, which was now always `undefined → []`. This caused crawl data to be empty even after successful crawls.

### Fixes

**`server/crawler.js`**:
- Added `id: \`entry_${crawledCount}_${Date.now()}\`` to every `results.push({...})` call (both success and error paths).
- This ensures every entry has a globally unique ID within a crawl session.

**`server/index.js`**:
- Results are now stored on `job.results = entries` when crawl completes.
- `GET /api/crawl/results` reads from `job.results` instead of the non-existent `doneEvent.results`.

**`src/workers/matcher.worker.ts`**:
- Added URL-based fallback: `source.id ? \`map_${source.id}\` : \`map_url_${i}_${source.url...}\``
- Ensures unique mapping IDs even for legacy crawl data without the `id` field.

**`src/App.tsx`** — `deduplicateMappings()`:
- Added duplicate ID detection and repair step.
- If two loaded mappings share the same `id` (e.g. legacy `"map_undefined"` data), they are reassigned unique IDs based on index + source URL.
- Prevents a corrupted saved project from causing the all-rows-in-edit-mode bug on reload.
