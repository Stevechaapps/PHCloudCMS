// src/admin.ts — Admin panel HTML pages
// Uses multi-line template strings to stay within TS parser limits.

// ── Layout shell (sidebar + topbar + content slot) ──────────────────

export function adminShell(title: string, bodyHtml: string): string {
  const styles = [
    "*{margin:0;padding:0;box-sizing:border-box}",
    "body{font-family:system-ui,sans-serif;background:#f8fafc;color:#1e293b}",
    ".topbar{background:#0f172a;color:white;padding:0 2rem;height:52px;display:flex;align-items:center;justify-content:space-between}",
    ".topbar a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85rem}",
    ".topbar a:hover{color:white}",
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
    ".toolbar .sep{width:1px;background:#e2e8f0;margin:0 0.25rem}",
    ".preview-box{background:white;border:1px solid #e2e8f0;border-radius:0 0 5px 5px;padding:1rem;min-height:200px;font-size:0.9rem;line-height:1.7;display:none;overflow-y:auto}",
    ".preview-box h1{font-size:1.4rem;margin:0.5rem 0}.preview-box h2{font-size:1.2rem;margin:0.4rem 0}.preview-box h3{font-size:1.05rem;margin:0.3rem 0}.preview-box p{margin:0.5rem 0}.preview-box code{background:#f1f5f9;padding:0.1rem 0.3rem;border-radius:3px;font-size:0.85em}.preview-box img{max-width:100%;border-radius:4px;margin:0.5rem 0}",
    ".form-group{margin-bottom:1.25rem}",
    "label{display:block;font-weight:500;margin-bottom:0.4rem;font-size:0.9rem}",
    'input[type="text"],textarea{width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem;font-family:inherit}',
    "textarea{min-height:320px;font-family:monospace;font-size:0.9rem;line-height:1.5}",
    ".row{display:flex;gap:1rem}",
    ".row .form-group{flex:1}",
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
<nav>
<a href="/admin">Dashboard</a>
<a href="/admin/posts">Posts</a>
<a href="/admin/pages">Pages</a>
<a href="/admin/new">New Post</a>
<a href="/admin/images">Images</a>
<a href="/admin/plugins">Plugins</a>
<a href="/admin/tags">Tags</a>
<a href="/admin/nav">Navigation</a>
<a href="/admin/settings">Settings</a>
<a href="/" style="margin-left:1rem">View Site</a>
<button type="button" onclick="logout()" style="margin-left:1rem;background:transparent;border:none;color:#f87171;cursor:pointer;font-size:0.85rem">Logout</button>
</nav>
</div>
<div class="layout">
<aside class="sidebar">
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
<div id="pagination" style="display:flex;justify-content:center;gap:0.5rem;margin-top:1rem;align-items:center"></div>
<script>
function renderAdminPage(page,totalPages){var nav=document.getElementById('pagination');if(totalPages<=1){nav.innerHTML='';return}
var h='';if(page>1)h+='<a href="?page='+(page-1)+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">← Prev</a>';
for(var i=1;i<=totalPages;i++){if(i===page)h+='<span style="padding:0.3rem 0.6rem;background:#0f172a;color:white;border-radius:4px;font-weight:600;font-size:0.85rem">'+i+'</span>';else h+='<a href="?page='+i+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">'+i+'</a>'}
if(page<totalPages)h+='<a href="?page='+(page+1)+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">Next →</a>';nav.innerHTML=h}
function loadPosts(){var page=parseInt(location.search.match(/[?&]page=(\d+)/)||[,'1'],10);
fetch('/api/admin/posts?page='+page).then(function(r){return r.json()}).then(function(data){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
document.getElementById('total').textContent=data.total;
document.getElementById('pub').textContent=data.results.filter(function(p){return p.published}).length;
var tbody=document.getElementById('posts');
if(!data.results.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b">No posts yet. <a href="/admin/new">Create one</a>.</td></tr>';return}
tbody.innerHTML=data.results.map(function(p){
return '<tr>'
+'<td><strong>'+ea(p.title)+'</strong></td>'
+'<td style="color:#64748b">/'+ea(p.slug)+'</td>'
+'<td><span class="badge '+(p.published?'badge-pub':'badge-draft')+'">'+(p.published?'Published':'Draft')+'</span></td>'
+'<td style="color:#64748b;font-size:0.85rem">'+new Date(p.updated_at).toLocaleDateString()+'</td>'
+'<td style="display:flex;gap:0.4rem">'
+'<a class="btn btn-sm" href="/admin/edit/'+p.id+'">Edit</a>'
+'<button class="btn btn-sm btn-danger" onclick="del('+p.id+')">Delete</button>'
+'</td></tr>'}).join('')});renderAdminPage(data.page,data.totalPages)}
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(){location.reload()})}
loadPosts();</script>`;
}

// ── Posts list ─────────────────────────────────────────────────────

export function postsBody(): string {
  return `<h2 style="margin-bottom:1rem">All Posts</h2>
<a href="/admin/new" class="btn btn-primary" style="margin-bottom:1rem">+ New Post</a>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
<tbody id="posts"><tr><td colspan="5" style="text-align:center;color:#64748b">Loading…</td></tr></tbody>
</table></div>
<div id="pagination" style="display:flex;justify-content:center;gap:0.5rem;margin-top:1rem;align-items:center"></div>
<script>
function renderAdminPage(page,totalPages){var nav=document.getElementById('pagination');if(totalPages<=1){nav.innerHTML='';return}
var h='';if(page>1)h+='<a href="?page='+(page-1)+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">← Prev</a>';
for(var i=1;i<=totalPages;i++){if(i===page)h+='<span style="padding:0.3rem 0.6rem;background:#0f172a;color:white;border-radius:4px;font-weight:600;font-size:0.85rem">'+i+'</span>';else h+='<a href="?page='+i+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">'+i+'</a>'}
if(page<totalPages)h+='<a href="?page='+(page+1)+'" style="padding:0.3rem 0.6rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6;font-size:0.85rem">Next →</a>';nav.innerHTML=h}
function loadPosts(){var page=parseInt(location.search.match(/[?&]page=(\d+)/)||[,'1'],10);
fetch('/api/admin/posts?page='+page).then(function(r){return r.json()}).then(function(data){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var tbody=document.getElementById('posts');
if(!data.results.length){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#64748b">No posts yet.</td></tr>';return}
tbody.innerHTML=data.results.map(function(p){return '<tr>'
+'<td><strong>'+ea(p.title)+'</strong></td>'
+'<td style="color:#64748b">/'+ea(p.slug)+'</td>'
+'<td><span class="badge '+(p.published?'badge-pub':'badge-draft')+'">'+(p.published?'Published':'Draft')+'</span></td>'
+'<td style="color:#64748b;font-size:0.85rem">'+new Date(p.updated_at).toLocaleDateString()+'</td>'
+'<td style="display:flex;gap:0.4rem">'
+'<a class="btn btn-sm" href="/admin/edit/'+p.id+'">Edit</a>'
+'<button class="btn btn-sm btn-danger" onclick="del('+p.id+')">Delete</button>'
+'</td></tr>'}).join('')});renderAdminPage(data.page,data.totalPages)}
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(){location.reload()})}
loadPosts();</script>`;
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
<div class="form-group">
  <label for="content">Content <span style="color:#6474b;font-weight:400">(Markdown)</span> <button type="button" onclick="togglePreview(event)" class="btn btn-sm" style="float:right" title="Toggle preview" aria-label="Toggle preview">Preview</button></label>
  <div class="toolbar">
    <button type="button" onclick="mdWrap(event,'**','bold')" title="Bold" aria-label="Bold"><strong>B</strong></button>
    <button type="button" onclick="mdWrap(event,'*','italic')" title="Italic" aria-label="Italic"><em>I</em></button>
    <span class="sep"></span>
    <button type="button" onclick="mdLine(event,'## ')" title="Heading 2" aria-label="Heading 2">H2</button>
    <button type="button" onclick="mdLine(event,'### ')" title="Heading 3" aria-label="Heading 3">H3</button>
    <span class="sep"></span>
    <button type="button" onclick=\"mdLink(event)\" title=\"Link\" aria-label=\"Insert link\">Link</button>
    <button type="button" onclick=\"mdImage(event)\" title=\"Image\" aria-label=\"Insert image\">Img</button>
    <span class="sep"></span>
    <button type="button" onclick="mdLine(event,'> ')" title="Blockquote" aria-label="Insert blockquote">Quote</button>
    <button type="button" onclick="mdLine(event,'- ')" title="List item" aria-label="Insert list item">List</button>
  </div>
  <div id="editor-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;min-height:320px">
    <textarea id="content" name="content" required style="min-height:300px;resize:vertical"></textarea>
    <div class="preview-box" id="preview" style="display:none;min-height:300px"></div>
  </div>
</div>
<div class="form-group">
<label>Tags</label>
<div id="tagCheckboxes" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.3rem"></div>
</div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" /> Publish immediately</label></div>
<div class="form-group"><label><input type="checkbox" id="schedule" onchange="scheduleToggle()" /> Schedule for later</label>
<input type="datetime-local" id="publish_at" name="publish_at" style="display:none;margin-top:0.4rem" /></div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Save Post</button>
<a href="/admin/posts" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
</form>
<script>
function scheduleToggle(){var s=document.getElementById('schedule'),p=document.getElementById('publish_at'),c=document.getElementById('published');if(s.checked){p.style.display='block';c.checked=false}else{p.style.display='none';p.value=''}}
</script>
<script>
function mdWrap(e,c,ph){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||ph||'text';ta.value=val.substring(0,s)+c+sel+c+val.substring(en);ta.selectionStart=s+c.length;ta.selectionEnd=s+c.length+sel.length;ta.focus()}
function mdLine(e,p){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart;var ls=ta.value.lastIndexOf(String.fromCharCode(10),s-1)+1;ta.value=ta.value.substring(0,ls)+p+ta.value.substring(ls);ta.selectionStart=ta.selectionEnd=s+p.length;ta.focus()}
function mdLink(e){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||'link text';ta.value=val.substring(0,s)+'['+sel+'](url)'+val.substring(en);ta.selectionStart=s+sel.length+2;ta.selectionEnd=s+sel.length+2+3;ta.focus()}
function mdImage(e){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||'alt';ta.value=val.substring(0,s)+'!['+sel+'](url)'+val.substring(en);ta.selectionStart=s+sel.length+3;ta.selectionEnd=s+sel.length+3+3;ta.focus()}
function togglePreview(e){if(e){e.preventDefault()}var ta=document.getElementById('content'),pre=document.getElementById('preview');if(pre.style.display==='block'){pre.style.display='none';ta.style.display='block';return}ta.style.display='none';pre.style.display='block';if(pre.textContent===''||pre.textContent==='…')renderPreview(ta.value,pre)}function renderPreview(content,pre){pre.textContent='…';fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content})}).then(function(r){return r.json()}).then(function(data){pre.innerHTML=data.html}).catch(function(){pre.textContent='Preview failed'})}
</script>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
fetch('/api/admin/tags').then(function(r){return r.json()}).then(function(cats){
var html='';
for(var i=0;i<cats.length;i++){
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+cats[i].id+'" class="tag-cb" /> '+cats[i].name+'</label>'}
document.getElementById('tagCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No tags yet. <a href="/admin/tags">Manage tags</a>.</span>'});
function getTagIds(){var ids=[];[].forEach.call(document.querySelectorAll('.tag-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
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
publish_at:document.getElementById('publish_at').value||null,
tag_ids:getTagIds()
})}).then(function(res){
if(res.ok){
res.json().then(function(p){
status.style.color='#16a34a';
status.textContent='Saved! Redirecting…';
setTimeout(function(){location.href='/admin/edit/'+p.id},500)})}
 else{status.style.color='#dc2626';status.textContent='Error saving post'}})});
</script>
<script>
var contentTa=document.getElementById('content');
contentTa.addEventListener('paste',function(e){
var files=e.clipboardData.files;
if(!files.length)return;
var file=files[0];
if(!file.type.startsWith('image/'))return;
e.preventDefault();
var ta=this;
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Processing image…';
var reader=new FileReader();
reader.onload=function(ev){
var img=new Image();
img.onload=function(){
var MAX_W=1200;
var w=img.width,h=img.height;
if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement('canvas');
c.width=w;c.height=h;
var ctx=c.getContext('2d');
ctx.drawImage(img,0,0,w,h);
c.toBlob(function(blob){
var r2=new FileReader();
r2.onload=function(ev2){
var dataUrl=ev2.target.result;
status.textContent='Uploading…';
fetch('/api/admin/images',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({data:dataUrl,filename:file.name||'paste.webp'})
}).then(function(r){return r.json()}).then(function(res){
if(res.url){
var markdown='![]('+res.url+')';
var start=ta.selectionStart,end=ta.selectionEnd;
var val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;
ta.focus();
status.style.color='#16a34a';
status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Upload error'})};
r2.readAsDataURL(blob)},'image/webp',0.7)};
img.src=ev.target.result};
reader.readAsDataURL(file)});
</script><script>
(function(){
var ta=document.getElementById('content'),pre=document.getElementById('preview'),wrap=document.getElementById('editor-wrap'),debounce=null;
ta.addEventListener('input',function(){clearTimeout(debounce);debounce=setTimeout(function(){if(pre.style.display==='block')renderPreview(ta.value,pre)},400)});
wrap.addEventListener('dragover',function(e){e.preventDefault();wrap.style.outline='2px dashed #3b82f6';wrap.style.outlineOffset='-2px'},false);
wrap.addEventListener('dragleave',function(){wrap.style.outline='';wrap.style.outlineOffset=''},false);
wrap.addEventListener('drop',function(e){e.preventDefault();wrap.style.outline='';wrap.style.outlineOffset='';var files=e.dataTransfer.files;if(!files.length)return;var file=files[0];if(!file.type.startsWith('image/'))return;uploadImageToMarkdown(file,ta)},false);
function uploadImageToMarkdown(file,ta){
var status=document.getElementById('status');status.style.color='#2563eb';status.textContent='Processing image…';
var reader=new FileReader();
reader.onload=function(ev){
var img=new Image();img.onload=function(){
var MAX_W=1200,w=img.width,h=img.height;if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement("canvas");c.width=w;c.height=h;var ctx=c.getContext("2d");ctx.drawImage(img,0,0,w,h);
c.toBlob(function(blob){var r2=new FileReader();r2.onload=function(ev2){var dataUrl=ev2.target.result;status.textContent="Uploading…";
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:dataUrl,filename:file.name||'drop.webp'})})
.then(function(r){return r.json()}).then(function(res){
if(res.url){var markdown="![]("+res.url+")";
var start=ta.selectionStart,end=ta.selectionEnd,val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;ta.focus();
if(pre.style.display==="block")renderPreview(ta.value,pre);
status.style.color='#16a34a';status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}
}).catch(function(){status.style.color="#dc2626";status.textContent="Upload error"})};
r2.readAsDataURL(blob)},"image/webp",0.7)};
img.src=ev.target.result};reader.readAsDataURL(file)};
};
})();
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
  publish_at?: string | null;
  preview_token?: string | null;
  updated_at: string;
}): string {
  var id = String(post.id);
  var checked = post.published == 1 || post.published === "1" ? "checked" : "";
  var hasSchedule = !!post.publish_at;
  var scheduleChecked = hasSchedule ? "checked" : "";
  var previewLink = post.preview_token
    ? "/" + post.slug + "?preview=" + post.preview_token
    : "";
  return `<h2 style="margin-bottom:1.5rem">Edit Post</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required value="${escAttr(post.title)}" /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required value="${escAttr(post.slug)}" /></div>
</div>
<div class="form-group"><label for="excerpt">Excerpt <span style="color:#64748b;font-weight:400">(optional)</span></label><input type="text" id="excerpt" name="excerpt" value="${escAttr(String(post.excerpt ?? ""))}" /></div>
 <div class="form-group">
  <label for="content">Content <span style="color:#64748b;font-weight:400">(Markdown)</span> <button type="button" onclick="togglePreview(event)" class="btn btn-sm" style="float:right" title="Toggle preview" aria-label="Toggle preview">Preview</button></label>
  <div class="toolbar">
    <button type="button" onclick="mdWrap(event,'**','bold')" title="Bold" aria-label="Bold"><strong>B</strong></button>
    <button type="button" onclick="mdWrap(event,'*','italic')" title="Italic" aria-label="Italic"><em>I</em></button>
    <span class="sep"></span>
    <button type="button" onclick="mdLine(event,'## ')" title="Heading 2" aria-label="Heading 2">H2</button>
    <button type="button" onclick="mdLine(event,'### ')" title="Heading 3" aria-label="Heading 3">H3</button>
    <span class="sep"></span>
    <button type="button" onclick=\"mdLink(event)\" title=\"Link\" aria-label=\"Insert link\">Link</button>
    <button type="button" onclick=\"mdImage(event)\" title=\"Image\" aria-label=\"Insert image\">Img</button>
    <span class="sep"></span>
    <button type="button" onclick="mdLine(event,'> ')" title="Blockquote" aria-label="Insert blockquote">Quote</button>
    <button type="button" onclick="mdLine(event,'- ')" title="List item" aria-label="Insert list item">List</button>
  </div>
  <div id="editor-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;min-height:320px">
    <textarea id="content" name="content" required style="min-height:300px;resize:vertical">${escHtml(post.content)}</textarea>
    <div class="preview-box" id="preview" style="display:none;min-height:300px"></div>
  </div>
</div>
<div class="form-group">
<label>Tags</label>
<div id="tagCheckboxes" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.3rem"></div>
</div>
<div class="form-group"><label><input type="checkbox" id="published" name="published" ${checked} /> Published</label></div>
<div class="form-group"><label><input type="checkbox" id="schedule" onchange="scheduleToggle()" ${scheduleChecked} /> Schedule for later</label>
<input type="datetime-local" id="publish_at" name="publish_at" style="${hasSchedule ? "display:block" : "display:none"};margin-top:0.4rem" value="${post.publish_at ? post.publish_at.replace("Z", "").substring(0, 19) : ""}" /></div>
${previewLink ? '<div style="font-size:0.85rem;margin-bottom:0.75rem"><a href="' + previewLink + '" target="_blank" style="color:#3b82f6;text-decoration:none">Preview unpublished post ↗</a></div>' : ""}
<div style="font-size:0.8rem;color:#64748b;margin-bottom:1rem">Last updated: ${escAttr(post.updated_at)}</div>
<div style="display:flex;gap:0.75rem">
<button type="submit" class="btn btn-primary">Update Post</button>
<a href="/admin/posts" class="btn" style="background:#e5e7eb;color:#1e293b">Cancel</a>
</div>
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
</form>
<script>
function scheduleToggle(){var s=document.getElementById('schedule'),p=document.getElementById('publish_at'),c=document.getElementById('published');if(s.checked){p.style.display='block';c.checked=false}else{p.style.display='none';p.value=''}}
</script>
<script>
function mdWrap(e,c,ph){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||ph||'text';ta.value=val.substring(0,s)+c+sel+c+val.substring(en);ta.selectionStart=s+c.length;ta.selectionEnd=s+c.length+sel.length;ta.focus()}
function mdLine(e,p){e.preventDefault();var ta=document.getElementById('content');var ls=ta.value.lastIndexOf(String.fromCharCode(10),ta.selectionStart-1)+1;ta.value=ta.value.substring(0,ls)+p+ta.value.substring(ls);ta.selectionStart=ta.selectionEnd=ta.selectionStart+p.length;ta.focus()}
function mdLink(e){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||'link text';ta.value=val.substring(0,s)+'['+sel+'](url)'+val.substring(en);ta.selectionStart=s+sel.length+2;ta.selectionEnd=s+sel.length+2+3;ta.focus()}
function mdImage(e){e.preventDefault();var ta=document.getElementById('content'),s=ta.selectionStart,en=ta.selectionEnd,val=ta.value,sel=val.substring(s,en)||'alt';ta.value=val.substring(0,s)+'!['+sel+'](url)'+val.substring(en);ta.selectionStart=s+sel.length+3;ta.selectionEnd=s+sel.length+3+3;ta.focus()}
function togglePreview(e){if(e){e.preventDefault()}var ta=document.getElementById('content'),pre=document.getElementById('preview');if(pre.style.display==='block'){pre.style.display='none';ta.style.display='block';return}ta.style.display='none';pre.style.display='block';if(pre.textContent===''||pre.textContent==='…')renderPreview(ta.value,pre)}function renderPreview(content,pre){pre.textContent='…';fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content})}).then(function(r){return r.json()}).then(function(data){pre.innerHTML=data.html}).catch(function(){pre.textContent='Preview failed'})}
</script>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function getTagIds(){var ids=[];[].forEach.call(document.querySelectorAll('.tag-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
var postCatReq=fetch('/api/admin/posts/${id}/tags').then(function(r){return r.json()});
var allCatReq=fetch('/api/admin/tags').then(function(r){return r.json()});
Promise.all([postCatReq,allCatReq]).then(function(results){
var postCatIds=results[0].map(function(c){return c.id});
var cats=results[1];
var html='';
for(var i=0;i<cats.length;i++){
var checked=postCatIds.indexOf(cats[i].id)!==-1?' checked':'';
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+cats[i].id+'" class="tag-cb"'+checked+' /> '+cats[i].name+'</label>'}
document.getElementById('catCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No tags yet.</span>'});

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
publish_at:document.getElementById('publish_at').value||null,
tag_ids:getTagIds()
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Updated!'}
else{status.style.color='#dc2626';status.textContent='Error updating post'}})});
</script>
<script>
var contentTa=document.getElementById('content');
contentTa.addEventListener('paste',function(e){
var files=e.clipboardData.files;
if(!files.length)return;
var file=files[0];
if(!file.type.startsWith('image/'))return;
e.preventDefault();
var ta=this;
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Processing image…';
var reader=new FileReader();
reader.onload=function(ev){
var img=new Image();
img.onload=function(){
var MAX_W=1200;
var w=img.width,h=img.height;
if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement('canvas');
c.width=w;c.height=h;
var ctx=c.getContext('2d');
ctx.drawImage(img,0,0,w,h);
c.toBlob(function(blob){
var r2=new FileReader();
r2.onload=function(ev2){
var dataUrl=ev2.target.result;
status.textContent='Uploading…';
fetch('/api/admin/images',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({data:dataUrl,filename:file.name||'paste.webp'})
}).then(function(r){return r.json()}).then(function(res){
if(res.url){
var markdown='![]('+res.url+')';
var start=ta.selectionStart,end=ta.selectionEnd;
var val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;
ta.focus();
status.style.color='#16a34a';
status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Upload error'})};
r2.readAsDataURL(blob)},'image/webp',0.7)};
img.src=ev.target.result};
reader.readAsDataURL(file)});
</script><script>
(function(){
var ta=document.getElementById('content'),pre=document.getElementById('preview'),wrap=document.getElementById('editor-wrap'),debounce=null;
ta.addEventListener('input',function(){clearTimeout(debounce);debounce=setTimeout(function(){if(pre.style.display==='block')renderPreview(ta.value,pre)},400)});
wrap.addEventListener('dragover',function(e){e.preventDefault();wrap.style.outline='2px dashed #3b82f6';wrap.style.outlineOffset='-2px'},false);
wrap.addEventListener('dragleave',function(){wrap.style.outline='';wrap.style.outlineOffset=''},false);
wrap.addEventListener('drop',function(e){e.preventDefault();wrap.style.outline='';wrap.style.outlineOffset='';var files=e.dataTransfer.files;if(!files.length)return;var file=files[0];if(!file.type.startsWith('image/'))return;uploadImageToMarkdown(file,ta)},false);
function uploadImageToMarkdown(file,ta){
var status=document.getElementById('status');status.style.color='#2563eb';status.textContent='Processing image…';
var reader=new FileReader();
reader.onload=function(ev){
var img=new Image();img.onload=function(){
var MAX_W=1200,w=img.width,h=img.height;if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement("canvas");c.width=w;c.height=h;var ctx=c.getContext("2d");ctx.drawImage(img,0,0,w,h);
c.toBlob(function(blob){var r2=new FileReader();r2.onload=function(ev2){var dataUrl=ev2.target.result;status.textContent="Uploading…";
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:dataUrl,filename:file.name||'drop.webp'})})
.then(function(r){return r.json()}).then(function(res){
if(res.url){var markdown="![]("+res.url+")";
var start=ta.selectionStart,end=ta.selectionEnd,val=ta.value;
ta.value=val.substring(0,start)+markdown+val.substring(end);
ta.selectionStart=ta.selectionEnd=start+markdown.length;ta.focus();
if(pre.style.display==="block")renderPreview(ta.value,pre);
status.style.color='#16a34a';status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}
}).catch(function(){status.style.color="#dc2626";status.textContent="Upload error"})};
r2.readAsDataURL(blob)},"image/webp",0.7)};
img.src=ev.target.result};reader.readAsDataURL(file)};
};
})();
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
  { key: "seo", label: "SEO" },
  { key: "security", label: "Security" },
  { key: "forms", label: "Forms" },
  { key: "analytics", label: "Analytics" },
  { key: "backup", label: "Backup & Export" },
  { key: "ecommerce", label: "E-Commerce" },
  { key: "social", label: "Social" },
  { key: "media", label: "Media" },
  { key: "custom", label: "Custom" },
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
  activePluginIds: Set<string>,
): string {
  var byCategory: Record<string, typeof availablePlugins> = {};
  for (var i = 0; i < availablePlugins.length; i++) {
    var p = availablePlugins[i];
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  var html = '<h2 style="margin-bottom:0.5rem">Plugins</h2>';
  html +=
    '<p style="color:#64748b;margin-bottom:2rem;font-size:0.9rem">Toggle plugins on or off. Changes take effect immediately.</p>';

  for (var c = 0; c < PLUGIN_CATEGORIES.length; c++) {
    var cat = PLUGIN_CATEGORIES[c];
    var plugins = byCategory[cat.key];
    if (!plugins || !plugins.length) continue;

    html +=
      '<h3 style="margin:2rem 0 1rem;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b">';
    html += esc(cat.label) + "</h3>";
    html +=
      '<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:1.5rem">';

    for (var j = 0; j < plugins.length; j++) {
      var pl = plugins[j];
      var isActive = activePluginIds.has(pl.id);
      html +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;';
      html += 'border-bottom:1px solid #f1f5f9">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:0.95rem">' + esc(pl.name);
      html +=
        ' <span style="font-weight:400;color:#94a3b8;font-size:0.8rem">v' +
        esc(pl.version) +
        "</span></div>";
      html +=
        '<div style="color:#64748b;font-size:0.85rem;margin-top:0.2rem">' +
        esc(pl.description) +
        "</div>";
      html +=
        '<div style="color:#94a3b8;font-size:0.75rem;margin-top:0.3rem">by ' +
        esc(pl.author);
      html += " · hooks: " + esc(pl.hooks.join(", ")) + "</div>";
      html += "</div>";
      html += '<div style="margin-left:1.5rem;flex-shrink:0">';
      html +=
        '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">';
      html +=
        '<input type="checkbox" class="plugin-toggle" data-plugin="' +
        escAttr(pl.id) +
        '"';
      html += isActive ? " checked" : "";
      html += " />";
      html +=
        '<span style="font-size:0.85rem;color:#64748b">' +
        (isActive ? "Active" : "Inactive") +
        "</span>";
      html += "</label></div></div>";
    }

    html += "</div>";
  }

  if (!availablePlugins.length) {
    html +=
      '<div style="text-align:center;padding:3rem;color:#64748b">No plugins available.';
    html +=
      " Add files to <code>src/plugins/</code> and list them in <code>src/plugins/index.ts</code>.</div>";
  }

  html += "<script>";
  html +=
    'document.querySelectorAll(".plugin-toggle").forEach(function(cb){cb.addEventListener("change",function(){';
  html += "var id=cb.dataset.plugin;cb.disabled=true;";
  html +=
    'fetch("/api/admin/plugins/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},';
  html +=
    "body:JSON.stringify({active:cb.checked})}).then(function(res){cb.disabled=false;";
  html += 'if(!res.ok){cb.checked=!cb.checked;alert("Failed to save")}';
  html += 'var span=cb.closest("label").querySelector("span");';
  html += 'if(span)span.textContent=cb.checked?"Active":"Inactive"})})});';
  html += "</script>";

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
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
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
  var checked = page.published == 1 || page.published === "1" ? "checked" : "";
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
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
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

// ── Tags editor ────────────────────────────────────────────────────

export function tagsBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Tags</h2>
<form id="tagForm" style="display:flex;gap:0.75rem;margin-bottom:2rem;max-width:500px">
<div style="flex:1"><label for="name">Tag name</label><input type="text" id="name" required /></div>
<div style="flex:1"><label for="slug">Slug</label><input type="text" id="slug" required placeholder="auto" /></div>
<div style="display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary">Add</button></div>
</form>
<div id="status" style="margin-bottom:1rem;font-size:0.9rem"></div>
<div style="background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
<table><thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
<tbody id="tags"></tbody>
</table></div>
<script>
var nameEl=document.getElementById('name');
var slugEl=document.getElementById('slug');
nameEl.addEventListener('input',function(){
slugEl.value=nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function load(){fetch('/api/admin/tags').then(function(r){return r.json()}).then(function(tags){
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var tbody=document.getElementById('tags');
if(!tags.length){tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:#64748b">No tags yet.</td></tr>';return}
tbody.innerHTML=tags.map(function(t){return '<tr>'
+'<td><strong>'+ea(t.name)+'</strong></td>'
+'<td style="color:#64748b">'+ea(t.slug)+'</td>'
+'<td><button class="btn btn-sm btn-danger" onclick="del('+t.id+')">Delete</button></td></tr>'}).join('')})}
document.getElementById('tagForm').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
var slug=slugEl.value||nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
fetch('/api/admin/tags',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nameEl.value,slug:slug})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Added!';nameEl.value='';slugEl.value='';load()}
else{status.style.color='#dc2626';status.textContent='Error adding tag'}})});
function del(id){if(!confirm('Delete tag?'))return;fetch('/api/admin/tags/'+id,{method:'DELETE'}).then(function(){load()})}
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
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
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

