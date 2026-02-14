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
  function toggle(){
    const current = get();
    const goingDark = current !== 'dark';
    if(goingDark){
      // Dark mode indisponível: manter fundo branco e avisar
      showDevNotice();
      set('light');
      apply('light');
      return;
    }
    // Se já estiver em 'dark' por algum estado antigo, voltar para 'light'
    set('light');
    apply('light');
  }
  function prefersDark(){ return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; }
  function init(){
    // Forçar tema claro enquanto o modo escuro está em desenvolvimento
    set('light');
    apply('light');
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
  function showDevNotice(){
    try{
      const existing = document.getElementById('devNoticeToast');
      if(existing) existing.remove();
      const el = document.createElement('div');
      el.id = 'devNoticeToast';
      el.textContent = 'O modo escuro ainda está em desenvolvimento.';
      el.style.position = 'fixed';
      el.style.bottom = '20px';
      el.style.right = '20px';
      el.style.padding = '12px 16px';
      el.style.borderRadius = '8px';
      el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
      el.style.fontSize = '14px';
      el.style.zIndex = '9999';
      // Ajustar cores para ambos temas
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      el.style.background = isDark ? '#111827' : '#1f2937';
      el.style.color = '#ffffff';
      el.style.border = '1px solid rgba(255,255,255,0.1)';
      // Ícone opcional
      const icon = document.createElement('i');
      icon.className = 'fas fa-tools';
      icon.style.marginRight = '8px';
      el.prepend(icon);
      document.body.appendChild(el);
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 4000);
    }catch{}
  }
  window.Theme = { init, toggle, apply, get };
  document.addEventListener('DOMContentLoaded', init);
})();
