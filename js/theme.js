(function(){
  const STORAGE_KEY = 'theme';
  function apply(theme){
    const t = (theme||'').toLowerCase();
    const root = document.documentElement;
    if(t === 'dark'){ root.setAttribute('data-theme','dark'); }
    else { root.removeAttribute('data-theme'); }
    updateToggleIcon();
  }
  function get(){ try { return localStorage.getItem(STORAGE_KEY) || 'light'; } catch { return 'light'; } }
  function set(theme){ try { localStorage.setItem(STORAGE_KEY, theme); } catch {} }
  function toggle(){ const cur = get()==='dark'?'light':'dark'; set(cur); apply(cur); }
  function prefersDark(){ return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function init(){
    let theme = get();
    if(theme !== 'dark' && theme !== 'light'){
      theme = prefersDark() ? 'dark' : 'light';
      set(theme);
    }
    apply(theme);
    bindUI();
  }
  function bindUI(){
    document.querySelectorAll('#themeToggle,[data-theme-toggle]')
      .forEach(btn => {
        if(btn.dataset.boundTheme) return;
        btn.dataset.boundTheme = '1';
        btn.addEventListener('click', (e)=>{ e.preventDefault(); toggle(); });
      });
  }
  function updateToggleIcon(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('#themeToggle i,[data-theme-toggle] i').forEach(i => {
      if(!i) return;
      i.classList.remove('fa-moon','fa-sun');
      i.classList.add(isDark ? 'fa-sun' : 'fa-moon');
      if(i.parentElement){
        i.parentElement.title = isDark ? 'Modo claro' : 'Modo escuro';
      }
    });
  }
  window.Theme = { init, toggle, apply, get };
  document.addEventListener('DOMContentLoaded', init);
})();
