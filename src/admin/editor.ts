// src/admin/editor.ts — shared admin rich-text editor JavaScript.
// Inline <script> bodies for the post/page content editor. The editor is a
// contentEditable div driven by document.execCommand (deprecated but
// universally supported in browsers; it emits semantic allowlisted tags —
// b/i/h*/ul/ol/blockquote/a/img — that src/cms/sanitize.ts keeps round-
// tripping on both write and read). There is no separate preview panel: the
// editable IS the WYSIWYG. Interpolated by src/admin/posts.ts and pages.ts.
// (Phase 4: replaced the markdown textarea + live POST /api/preview with
// this rich-text editor; dropped the marked dependency.)

// Schedule-for-later checkbox toggle (DOM: #schedule, #publish_date, #publish_hour, #publish_minute, #publish_ampm, #published).
export const SCHEDULE_TOGGLE_SCRIPT = `function scheduleToggle(){var s=document.getElementById('schedule'),c=document.getElementById('published');['publish_date','publish_hour','publish_minute','publish_ampm'].forEach(function(id){var e=document.getElementById(id);if(s.checked){e.style.display='inline-block'}else{e.style.display='none';e.value=''}});if(s.checked)c.checked=false}`;

// Scheduled-post datetime round-trips. The user picks date + hour (1-12) +
// AM/PM + minute in their local timezone; phIso converts to UTC ISO for
// the server, phLocalFromUtc converts the stored UTC back to local values.
export const SCHEDULER_SCRIPT = `function phIso(dv,hv,mv,ampm){if(!dv||hv===void 0||mv===void 0)return null;var h=Number(hv);if(ampm==='PM'&&h!==12)h+=12;if(ampm==='AM'&&h===12)h=0;var d=new Date(dv+'T'+(h<10?'0':'')+h+':'+(mv<10?'0':'')+mv);if(isNaN(d.getTime()))return null;return d.toISOString()}function phLocalFromUtc(iso){if(!iso)return null;var d=new Date(iso);if(isNaN(d.getTime()))return null;var h=d.getHours(),a='AM';if(h>=12){a='PM';if(h>12)h-=12}if(h===0)h=12;return{date:d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate(),hour:h,minute:d.getMinutes(),ampm:a}}`;

// Toolbar commands + a selection save/restore used across the async image
// upload. Toolbar buttons call these from onmousedown (with preventDefault so
// clicking a button never blurs the editable and drops the selection the
// command acts on). (DOM: #content, a contenteditable div.)
export const EDITOR_FORMAT_SCRIPTS = `function rteCmd(c){document.execCommand(c,false,null);rteSync()}
function rteHead(h){document.execCommand('formatBlock',false,h);rteSync()}
function rteEsc(s){return String(s).replace(/&/g,'&'+'amp;').replace(/</g,'&'+'lt;').replace(/>/g,'&'+'gt;').replace(/"/g,'&'+'quot;')}
// Mirror of the server-side safeUrl so a javascript:/data: scheme can't even
// enter the editor buffer (the server re-checks on write either way).
function rteSafeUrl(u){var s=String(u||'').trim();if(!s)return'';var c=s.indexOf(':');if(c<0)return s;var p=s.slice(0,c);if(/[/?#]/.test(p))return s;return /^(https?|mailto|tel|sms)$/i.test(p)?s:''}
function rteLink(e){e.preventDefault();
var sel=window.getSelection(),hasSel=sel&&!sel.isCollapsed&&String(sel).length>0;
var u=prompt('Link URL:','https://');if(u===null)return;u=rteSafeUrl(u);
if(!u){alert('Use an http(s) or mailto: URL.');return}
if(hasSel){document.execCommand('createLink',false,u);rteSync();return}
var t=prompt('Link text (shown for the link):',u);if(t===null)return;if(!t)t=u;
document.execCommand('insertHTML',false,'<a href="'+rteEsc(u)+'">'+rteEsc(t)+'</a>');rteSync()}
function rteImg(e){e.preventDefault();var u=prompt('Image URL:','');if(u)document.execCommand('insertImage',false,u)}
function rteSave(c){try{return window.getSelection().getRangeAt(0).cloneRange()}catch(x){var r=document.createRange();r.selectNodeContents(c);r.collapse(false);return r}}
function rteRestore(c,r){c.focus();var s=window.getSelection();s.removeAllRanges();s.addRange(r)}
// Reflect the selection's formatting back onto the toolbar buttons so the user
// can tell what's active. aria-pressed + the .toolbar button[aria-pressed="true"]
// rule in shell.ts give the visual "on" state. rteSync runs on selectionchange
// AND right after each rteCmd/rteHead, so the toolbar updates the instant you
// click a button (execCommand doesn't always fire selectionchange itself).
function rteSync(){var c=document.getElementById('content');if(!c)return;var node=null;try{node=window.getSelection().getRangeAt(0).startContainer}catch(e){}if(!node||(node!==c&&!c.contains(node))){rteClear();return}var blk=String(qVal('formatBlock')||'').toLowerCase().replace(/[<>]/g,'');rteSet('Paragraph',blk===''||blk==='p'||blk==='div');rteSet('Bold',qState('bold'));rteSet('Italic',qState('italic'));rteSet('Align left',qState('justifyLeft'));rteSet('Align center',qState('justifyCenter'));rteSet('Align right',qState('justifyRight'));rteSet('Justify',qState('justifyFull'));rteSet('Heading 2',blk==='h2');rteSet('Heading 3',blk==='h3');rteSet('Insert blockquote',blk==='blockquote');rteSet('Insert list item',qState('insertUnorderedList'));rteSet('Numbered list',qState('insertOrderedList'));var ln=(node.nodeType===3?node.parentNode:node);rteSet('Insert link',!!(ln&&ln.closest&&ln.closest('a')))}
function qState(c){try{return document.queryCommandState(c)}catch(e){return false}}
function qVal(c){try{return document.queryCommandValue(c)}catch(e){return ''}}
function rteSet(label,on){var b=document.querySelector('.toolbar button[aria-label="'+label+'"]');if(!b)return;b.setAttribute('aria-pressed',on?'true':'false')}
function rteClear(){var bs=document.querySelectorAll('.toolbar button[aria-pressed]');for(var i=0;i<bs.length;i++)bs[i].setAttribute('aria-pressed','false')}
document.addEventListener('selectionchange',rteSync)`;

