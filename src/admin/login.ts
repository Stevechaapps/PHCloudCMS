// src/admin/login.ts — admin login form (standalone page, not the admin shell).

export function loginForm(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Login · PHCloud CMS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f172a;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center}
form{background:#1e293b;padding:2.5rem;border-radius:8px;width:100%;max-width:360px;box-shadow:0 8px 30px rgba(0,0,0,0.4)}
h1{font-size:1.2rem;margin-bottom:1.5rem}
label{display:block;font-size:0.85rem;margin-bottom:0.4rem;color:rgba(255,255,255,0.7)}
input[type="text"],input[type="password"]{width:100%;padding:0.7rem;border:1px solid rgba(255,255,255,0.1);border-radius:4px;font-size:1rem;background:#0f172a;color:white;margin-bottom:1rem}
input:focus{outline:none;border-color:#3b82f6}
button{width:100%;padding:0.75rem;background:#3b82f6;color:white;border:none;border-radius:4px;font-size:1rem;cursor:pointer}
button:hover{background:#2563eb}
button:disabled{opacity:0.5;cursor:not-allowed}
.err{color:#f87171;font-size:0.85rem;margin-bottom:1rem;display:none}
</style>
</head>
<body>
<form id="loginForm">
<h1>Admin Login</h1>
<div class="err" id="err"></div>
<label for="username">Username</label>
<input type="text" id="username" name="username" autofocus />
<label for="password">Password</label>
<input type="password" id="password" name="password" />
<button type="submit" id="btn">Sign in</button>
</form>
<script>
var form=document.getElementById('loginForm');
var errEl=document.getElementById('err');
var btn=document.getElementById('btn');
form.addEventListener('submit',function(e){
e.preventDefault();
errEl.style.display='none';
btn.disabled=true;
btn.textContent='Signing in…';
var u=document.getElementById('username').value;
var p=document.getElementById('password').value;
fetch('/api/auth/login',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:u,password:p})}).then(function(r){return r.json()}).then(function(data){
if(!data.ok){errEl.textContent=data.error||'Login failed';errEl.style.display='block';btn.disabled=false;btn.textContent='Sign in'}
else{window.location.href='/admin'}})});
</script>
</body>
</html>`;
}
