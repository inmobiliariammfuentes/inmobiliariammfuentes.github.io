// Cobranza Fuentes · service worker mínimo del portal (permite instalarlo como app en el celular)
// No guarda copias de las páginas: todo se pide siempre a internet, así nunca se ve una versión vieja.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui,sans-serif;padding:28px;color:#241a1c"><h2 style="color:#7a1f2e">Sin conexión</h2><p>Revisá tu internet y volvé a abrir el portal.</p></body>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
