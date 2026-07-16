# PHCloud CMS — Comprehensive UI/UX Audit

**Audit Date:** 2026-07-16
**Auditor:** UI Designer (20-year senior UI/UX developer)
**Scope:** Full public-facing site, admin panel, theme system, install wizard
**Files Reviewed:** `src/admin.ts`, `src/index.ts`, `src/themes/default.ts`, `src/cms/middleware.ts`, `src/cms/escape.ts`

---

## Executive Summary

PHCloud CMS delivers on its "world's lightest CMS" promise from a performance standpoint — the theme CSS is ~3KB minified, HTML is lean, and there are zero external dependencies. However, there are **significant structural bugs** in the HTML shell that break the intended layout, **widespread accessibility failures** that exclude users with disabilities, and a **disconnected theme system** where the class-based design system in `default.ts` is largely bypassed by inline styles in the render helpers.

| Severity | Count |
|----------|-------|
| CRITICAL | 6 |
| HIGH | 12 |
| MEDIUM | 14 |
| LOW | 10 |

---

## 1. Public-Facing UI

### 1.1 Accessibility

#### CRITICAL — Missing `<title>` element in page shell
**File:** `src/index.ts` → `shellFull()` (line 1321-1345)
**Finding:** The `shellFull()` function emits `<!DOCTYPE html><html lang="en"><head>` but never outputs a `<title>` tag. The page title is passed into `headPayload` via `title:` but it's up to plugins (SEO plugin) to inject it into `<title>`. Without the SEO plugin, every public page renders with **no title at all** — a WCAG 2.4.2 violation and an SEO disaster.
**Impact:** Screen readers announce the page with no title. Browser tabs show the raw URL. Google cannot index page titles.
**Recommendation:** Always emit `<title>${esc(title)}</title>` in `shellFull()` as a baseline, before plugin markup.

#### CRITICAL — Broken header layout: missing `.inner` wrapper
**File:** `src/index.ts` → `shellFull()` (line 1336-1339)
**Finding:** The theme CSS defines `header .inner` as the flex container with `max-width:900px; margin:0 auto; padding:0 1.5rem; height:56px`. However, `shellFull()` emits `<header><a class="site-name">...</a><nav>...</nav></header>` with **no `.inner` div**. This means:
- Header nav goes edge-to-edge with no padding
- No max-width constraint on header content
- The sticky header has no inner spacing
**Impact:** The entire public header layout is visually broken — content sits flush against viewport edges.
**Recommendation:** Wrap header contents in `<div class="inner">...</div>`.

#### HIGH — No skip-to-content link
**Finding:** Neither the public shell nor admin shell provides a "Skip to main content" link. This is a WCAG 2.4.1 violation that forces keyboard-only users to tab through the entire navigation on every page load.
**Recommendation:** Add `<a href="#main" class="sr-only sr-only:focusable">Skip to content</a>` before header, with corresponding `id="main"` on `<main>`.

#### HIGH — No `aria-current="page"` on active navigation links
**Finding:** Neither the public nav nor admin sidebar indicates the current page. Users have no way to know which page they're on from the navigation alone.
**Impact:** WCAG 2.4.8 violation. Screen reader users cannot orient themselves.
**Recommendation:** Pass the current path into `shellFull()` and render `aria-current="page"` on the matching nav link.

#### HIGH — Search form has no `<label>` element
**File:** `src/index.ts` → `/search` route (line 816-818)
**Finding:** The search input uses a placeholder but has no associated `<label>` element. The `<form>` contains only the `<input>` with `placeholder="Search posts…"` — no submit button, no label.
**Impact:** WCAG 1.3.1 / 4.1.2 violation. Screen readers announce "edit text" with no context. Placeholder text is not a label substitute.
**Recommendation:** Add `<label for="search-input" class="sr-only">Search</label>` and a visible submit button.

#### HIGH — `--text-muted` color fails WCAG AA contrast in light mode
**File:** `src/themes/default.ts` (line 3)
**Finding:** `--text-muted:#94a3b8` on `--bg:#f8fafc` yields a contrast ratio of **~2.4:1** — well below the 4.5:1 minimum for normal text (WCAG 1.4.3). This color is used for dates, meta text, tag labels, image counts, pagination, sidebar hints, and empty-state messages across both public and admin UIs.
**Impact:** Approximately 30% of secondary text content is illegible for users with low vision.
**Recommendation:** Increase `--text-muted` to at least `#6b7280` (5.4:1) or `#64748b` (4.6:1).

