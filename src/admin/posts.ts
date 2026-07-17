// src/admin/posts.ts — posts admin: list, new-post form, edit-post form.
// The post-editor widget JS lives in src/admin/editor.ts (one shared copy of
// the fragile editor strings); Phase 4 swaps that module for a rich-text editor.

import { escAttr } from "../cms/escape.js";
import { sanitizePostHtml } from "../cms/sanitize.js";
import { SCHEDULE_TOGGLE_SCRIPT, EDITOR_FORMAT_SCRIPTS, PASTE_IMAGE_SCRIPT, DROP_IMAGE_SCRIPT } from "./editor.js";

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
function loadPosts(){var page=parseInt(location.search.match(/[?&]page=(\\d+)/)||[,'1'],10);
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
+'</td></tr>'}).join('');renderAdminPage(data.page,data.totalPages)}).catch(function(e){console.error('loadPosts failed',e);window.location.href='/admin/login'})
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('fail');location.reload()}).catch(function(){alert('Delete failed.')})}
}
loadPosts();</script>`;
}

export function newPostBody(): string {
  return `<h2 style="margin-bottom:1.5rem">New Post</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required /></div>
</div>
<div class="form-group"><label for="excerpt">Excerpt <span style="color:#64748b;font-weight:400">(optional)</span></label><textarea id="excerpt" name="excerpt" rows="2"></textarea></div>
<div class="form-group">
  <label for="content">Content <span style="color:#64748b;font-weight:400">(Rich text)</span></label>
  <div class="toolbar">
    <button type="button" onmousedown="event.preventDefault();rteCmd('bold')" title="Bold" aria-label="Bold"><strong>B</strong></button>
    <button type="button" onmousedown="event.preventDefault();rteCmd('italic')" title="Italic" aria-label="Italic"><em>I</em></button>
    <span class="sep"></span>
    <button type="button" onmousedown="event.preventDefault();rteHead('<h2>')" title="Heading 2" aria-label="Heading 2">H2</button>
    <button type="button" onmousedown="event.preventDefault();rteHead('<h3>')" title="Heading 3" aria-label="Heading 3">H3</button>
    <span class="sep"></span>
    <button type="button" onmousedown="rteLink(event)" title="Link" aria-label="Insert link">Link</button>
    <button type="button" onmousedown="rteImg(event)" title="Image by URL" aria-label="Insert image by URL">Img</button>
    <span class="sep"></span>
    <button type="button" onmousedown="event.preventDefault();rteHead('<blockquote>')" title="Blockquote" aria-label="Insert blockquote">Quote</button>
    <button type="button" onmousedown="event.preventDefault();rteCmd('insertUnorderedList')" title="List item" aria-label="Insert list item">List</button>
  </div>
  <div id="editor-wrap" style="min-height:320px">
    <div id="content" class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Post content" data-ph="Write your post…"></div>
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
<script>${SCHEDULE_TOGGLE_SCRIPT}</script>
<script>${EDITOR_FORMAT_SCRIPTS}</script>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function ea(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
fetch('/api/admin/tags').then(function(r){return r.json()}).then(function(cats){
var html='';
for(var i=0;i<cats.length;i++){
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+ea(cats[i].id)+'" class="tag-cb" /> '+ea(cats[i].name)+'</label>'}
document.getElementById('tagCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No tags yet. <a href="/admin/tags">Manage tags</a>.</span>'});
function getTagIds(){var ids=[];[].forEach.call(document.querySelectorAll('.tag-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
var contentEl=document.getElementById('content');
if(!contentEl.textContent.trim()&&!contentEl.querySelector('img')){status.style.color='#dc2626';status.textContent='Content is required';return}
fetch('/api/admin/posts',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:contentEl.innerHTML,
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
<script>${PASTE_IMAGE_SCRIPT}</script><script>${DROP_IMAGE_SCRIPT}</script>`;
}

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
<div class="form-group"><label for="excerpt">Excerpt <span style="color:#64748b;font-weight:400">(optional)</span></label><textarea id="excerpt" name="excerpt" rows="2">${escAttr(String(post.excerpt ?? ""))}</textarea></div>
 <div class="form-group">
  <label for="content">Content <span style="color:#64748b;font-weight:400">(Rich text)</span></label>
  <div class="toolbar">
    <button type="button" onmousedown="event.preventDefault();rteCmd('bold')" title="Bold" aria-label="Bold"><strong>B</strong></button>
    <button type="button" onmousedown="event.preventDefault();rteCmd('italic')" title="Italic" aria-label="Italic"><em>I</em></button>
    <span class="sep"></span>
    <button type="button" onmousedown="event.preventDefault();rteHead('<h2>')" title="Heading 2" aria-label="Heading 2">H2</button>
    <button type="button" onmousedown="event.preventDefault();rteHead('<h3>')" title="Heading 3" aria-label="Heading 3">H3</button>
    <span class="sep"></span>
    <button type="button" onmousedown="rteLink(event)" title="Link" aria-label="Insert link">Link</button>
    <button type="button" onmousedown="rteImg(event)" title="Image by URL" aria-label="Insert image by URL">Img</button>
    <span class="sep"></span>
    <button type="button" onmousedown="event.preventDefault();rteHead('<blockquote>')" title="Blockquote" aria-label="Insert blockquote">Quote</button>
    <button type="button" onmousedown="event.preventDefault();rteCmd('insertUnorderedList')" title="List item" aria-label="Insert list item">List</button>
  </div>
  <div id="editor-wrap" style="min-height:320px">
    <div id="content" class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Post content" data-ph="Write your post…">${sanitizePostHtml(post.content)}</div>
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
<script>${SCHEDULE_TOGGLE_SCRIPT}</script>
<script>${EDITOR_FORMAT_SCRIPTS}</script>
<script>
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
titleEl.addEventListener('input',function(){
slugEl.value=titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
});
function getTagIds(){var ids=[];[].forEach.call(document.querySelectorAll('.tag-cb:checked'),function(cb){ids.push(Number(cb.value))});return ids}
function ea(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
var postCatReq=fetch('/api/admin/posts/${id}/tags').then(function(r){return r.json()});
var allCatReq=fetch('/api/admin/tags').then(function(r){return r.json()});
Promise.all([postCatReq,allCatReq]).then(function(results){
var postCatIds=results[0].map(function(c){return c.id});
var cats=results[1];
var html='';
for(var i=0;i<cats.length;i++){
var checked=postCatIds.indexOf(cats[i].id)!==-1?' checked':'';
html+='<label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;cursor:pointer"><input type="checkbox" value="'+ea(cats[i].id)+'" class="tag-cb"'+checked+' /> '+ea(cats[i].name)+'</label>'}
document.getElementById('tagCheckboxes').innerHTML=html||'<span style="color:#94a3b8;font-size:0.85rem">No tags yet.</span>'});

document.getElementById('form').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
status.style.color='#2563eb';
status.textContent='Saving…';
var fd=new FormData(e.target);
var contentEl=document.getElementById('content');
if(!contentEl.textContent.trim()&&!contentEl.querySelector('img')){status.style.color='#dc2626';status.textContent='Content is required';return}
fetch('/api/admin/posts/${id}',{
method:'PATCH',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:contentEl.innerHTML,
excerpt:String(fd.get('excerpt')||''),
published:document.getElementById('published').checked,
publish_at:document.getElementById('publish_at').value||null,
tag_ids:getTagIds()
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Updated!'}
else{status.style.color='#dc2626';status.textContent='Error updating post'}})});
</script>
<script>${PASTE_IMAGE_SCRIPT}</script><script>${DROP_IMAGE_SCRIPT}</script>`;
}
