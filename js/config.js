(function(){
  try{
    var saved = localStorage.getItem('API_BASE');

    var defaultLocal = 'http://localhost:3001/api';
    var defaultExternal = 'https://backend-cold-sound-9916.fly.dev/api';

    var isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    var base = saved || (isLocal ? defaultLocal : defaultExternal);

    window.API_BASE = base;
    console.log('[config] API_BASE =', base);
  } catch(e){
    window.API_BASE = 'https://backend-cold-sound-9916.fly.dev/api';
  }
})();