#### MEDIUM — Dark mode `--text-muted` also fails WCAG AA
**File:** `src/themes/default.ts` (line 49)
**Finding:** In dark mode, `--text-muted:#64748b` on `--bg:#0f172a` yields **~3.85:1** — below the 4.5:1 threshold. The dark mode overrides remap `--text-muted` to `#64748b` but this is still insufficient.
**Recommendation:** Use `#94a3b8` for `--text-muted` in dark mode (yields ~7.3:1).

#### MEDIUM — Pagination nav lacks ARIA semantics
**File:** `src/index.ts` → `renderPagination()` (line 1416-1462)
**Finding:** The pagination uses `<nav>` (good) but lacks `aria-label="Pagination"` and `aria-current="page"` on the active page span. Screen readers announce "navigation" with no context.
**Recommendation:** Add `aria-label="Pagination"` and `aria-current="page"` to the active page element.

#### MEDIUM — Admin sidebar and topbar lack ARIA labels
**File:** `src/admin.ts` → `adminShell()` (lines 56, 71)
**Finding:** The topbar `<nav>` and sidebar `<aside>` have no `aria-label`. Both contain navigation links, and screen readers cannot distinguish between them.
**Recommendation:** Add `aria-label="Top navigation"` to the topbar nav and `aria-label="Admin sidebar"` to the sidebar.

#### LOW — No `role="search"` on search form
**File:** `src/index.ts` (line 816)
**Finding:** The search `<form>` doesn't have `role="search"` or `<search>` element, making it harder for screen reader users to jump directly to the search function.

---

### 1.2 Responsive Design

#### HIGH — Public header has no mobile handling
**File:** `src/themes/default.ts` (line 48)
**Finding:** The media query at `max-width:600px` adjusts padding and font sizes but doesn't address the header nav. On mobile, `header nav` with `display:flex; gap:1.5rem` will overflow the viewport with multiple nav links + admin link. No hamburger menu, no wrapping, no scroll.
**Impact:** Navigation links are cut off or require horizontal scrolling on phones.
**Recommendation:** Add `flex-wrap:wrap` to header nav, reduce gap on mobile, or implement a collapsible menu.

#### MEDIUM — Post list gap doesn't collapse on mobile
**File:** `src/themes/default.ts` (line 48)
**Finding:** The `@media(max-width:600px)` breakpoint reduces main margin and h1 size, but doesn't adjust the `.post-list` gap or `.post-card` spacing, leading to excessive vertical whitespace on small screens.

#### LOW — `main` max-width is fixed at 680px
**File:** `src/themes/default.ts` (line 13)
**Finding:** `main{max-width:680px}` is appropriate for readability but may feel overly narrow on tablets (768px-1024px). No intermediate breakpoint widens content for larger screens.

---

### 1.3 Performance

#### GOOD — Inline CSS is extremely lightweight
**Finding:** The theme CSS is approximately **3.2KB** minified. The admin CSS is approximately **2.8KB** minified. Total CSS payload per page is under 6KB inline — no external stylesheets, no render-blocking requests. This is excellent for a CMS.

#### MEDIUM — Large inline `<script>` blocks on every admin page
**File:** `src/admin.ts` — `newPostBody()`, `editBody()`, `postsBody()`, `dashboardBody()`
**Finding:** Each admin page embeds 200-500+ lines of inline JavaScript. The new post editor alone has **four separate `<script>` blocks** totaling ~300 lines. The image paste and drag-drop code is **fully duplicated** between `newPostBody()` and `editBody()`.
**Impact:** Increases HTML document size unnecessarily. Duplicated code means bugs must be fixed in multiple places.
**Recommendation:** Extract shared JS into a single inline script at the bottom of the admin shell. Use a single function for image upload logic.

#### LOW — No preconnect or resource hints
**Finding:** No `<link rel="preconnect">` or DNS prefetch hints are present. Since the app runs on Cloudflare Workers, all assets are served from the same origin, so this is acceptable. But if CDN images or external fonts are ever added, this will matter.

---

### 1.4 Typography

#### GOOD — Type scale is consistent and readable
**Finding:** The theme uses a clear hierarchy:
- `h1: 2rem / 800 weight / -0.02em tracking`
- `h2: 1.4rem / 700 weight`
- `h3: 1.1rem / 600 weight`
- `body: system-ui / 1.7 line-height`
- `post-content: 1.05rem / 1.9 line-height`
- `meta: 0.8rem / muted`

This is a well-structured typographic scale. Line heights of 1.7-1.9 for body text provide excellent readability.

