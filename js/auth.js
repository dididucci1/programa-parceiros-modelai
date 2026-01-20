(function(){
  const API_BASE = '';
  const DEFAULT_USER = { name: 'Admin', email: 'admin@modelai.com', role: 'admin' };

  function getCurrentUser(){
    try{
      const raw = localStorage.getItem('currentUser');
      if(!raw) return null;
      const u = JSON.parse(raw);
      if(!u || !u.email || !u.role) return null;
      return u;
    }catch(e){ return DEFAULT_USER; }
  }
  function isAdmin(){
    const u = getCurrentUser() || {};
    return (u.role||'').toLowerCase()==='admin';
  }
  function setCurrentUser(u){
    if(u && u.email && u.role){ localStorage.setItem('currentUser', JSON.stringify(u)); }
  }
  function getToken(){ try { return localStorage.getItem('authToken') || ''; } catch { return ''; } }
  function setToken(t){ try { if(t) localStorage.setItem('authToken', t); } catch {} }
  function clearAuth(){ try { localStorage.removeItem('authToken'); localStorage.removeItem('currentUser'); } catch {} }
  function decodeJwt(token){
    try{
      const parts = token.split('.');
      if(parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
      return payload || null;
    }catch{ return null; }
  }

  // Patch fetch to attach Authorization header for API calls
  (function(){
    const origFetch = window.fetch.bind(window);
    window.fetch = async function(input, init){
      let url = typeof input === 'string' ? input : (input && input.url);
      const isApi = typeof url === 'string' && (
        url.startsWith('/api') ||
        url.startsWith(location.origin + '/api')
      );
      const token = getToken();
      if(isApi && token){
        const opts = init || {};
        const headers = new Headers(opts.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
        if(!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        const nextInit = Object.assign({}, opts, { headers });
        const resp = await origFetch(input, nextInit);
        if(resp.status === 401){
          clearAuth();
          if(!/login\.html$/i.test(location.pathname)) location.href = 'login.html';
        }
        return resp;
      }
      return origFetch(input, init);
    };
  })();

  // Expose globally
  window.Auth = { getCurrentUser, isAdmin, setCurrentUser, getToken, setToken, clearAuth, decodeJwt };

  // Update sidebar labels if present; enforce login
  window.addEventListener('DOMContentLoaded', ()=>{
    const u = getCurrentUser();
    const onLoginPage = /login\.html$/i.test(window.location.pathname);
    if(!u && !onLoginPage){
      window.location.href = 'login.html';
      return;
    }

    // Ensure token and currentUser belong to the same identity
    const tok = getToken();
    if(tok && u){
      const payload = decodeJwt(tok);
      if(!payload || (payload.email && String(payload.email).toLowerCase() !== String(u.email).toLowerCase())){
        clearAuth();
        if(!onLoginPage){ window.location.href = 'login.html'; return; }
      }
    }
    const nameEl = document.querySelector('.modern-sidebar .text-white.font-medium.text-sm');
    const emailEl = document.querySelector('.modern-sidebar .text-teal-200.text-xs');
    if(u){
      if(nameEl) nameEl.textContent = u.nome || u.name || (u.role==='admin' ? 'Admin' : 'Parceiro');
      if(emailEl) emailEl.textContent = u.email;
    }

    // Hide admin-only elements for non-admins
    const adminOnly = document.querySelectorAll('[data-admin-only]');
    if (!isAdmin()) {
      adminOnly.forEach(el => {
        if (el && el.style) el.style.display = 'none';
      });
    }

    // Bind logout on sign-out icon buttons
    document.querySelectorAll('.modern-sidebar i.fa-sign-out-alt').forEach(icon => {
      const btn = icon.closest('button');
      if(btn && !btn.dataset.boundLogout){
        btn.dataset.boundLogout = '1';
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          clearAuth();
          window.location.href = 'login.html';
        });
      }
    });
  });
})();