// Paste an image into #content -> resize on canvas (MAX_W=1200) -> upload to
// /api/admin/images -> insert <img> at the caret. The caret range is saved
// across the async upload and restored so the image lands at the paste point.
// Non-image pastes fall through to the browser's default text paste.
export const PASTE_IMAGE_SCRIPT = `var contentEl=document.getElementById('content');
contentEl.addEventListener('paste',function(e){var files=e.clipboardData.files;if(!files.length)return;var file=files[0];if(!file.type.startsWith('image/'))return;e.preventDefault();var saved=rteSave(contentEl);uploadImage(file,contentEl,saved,'paste.webp')});
function uploadImage(file,c,saved,fallbackName){
var status=document.getElementById('status');status.style.color='#2563eb';status.textContent='Processing image…';
var reader=new FileReader();
reader.onload=function(ev){var img=new Image();img.onload=function(){
var MAX_W=1200,w=img.width,h=img.height;if(w>MAX_W){h=Math.round(h*MAX_W/w);w=MAX_W}
var cv=document.createElement('canvas');cv.width=w;cv.height=h;var ctx=cv.getContext('2d');ctx.drawImage(img,0,0,w,h);
function go(blob){var r2=new FileReader();r2.onload=function(ev2){var dataUrl=ev2.target.result;status.textContent='Uploading…';
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:dataUrl,filename:file.name||fallbackName})})
.then(function(r){return r.json()}).then(function(res){
if(res.url){rteRestore(c,saved);document.execCommand('insertImage',false,res.url);status.style.color='#16a34a';status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Upload error'})};r2.readAsDataURL(blob)}
// toBlob passes null on browsers that can't encode WebP (older Safari/mobile);
// readAsDataURL(null) threw in the async callback and hung the spinner
// silently — this was why pasting/dropping an image into the editor never
// uploaded. Fall back to PNG, which every browser encodes.
cv.toBlob(function(blob){if(blob){go(blob);return}cv.toBlob(function(b2){if(b2)go(b2);else{status.style.color='#dc2626';status.textContent='Could not encode image'}},'image/png')},'image/webp',0.7)};
img.src=ev.target.result};
reader.readAsDataURL(file)}`;

// Drag-and-drop an image onto #editor-wrap -> same resize/upload/insert as
// paste. We focus the editable and save a caret range at drop time so the
// image lands where the user dropped it.
export const DROP_IMAGE_SCRIPT = `(function(){
var c=document.getElementById('content'),wrap=document.getElementById('editor-wrap');
wrap.addEventListener('dragover',function(e){e.preventDefault();wrap.style.outline='2px dashed #3b82f6';wrap.style.outlineOffset='-2px'},false);
wrap.addEventListener('dragleave',function(){wrap.style.outline='';wrap.style.outlineOffset=''},false);
wrap.addEventListener('drop',function(e){e.preventDefault();wrap.style.outline='';wrap.style.outlineOffset='';var files=e.dataTransfer.files;if(!files.length)return;var file=files[0];if(!file.type.startsWith('image/'))return;c.focus();var saved=rteSave(c);uploadImage(file,c,saved,'drop.webp')},false);
})();`;