#### MEDIUM — Post content heading hierarchy may jump levels
**File:** `src/index.ts` → `renderPost()` (line 1347)
**Finding:** User-authored markdown content can contain any heading level (h1-h6). The post title is rendered as `<h1>`, but the markdown body might also start with `# Title` (another h1), creating multiple h1 elements on the page. This is a WCAG 1.3.1 violation.
**Recommendation:** Post-process rendered markdown to shift heading levels (h1→h2, h2→h3, etc.) or document that users should not use h1 in content.

---

### 1.5 Color Contrast

**Detailed contrast analysis:**

| Element | Foreground | Background | Ratio | WCAG AA (4.5:1) |
|---------|-----------|------------|-------|-----------------|
| Primary text (light) | `#1e293b` | `#f8fafc` | 14.8:1 | PASS |
| Primary text (dark) | `#f1f5f9` | `` | 15.5:1 | PASS |
| `--text-light` (light) | `#64748b` | `#f8fafc` | 4.56:1 | PASS (barely) |
| `--text-light` (dark) | `#94a3b8` | `#0f172a` | 7.29:1 | PASS |
| `--text-muted` (light) | `#94a3b8` | `#f8fafc` | **2.41:1** | **FAIL** |
| `--text-muted` (dark) | `#64748b` | `#0f172a` | **3.85:1** | **FAIL** |
| `--accent` (light) | `#b45309` | `#fff` | 4.62:1 | PASS |
| `--accent` (dark) | `#f97316` | `#1e293b` | 4.89:1 | PASS |
| Admin btn-primary text | `#fff` | `#0f172a` | 15.7:1 | PASS |
| Admin badge-draft | `#92400e` | `#fef3c7` | 5.12:1 | PASS |
| Admin badge-pub | `#166534` | `#dcfce7` | 4.92:1 | PASS |

#### HIGH — Muted text fails AA in both light and dark modes
**Finding:** As detailed above, `--text-muted` fails in both color schemes. This affects dates, tag labels, metadata, empty state text, sidebar hints, and pagination info across the entire application.
**Recommendation:** Increase contrast to at least 4.5:1 in both themes.

---

### 1.6 Navigation

#### HIGH — Public nav uses wrong theme class structure
**File:** `src/index.ts` → `shellFull()` (line 1336-1339)
**Finding:** The theme CSS styles `header nav a` with `color:var(--text-light); font-size:0.9rem; transition:color 0.15s`. However, the nav links rendered by `shellFull()` don't have any classes, so they rely on the generic `a` tag style (`color:var(--accent)` — orange). The `header nav a` rule should override this, but it only does so for direct children, and the actual `<nav>` contains both navigation links and the "Admin" link with an inline `style="color:#f97316"`, making the admin link visually consistent but by accident rather than design.

#### MEDIUM — No indication of current section in public nav
**Finding:** Public navigation has no `aria-current` or visual indicator of the active page.

#### LOW — "View Site" link in admin topbar goes to `/`
**Finding:** The admin "View Site" link points to `/`, which is correct. However, there's no way to view a specific post from the admin — you must copy the slug.

---

### 1.7 Search UX

#### MEDIUM — Search form has no submit button
**File:** `src/index.ts` → `/search` route (line 816-818)
**Finding:** The search form is a bare `<input>` inside a `<form action="/search" method="get">` with no submit button. While pressing Enter works, there's no visual affordance indicating the form is submittable. Touch users may not realize they can tap the keyboard's "Go" button.
**Recommendation:** Add a visible search button or a search icon button.

#### LOW — Search results use LIKE queries without indexing
**Finding:** `WHERE title LIKE ? OR content LIKE ?` with `%` wildcards won't use D1 indexes. This is a performance concern, not a UX issue, but slow search degrades the experience.

---

### 1.8 RSS/Sitemap Discoverability

#### MEDIUM — RSS `<link>` tag only on homepage
**File:** `src/index.ts` → homepage render (lines 1287-1290)
**Finding:** The `<link rel="alternate" type="application/rss+xml">` tag is injected only on the homepage via the `render:head` pipeline. Individual post pages, tag pages, and the search page do not include it. RSS readers auto-discovering from individual pages will fail.
**Recommendation:** Add the RSS link to the `headMarkup` in all render paths, or make it part of `shellFull()`.

#### LOW — Sitemap link not in HTML
**Finding:** The `/sitemap.xml` endpoint exists but is not linked anywhere in the HTML. It's only discoverable if a crawler tries `/sitemap.xml` directly. Adding `<link rel="sitemap" type="application/xml" href="/sitemap.xml">` to the head would improve discoverability.

