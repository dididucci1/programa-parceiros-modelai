(function(){
  try{
    var saved = localStorage.getItem('API_BASE');
    // Local development should use the dedicated backend on 3001
    var defaultLocal = 'http://localhost:3001/api';
    // Non-local hosts can keep pointing to the same backend URL for now
    var defaultExternal = 'http://localhost:3001/api';
    // If user saved a custom base, prefer it; otherwise choose by hostname
    var isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
    var base = saved || (isLocal ? defaultLocal : defaultExternal);
    window.API_BASE = base;
    console.log('[config] API_BASE =', base);
  }catch(e){
    // Fallback to local backend
    window.API_BASE = 'http://localhost:3001/api';
  }
})();