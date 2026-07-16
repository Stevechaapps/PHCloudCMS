export const layout = 'centered' as const;

export const css = `:root{--bg:#f8fafc;--surface:#fff;--text:#1e293b;--text-light:#64748b;--text-muted:#6b7280;--accent:#b45309;--accent-hover:#ea580c;--border:#e2e8f0;--radius:8px;--font:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:'JetBrains Mono','Fira Code',monospace;--shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);--shadow-lg:0 4px 16px rgba(0,0,0,0.08)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{color:var(--accent-hover)}
header{background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;box-shadow:var(--shadow)}
header .inner{max-width:900px;margin:0 auto;padding:0 1.5rem;height:56px;display:flex;align-items:center;justify-content:space-between}
header .site-name{font-weight:700;font-size:1.1rem;color:var(--text);letter-spacing:-0.01em}
header nav{display:flex;gap:1.5rem;align-items:center}
header nav a{color:var(--text-light);font-size:0.9rem;transition:color 0.15s}
header nav a:hover{color:var(--accent)}
main{max-width:680px;margin:3rem auto;padding:0 1.5rem;min-height:60vh}
footer{text-align:center;padding:2.5rem 1.5rem;color:var(--text-muted);font-size:0.8rem;border-top:1px solid var(--border);margin-top:4rem}
h1{font-size:2rem;font-weight:800;letter-spacing:-0.02em;line-height:1.3;margin-bottom:1.5rem}
h2{font-size:1.4rem;font-weight:700;margin-bottom:1rem}
h3{font-size:1.1rem;font-weight:600;margin-bottom:0.75rem}
p{line-height:1.8;color:var(--text-light);margin-bottom:1rem}
.post-list{display:flex;flex-direction:column;gap:1.25rem}
.post-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;transition:box-shadow 0.2s,border-color 0.2s;box-shadow:var(--shadow)}
.post-card:hover{border-color:var(--accent);box-shadow:var(--shadow-lg)}
.post-card h2{font-size:1.15rem;margin-bottom:0.3rem}
.post-card h2 a{color:var(--text)}.post-card h2 a:hover{color:var(--accent)}
.post-card .meta{color:var(--text-muted);font-size:0.8rem;margin-bottom:0.6rem}
.post-card .excerpt{color:var(--text-light);font-size:0.9rem;line-height:1.6;margin-bottom:0.6rem}
.post-card .read-more{font-size:0.85rem;font-weight:500}
.post-meta{color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;display:flex;gap:0.75rem;flex-wrap:wrap}
.post-meta a{color:var(--text-muted)}.post-meta a:hover{color:var(--accent)}
.post-content{line-height:1.9;font-size:1.05rem;color:var(--text-light)}
.post-content p{margin-bottom:1.25rem}
.post-content img{max-width:100%;height:auto;border-radius:var(--radius);margin:1.5rem 0;box-shadow:var(--shadow-lg)}
.post-content code{background:#f1f5f9;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.9em;font-family:var(--font-mono)}
.post-content pre{background:#0f172a;color:#e2e8f0;padding:1.25rem;border-radius:var(--radius);overflow-x:auto;margin:1.5rem 0;font-size:0.85rem;line-height:1.6}
.post-content pre code{background:none;padding:0;color:inherit;font-size:inherit}
.post-content blockquote{border-left:3px solid var(--accent);padding:0.75rem 1.25rem;margin:1.5rem 0;background:rgba(180,83,9,0.04);background:color-mix(in srgb, var(--accent) 4%, transparent);border-radius:0 var(--radius) var(--radius) 0;color:var(--text-light)}
.post-content ul,.post-content ol{padding-left:1.5rem;margin-bottom:1.25rem;color:var(--text-light)}
.post-content li{margin-bottom:0.35rem}
.back-link{display:inline-flex;align-items:center;gap:0.4rem;color:var(--text-muted);font-size:0.85rem;margin-bottom:2rem;transition:color 0.15s}
.back-link:hover{color:var(--accent)}
.site-title{margin-bottom:2.5rem;text-align:center}
.site-title h1{font-size:2.5rem;margin-bottom:0.5rem}.site-title p{color:var(--text-muted);font-size:1rem}
.search-form{margin-bottom:2.5rem}
.search-form input{width:100%;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:var(--radius);font-size:1rem;font-family:var(--font);background:var(--surface);transition:border-color 0.15s;box-shadow:var(--shadow)}
.search-form input:focus{outline:none;border-color:var(--accent)}
.tag-pill{display:inline-block;padding:0.15rem 0.6rem;font-size:0.75rem;border-radius:99px;background:rgba(180,83,9,0.08);background:color-mix(in srgb, var(--accent) 8%, transparent);color:var(--accent);margin-right:0.3rem;margin-bottom:0.3rem;transition:background 0.15s}
.tag-pill:hover{background:rgba(180,83,9,0.15);background:color-mix(in srgb, var(--accent) 15%, transparent)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
@media(max-width:600px){header .inner{padding:0 1rem}header nav{flex-wrap:wrap;gap:0.75rem}main{margin:1.5rem auto}h1{font-size:1.5rem}.site-title h1{font-size:1.8rem}.post-card{padding:1.25rem}.post-list{gap:1rem}}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--surface:#1e293b;--text:#f1f5f9;--text-light:#94a3b8;--text-muted:#94a3b8;--accent:#f97316;--accent-hover:#fb923c;--border:#334155}
.post-content code{background:#334155}
.post-content blockquote{background:rgba(249,115,22,0.08);background:color-mix(in srgb, var(--accent) 8%, transparent)}
.tag-pill{background:rgba(249,115,22,0.15);background:color-mix(in srgb, var(--accent) 15%, transparent)}
}
@media print{header,footer,nav,.sidebar,.topbar{display:none!important}main{max-width:100%;margin:0;padding:0}.post-content pre{background:#f1f5f9;color:#1e293b}a{color:#1e293b;text-decoration:underline}a[href]::after{content:" (" attr(href) ")";font-size:0.8em}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}`;
