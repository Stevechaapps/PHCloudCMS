// src/admin/settings.ts — settings admin page body.

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
if(s.site_logo){var img=document.createElement('img');img.src=s.site_logo;img.style.cssText='max-width:120px;max-height:60px;border:1px solid #e5e7eb;border-radius:4px';document.getElementById('logoPreview').appendChild(img)}});
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