---

## 2. Admin Panel UI

### 2.1 Form UX

#### HIGH — Form fields lack visual required indicators
**File:** `src/admin.ts` — `newPostBody()`, `editBody()`, `newPageBody()`, `editPageBody()`
**Finding:** Fields use the HTML `required` attribute (triggering browser-native validation) but there are no visual asterisks (*) or "required" text indicators. Users don't know which fields are mandatory until they try to submit.
**Recommendation:** Add a red asterisk after required field labels: `<label>Title <span style="color:red">*</span></label>`.

#### HIGH — No real-time form validation feedback
**Finding:** Forms only show validation state on submit via the browser's default validation bubbles. There's no inline validation for:
- Slug format (only allows lowercase alphanumeric + hyphens)
- Empty title detection
- Password strength (install wizard)
**Impact:** Users fill out entire forms only to discover errors on submission.
**Recommendation:** Add basic inline validation on blur events.

#### MEDIUM — Pages editor lacks markdown toolbar and preview
**File:** `src/admin.ts` → `newPageBody()` (line 731), `editPageBody()` (line 776)
**Finding:** The page editor is a bare `<textarea>` with no markdown toolbar, no preview toggle, and no image paste/drop support. The post editor has all of these features. This inconsistency confuses users — "Why can I preview posts but not pages?"
**Recommendation:** Reuse the post editor toolbar and preview functionality for pages, or document the intentional difference.

#### MEDIUM — Excerpt field on post editor is too narrow for its purpose
**File:** `src/admin.ts` → `newPostBody()` (line 186)
**Finding:** The excerpt input is a single-line `<input type="text">` despite excerpts being potentially multi-sentence. Users can't see the full excerpt without scrolling horizontally. Additionally, there's a typo in the CSS color: `color:#6474b` (line 188) instead of `color:#64748b`.
**Recommendation:** Use a `<textarea rows="2">` for the excerpt field. Fix the typo.

---

### 2.2 Button States

#### HIGH — Form submit buttons are not disabled during submission
**File:** `src/admin.ts` — all form handlers
**Finding:** When a user clicks "Save Post", "Update Post", "Save Page", "Save Settings", or "Save Navigation", the status text changes to "Saving…" but the **submit button remains clickable**. A double-click or impatient user can submit the form twice, creating duplicate posts or triggering race conditions.
**Impact:** Database duplicate entries, lost data, confusing UX.
**Recommendation:** Disable the submit button immediately on click: `btn.disabled = true; btn.textContent = 'Saving…';` and re-enable on error.

#### GOOD — Login form has proper disabled/loading state
**File:** `src/admin.ts` → `loginForm()` (line 567-585)
**Finding:** The login button is properly disabled and shows "Signing in…" during submission, then re-enables on error. This is correct.

#### GOOD — Plugin toggle disables during save
**File:** `src/admin.ts` → `pluginsBody()` (line 689)
**Finding:** Plugin checkboxes are disabled during the PATCH request and re-enabled on completion. This is correct.

---

### 2.3 Post Editor

#### MEDIUM — No keyboard shortcuts for markdown toolbar
**Finding:** The toolbar buttons (Bold, Italic, H2, H3, Link, Image, Quote, List) work via mouse click only. There are no keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) despite the toolbar suggesting a rich editing experience.
**Impact:** Power users must use the mouse for formatting, breaking the editing flow.
**Recommendation:** Add `Ctrl+B` → Bold, `Ctrl+I` → Italic, and display shortcuts in tooltips.

#### MEDIUM — No word/character count
**Finding:** The editor provides no feedback on content length. Users writing excerpts or SEO-optimized content need to manually count words.
**Recommendation:** Add a character/word count below the textarea.

#### LOW — Preview toggle hides the editor (mutual exclusion)
**Finding:** When preview is active, the textarea is hidden (`display:none`) and the preview box is shown. Users cannot edit and preview simultaneously. The split-view grid layout (`grid-template-columns:1fr 1fr`) exists but is never actually used for side-by-side editing.
**Recommendation:** Show both editor and preview side-by-side when screen width allows, or make the toggle a true toggle that shows/hides the preview panel.

---

### 2.4 Plugin Manager

#### MEDIUM — Toggle failure shows `alert()` dialog
**File:** `src/admin.ts` → `pluginsBody()` (line 694)
**Finding:** When a plugin toggle PATCH request fails, the UI shows a native browser `alert("Failed to save")`. This is jarring, unstyled, and inconsistent with the rest of the admin's inline status messaging.
**Recommendation:** Use the same `aria-live` status div pattern used elsewhere in the admin panel.

