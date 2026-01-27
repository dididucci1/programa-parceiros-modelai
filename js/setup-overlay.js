(function(){
  if (window.location.pathname.toLowerCase().includes('login.html')) return;
  const API = window.API_BASE || '/api';

  function showOverlay(){
    const existing = document.getElementById('setupOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'setupOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:720px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;">
        <div style="padding:24px 24px 0 24px;text-align:center">
          <div style="width:64px;height:64px;border-radius:50%;background:#fef3c7;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;color:#d97706"><i class="fas fa-key" style="font-size:24px"></i></div>
          <h2 style="margin:0 0 6px 0;font-size:22px;color:#0f172a">Configuração inicial obrigatória</h2>
          <p style="margin:0;color:#475569">Defina sua própria senha e aceite o termo de confidencialidade para continuar.</p>
        </div>
        <div style="padding:24px">
          <div id="setupError" style="display:none;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:14px"></div>

          <label style="display:block;font-weight:600;color:#334155;font-size:13px;margin-bottom:4px">Nova senha</label>
          <input id="setupPwd" type="password" placeholder="Mínimo 6 caracteres" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:12px" />

          <label style="display:block;font-weight:600;color:#334155;font-size:13px;margin-bottom:4px">Confirmar nova senha</label>
          <input id="setupPwd2" type="password" placeholder="Repita a senha" style="width:100%;border:2px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:14px;margin-bottom:16px" />

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:12px;text-align:left;color:#334155">
            <p style="margin:0 0 6px 0"><strong>Termo de Confidencialidade:</strong></p>
            <ul style="padding-left:18px;margin:0 0 10px 0;list-style:disc">
              <li>Todos os dados acessados na plataforma Model AI são <strong>estritamente confidenciais</strong>.</li>
              <li>É <strong>proibido</strong> compartilhar, copiar, exportar, divulgar ou vazar qualquer informação contida na plataforma.</li>
              <li>O acesso é individual e intransferível; o uso indevido pode resultar em bloqueio e medidas legais.</li>
            </ul>
            <p style="margin:10px 0 6px 0"><strong>Regras de Leads:</strong></p>
            <ul style="padding-left:18px;margin:0;list-style:disc">
              <li>Leads possuem prazo máximo de <strong>4 a 5 meses</strong> para conversão.</li>
              <li>Se o lead permanecer sem retorno após esse prazo, ele poderá ser <strong>cadastrado por outro parceiro</strong>.</li>
            </ul>
          </div>

          <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;color:#334155">
            <input id="setupAgree" type="checkbox" />
            <span>Li e <strong>aceito</strong> o Termo de Confidencialidade e as regras de leads.</span>
          </label>

          <button id="setupSubmit" style="width:100%;background:#14b8a6;color:#fff;font-weight:700;border:none;border-radius:10px;padding:12px 16px;font-size:15px;display:flex;align-items:center;justify-content:center;gap:8px">
            <span id="setupIcon"><i class="fas fa-check"></i></span>
            <span id="setupText">Salvar e continuar</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#setupSubmit').addEventListener('click', async function(){
      const err = overlay.querySelector('#setupError');
      const pwd = overlay.querySelector('#setupPwd').value || '';
      const pwd2 = overlay.querySelector('#setupPwd2').value || '';
      const agree = overlay.querySelector('#setupAgree').checked;
      err.style.display = 'none';
      if (pwd.length < 6){ err.textContent = 'A senha deve ter no mínimo 6 caracteres.'; err.style.display = 'block'; return; }
      if (pwd !== pwd2){ err.textContent = 'As senhas não coincidem.'; err.style.display = 'block'; return; }
      if (!agree){ err.textContent = 'É necessário aceitar o termo para continuar.'; err.style.display = 'block'; return; }
      const btn = overlay.querySelector('#setupSubmit');
      const icon = overlay.querySelector('#setupIcon');
      const text = overlay.querySelector('#setupText');
      btn.disabled = true; btn.style.opacity = '0.7'; icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; text.textContent = 'Salvando...';
      try{
        const token = localStorage.getItem('authToken') || '';
        const url = `${API}/auth/setup-inicial`;
        console.log('[SETUP] POST', url);
        const res = await fetch(url, {
          method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ novaSenha: pwd, aceitouTermo: true })
        });
        const data = await res.json().catch(()=>({}));
        console.log('[SETUP] Status', res.status, 'Data', data);
        if (!res.ok){
          err.textContent = data.error || (res.status === 401 ? 'Sessão expirada. Faça login novamente.' : 'Não foi possível concluir o setup.');
          err.style.display = 'block'; btn.disabled=false; btn.style.opacity='1'; icon.innerHTML='<i class="fas fa-check"></i>'; text.textContent='Salvar e continuar'; return; }
        const user = (data && data.user) ? data.user : null;
        if (user){ localStorage.setItem('currentUser', JSON.stringify(user)); }
        overlay.remove();
        location.reload();
      }catch(e){ err.textContent = 'Falha de conexão com o servidor.'; err.style.display='block'; btn.disabled=false; btn.style.opacity='1'; icon.innerHTML='<i class="fas fa-check"></i>'; text.textContent='Salvar e continuar'; }
    });
  }

  function shouldBlock(){
    try{
      const raw = localStorage.getItem('currentUser');
      if (!raw) return false; // Sem user: login page cuida
      const u = JSON.parse(raw);
      // Bloqueia se NÃO estiver claramente concluído (primeiraSenha=false e termoAceite=true)
      const setupConcluido = (u && u.primeiraSenha === false && u.termoAceite === true);
      return !setupConcluido;
    }catch{ return true; }
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (shouldBlock()) showOverlay();
  });
})();
