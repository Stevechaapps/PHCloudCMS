// src/admin.ts — Admin panel HTML pages
// Uses multi-line template strings to stay within TS parser limits.

// ── Layout shell (sidebar + topbar + content slot) ──────────────────

export function adminShell(title: string, bodyHtml: string): string {
const styles = [
  '*{margin:0;padding:0;box-sizing:border-box}',
  'body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b}',
  '.topbar{background:#0f172a;color:white;padding:0 2rem;height:52px;display:flex;align-items:center;justify-content:space-between}',
  '.topbar a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem}',
  '.topbar a:hover{color:white}',
  '.layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 52px)}',
  '.sidebar{background:white;border-right:1px solid #e5e7eb;padding:1.5rem 0}',
  '.sidebar a{display:block;padding:0.5rem 1.5rem;color:#1a1a1a;text-decoration:none;font-size:0.9rem}',
  '.sidebar a:hover{background:#f1f5f9}',
  '.content{padding:2rem}',
  'table{width:100%;border-collapse:collapse}',
  'th,td{text-align:left;padding:0.6rem 0.75rem;border-bottom:1px solid #e5e7eb;font-size:0.9rem}',
  'th{font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b}',
  '.badge{display:inline-block;padding:0.15rem 0.5rem;border-radius:3px;font-size:0.75rem;font-weight:500}',
  '.badge-pub{background:#dcfce7;color:#166534}',
  '.badge-draft{background:#fef3c7;color:#92400e}',
  '.btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 0.9rem;border-radius:4px;font-size:0.8rem;text-decoration:none;cursor:pointer;border:none;font-weight:500}',
  '.btn-primary{background:#0f172a;color:white}',
  '.btn-sm{padding:0.3rem 0.6rem;border-radius:4px;border:1px solid #e5e7eb;background:white;cursor:pointer;font-size:0.8rem}',
  '.btn-danger{color:#dc2626}',
  '.form-group{margin-bottom:1.25rem}',
  'label{display:block;font-weight:500;margin-bottom:0.4rem;font-size:0.9rem}',
  'input[type="text"],textarea{width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem;font-family:inherit}',
  'textarea{min-height:320px;font-family:monospace;font-size:0.9rem;line-height:1.5}',
  '.row{display:flex;gap:1rem}',
  '.row .form-group{flex:1}',
].join(' ');

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
<nav>
<a href="/admin">Dashboard</a>
<a href="/admin/posts">Posts</a>
<a href="/admin/pages">Pages</a>
<a href="/admin/new">New Post</a>
<a href="/admin/plugins">Plugins</a>
<a href="/admin/categories">Categories</a>
<a href="/admin/nav">Navigation</a>
<a href="/admin/settings">Settings</a>
<a href="/" style="margin-left:1rem">View Site</a>
<a href="#" onclick="logout(event)" style="margin-left:1rem;color:#f87171">Logout</a>
</nav>
</div>
<div class="layout">
<aside class="sidebar">
<a href="/admin">Dashboard</a>
<a href="/admin/posts">All Posts</a>
<a href="/admin/pages">Pages</a>
<a href="/admin/new">New Post</a>
<a href="/admin/categories">Categories</a>
<a href="/admin/nav">Navigation</a>
<a href="/admin/plugins">Plugins</a>
<a href="/admin/settings">Settings</a>
</aside>
<main class="content">${bodyHtml}</main>
</div>
<script>
async function logout(e){e.preventDefault();await fetch('/api/auth/logout',{method:'POST'});window.location.href='/'}
</script>
</body>
</html>`;
}

// ── Dashboard ──────────────────────────────────────────────────────

export function dashboardBody(): string {
return `<h2 style="margin-bottom:1.5rem">Dashboard</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem">
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:1rem">
<div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Total Posts</div>
<div id="total" style="font-size:2rem;font-weight:700;margin-top:0.25rem">—</div>
</div>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:1rem">
<div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Published</div>
<div id="pub" style="font-size:2rem;font-weight:700;margin-top:0.25rem">—</div>
</div>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;padding:1rem">
<div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Setup</div>
<div style="font-size:0.85rem;color:#16a34a;margin-top:0.5rem">✓ Configured</div>
</div>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
<h3>Recent Posts</h3>
<a href="/admin/new" class="btn btn-primary">+ New Post</a>
</div>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
<tbody id="posts"><tr><td colspan="5" style="text-align:center;color:#64748b">Loading…</td></tr></tbody>
</table></div>
<script>
fetch('/api/admin/posts').then(function(r){return r.json()}).then(function(posts){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
document.getElementById('total').textContent=posts.length;
document.getElementById('pub').textContent=posts.filter(function(p){return p.published}).length;
var tbody=document.getElementById('posts');
if(!posts.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b">No posts yet. <a href="/admin/new">Create one</a>.</td></tr>';return}
tbody.innerHTML=posts.map(function(p){
return '<tr>'
+'<td><strong>'+ea(p.title)+'</strong></td>'
+'<td style="color:#64748b">/'+ea(p.slug)+'</td>'
+'<td><span class="badge '+(p.published?'badge-pub':'badge-draft')+'">'+(p.published?'Published':'Draft')+'</span></td>'
+'<td style="color:#64748b;font-size:0.85rem">'+new Date(p.updated_at).toLocaleDateString()+'</td>'
+'<td style="display:flex;gap:0.4rem">'
+'<a class="btn btn-sm" href="/admin/edit/'+p.id+'">Edit</a>'
+'<button class="btn btn-sm btn-danger" onclick="del('+p.id+')">Delete</button>'
+'</td></tr>'}).join('')});
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(){location.reload()})}
</script>`;
}

// ── Posts list ─────────────────────────────────────────────────────

export function postsBody(): string {
return `<h2 style="margin-bottom:1rem">All Posts</h2>
<a href="/admin/new" class="btn btn-primary" style="margin-bottom:1rem">+ New Post</a>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
<tbody id="posts"><tr><td colspan="5" style="text-align:center;color:#64748b">Loading…</td></tr></tbody>
</table></div>
<script>
fetch('/api/admin/posts').then(function(r){return r.json()}).then(function(posts){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var tbody=document.getElementById('posts');
if(!posts.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b">No posts yet.</td></tr>';return}
tbody.innerHTML=posts.map(function(p){return '<tr>'
+'<td><strong>'+ea(p.title)+'</strong></td>'
+'<td style="color:#64748b">/'+ea(p.slug)+'</td>'
+'<td><span class="badge '+(p.published?'badge-pub':'badge-draft')+'">'+(p.published?'Published':'Draft')+'</span></td>'
+'<td style="color:#64748b;font-size:0.85rem">'+new Date(p.updated_at).toLocaleDateString()+'</td>'
+'<td style="display:flex;gap:0.4rem">'
+'<a class="btn btn-sm" href="/admin/edit/'+p.id+'">Edit</a>'
+'<button class="btn btn-sm btn-danger" onclick="del('+p.id+')">Delete</button>'
+'</td></tr>'}).join('')});
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(){location.reload()})}
</script>`;
}

// ── New post form ──────────────────────────────────────────────────

export function newPostBody(): string {
return `<h2 style="margin-bottom:1.5rem">New Post</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required /></div>
</div>
<div class="form-group"><label for="excerpt">Excerpt <span style="color:#64748b;font-weight:400">(optional)</span></label><input type="text" id="excerpt" name="excerpt" /></div>
<div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Markdown)</span></label><textarea id="content" name="content" required></textarea></div>
<div class="form-group">
<label>Categories</label>
<div id="catCheckboxes" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.3rem"></div>
</div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" /> Publish immediately</label></div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Save Post</button>
<a href="/admin/posts" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
</form>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
fetch('/api/admin/categories').then(function(r){return r.json()}).then(function(cats){
var html='';
for(var i=0;i<cats.length;i++){
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+cats[i].id+'" class="cat-cb" /> '+cats[i].name+'</label>'}
document.getElementById('catCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No categories. <a href="/admin/categories">Manage categories</a>.</span>'});
function getCatIds(){var ids=[];[].forEach.call(document.querySelectorAll('.cat-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
fetch('/api/admin/posts',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:String(fd.get('content')||''),
excerpt:String(fd.get('excerpt')||''),
published:document.getElementById('published').checked,
category_ids:getCatIds()
})}).then(function(res){
if(res.ok){
res.json().then(function(p){
status.style.color='#16a34a';
status.textContent='Saved! Redirecting…';
setTimeout(function(){location.href='/admin/edit/'+p.id},500)})}
 else{status.style.color='#dc2626';status.textContent='Error saving post'}})});