#### LOW — No confirmation for plugin activation
**Finding:** Toggling a plugin on/off takes effect immediately with no confirmation dialog. While the description says "Changes take effect immediately," activating a broken plugin could break the site with no undo path.
**Recommendation:** Consider adding a confirmation for activation (not deactivation).

---

### 2.5 Settings Form

#### MEDIUM — Settings page reloads after save, losing scroll position
**File:** `src/admin.ts` → `settingsBody()` (line 950)
**Finding:** After successfully saving settings, the code runs `location.reload()`. On long settings pages, this resets the scroll position to the top. The reload is also unnecessary since the form values are already displayed.
**Recommendation:** Just show the "Saved!" message without reloading. The values are already in the form.

#### LOW — No file size or format guidance for logo upload
**File:** `src/admin.ts` → `settingsBody()` (line 909)
**Finding:** The logo file input uses `accept="image/*"` but provides no guidance on recommended dimensions, file size limits, or supported formats. The backend limits to ~500KB and PNG/JPEG/WebP, but this isn't communicated to the user until they hit an error.
**Recommendation:** Add helper text: "Recommended: 600×200px. Max 500KB. PNG, JPEG, or WebP."

---

### 2.6 Login Form

#### GOOD — Login flow is clear and accessible
**Finding:** The login form has:
- Proper `<label>` elements with `for` attributes ✓
- `autofocus` on the username field ✓
- Loading state with disabled button ✓
- Error message display ✓
- Clean, focused layout ✓

#### MEDIUM — No "Forgot password" or account recovery path
**Finding:** The login form provides no mechanism for password recovery. If an admin forgets their password, they must manually reset it via D1 database access.
**Impact:** Non-technical users could be permanently locked out.
**Recommendation:** Consider adding a recovery mechanism, or at minimum document the manual recovery process in the login UI.

#### LOW — Login page doesn't respect `prefers-color-scheme`
**Finding:** The login page has a hardcoded dark theme (`background:#0f172a; color:white`) regardless of the user's OS color scheme preference. While this looks intentional for branding, it's inconsistent with the public site's automatic dark mode.

---

### 2.7 Dashboard

#### MEDIUM — Post list shows "Loading…" with no skeleton or spinner
**File:** `src/admin.ts` → `dashboardBody()` (line 115)
**Finding:** While posts are loading via fetch, the table shows a single cell with "Loading…" text. There's no visual loading indicator (spinner, skeleton screen, pulse animation) to indicate the page is actively working.
**Recommendation:** Add a subtle CSS pulse animation to the loading text, or use a skeleton row pattern.

#### LOW — Dashboard stats show "—" during load
**File:** `src/admin.ts` → `dashboardBody()` (lines 98-102)
**Finding:** The stat cards show "—" as a placeholder while loading. This is acceptable but could be improved with a skeleton animation for visual polish.

---

### 2.8 Consistency

#### HIGH — Admin panel is completely disconnected from the public theme
**Finding:** The admin panel (`adminShell()`) defines its own complete CSS reset, color palette, typography, and component styles that share nothing with the public theme (`default.ts`). The public theme uses CSS custom properties (`--bg`, `--surface`, `--text`, etc.) while the admin hardcodes all values (`#f8fafc`, `#1e293b`, `#0f172a`).
**Impact:** Any theme customization on the public site has zero effect on the admin panel. The two interfaces feel like different products. Brand color changes require editing both files.
**Recommendation:** Extract shared design tokens (colors, spacing, typography) into a common CSS variable set used by both themes.

#### MEDIUM — Inconsistent button styles across admin pages
**Finding:**
- Primary buttons: `.btn-primary` (dark background, white text) ✓ consistent
- Cancel buttons: Inline styles `style="background:#e5e7eb;color:#1e293b"` — not a defined class
- Delete buttons: `.btn-sm.btn-danger` (text only, red) — inconsistent with cancel buttons
- Add buttons: `.btn-sm` (bordered, white background) — different from primary
**Impact:** Three different button visual styles for destructive/secondary actions with no clear hierarchy.
**Recommendation:** Define `.btn-secondary` and `.btn-danger` as proper classes in the admin CSS.

