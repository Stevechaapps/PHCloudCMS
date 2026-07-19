// src/admin/editor.ts — shared admin rich-text editor JavaScript.
// Inline <script> bodies for the post/page content editor. The editor is a
// contentEditable div driven by document.execCommand (deprecated but
// universally supported in browsers; it emits semantic allowlisted tags —
// b/i/h*/ul/ol/blockquote/a/img — that src/cms/sanitize.ts keeps round-
// tripping on both write and read). There is no separate preview panel: the
// editable IS the WYSIWYG. Interpolated by src/admin/posts.ts and pages.ts.
// (Phase 4: replaced the markdown textarea + live POST /api/preview with
// this rich-text editor; dropped the marked dependency.)

// Schedule-for-later checkbox toggle (DOM: #schedule, #publish_at, #published).
export const SCHEDULE_TOGGLE_SCRIPT = `function scheduleToggle(){var s=document.getElementById('schedule'),p=document.getElementById('publish_at'),c=document.getElementById('published');if(s.checked){p.style.display='block';c.checked=false}else{p.style.display='none';p.value=''}}`;

// Scheduled-post datetime round-trips. datetime-local gives a timezone-naive
// local string (e.g. "2026-07-19T15:00"); the server compares publish_at to a
// UTC ISO now(), so a naive local string publishes at the wrong wall-clock
// time (off by the user's UTC offset). Convert to UTC ISO on submit, and
// format the stored UTC value back into the local box on edit load.
export const SCHEDULER_SCRIPT = `function phIso(localVal){if(!localVal)return null;var d=new Date(localVal);if(isNaN(d.getTime()))return null;return d.toISOString()}function phLocalFromUtc(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d.getTime()))return '';function p(n){return String(n).padStart(2,'0')}return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())}`;

// Toolbar commands + a selection save/restore used across the async image
// upload. Toolbar buttons call these from onmousedown (with preventDefault so
// clicking a button never blurs the editable and drops the selection the
// command acts on). (DOM: #content, a contenteditable div.)
export const EDITOR_FORMAT_SCRIPTS = `function rteCmd(c){document.execCommand(c,false,null)}
function rteHead(h){document.execCommand('formatBlock',false,h)}
function rteLink(e){e.preventDefault();var u=prompt('Link URL:','https://');if(u)document.execCommand('createLink',false,u)}
function rteImg(e){e.preventDefault();var u=prompt('Image URL:','');if(u)document.execCommand('insertImage',false,u)}
function rteSave(c){try{return window.getSelection().getRangeAt(0).cloneRange()}catch(x){var r=document.createRange();r.selectNodeContents(c);r.collapse(false);return r}}
function rteRestore(c,r){c.focus();var s=window.getSelection();s.removeAllRanges();s.addRange(r)}
// Reflect the selection's formatting back onto the toolbar buttons so the user
// can tell what's active (Bold/Italic pressed, current block is h2/h3/blockquote,
// caret is in a list). aria-pressed + the .toolbar button[aria-pressed="true"]
// rule in shell.ts give the visual "on" state every WYSIWYG editor shows.
function rteSync(){var c=document.getElementById('content');if(!c)return;var node=null;try{node=window.getSelection().getRangeAt(0).startContainer}catch(e){}if(!node||(node!==c&&!c.contains(node))){rteClear();return}rteSet('Bold',qState('bold'));rteSet('Italic',qState('italic'));rteSet('Insert list item',qState('insertUnorderedList'));rteSet('Numbered list',qState('insertOrderedList'));var blk=String(qVal('formatBlock')||'').toLowerCase().replace(/[<>]/g,'');rteSet('Heading 2',blk==='h2');rteSet('Heading 3',blk==='h3');rteSet('Insert blockquote',blk==='blockquote')}
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
cv.toBlob(function(blob){var r2=new FileReader();r2.onload=function(ev2){var dataUrl=ev2.target.result;status.textContent='Uploading…';
fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:dataUrl,filename:file.name||fallbackName})})
.then(function(r){return r.json()}).then(function(res){
if(res.url){rteRestore(c,saved);document.execCommand('insertImage',false,res.url);status.style.color='#16a34a';status.textContent='Image uploaded'}
else{status.style.color='#dc2626';status.textContent=res.error||'Upload failed'}})
.catch(function(){status.style.color='#dc2626';status.textContent='Upload error'})};
r2.readAsDataURL(blob)},'image/webp',0.7)};
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
