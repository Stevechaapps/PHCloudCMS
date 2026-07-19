export const css = `:root{--bg:#f8fafc;--surface:#fff;--text:#0f172a;--text-light:#475569;--text-muted:#64748b;--accent:#b45309;--accent-hover:#ea580c;--border:#e2e8f0;--radius:8px;--font:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--font-mono:'JetBrains Mono','Fira Code',monospace;--shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);--shadow-lg:0 10px 15px -3px rgba(0,0,0,0.1),0 4px 6px -2px rgba(0,0,0,0.05)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none;transition:color 0.2s}a:hover{color:var(--accent-hover)}
header{background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;box-shadow:var(--shadow)}
header .inner{max-width:1000px;margin:0 auto;padding:0 1.5rem;height:64px;display:flex;align-items:center;justify-content:space-between;gap:1rem}
header .site-name{font-weight:800;font-size:1.25rem;color:var(--text);letter-spacing:-0.02em}
header nav{display:flex;gap:1.25rem;align-items:center}
header nav a{color:var(--text-light);font-size:0.9rem;font-weight:500}
header nav a:hover{color:var(--text)}
.search-wrap{position:relative;display:flex;align-items:center}
.search-wrap input{padding:0.4rem 0.75rem;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;font-family:inherit;background:var(--bg);color:var(--text);width:160px;transition:width 0.2s,border-color 0.2s,box-shadow 0.2s}
.search-wrap input:focus{outline:none;width:220px;border-color:var(--accent);box-shadow:0 0 0 3px rgba(180,83,9,0.1)}
main{max-width:720px;margin:4rem auto;padding:0 1.5rem;min-height:70vh}
footer{background:var(--surface);border-top:1px solid var(--border);padding:2rem 1.5rem;margin-top:5rem;text-align:center}
footer .inner{max-width:1000px;margin:0 auto}
.colophon{font-size:0.8rem;color:var(--text-muted)}
h1{font-size:2.5rem;font-weight:800;letter-spacing:-0.03em;line-height:1.2;margin-bottom:1.5rem;color:var(--text)}
h2{font-size:1.75rem;font-weight:700;margin-bottom:1rem;letter-spacing:-0.01em}
h3{font-size:1.25rem;font-weight:600;margin-bottom:0.75rem}
p{margin-bottom:1.25rem;color:var(--text-light)}
.post-list{display:flex;flex-direction:column;gap:2rem}
.post-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.75rem;transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s;box-shadow:var(--shadow)}
.post-card:hover{transform:translateY(-2px);border-color:var(--accent);box-shadow:var(--shadow-lg)}
.post-card h2{font-size:1.3rem;margin-bottom:0.5rem}
.post-card h2 a{color:var(--text);font-weight:700}.post-card h2 a:hover{color:var(--accent)}
.post-card .meta{color:var(--text-muted);font-size:0.8rem;margin-bottom:0.75rem;font-variant-numeric:tabular-nums}
.post-card .excerpt{color:var(--text-light);font-size:0.95rem;line-height:1.6;margin-bottom:1rem}
.post-card .read-more{font-size:0.85rem;font-weight:600;display:inline-flex;align-items:center;gap:0.25rem}
.post-meta{color:var(--text-muted);font-size:0.85rem;margin-bottom:2rem;display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center}
.post-meta a{color:var(--text-muted);font-weight:500}.post-meta a:hover{color:var(--accent)}
.post-content{line-height:1.8;font-size:1.1rem;color:var(--text-light)}
.post-content p{margin-bottom:1.5rem}
.post-content img{max-width:100%;height:auto;border-radius:var(--radius);margin:2rem 0;box-shadow:var(--shadow-lg)}
.post-content code{background:#f1f5f9;padding:0.2rem 0.4rem;border-radius:4px;font-size:0.9em;font-family:var(--font-mono);color:var(--text)}
.post-content pre{background:#0f172a;color:#e2e8f0;padding:1.5rem;border-radius:var(--radius);overflow-x:auto;margin:2rem 0;font-size:0.9rem;line-height:1.6}
.post-content pre code{background:none;padding:0;color:inherit;font-size:inherit}
.post-content blockquote{border-left:4px solid var(--accent);padding:0.5rem 1.25rem;margin:2rem 0;background:color-mix(in srgb, var(--accent) 4%, transparent);border-radius:0 var(--radius) var(--radius) 0;color:var(--text);font-style:italic}
.post-content ul,.post-content ol{padding-left:1.5rem;margin-bottom:1.5rem;color:var(--text-light)}
.post-content li{margin-bottom:0.5rem}
.back-link{display:inline-flex;align-items:center;gap:0.5rem;color:var(--text-muted);font-size:0.9rem;margin-bottom:2.5rem;transition:color 0.2s;font-weight:500}
.back-link:hover{color:var(--text)}
.site-title{margin-bottom:3rem;text-align:center}
.site-title h1{font-size:3rem;margin-bottom:0.75rem}
.site-title p{color:var(--text-muted);font-size:1.1rem;max-width:600px;margin:0 auto 2rem}
.search-form{margin-bottom:3rem}
.search-form input{width:100%;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:var(--radius);font-size:1.1rem;font-family:inherit;background:var(--surface);transition:border-color 0.2s,box-shadow 0.2s;box-shadow:var(--shadow)}
.search-form input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(180,83,9,0.1)}
.tag-pill{display:inline-block;padding:0.2rem 0.6rem;font-size:0.75rem;border-radius:99px;background:color-mix(in srgb, var(--accent) 10%, transparent);color:var(--accent);margin-right:0.4rem;margin-bottom:0.4rem;font-weight:600;transition:background 0.2s}
.tag-pill:hover{background:color-mix(in srgb, var(--accent) 20%, transparent)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
@media(max-width:768px){header .inner{padding:0 1rem}header nav{display:none}main{margin:2rem auto;padding:0 1rem}h1{font-size:2rem}.site-title h1{font-size:2.2rem}}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f172a;--surface:#1e293b;--text:#f1f5f9;--text-light:#94a3b8;--text-muted:#64748b;--accent:#f97316;--accent-hover:#fb923c;--border:#334155}.post-content code{background:#334155}.post-content blockquote{background:color-mix(in srgb, var(--accent) 12%, transparent)}}
:root[data-theme="dark"]{--bg:#0f172a;--surface:#1e293b;--text:#f1f5f9;--text-light:#94a3b8;--text-muted:#64748b;--accent:#f97316;--accent-hover:#fb923c;--border:#334155}
:root[data-theme="dark"] .post-content code{background:#334155}
:root[data-theme="dark"] .post-content blockquote{background:color-mix(in srgb, var(--accent) 12%, transparent)}
:root[data-theme="dark"] .tag-pill{background:color-mix(in srgb, var(--accent) 20%, transparent)}
.theme-toggle{background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-light);font-size:0.85rem;padding:0.25rem 0.6rem;cursor:pointer;line-height:1;transition:all 0.2s}
.theme-toggle:hover{color:var(--text);border-color:var(--text-light)}
@media print{header,footer,nav,.sidebar,.topbar{display:none!important}main{max-width:100%;margin:0;padding:0}.post-content pre{background:#f1f5f9;color:#1e293b}a{color:#1e293b;text-decoration:underline}a[href]::after{content:" (" attr(href) ")";font-size:0.8em}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}`;