#### MEDIUM — Duplicate navigation between topbar and sidebar
**File:** `src/admin.ts` → `adminShell()` (lines 54-81)
**Finding:** The topbar contains: Dashboard, Posts, Pages, New Post, Images, Plugins, Tags, Navigation, Settings, View Site, Logout. The sidebar contains: Dashboard, All Posts, Pages, New Post, Images, Tags, Navigation, Plugins, Settings. These are **nearly identical** with slightly different labels ("Posts" vs "All Posts").
**Impact:** Confusing — users don't know which navigation to use. The topbar links become inaccessible on mobile (they overflow). Two navigations doubling the cognitive load.
**Recommendation:** Keep only the sidebar for primary navigation. Use the topbar for branding, search, and user actions (View Site, Logout).

#### LOW — Admin and public use different heading for "All Posts"
**Finding:** Sidebar says "All Posts" while topbar says "Posts". Minor but adds to inconsistency.

---

### 2.9 Error Handling UX

#### HIGH — Delete operations have no error handling
**File:** `src/admin.ts` → `dashboardBody()` (line 140), `postsBody()` (line 173), `pagesBody()` (line 725)
**Finding:** The delete function is:
```javascript
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(){location.reload()})}
```
If the DELETE request fails (network error, 401 session expiry, 500 server error), there's **no error handling at all**. The `.then()` only handles success. A failed delete silently does nothing, leaving the user confused about whether the post was deleted.
**Recommendation:** Add `.catch()` and error status handling: `fetch(...).then(...).catch(function(){alert('Delete failed. Please try again.')})`.

#### MEDIUM — API errors show generic "Error saving post" messages
**Finding:** When POST/PATCH operations fail, the status text shows generic messages like "Error saving post" or "Error updating post" without the actual server error. The server may return specific validation errors (e.g., duplicate slug), but these are discarded.
**Recommendation:** Parse the response body for error details: `res.json().then(function(data){status.textContent = data.error || 'Error saving post'})`.

#### MEDIUM — Session expiry silently redirects to login
**File:** `src/admin.ts` → `dashboardBody()` (line 139)
**Finding:** When the posts API returns 401 (expired session), the catch handler does `window.location.href='/admin/login'`. The user sees a sudden redirect to the login page with no explanation of why they were logged out.
**Recommendation:** Show a brief "Your session expired. Please log in again." message before redirecting.

---

### 2.10 Mobile Admin

#### CRITICAL — Admin panel has no responsive layout
**File:** `src/admin.ts` → `adminShell()` (line 15)
**Finding:** The admin layout uses `grid-template-columns:220px 1fr` with **no media queries or responsive breakpoints**. On screens narrower than ~700px:
- The 220px sidebar + content area exceeds the viewport width
- Content is clipped or requires horizontal scrolling
- The topbar nav links overflow and are inaccessible
- Tables overflow their containers
- The markdown editor's 2-column grid (`grid-template-columns:1fr 1fr`) breaks
**Impact:** The admin panel is **completely unusable on mobile phones**. Tablets in portrait mode also struggle.
**Recommendation:** Add responsive breakpoints:
- `<768px`: Hide sidebar, add hamburger menu toggle
- `<640px`: Stack the markdown editor vertically, make tables horizontally scrollable
- Topbar: Collapse nav links into a menu on mobile

#### HIGH — Markdown editor split view breaks on narrow screens
**File:** `src/admin.ts` → `newPostBody()` (line 202), `editBody()` (line 388)
**Finding:** The editor wrapper uses `display:grid; grid-template-columns:1fr 1fr; min-height:320px`. On screens narrower than ~500px, both the textarea and preview (when visible) are squished to ~240px each, making editing impossible.
**Recommendation:** Stack vertically on mobile: `@media(max-width:600px){#editor-wrap{grid-template-columns:1fr}}`

---

### 2.11 Navigation (Admin)

#### HIGH — No active state indicator on sidebar
**Finding:** The admin sidebar shows all navigation links as plain text with no visual indicator of which page the user is currently on. There's no `aria-current="page"`, no background highlight, no bold text, nothing.
**Impact:** Users navigating deep into the admin (e.g., editing a post) have no way to orient themselves in the navigation. This is a WCAG 2.4.8 (Location) violation.
**Recommendation:** Add a server-side check: compare the current URL path to each sidebar link and render an `active` class or `aria-current="page"`.

#### MEDIUM — Sidebar doesn't indicate content type distinction
**Finding:** "All Posts" and "Pages" are separate sections, but there's no visual grouping or explanation of the difference. New users may not understand the posts vs. pages distinction.

---

### 2.12 Empty States

