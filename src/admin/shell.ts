// src/admin/shell.ts — admin layout shell (topbar + sidebar + content slot).

import { esc } from "../cms/escape.js";

export function adminShell(title: string, bodyHtml: string): string {
  const styles = [
    "*{margin:0;padding:0;box-sizing:border-box}",
    // Admin palette. Inline styles across admin pages reference these via
    // var(--ad-…) so muted text / cards / surfaces flip correctly in dark mode
    // (the inline literal would otherwise stay light on a dark surface).
    ":root{--ad-card:#fff;--ad-card-bd:#e5e7eb;--ad-row-bd:#f1f5f9;--ad-muted:#475569;--ad-cancel:#e5e7eb;--ad-cancel-text:#1e293b;--ad-active:#0f172a;--ad-link:#3b82f6;--ad-warn-bg:#fef2f2;--ad-warn-bd:#fca5a5;--ad-warn-tx:#b91c1c}",
    "@media(prefers-color-scheme:dark){:root{--ad-card:#1e293b;--ad-card-bd:#334155;--ad-row-bd:#334155;--ad-muted:#94a3b8;--ad-cancel:#334155;--ad-cancel-text:#f1f5f9;--ad-active:#f97316;--ad-link:#60a5fa;--ad-warn-bg:rgba(220,38,38,.12);--ad-warn-bd:rgba(248,113,113,.35);--ad-warn-tx:#fca5a5}}",
    "body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b}",
    ".topbar{background:#0f172a;color:white;padding:0 2rem;height:52px;display:flex;align-items:center;justify-content:space-between}",
    ".topbar a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem}",
    ".topbar a:hover{color:white}",
    ".topbar .actions{display:flex;align-items:center;gap:0.75rem}",
    // Desktop: sidebar is the nav — hide the topbar link list so we don't
    // show the same 9 links twice. (Shown on mobile in the @media block below,
    // where the sidebar is display:none and we'd otherwise have no nav.)
    ".topbar .toplinks{display:none}",
    ".layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 52px)}",
    ".sidebar{background:white;border-right:1px solid #e5e7eb;padding:1.5rem 0}",
    ".sidebar a{display:block;padding:0.5rem 1.5rem;color:#1a1a1a;text-decoration:none;font-size:0.9rem}",
    ".sidebar a:hover{background:#f1f5f9}",
    ".content{padding:2rem}",
    "table{width:100%;border-collapse:collapse}",
    "th,td{text-align:left;padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.9rem}",
    "th{font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b}",
    ".badge{display:inline-block;padding:0.15rem 0.5rem;border-radius:3px;font-size:0.75rem;font-weight:500}",
    ".badge-pub{background:#dcfce7;color:#166534}",
    ".badge-draft{background:#fef3c7;color:#92400e}",
    ".badge-info{background:#dbeafe;color:#1e40af}",
    ".btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 0.9rem;border-radius:4px;font-size:0.8rem;text-decoration:none;cursor:pointer;border:none;font-weight:500}",
    ".btn-primary{background:#0f172a;color:white}",
    ".btn-sm{padding:0.3rem 0.6rem;border-radius:4px;border:1px solid #e5e7eb;background:white;cursor:pointer;font-size:0.8rem}",
    ".btn-danger{color:#dc2626}",
    ".toolbar{display:flex;gap:2px;padding:0.5rem;background:#f8fafc;border:1px solid #e2e8f0;border-bottom:none;border-radius:5px 5px 0 0;flex-wrap:wrap;margin-bottom:0}",
    ".toolbar button{background:none;border:none;padding:0.3rem 0.55rem;border-radius:3px;cursor:pointer;font-size:0.8rem;color:#475569;font-weight:500}",
    ".toolbar button:hover{background:#e2e8f0;color:#1e293b}",
    // Active toolbar state: rteSync() sets aria-pressed on the button whose
    // command matches the current selection. Placed after :hover so it wins
    // the specificity tie and the pressed look survives hover.
    '.toolbar button[aria-pressed="true"]{background:#0f172a;color:white}',
    ".toolbar .sep{width:1px;background:#e2e8f0;margin:0 0.25rem}",
    ".rte{min-height:300px;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem;line-height:1.7;overflow-y:auto;outline:none}",
    ".rte:focus{border-color:#3b82f6}.rte:empty:before{content:attr(data-ph);color:#94a3b8}",
    ".rte h1{font-size:1.5rem;margin:0.5rem 0}.rte h2{font-size:1.3rem;margin:0.4rem 0}.rte h3{font-size:1.1rem;margin:0.3rem 0}.rte p{margin:0.5rem 0}.rte ul,.rte ol{margin:0.5rem 1.5rem}.rte blockquote{border-left:3px solid #cbd5e1;padding-left:0.75rem;color:#475569;margin:0.5rem 0}.rte code{background:#f1f5f9;padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em}.rte pre{background:#0f172a;color:#e2e8f0;padding:0.75rem;border-radius:4px;overflow-x:auto}.rte img{max-width:100%;border-radius:4px;margin:0.5rem 0}",
    ".form-group{margin-bottom:1.25rem}",
    "label{display:block;font-weight:500;margin-bottom:0.4rem;font-size:0.9rem}",
    'input[type="text"],textarea{width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem;font-family:inherit}',
    "textarea{min-height:320px;font-family:monospace;font-size:0.9rem;line-height:1.5}",
    ".row{display:flex;gap:1rem}",
    ".row .form-group{flex:1}",
    "@media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{display:none}.topbar{flex-wrap:wrap;height:auto;padding:0.5rem 1rem}.topbar .toplinks{display:flex;flex-wrap:wrap;gap:0.4rem;width:100%;justify-content:center;margin-top:0.4rem;font-size:0.75rem}.topbar .actions{margin-left:auto}table{font-size:0.8rem}th,td{padding:0.4rem 0.5rem}}",
    // Dark mode: the admin follows the OS color scheme. No manual toggle in
    // the admin (only the public site has one); the topbar is already dark so
    // it works in both. Surfaces, inputs, toolbar, sidebar, buttons, table
    // borders flip to the same slate palette the public dark theme uses.
    '@media(prefers-color-scheme:dark){body{background:#0f172a;color:#f1f5f9}.sidebar{background:#1e293b;border-right-color:#334155}.sidebar a{color:#e2e8f0}.sidebar a:hover{background:#334155}th,td{border-bottom-color:#334155}th{color:#94a3b8}.content a{color:#f97316}.toolbar{background:#1e293b;border-color:#334155}.toolbar button{color:#94a3b8}.toolbar button:hover{background:#334155;color:#f1f5f9}.rte{background:#1e293b;color:#f1f5f9;border-color:#475569}.rte code{background:#334155}.rte blockquote{border-color:#475569;color:#94a3b8}input[type="text"],input[type="password"],input[type="search"],input[type="email"],input[type="number"],input[type="url"],input[type="datetime-local"],input[type="date"],textarea{background:#1e293b;color:#f1f5f9;border-color:#475569}.btn-sm{background:#1e293b;border-color:#475569;color:#f1f5f9}.btn-primary{background:#f97316;color:#fff}}',
  ].join(" ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Admin</title>
<style>${styles}</style>
</head>
<body>
<div class="topbar">
<strong>PHCloud CMS</strong>
<nav class="actions" aria-label="Site actions">
<a href="/" target="_blank" rel="noopener">View Site ↗</a>
<button type="button" onclick="logout()" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:0.85rem">Logout</button>
</nav>
<nav class="toplinks" aria-label="Admin navigation">
<a href="/admin">Dashboard</a>
<a href="/admin/posts">Posts</a>
<a href="/admin/pages">Pages</a>
<a href="/admin/new">New Post</a>
<a href="/admin/images">Images</a>
<a href="/admin/plugins">Plugins</a>
<a href="/admin/tags">Tags</a>
<a href="/admin/nav">Navigation</a>
<a href="/admin/settings">Settings</a>
</nav>
</div>
<div class="layout">
<aside class="sidebar" aria-label="Admin sidebar">
<a href="/admin">Dashboard</a>
<a href="/admin/posts">All Posts</a>
<a href="/admin/pages">Pages</a>
<a href="/admin/new">New Post</a>
<a href="/admin/images">Images</a>
<a href="/admin/tags">Tags</a>
<a href="/admin/nav">Navigation</a>
<a href="/admin/plugins">Plugins</a>
<a href="/admin/settings">Settings</a>
</aside>
<main class="content">${bodyHtml}</main>
</div>
<script>
async function logout(){await fetch('/api/auth/logout',{method:'POST'});window.location.href='/'}
</script>
</body>
</html>`;
}