</script>
<script>
var imgurClientId='';
fetch('/api/admin/settings').then(function(r){return r.json()}).then(function(s){imgurClientId=s.imgur_client_id});
var contentTa=document.getElementById('content');
contentTa.addEventListener('paste',function(e){
if(!imgurClientId)return;
var files=e.clipboardData.files;
if(!files.length)return;
e.preventDefault();
var ta=this;
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Uploading image to Imgur…';
var fd=new FormData();
fd.append('image',files[0]);
fetch('https://api.imgur.com/3/image',{
method:'POST',
headers:{'Authorization':'Client-ID '+imgurClientId},
body:fd}).then(function(r){return r.json()}).then(function(res){
if(res.success){
var url=res.data.link;
var markdown='![]('+url+')';
var start=ta.selectionStart,end=ta.selectionEnd;
var val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;
ta.focus();
status.style.color='#16a34a';
status.textContent='Image uploaded: '+url}
else{status.style.color='#dc2626';status.textContent='Imgur upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Imgur upload error'})});
</script>`;
}

// ── Edit post form ─────────────────────────────────────────────────

export function editBody(post: {
id: string | number;
title: string;
slug: string;
content: string;
excerpt?: string;
published: string | number;
updated_at: string;
}): string {
var id = String(post.id);
var checked = (post.published == 1 || post.published === '1') ? 'checked' : '';
return `<h2 style="margin-bottom:1.5rem">Edit Post</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required value="${escAttr(post.title)}" /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required value="${escAttr(post.slug)}" /></div>
</div>
<div class="form-group"><label for="excerpt">Excerpt <span style="color:#64748b;font-weight:400">(optional)</span></label><input type="text" id="excerpt" name="excerpt" value="${escAttr(String(post.excerpt ?? ''))}" /></div>
 <div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Markdown)</span></label><textarea id="content" name="content" required>${escHtml(post.content)}</textarea></div>
