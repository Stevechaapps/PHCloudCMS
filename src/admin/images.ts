// src/admin/images.ts — image library admin page body.

export function imagesBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Image Library</h2>
<div id="imgCount" style="margin-bottom:1rem;color:var(--ad-muted);font-size:0.85rem"></div>
<div id="imageGrid" class="image-grid"></div>
<style>
.image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}
.image-card{background:var(--ad-card);border:1px solid var(--ad-card-bd);border-radius:6px;overflow:hidden;display:flex;flex-direction:column}
.image-card .thumb{width:100%;height:140px;overflow:hidden;background:var(--ad-row-bd);display:flex;align-items:center;justify-content:center}
.image-card .thumb img{width:100%;height:100%;object-fit:cover}
.image-card .info{padding:0.6rem;display:flex;flex-direction:column;gap:0.2rem;flex:1}
.image-card .info .name{font-size:0.8rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.image-card .info .meta{font-size:0.75rem;color:var(--ad-muted)}
.image-card .info .actions{margin-top:0.4rem}
</style>
<script>
function ea(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function fmtSize(b){return b>1048576?(b/1048576).toFixed(1)+' MB':b>1024?(b/1024).toFixed(1)+' KB':b+' B'}
fetch('/api/admin/images').then(function(r){return r.json()}).then(function(data){var imgs=data.results||[];
document.getElementById('imgCount').textContent=data.total+' image'+(data.total===1?'':'s');
var grid=document.getElementById('imageGrid');
if(!imgs.length){grid.innerHTML='<p style="color:var(--ad-muted);grid-column:1/-1">No images uploaded yet. Upload images from the post editor.</p>';return}
grid.innerHTML=imgs.map(function(img){
return '<div class="image-card">'
+'<div class="thumb"><img src="/img/'+img.id+'" alt="'+ea(img.filename)+'" loading="lazy" /></div>'
+'<div class="info">'
+'<div class="name" title="'+ea(img.filename)+'">'+ea(img.filename)+'</div>'
+'<div class="meta">'+fmtSize(img.size)+' · '+new Date(img.created_at).toLocaleDateString()+'</div>'
+'<div class="actions"><button class="btn btn-sm btn-danger" onclick="delImg('+img.id+')">Delete</button></div>'
+'</div></div>'}).join('');
if(data.totalPages>1)document.getElementById('imgCount').innerHTML+=' <span style="font-weight:400">Page '+data.page+' of '+data.totalPages+'</span>';});
function delImg(id){if(!confirm('Delete this image? This action cannot be undone.'))return;fetch('/api/admin/images/'+id,{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('fail');location.reload()}).catch(function(){alert('Delete failed.')})}
</script>`;
}