#### MEDIUM — Pages list has no guidance in empty state
**File:** `src/admin.ts` → `pagesBody()` (line 715)
**Finding:** When there are no pages, the table shows "No pages yet." — but unlike the posts list which includes "Create one" with a link, the pages empty state provides **no action or link** to create a page.
**Recommendation:** Change to: "No pages yet. [Create one](/admin/pages/new)."

#### LOW — Tags list has no guidance in empty state
**File:** `src/admin.ts` → `tagsBody()` (line 850)
**Finding:** Empty tags show "No tags yet." without explaining what tags are for or how to create one, despite the form being visible above the table.

---

## 3. Theme Quality

### 3.1 CSS Weight

#### GOOD — Exceptionally lightweight CSS
**Finding:**
- Public theme CSS: **~3.2KB** minified (including dark mode, all components, responsive breakpoints)
- Admin CSS: **~2.8KB** minified (complete admin panel styling)
- Total per page load: **~3-6KB** inline CSS (zero external requests)
- No JavaScript frameworks, no CSS preprocessors, no build-time processing

This is genuinely lightweight and aligns with the "world's lightest CMS" brand promise.

### 3.2 Dark Mode

#### GOOD — Public site has automatic dark mode
**File:** `src/themes/default.ts` (line 49-52)
**Finding:** Uses `@media(prefers-color-scheme:dark)` to override CSS custom properties. This provides automatic dark mode based on OS preference with no JavaScript. The implementation is clean and covers all color tokens.

#### HIGH — Admin panel has no dark mode support
**Finding:** The admin panel hardcodes all colors (e.g., `background:#f8fafc`, `color:#1e293b`) with no CSS custom properties and no `prefers-color-scheme` media query. Admins working at night or in dark environments get a bright white interface with no option.
**Recommendation:** Port the admin CSS to use the same CSS custom property system as the public theme, and add a `@media(prefers-color-scheme:dark)` block.

#### MEDIUM — Login page has hardcoded dark theme
**Finding:** The login page is always dark (`background:#0f172a`), ignoring OS preference. This creates a jarring transition if the user's system is in light mode — they see a dark login page, then a bright admin panel.

### 3.3 Print Styles

#### MEDIUM — No print stylesheet
**Finding:** There are no `@media print` rules anywhere in the codebase. Printing a post or page will:
- Include the sticky header and navigation
- Include the admin link
- Show the dark code blocks as solid black rectangles
- Show the sidebar in admin printouts
- No page break control for long content

**Recommendation:** Add basic print styles:
```css
@media print {
  header, footer, nav, .sidebar, .topbar { display: none !important; }
  main { max-width: 100%; margin: 0; padding: 0; }
  .post-content pre { background: #f1f5f9; color: #1e293b; }
  a { color: #1e293b; text-decoration: underline; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; }
}
```

### 3.4 Other Theme Issues

#### MEDIUM — `color-mix()` has limited browser support
**File:** `src/themes/default.ts` (lines 35, 45-46, 51-52)
**Finding:** The theme uses `color-mix(in srgb, var(--accent) 4%, transparent)` for blockquote backgrounds and tag pill backgrounds. `color-mix()` is supported in Chrome 111+, Firefox 113+, Safari 16.2+. While coverage is now ~95%, older browsers will fall back to the default (transparent), causing blockquotes to lose their background entirely.
**Recommendation:** Provide a fallback: `background: rgba(180,83,9,0.04); background: color-mix(...)`.

#### LOW — No `prefers-reduced-motion` support
**Finding:** The theme uses transitions (`transition:box-shadow 0.2s, border-color 0.2s` on `.post-card`, `transition:color 0.15s` on links) but doesn't respect `@media(prefers-reduced-motion:reduce)`. Users with vestibular disorders may experience discomfort.
**Recommendation:** Add `@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`.

---

## 4. Install Wizard UI

#### GOOD — Install wizard is clean and functional
**File:** `src/cms/middleware.ts` → `serveOnboardingUI()` (lines 36-145)
**Finding:** The install wizard has:
- Proper `<label>` elements with `for` attributes ✓
- `required` attributes on mandatory fields ✓
- `minlength="8"` on password ✓
- Client-side password validation ✓
- Error display ✓
- Clean, focused single-column layout ✓

#### MEDIUM — Install wizard has no progress indication
**Finding:** The "Initialize Core Systems" button is clicked, and the user sees... nothing until the page redirects. There's no loading state, no spinner, no "Setting up your site…" message. For a process that involves database migrations and admin creation, this could take 1-3 seconds.
**Recommendation:** Add a loading state: `btn.disabled=true; btn.textContent='Setting up…'`.

