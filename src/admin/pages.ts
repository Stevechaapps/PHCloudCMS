// src/admin/pages.ts — pages admin: list, new-page form, edit-page form.

import { escAttr } from "../cms/escape.js";
import { sanitizePostHtml } from "../cms/sanitize.js";
import { EDITOR_FORMAT_SCRIPTS, PASTE_IMAGE_SCRIPT, DROP_IMAGE_SCRIPT } from "./editor.js";

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
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/pages/'+id,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('fail');location.reload()}).catch(function(){alert('Delete failed.')})}
</script>`;
}

export function newPageBody(): string {
  return `<h2 style="margin-bottom:1.5rem">New Page</h2>
<form id="form" style="max-width:800px">
<div class="row">
<div class="form-group"><label for="title">Title</label><input type="text" id="title" name="title" required /></div>
<div class="form-group"><label for="slug">Slug</label><input type="text" id="slug" name="slug" required placeholder="about" /></div>
</div>
<div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Rich text)</span></label><div class="toolbar"><button type="button" onmousedown="event.preventDefault();rteCmd('bold')" title="Bold" aria-label="Bold"><strong>B</strong></button><button type="button" onmousedown="event.preventDefault();rteCmd('italic')" title="Italic" aria-label="Italic"><em>I</em></button><span class="sep"></span><button type="button" onmousedown="event.preventDefault();rteHead('<h2>')" title="Heading 2" aria-label="Heading 2">H2</button><button type="button" onmousedown="event.preventDefault();rteHead('<h3>')" title="Heading 3" aria-label="Heading 3">H3</button><span class="sep"></span><button type="button" onmousedown="rteLink(event)" title="Link" aria-label="Insert link">Link</button><button type="button" onmousedown="rteImg(event)" title="Image by URL" aria-label="Insert image by URL">Img</button><span class="sep"></span><button type="button" onmousedown="event.preventDefault();rteHead('<blockquote>')" title="Blockquote" aria-label="Insert blockquote">Quote</button><button type="button" onmousedown="event.preventDefault();rteCmd('insertUnorderedList')" title="List item" aria-label="Insert list item">List</button></div><div id="editor-wrap" style="min-height:320px"><div id="content" class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Page content" data-ph="Write your page…"></div></div></div>
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
var contentEl=document.getElementById('content');
if(!contentEl.textContent.trim()&&!contentEl.querySelector('img')){status.style.color='#dc2626';status.textContent='Content is required';return}
fetch('/api/admin/pages',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:contentEl.innerHTML,
published:document.getElementById('published').checked
})}).then(function(res){
if(res.ok){
status.style.color='#16a34a';
status.textContent='Saved!';setTimeout(function(){location.href='/admin/pages'},500)}
else{status.style.color='#dc2626';status.textContent='Error saving page'}})});
</script>
<script>${EDITOR_FORMAT_SCRIPTS}</script>
<script>${PASTE_IMAGE_SCRIPT}</script>
<script>${DROP_IMAGE_SCRIPT}</script>`;
}

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
<div class="form-group"><label for="content">Content <span style="color:#64748b;font-weight:400">(Rich text)</span></label><div class="toolbar"><button type="button" onmousedown="event.preventDefault();rteCmd('bold')" title="Bold" aria-label="Bold"><strong>B</strong></button><button type="button" onmousedown="event.preventDefault();rteCmd('italic')" title="Italic" aria-label="Italic"><em>I</em></button><span class="sep"></span><button type="button" onmousedown="event.preventDefault();rteHead('<h2>')" title="Heading 2" aria-label="Heading 2">H2</button><button type="button" onmousedown="event.preventDefault();rteHead('<h3>')" title="Heading 3" aria-label="Heading 3">H3</button><span class="sep"></span><button type="button" onmousedown="rteLink(event)" title="Link" aria-label="Insert link">Link</button><button type="button" onmousedown="rteImg(event)" title="Image by URL" aria-label="Insert image by URL">Img</button><span class="sep"></span><button type="button" onmousedown="event.preventDefault();rteHead('<blockquote>')" title="Blockquote" aria-label="Insert blockquote">Quote</button><button type="button" onmousedown="event.preventDefault();rteCmd('insertUnorderedList')" title="List item" aria-label="Insert list item">List</button></div><div id="editor-wrap" style="min-height:320px"><div id="content" class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Page content" data-ph="Write your page…">${sanitizePostHtml(page.content)}</div></div></div>
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
var contentEl=document.getElementById('content');
if(!contentEl.textContent.trim()&&!contentEl.querySelector('img')){status.style.color='#dc2626';status.textContent='Content is required';return}
fetch('/api/admin/pages/${id}',{
method:'PATCH',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
title:String(fd.get('title')||''),
slug:String(fd.get('slug')||''),
content:contentEl.innerHTML,
published:document.getElementById('published').checked
})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Updated!';setTimeout(function(){location.href='/admin/pages'},500)}
else{status.style.color='#dc2626';status.textContent='Error updating page'}})});
</script>
<script>${EDITOR_FORMAT_SCRIPTS}</script>
<script>${PASTE_IMAGE_SCRIPT}</script>
<script>${DROP_IMAGE_SCRIPT}</script>`;
}
