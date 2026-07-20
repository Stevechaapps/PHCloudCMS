// src/admin/settings.ts — settings admin page body.

export function settingsBody(): string {
  return `<h2 style="margin-bottom:1.5rem">Settings</h2>
<form id="settingsForm" style="max-width:600px">
<div class="form-group"><label for="siteName">Site Name</label><input type="text" id="siteName" required /></div>
<div class="form-group"><label for="seoDescription">Site Description <span style="color:var(--ad-muted);font-weight:400">(meta description)</span></label><input type="text" id="seoDescription" /></div>
<div class="form-group">
<label>Site Logo</label>
<div id="logoPreview" style="margin-bottom:0.5rem"></div>
<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" />
<p style="color:var(--ad-muted);font-size:0.8rem;margin-top:0.4rem">Recommended: a wide, short logo (about <strong>600×200px</strong>, PNG with transparency). Shrunk to 600px wide if larger; a wider banner works better for the social-share image. Flat logos stay lossless PNG (crisp + small); photo-like logos compress to WebP. Transparency kept.</p>
</div>
<button type="submit" class="btn btn-primary">Save Settings</button>
<div id="status" style="margin-top:1rem;font-size:0.9rem" aria-live="polite" role="status"></div>
</form>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:2.5rem 0" />
<div style="max-width:600px;border:1px solid var(--ad-warn-bd);background:var(--ad-warn-bg);border-radius:6px;padding:1.25rem">
<h3 style="color:var(--ad-warn-tx);margin-bottom:0.5rem">Reset Site</h3>
<p style="color:var(--ad-muted);font-size:0.9rem;margin-bottom:1rem">Erases all posts, pages, tags, images, settings, and admin accounts, then returns you to the setup wizard. This cannot be undone.</p>
<button type="button" id="resetBtn" class="btn" style="background:#dc2626;color:white">Reset & Start Over</button>
<span id="resetStatus" style="margin-left:0.75rem;font-size:0.9rem"></span>
</div>
<script>
fetch('/api/admin/settings').then(function(r){return r.json()}).then(function(s){
document.getElementById('siteName').value=s.site_name;
document.getElementById('seoDescription').value=s.seo_description;
if(s.site_logo){var img=document.createElement('img');img.src=s.site_logo;img.style.cssText='max-width:120px;max-height:60px;border:1px solid var(--ad-card-bd);border-radius:4px';document.getElementById('logoPreview').appendChild(img)}});
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
if(!w||!h){status.style.color='#dc2626';status.textContent='That file has no readable pixel dimensions (SVGs without an embedded width/height do this). Re-save it as a PNG, JPEG, or WebP with a set size and re-upload.';return}
if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var c=document.createElement('canvas');
c.width=w;c.height=h;
var ctx=c.getContext('2d');
ctx.drawImage(img,0,0,w,h);
// Flat logos (text/shapes, transparency) stay crisp + small as lossless PNG;
// photo-like logos and JPEGs compress to lossy WebP q0.7. Heuristic: count
// distinct colors on the downscaled canvas — flat art has a few thousand or
// fewer, photos run into the tens of thousands. Counting pixels is cheap at
// 600px wide. (ponytail: color-count heuristic; misclassifies a noisy-but-
// flat logo toward webp, only costs a little edge softness.)
var outType='image/webp',outExt='webp';
if((logoFile.type||'')==='image/png'){try{var px=ctx.getImageData(0,0,w,h).data;var seen=Object.create(null),n=0;for(var i=0;i<px.length;i+=4){var k=px[i]+','+px[i+1]+','+px[i+2]+','+px[i+3];if(!seen[k]){seen[k]=1;if(++n>=5000)break}}if(n<5000){outType='image/png';outExt='png'}}catch(e){}}
c.toBlob(function(blob){
var r2=new FileReader();
r2.onload=function(ev2){
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:ev2.target.result,filename:'logo.'+outExt})}).then(function(r){return r.json()}).then(function(res){
if(res.url){data.site_logo=res.url;saveSettings(data,status)}
else{status.style.color='#dc2626';status.textContent='Logo upload failed'}})};
r2.readAsDataURL(blob)},outType,0.7)};
img.src=ev.target.result};
reader.readAsDataURL(logoFile)}
else{saveSettings(data,status)}});
function saveSettings(data,status){
fetch('/api/admin/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(r){
if(r.ok){status.style.color='#16a34a';status.textContent='Saved!';location.reload()}
else{status.style.color='#dc2626';status.textContent='Error saving settings'}})}
document.getElementById('resetBtn').addEventListener('click',function(){
var s=document.getElementById('resetStatus');
var typed=prompt('This will permanently erase ALL posts, pages, tags, images, settings, and admin accounts. Type RESET to confirm.');
if(typed!=='RESET'){if(typed!==null){s.style.color='#dc2626';s.textContent='Cancelled — typed text did not match.'}return;}
s.style.color='#2563eb';s.textContent='Resetting…';
fetch('/api/admin/wipe',{method:'POST'}).then(function(r){
if(r.ok){s.style.color='#16a34a';s.textContent='Reset complete. Loading setup wizard…';window.location.href='/';}
else{s.style.color='#dc2626';s.textContent='Reset failed (are you still logged in?).';}}).catch(function(){s.style.color='#dc2626';s.textContent='Reset failed — check your connection.';})});
</script>`;
}
