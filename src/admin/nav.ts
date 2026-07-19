// src/admin/nav.ts — navigation editor admin page body.

export function navBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Navigation</h2>
<p style="color:var(--ad-muted);margin-bottom:1.5rem;font-size:0.9rem">Links appear in the header of your public site. To sign in to the admin, use the small <strong>Manage</strong> link in your site footer.</p>
<div id="items"></div>
<div style="margin:1rem 0"><button class="btn btn-sm" onclick="addItem()">+ Add Link</button></div>
<button class="btn btn-primary" onclick="save()">Save Navigation</button>
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
<script>
var items=[];
function render(){
var html='<div style="background:var(--ad-card);border:1px solid var(--ad-card-bd);border-radius:6px;overflow:hidden">';
for(var i=0;i<items.length;i++){
html+='<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;border-bottom:1px solid var(--ad-row-bd)">';
html+='<input type="text" placeholder="Label" aria-label="Link label" value="'+ea(items[i].label)+'" onchange="items['+i+'].label=this.value" style="flex:1;padding:0.4rem;border:1px solid #cbd5e1;border-radius:3px;font-size:0.9rem" />';
html+='<input type="text" placeholder="URL" aria-label="Link URL" value="'+ea(items[i].url)+'" onchange="items['+i+'].url=this.value" style="flex:1;padding:0.4rem;border:1px solid #cbd5e1;border-radius:3px;font-size:0.9rem" />';
html+='<button class="btn btn-sm btn-danger" onclick="removeItem('+i+')">✕</button></div>'}
html+='</div>';
document.getElementById('items').innerHTML=html||'<p style="color:var(--ad-muted)">No navigation links yet.</p>'}
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
