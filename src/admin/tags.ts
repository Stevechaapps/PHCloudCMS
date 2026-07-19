// src/admin/tags.ts — tags admin page body.

export function tagsBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Tags</h2>
<form id="tagForm" style="display:flex;gap:0.75rem;margin-bottom:2rem;max-width:500px">
<div style="flex:1"><label for="name">Tag name</label><input type="text" id="name" required /></div>
<div style="flex:1"><label for="slug">Slug</label><input type="text" id="slug" required placeholder="auto" /></div>
<div style="display:flex;align-items:flex-end"><button type="submit" class="btn btn-primary">Add</button></div>
</form>
<div id="status" style="margin-bottom:1rem;font-size:0.9rem"></div>
<div style="background:var(--ad-card);border:1px solid var(--ad-card-bd);border-radius:6px;overflow:hidden">
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
if(!tags.length){tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:var(--ad-muted)">No tags yet.</td></tr>';return}
tbody.innerHTML=tags.map(function(t){return '<tr>'
+'<td><strong>'+ea(t.name)+'</strong></td>'
+'<td style="color:var(--ad-muted)">'+ea(t.slug)+'</td>'
+'<td><button class="btn btn-sm btn-danger" onclick="del('+t.id+')">Delete</button></td></tr>'}).join('')})}
document.getElementById('tagForm').addEventListener('submit',function(e){
e.preventDefault();
var status=document.getElementById('status');
var slug=slugEl.value||nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
fetch('/api/admin/tags',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nameEl.value,slug:slug})}).then(function(res){
if(res.ok){status.style.color='#16a34a';status.textContent='Added!';nameEl.value='';slugEl.value='';load()}
else{status.style.color='#dc2626';status.textContent='Error adding tag'}})});
function del(id){if(!confirm('Delete tag?'))return;fetch('/api/admin/tags/'+id,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('fail');load()}).catch(function(){alert('Delete failed.')})}
load();
</script>`;
}