export function settingsBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Settings</h2>
<form id="settingsForm" style="max-width:600px">
<div class="form-group"><label for="siteName">Site Name</label><input type="text" id="siteName" required /></div>
<div class="form-group"><label for="seoDescription">Site Description <span style="color:#64748b;font-weight:400">(meta description)</span></label><input type="text" id="seoDescription" /></div>
<div class="form-group">
<label>Site Logo</label>
<div id="logoPreview" style="margin-bottom:0.5rem"></div>
<input type="file" id="logoFile" accept="image/*" />
</div>
<button type="submit" class="btn btn-primary">Save Settings</button>
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
</form>
<script>
fetch('/api/admin/settings').then(function(r){return r.json()}).then(function(s){
document.getElementById('siteName').value=s.site_name;
document.getElementById('seoDescription').value=s.seo_description;
if(s.site_logo){document.getElementById('logoPreview').innerHTML='<img src="'+s.site_logo+'" style="max-width:120px;max-height:60px;border:1px solid #e5e7eb;border-radius:4px" />'}});
document.getElementById('settingsForm').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var data={site_name:document.getElementById('siteName').value,seo_description:document.getElementById('seoDescription').value};
var logoFile=document.getElementById('logoFile').files[0];
if(logoFile){
var reader=new FileReader();
reader.onload=function(ev){
var img=new Image();
img.onload=function(){
var MAX_W=600;
var w=img.width,h=img.height;
if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement('canvas');
c.width=w;c.height=h;
var ctx=c.getContext('2d');
ctx.drawImage(img,0,0,w,h);
c.toBlob(function(blob){
var r2=new FileReader();
r2.onload=function(ev2){
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:ev2.target.result,filename:'logo.webp'})}).then(function(r){return r.json()}).then(function(res){
if(res.url){data.site_logo=res.url;saveSettings(data,status)}
else{status.style.color='#dc2626';status.textContent='Logo upload failed'}})};
r2.readAsDataURL(blob)},'image/webp',0.7)};
img.src=ev.target.result};
reader.readAsDataURL(logoFile)}
else{saveSettings(data,status)}});
function saveSettings(data,status){
fetch('/api/admin/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){
if(r.ok){status.style.color='#16a34a';status.textContent='Saved!';location.reload()}
else{status.style.color='#dc2626';status.textContent='Error saving settings'}})}
</script>`;
}

// ── Image Library page ─────────────────────────────────────────────

export function imagesBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Image Library</h2>
<div id="imgCount" style="margin-bottom:1rem;color:#64748b;font-size:0.85rem"></div>
<div id="imageGrid" class="image-grid"></div>
<style>
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}
.image-card{background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.image-card .thumb{width:100%;height:140px;overflow:hidden;background:#f8fafc;display:flex;align-items:center;justify-content:center}
.image-card .thumb img{width:100%;height:100%;object-fit:cover}
.image-card .info{padding:0.6rem;display:flex;flex-direction:column;gap:0.2rem;flex:1}
.image-card .info .name{font-size:0.8rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.image-card .info .meta{font-size:0.75rem;color:#64748b}
.image-card .info .actions{margin-top:0.4rem}
</style>
<script>
function ea(s){return s.replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'&#39;')}
function fmtSize(b){return b>1048576?(b/1048576).toFixed(1)+' MB':b>1024?(b/1024).toFixed(1)+' KB':b+' B'}
fetch('/api/admin/images').then(function(r){return r.json()}).then(function(data){var imgs=data.results||[];
document.getElementById('imgCount').textContent=data.total+' image'+(data.total===1?'':'s');
var grid=document.getElementById('imageGrid');
if(!imgs.length){grid.innerHTML='<p style="color:#64748b;grid-column:1/-1">No images uploaded yet. Upload images from the post editor.</p>';return}
grid.innerHTML=imgs.map(function(img){
return '<div class="image-card">'
+'<div class="thumb"><img src="/img/'+img.id+'" alt="'+ea(img.filename)+'" loading="lazy" /></div>'
+'<div class="info">'
+'<div class="name" title="'+ea(img.filename)+'">'+ea(img.filename)+'</div>'
+'<div class="meta">'+fmtSize(img.size)+' · '+new Date(img.created_at).toLocaleDateString()+'</div>'
+'<div class="actions"><button class="btn btn-sm btn-danger" onclick="delImg('+img.id+')">Delete</button></div>'
+'</div></div>'}).join('');
if(data.totalPages>1)document.getElementById('imgCount').innerHTML+=' <span style="font-weight:400">Page '+data.page+' of '+data.totalPages+'</span>';});
function delImg(id){if(!confirm('Delete this image? This action cannot be undone.'))return;fetch('/api/admin/images/'+id,{method:'DELETE'}).then(function(){location.reload()})}
</script>`;
}

// ── Escaping helpers ──────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