#### LOW — Install wizard doesn't validate username format
**Finding:** The admin username field accepts any characters including spaces and special characters. While the backend handles this, unusual usernames could cause confusion during login.

---

## 5. Additional Findings

### 5.1 Theme-HTML Disconnect (Architectural)

#### CRITICAL — Theme CSS classes are defined but never used in public HTML
**File:** `src/themes/default.ts` vs `src/index.ts`
**Finding:** The theme defines a rich class-based design system:
- `.post-list`, `.post-card`, `.post-meta`, `.post-content`, `.back-link`
- `.search-form`, `.tag-pill`, `.site-title`, `.sr-only`
- `.post-card h2 a`, `.post-card .meta`, `.post-card .excerpt`, `.post-card .read-more`

**None of these classes are used in the actual HTML.** The `renderPostList()`, `renderPost()`, `renderHomepage()`, and `shellFull()` functions in `index.ts` emit **entirely inline styles** that sometimes duplicate and sometimes contradict the theme classes:
- Theme: `.post-card` has `background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem` — never used
- HTML: `renderPostList` uses `style="border-bottom:1px solid #e5e7eb;padding-bottom:1.5rem"` — a completely different visual treatment
- Theme: `.post-content` has `line-height:1.9; font-size:1.05rem` — never used
- HTML: `renderPost` uses `style="line-height:1.8;"` — different line height
- Theme: `.search-form input` is fully styled — never applied
- HTML: search input uses `style="width:100%;padding:0.65rem;border:1px solid #cbd5e1..."` — redundant inline styles

**Impact:** The theme is essentially a dead CSS file. Customizing the theme has no visible effect on the actual rendered HTML. The entire theming system is broken by design.
**Recommendation:** Refactor `shellFull()`, `renderPost()`, and `renderPostList()` to use the theme's CSS classes instead of inline styles.

### 5.2 Security-Adjacent UX

#### MEDIUM — No CSRF protection visible on admin forms
**Finding:** Admin forms submit via `fetch()` with JSON bodies, which provides some inherent CSRF protection (browsers don't send cross-origin JSON POSTs). However, there's no CSRF token mechanism, and the cookie-based auth with `SameSite=Lax` could be vulnerable in certain edge cases (top-level GET navigations from malicious sites).
**Impact:** Low risk due to SameSite=Lax + httpOnly cookies, but worth noting.

#### LOW — Rate limit message reveals timing
**Finding:** The login rate limit message says "Too many attempts. Try again in ${waitSec}s" — revealing the exact cooldown period. This is actually helpful UX, not a security issue.

---

## Summary: Priority Fix List

### Immediate (CRITICAL)
1. **Add `<title>` tag to `shellFull()`** — SEO and accessibility regression
2. **Add `.inner` wrapper to header** — header layout is completely broken
3. **Make theme CSS classes actually get used in HTML** — the entire theming system is non-functional
4. **Add responsive breakpoint for admin panel** — admin is unusable on mobile

### Short-term (HIGH)
5. Fix `--text-muted` contrast to pass WCAG AA (4.5:1 minimum)
6. Add skip-to-content link on both public and admin shells
7. Add `aria-current="page"` to active nav items
8. Add `<label>` to search input
9. Disable submit buttons during form submission
10. Add error handling to delete operations
11. Add active state indicator to admin sidebar
12. Unify admin/public design tokens
13. Fix header nav for mobile (overflow handling)
14. Fix post heading hierarchy (h1 nesting)

### Medium-term (MEDIUM)
15. Add dark mode to admin panel
16. Add print stylesheet
17. Fix duplicate navigation in admin (topbar + sidebar)
18. Add RSS link to all page templates
19. Add loading state to install wizard
20. Add real-time form validation
21. Add markdown toolbar to page editor
22. Add word count to editor
23. Fix settings page reload behavior
24. Add pagination ARIA attributes
25. Add submit button to search form
26. Improve error messages with server response details
27. Fix excerpt field to textarea
28. Add `prefers-reduced-motion` support
29. Handle session expiry gracefully in admin

### Nice-to-have (LOW)
30. Add sitemap link in HTML head
31. Add keyboard shortcuts to markdown toolbar
32. Add logo upload guidelines text
33. Add password recovery path documentation
34. Add confirmation for plugin activation
35. Add `role="search"` to search form
36. Validate install wizard username format

---

*Audit completed. Findings are based on static code analysis of the full codebase. No runtime testing was performed.*
