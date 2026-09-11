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