<div class="form-group">
<label>Categories</label>
<div id="catCheckboxes" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.3rem"></div>
</div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" ${checked} /> Published</label></div>
<div style="font-size:0.8rem;color:#64748b;margin-bottom:1rem">Last updated: ${escAttr(post.updated_at)}</div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Update Post</button>
<a href="/admin/posts" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
</form>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function getCatIds(){var ids=[];[].forEach.call(document.querySelectorAll('.cat-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
var postCatReq=fetch('/api/admin/posts/${id}/categories').then(function(r){return r.json()});
var allCatReq=fetch('/api/admin/categories').then(function(r){return r.json()});
Promise.all([postCatReq,allCatReq]).then(function(results){
var postCatIds=results[0].map(function(c){return c.id});
var cats=results[1];
var html='';
for(var i=0;i<cats.length;i++){
var checked=postCatIds.indexOf(cats[i].id)!==-1?' checked':'';
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+cats[i].id+'" class="cat-cb"'+checked+' /> '+cats[i].name+'</label>'}
document.getElementById('catCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No categories.</span>'});

document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
fetch('/api/admin/posts/${id}',{
method:'PATCH',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:String(fd.get('content')||''),
excerpt:String(fd.get('excerpt')||''),
published:document.getElementById('published').checked,
category_ids:getCatIds()
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Updated!'}
else{status.style.color='#dc2626';status.textContent='Error updating post'}})});
</script>
<script>
var imgurClientId='';
fetch('/api/admin/settings').then(function(r){return r.json()}).then(function(s){imgurClientId=s.imgur_client_id});
var contentTa=document.getElementById('content');
contentTa.addEventListener('paste',function(e){
if(!imgurClientId)return;
var files=e.clipboardData.files;
if(!files.length)return;
e.preventDefault();
var ta=this;
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Uploading image to Imgur…';
var fd=new FormData();
fd.append('image',files[0]);
fetch('https://api.imgur.com/3/image',{
method:'POST',
headers:{'Authorization':'Client-ID '+imgurClientId},
body:fd}).then(function(r){return r.json()}).then(function(res){
if(res.success){
var url=res.data.link;
var markdown='![]('+url+')';
var start=ta.selectionStart,end=ta.selectionEnd;
var val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;
ta.focus();
status.style.color='#16a34a';
status.textContent='Image uploaded: '+url}
else{status.style.color='#dc2626';status.textContent='Imgur upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Imgur upload error'})});
</script>`;
}

// ── Login form ─────────────────────────────────────────────────────

export function loginForm(): string {
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Login · PHCloud CMS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f172a;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center}
form{background:#1e293b;padding:2.5rem;border-radius:8px;width:100%;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,0.4)}
h1{font-size:1.2rem;margin-bottom:1.5rem}
label{display:block;font-size:0.85rem;margin-bottom:0.4rem;color:rgba(255,255,255,0.7)}
input[type="text"],input[type="password"]{width:100%;padding:0.7rem;border:1px solid rgba(255,255,255,0.1);border-radius:4px;font-size:1rem;background:#0f172a;color:white;margin-bottom:1rem}
input:focus{outline:none;border-color:#3b82f6}
button{width:100%;padding:0.75rem;background:#3b82f6;color:white;border:none;border-radius:4px;font-size:1rem;cursor:pointer}
button:hover{background:#2563eb}
button:disabled{opacity:0.5;cursor:not-allowed}
.err{color:#f87171;font-size:0.85rem;margin-bottom:1rem;display:none}
</style>
</head>
<body>
<form id="loginForm">
<h1>Admin Login</h1>
<div class="err" id="err"></div>
<label for="username">Username</label>
<input type="text" id="username" name="username" autofocus />
<label for="password">Password</label>
<input type="password" id="password" name="password" />
<button type="submit" id="btn">Sign in</button>
</form>
<script>
var form=document.getElementById('loginForm');
var errEl=document.getElementById('err');
var btn=document.getElementById('btn');
form.addEventListener('submit',function(e){
e.preventDefault();
errEl.style.display='none';
btn.disabled=true;
btn.textContent='Signing in…';
var u=document.getElementById('username').value;
var p=document.getElementById('password').value;
fetch('/api/auth/login',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:u,password:p})}).then(function(r){return r.json()}).then(function(data){
if(!data.ok){errEl.textContent=data.error||'Login failed';errEl.style.display='block';btn.disabled=false;btn.textContent='Sign in'}
else{window.location.href='/admin'}})});
</script>
</body>
</html>`;
}

// ── Plugins manager page ───────────────────────────────────────────

var PLUGIN_CATEGORIES = [
  { key: 'seo',       label: 'SEO' },
  { key: 'security',  label: 'Security' },
  { key: 'forms',     label: 'Forms' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'backup',    label: 'Backup & Export' },
  { key: 'ecommerce', label: 'E-Commerce' },
  { key: 'social',    label: 'Social' },
  { key: 'media',     label: 'Media' },
  { key: 'custom',    label: 'Custom' },
];

export function pluginsBody(
  availablePlugins: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    version: string;
    author: string;
    hooks: string[];
  }>,
  activePluginIds: Set<string>
): string {
  var byCategory: Record<string, typeof availablePlugins> = {};
  for (var i = 0; i < availablePlugins.length; i++) {
    var p = availablePlugins[i];
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  var html = '<h2 style="margin-bottom:0.5rem">Plugins</h2>';
  html += '<p style="color:#64748b;margin-bottom:2rem;font-size:0.9rem">Toggle plugins on or off. Changes take effect immediately.</p>';

  for (var c = 0; c < PLUGIN_CATEGORIES.length; c++) {
    var cat = PLUGIN_CATEGORIES[c];
    var plugins = byCategory[cat.key];
    if (!plugins || !plugins.length) continue;

    html += '<h3 style="margin:2rem 0 1rem;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b">';
    html += esc(cat.label) + '</h3>';
    html += '<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:1.5rem">';

    for (var j = 0; j < plugins.length; j++) {
      var pl = plugins[j];
      var isActive = activePluginIds.has(pl.id);
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;';
      html += 'border-bottom:1px solid #f1f5f9">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:0.95rem">' + esc(pl.name);
      html += ' <span style="font-weight:400;color:#94a3b8;font-size:0.8rem">v' + esc(pl.version) + '</span></div>';
      html += '<div style="color:#64748b;font-size:0.85rem;margin-top:0.2rem">' + esc(pl.description) + '</div>';
      html += '<div style="color:#94a3b8;font-size:0.75rem;margin-top:0.3rem">by ' + esc(pl.author);
      html += ' · hooks: ' + esc(pl.hooks.join(', ')) + '</div>';
      html += '</div>';
      html += '<div style="margin-left:1.5rem;flex-shrink:0">';
      html += '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">';
      html += '<input type="checkbox" class="plugin-toggle" data-plugin="' + escAttr(pl.id) + '"';
      html += isActive ? ' checked' : '';
      html += ' />';
      html += '<span style="font-size:0.85rem;color:#64748b">' + (isActive ? 'Active' : 'Inactive') + '</span>';
      html += '</label></div></div>';
    }

    html += '</div>';
  }

  if (!availablePlugins.length) {
    html += '<div style="text-align:center;padding:3rem;color:#64748b">No plugins available.';
    html += ' Add files to <code>src/plugins/</code> and list them in <code>src/plugins/index.ts</code>.</div>';
  }

  html += '<script>';
  html += 'document.querySelectorAll(".plugin-toggle").forEach(function(cb){cb.addEventListener("change",function(){';
  html += 'var id=cb.dataset.plugin;cb.disabled=true;';
  html += 'fetch("/api/admin/plugins/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},';
  html += 'body:JSON.stringify({active:cb.checked})}).then(function(res){cb.disabled=false;';
  html += 'if(!res.ok){cb.checked=!cb.checked;alert("Failed to save")}';
  html += 'var span=cb.closest("label").querySelector("span");';
  html += 'if(span)span.textContent=cb.checked?"Active":"Inactive"})})});';
  html += '</script>';

  return html;
}

// ── Pages list ──────────────────────────────────────────────────────

export function pagesBody(): string {
return `<h2 style="margin-bottom:1rem">Pages</h2>
<a href="/admin/pages/new" class="btn btn-primary" style="margin-bottom:1rem">+ New Page</a>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
<tbody id="pages"><tr><td colspan="5" style="text-align:center;color:#64748b">Loading…</td></tr></tbody>
</table></div>
<script>
fetch('/api/admin/pages').then(function(r){return r.json()}).then(function(pages){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var tbody=document.getElementById('pages');
if(!pages.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b">No pages yet.</td></tr>';return}
tbody.innerHTML=pages.map(function(p){return '<tr>'
+'<td><strong>'+ea(p.title)+'</strong></td>'
+'<td style="color:#64748b">/'+ea(p.slug)+'</td>'
+'<td><span class="badge '+(p.published?'badge-pub':'badge-draft')+'">'+(p.published?'Published':'Draft')+'</span></td>'
+'<td style="color:#64748b;font-size:0.85rem">'+new Date(p.updated_at).toLocaleDateString()+'</td>'
+'<td style="display:flex;gap:0.4rem">'
+'<a class="btn btn-sm" href="/admin/pages/edit/'+p.id+'">Edit</a>'
+'<button class="btn btn-sm btn-danger" onclick="del('+p.id+')">Delete</button>'
+'</td></tr>'}).join('')});
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/pages/'+id,{method:'DELETE'}).then(function(){location.reload()})}
</script>`;
}

// ── New page form ──────────────────────────────────────────────────

export function newPageBody(): string {
return `<h2 style="margin-bottom:1.5rem">New Page</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required placeholder="about" /></div>
</div>
<div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Markdown)</span></label><textarea id="content" name="content" required></textarea></div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" checked /> Published</label></div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Save Page</button>
<a href="/admin/pages" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
</form>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
fetch('/api/admin/pages',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:String(fd.get('content')||''),
published:document.getElementById('published').checked
})}).then(function(res){
if(res.ok){
status.style.color='#16a34a';
status.textContent='Saved!';setTimeout(function(){location.href='/admin/pages'},500)}
else{status.style.color='#dc2626';status.textContent='Error saving page'}})});
</script>`;
}

// ── Edit page form ─────────────────────────────────────────────────

export function editPageBody(page: {
id: string | number;
title: string;
slug: string;
content: string;
published: string | number;
updated_at: string;
}): string {
var id = String(page.id);
var checked = (page.published == 1 || page.published === '1') ? 'checked' : '';
return `<h2 style="margin-bottom:1.5rem">Edit Page</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required value="${escAttr(page.title)}" /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required value="${escAttr(page.slug)}" /></div>
</div>
<div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Markdown)</span></label><textarea id="content" name="content" required>${escHtml(page.content)}</textarea></div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" ${checked} /> Published</label></div>
<div style="font-size:0.8rem;color:#64748b;margin-bottom:1rem">Last updated: ${escAttr(page.updated_at)}</div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Update Page</button>
<a href="/admin/pages" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
</form>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
fetch('/api/admin/pages/${id}',{
method:'PATCH',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:String(fd.get('content')||''),
published:document.getElementById('published').checked
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Updated!';setTimeout(function(){location.href='/admin/pages'},500)}
else{status.style.color='#dc2626';status.textContent='Error updating page'}})});
</script>`;
}

// ── Categories editor ──────────────────────────────────────────────

export function categoriesBody(): string {
return `<h2 style="margin-bottom:1.5rem">Categories</h2>
<form id="catForm" style="display:flex;gap:0.75rem;margin-bottom:2rem;max-width:500px">
<div style="flex:1"><label for="name">Category name</label><input type="text" id="name" required /></div>
<div style="flex:1"><label for="slug">Slug</label><input type="text" id="slug" required placeholder="auto" /></div>
<div style="display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary">Add</button></div>
</form>
<div id="status" style="margin-bottom:1rem;font-size:0.9rem"></div>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
<tbody id="cats"></tbody>
</table></div>
<script>
var nameEl=document.getElementById('name');
var slugEl=document.getElementById('slug');
nameEl.addEventListener('input',function(){
slugEl.value=nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function load(){fetch('/api/admin/categories').then(function(r){return r.json()}).then(function(cats){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var tbody=document.getElementById('cats');
if(!cats.length){tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:#64748b">No categories.</td></tr>';return}
tbody.innerHTML=cats.map(function(c){return '<tr>'
+'<td><strong>'+ea(c.name)+'</strong></td>'
+'<td style="color:#64748b">'+ea(c.slug)+'</td>'
+'<td><button class="btn btn-sm btn-danger" onclick="del('+c.id+')">Delete</button></td></tr>'}).join('')})}
document.getElementById('catForm').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
var slug=slugEl.value||nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
fetch('/api/admin/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nameEl.value,slug:slug})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Added!';nameEl.value='';slugEl.value='';load()}
else{status.style.color='#dc2626';status.textContent='Error adding category'}})});
function del(id){if(!confirm('Delete category?'))return;fetch('/api/admin/categories/'+id,{method:'DELETE'}).then(function(){load()})}
load();
</script>`;
}

// ── Navigation editor ──────────────────────────────────────────────

export function navBody(): string {
return `<h2 style="margin-bottom:1.5rem">Navigation</h2>
<p style="color:#64748b;margin-bottom:1.5rem;font-size:0.9rem">Links appear in the header of your public site. The <strong>Admin</strong> link is always included automatically.</p>
<div id="items"></div>
<div style="margin:1rem 0"><button class="btn btn-sm" onclick="addItem()">+ Add Link</button></div>
<button class="btn btn-primary" onclick="save()">Save Navigation</button>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
<script>
var items=[];
function render(){
var html='<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">';
for(var i=0;i<items.length;i++){
html+='<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;border-bottom:1px solid #f1f5f9">';
html+='<input type="text" placeholder="Label" value="'+ea(items[i].label)+'" onchange="items['+i+'].label=this.value" style="flex:1;padding:0.4rem;border:1px solid #cbd5e1;border-radius:3px;font-size:0.9rem" />';
html+='<input type="text" placeholder="URL" value="'+ea(items[i].url)+'" onchange="items['+i+'].url=this.value" style="flex:1;padding:0.4rem;border:1px solid #cbd5e1;border-radius:3px;font-size:0.9rem" />';
html+='<button class="btn btn-sm btn-danger" onclick="removeItem('+i+')">✕</button></div>'}
html+='</div>';
document.getElementById('items').innerHTML=html||'<p style="color:#94a3b8">No navigation links yet.</p>'}
function ea(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function addItem(){items.push({label:'',url:''});render()}
function removeItem(i){items.splice(i,1);render()}
function save(){
var status=document.getElementById('status');
[].forEach.call(document.querySelectorAll('#items input'),function(el,i){if(i%2===0)items[i/2].label=el.value;else items[(i-1)/2].url=el.value});
fetch('/api/admin/nav',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Saved!'}else{status.style.color='#dc2626';status.textContent='Error saving'}})}
fetch('/api/admin/nav').then(function(r){return r.json()}).then(function(data){items=data;render()});
</script>`;
}

// ── Settings page ──────────────────────────────────────────────────

export function settingsBody(current: { imgur_client_id: string; theme: string; available_themes: { id: string; name: string }[] }): string {
const themeOpts = current.available_themes.map(function(t) {
const sel = t.id === current.theme ? ' selected' : '';
return '<option value="' + escAttr(t.id) + '"' + sel + '>' + esc(t.name) + '</option>';
}).join('');
return `<h2 style="margin-bottom:1.5rem">Settings</h2>
<form id="form" style="max-width:500px">
<div class="form-group">
<label for="imgur_client_id">Imgur Client ID <span style="color:#64748b;font-weight:400">(for image uploads)</span></label>
<input type="text" id="imgur_client_id" name="imgur_client_id" value="${escAttr(current.imgur_client_id)}" placeholder="Register at https://api.imgur.com/oauth2/addclient" />
<p style="color:#94a3b8;font-size:0.8rem;margin-top:0.3rem">Paste images into the post editor to auto-upload via Imgur. Get a Client ID by registering an app on Imgur (no auth needed).</p>
</div>
<div class="form-group">
<label for="theme">Public Site Theme</label>
<select id="theme" name="theme" style="width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem;font-family:inherit;background:white">${themeOpts}</select>
<p style="color:#94a3b8;font-size:0.8rem;margin-top:0.3rem">Create your own theme by adding a <code>.ts</code> file to <code>src/themes/</code> and registering it in <code>src/themes/index.ts</code>.</p>
</div>
<button type="submit" class="btn btn-primary">Save Settings</button>
<div id="status" style="margin-top:1rem;font-size:0.9rem"></div>
</form>
<script>
document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
fetch('/api/admin/settings',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
imgur_client_id:document.getElementById('imgur_client_id').value,
theme:document.getElementById('theme').value
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Saved!';setTimeout(function(){location.reload()},800)}
else{status.style.color='#dc2626';status.textContent='Error saving settings'}})});
</script>`;
}

// ── Escaping helpers ──────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;')
           .replace(/"/g, '&quot;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;');
}
