/* =============================================
   ONG GESTOR — Service Worker v7
   Estratégia: Cache-First para ativos estáticos
   Network-First para dados Supabase (REST API)
   v7: roles.js atualizado (dash-projeto, rubricas, metas)
       dashboard.js SUPREMO rewrite
       financeiro.js novos charts
   ============================================= */

const CACHE_NAME   = 'ong-gestor-v7';
const CACHE_STATIC = 'ong-static-v7';

/* Ativos essenciais — cacheados na instalação */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/roles.js',
  '/js/api.js',
  '/js/app.js',
  '/js/dashboard.js',
  '/js/projetos.js',
  '/js/financeiro.js',
  '/js/metas.js',
  '/js/rubricas.js',
  '/js/plano.js',
  '/js/prestacao.js',
  '/js/documentos.js',
  '/js/ui.js',
  '/manifest.json'
];

/* Domínios que nunca devem ser cacheados (APIs, CDNs dinâmicos) */
const BYPASS_ORIGINS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'cloudflare.com',
  'cdnjs.cloudflare.com',
  'jsdelivr.net',
  'fontawesome'
];

/* ── Instalação: pré-cacheia ativos estáticos ── */
self.addEventListener('install', event => {
  console.log('[SW] Instalando ONG Gestor Service Worker...');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Pré-cacheando ativos estáticos...');
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(e => {
            console.warn(`[SW] Não cacheou ${url}:`, e.message);
          }))
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ── Ativação: remove caches antigos ── */
self.addEventListener('activate', event => {
  console.log('[SW] Ativando e limpando caches antigos...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_NAME)
            .map(k => {
              console.log('[SW] Deletando cache antigo:', k);
              return caches.delete(k);
            })
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Intercepta requisições ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* 1. Ignora requisições não-GET e POST */
  if (request.method !== 'GET') return;

  /* 2. Ignora origens de API / CDN dinâmicos — usa rede sempre */
  if (BYPASS_ORIGINS.some(o => url.hostname.includes(o))) {
    return; // deixa o browser lidar normalmente
  }

  /* 3. Ignora outros domínios */
  if (url.origin !== self.location.origin) return;

  /* 4. Para tudo do mesmo domínio: Cache-First com fallback para rede */
  event.respondWith(cacheFirstStrategy(request));
});

async function cacheFirstStrategy(request) {
  const url = new URL(request.url);

  /* Assets estáticos (js, css, imagens, fontes): cache-first */
  const isStatic = /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|gif)$/i.test(url.pathname);

  try {
    /* Tenta cache primeiro */
    const cached = await caches.match(request, { ignoreSearch: isStatic });
    if (cached) return cached;

    /* Não está no cache: vai para a rede */
    const response = await fetch(request);

    /* Cacheia resposta válida de ativos estáticos */
    if (response.ok && isStatic) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    /* Offline fallback: retorna index.html para navegação */
    console.warn('[SW] Offline, retornando cache:', request.url);
    const fallback = await caches.match('/index.html');
    if (fallback) return fallback;

    /* Último recurso: resposta de erro offline */
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8">
       <title>ONG Gestor — Offline</title>
       <meta name="viewport" content="width=device-width,initial-scale=1">
       <style>
         body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
              justify-content:center;min-height:100vh;background:#0c1426;color:#fff;text-align:center;gap:16px;}
         .icon{font-size:4rem;opacity:.5;}
         h1{font-size:1.5rem;margin:0;}
         p{font-size:.9rem;opacity:.7;margin:0;}
         button{padding:10px 24px;border-radius:8px;border:none;background:#2563eb;color:#fff;
                font-size:1rem;cursor:pointer;}
       </style></head>
       <body>
         <div class="icon">📵</div>
         <h1>ONG Gestor</h1>
         <p>Você está offline.<br>Conecte-se à internet para continuar.</p>
         <button onclick="location.reload()">Tentar novamente</button>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/* ── Recebe mensagem para forçar atualização do cache ── */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_STATIC).then(() => {
      console.log('[SW] Cache limpo por solicitação');
    });
  }
});
