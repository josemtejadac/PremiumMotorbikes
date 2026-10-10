const CACHE = 'premium-mb-v2';
const ASSETS = ['./', './index.html', './logo.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
const CDN = /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function guardar(req, res){
  if (res && (res.ok || res.type === 'opaque')){
    const copia = res.clone();
    caches.open(CACHE).then(c => c.put(req, copia));
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismo = url.origin === location.origin;
  if (!mismo && !CDN.test(url.hostname)) return;   // Supabase y demás pasan directo, sin caché

  // La página: red primero, pero si tarda más de 3 s abre al tiro con la copia guardada
  if (req.mode === 'navigate' || (mismo && url.pathname.endsWith('.html'))){
    const red = fetch(req).then(res => { guardar(req, res); return res; });
    const guardada = new Promise(ok => setTimeout(() => caches.match(req).then(c => ok(c || null)), 3000));
    e.respondWith(
      Promise.race([red.catch(() => null), guardada])
        .then(r => r || red)
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Todo lo demás (librerías, fuentes, logo, íconos): responde al tiro con lo guardado y actualiza detrás
  const red = fetch(req).then(res => { guardar(req, res); return res; }).catch(() => null);
  e.waitUntil(red);
  e.respondWith(
    caches.match(req).then(hit => hit || red.then(r => r || new Response('', { status: 504 })))
  );
});
