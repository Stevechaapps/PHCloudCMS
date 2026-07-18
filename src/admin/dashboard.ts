// src/admin/dashboard.ts — dashboard page body.

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
function loadPosts(){var page=parseInt(location.search.match(/[?&]page=(\\d+)/)||[,'1'],10);
fetch('/api/admin/posts?page='+page).then(function(r){if(r.status===401){window.location.href='/admin/login';return null;}if(!r.ok){document.getElementById('posts').innerHTML='<tr><td colspan="5" style="text-align:center;color:#dc2626">Failed to load posts. Reload to retry.</td></tr>';return null;}return r.json();}).then(function(data){if(!data)return;
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
+'</td></tr>'}).join('');renderAdminPage(data.page,data.totalPages)}).catch(function(e){console.error('loadPosts failed',e);document.getElementById('posts').innerHTML='<tr><td colspan="5" style="text-align:center;color:#dc2626">Failed to load posts.</td></tr>';})
function del(id){if(!confirm('Delete?'))return;fetch('/api/admin/posts/'+id,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('fail');location.reload()}).catch(function(){alert('Delete failed.')})}
}
loadPosts();</script>`;
}
