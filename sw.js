// sw.js - Service Worker para CFM Actualizações - PWA Vertical Fullscreen
const CACHE_NAME = 'cfm-updates-v3.0';
const STATIC_CACHE = 'cfm-static-v3.0';
const API_CACHE = 'cfm-api-v3.0';
const OFFLINE_CACHE = 'cfm-offline-v3.0';

// URLs para cache - Recursos essenciais para PWA offline
const STATIC_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './termos.html',
  './politicas.html',
  './sound.mp3',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './pwa-fullscreen.css',
  
  // Recursos externos
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  
  // Fallback images
  './fallback-logo.png',
  './fallback-bg.jpg'
];

// Configurações do PWA
const PWA_CONFIG = {
  offlineTitle: 'CFM Actualizações (Offline)',
  offlineMessage: 'Você está offline. Algumas funcionalidades podem estar limitadas.',
  updateNotification: true
};

// ==============================================
// INSTALAÇÃO DO SERVICE WORKER
// ==============================================
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Instalando Service Worker para PWA CFM...');
  
  event.waitUntil(
    (async () => {
      // Abre caches
      const staticCache = await caches.open(STATIC_CACHE);
      const offlineCache = await caches.open(OFFLINE_CACHE);
      
      // Cacheia recursos estáticos essenciais
      console.log('[SW] 🗂️ Cacheando recursos estáticos PWA');
      await staticCache.addAll(STATIC_ASSETS);
      
      // Cacheia página offline customizada
      const offlineResponse = new Response(
        `<!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CFM - Offline</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
              color: white;
              font-family: Roboto, sans-serif;
              height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            .logo {
              width: 120px;
              height: 120px;
              margin-bottom: 30px;
              background: white;
              border-radius: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 48px;
              color: #4CAF50;
            }
            h1 {
              margin: 0 0 20px 0;
              font-size: 24px;
            }
            p {
              margin: 0 0 30px 0;
              opacity: 0.9;
              max-width: 300px;
            }
            .status {
              background: rgba(255,255,255,0.2);
              padding: 10px 20px;
              border-radius: 10px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="logo">🚆</div>
          <h1>CFM Actualizações</h1>
          <p>Você está offline. As actualizações serão carregadas quando a conexão voltar.</p>
          <div class="status">Modo Offline Activo</div>
        </body>
        </html>`,
        {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Offline': 'true'
          }
        }
      );
      
      await offlineCache.put('./offline.html', offlineResponse);
      
      console.log('[SW] ✅ Instalação PWA completa');
      return self.skipWaiting();
    })()
  );
});

// ==============================================
// ATIVAÇÃO DO SERVICE WORKER
// ==============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Ativando Service Worker...');
  
  event.waitUntil(
    (async () => {
      // Limpar caches antigos
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (![CACHE_NAME, STATIC_CACHE, API_CACHE, OFFLINE_CACHE].includes(cacheName)) {
            console.log(`[SW] 🗑️ Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Tomar controle imediato de todas as páginas
      await self.clients.claim();
      
      // Enviar mensagem para todas as páginas
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: '3.0',
          timestamp: new Date().toISOString()
        });
      });
      
      console.log('[SW] ✅ Ativação completa. Controle assumido.');
    })()
  );
});

// ==============================================
// ESTRATÉGIAS DE CACHE AVANÇADAS
// ==============================================

// 1. Estratégia para navegação (PWA fullscreen)
async function handleNavigation(request) {
  try {
    // Tenta buscar da rede primeiro
    const networkResponse = await fetch(request);
    
    // Se for HTML, atualiza cache
    if (networkResponse.headers.get('Content-Type')?.includes('text/html')) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] 🌐 Rede falhou para navegação, usando cache...');
    
    // Verifica se está no cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retorna página offline customizada
    const offlineCache = await caches.open(OFFLINE_CACHE);
    return offlineCache.match('./offline.html');
  }
}

// 2. Estratégia para recursos estáticos (Cache First)
async function cacheFirstWithUpdate(request) {
  // Primeiro verifica no cache
  const cachedResponse = await caches.match(request);
  
  // Busca da rede em background para atualizar
  const fetchPromise = fetch(request)
    .then(async networkResponse => {
      // Verifica se a resposta é válida
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.log(`[SW] ❌ Falha ao atualizar ${request.url}:`, error);
    });
  
  // Retorna cache imediatamente se existir
  if (cachedResponse) {
    // Atualiza em background
    if (!request.url.includes('chrome-extension')) {
      fetchPromise.catch(console.error);
    }
    return cachedResponse;
  }
  
  // Se não tem cache, espera pela rede
  return await fetchPromise;
}

// 3. Estratégia para API (Stale-While-Revalidate)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Busca da rede em background
  const fetchPromise = fetch(request)
    .then(async networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        await cache.put(request, networkResponse.clone());
        
        // Notifica sobre dados atualizados
        if (request.url.includes('script.google.com')) {
          notifyAboutUpdate();
        }
      }
      return networkResponse;
    })
    .catch(error => {
      console.log('[SW] 🌐 Falha ao buscar API:', error);
    });
  
  // Retorna cache imediatamente
  if (cachedResponse) {
    fetchPromise.catch(console.error);
    return cachedResponse;
  }
  
  return await fetchPromise;
}

// 4. Estratégia para Google Apps Script (Cache com timeout)
async function handleGoogleScript(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Se tem cache recente (menos de 5 minutos)
  if (cachedResponse) {
    const cachedTime = new Date(cachedResponse.headers.get('sw-cached-time'));
    const now = new Date();
    const minutesDiff = (now - cachedTime) / (1000 * 60);
    
    if (minutesDiff < 5) {
      // Retorna cache e atualiza em background
      fetch(request)
        .then(async networkResponse => {
          if (networkResponse.ok) {
            const headers = new Headers(networkResponse.headers);
            headers.set('sw-cached-time', new Date().toISOString());
            
            const response = new Response(networkResponse.body, {
              status: networkResponse.status,
              statusText: networkResponse.statusText,
              headers: headers
            });
            
            await cache.put(request, response.clone());
          }
        })
        .catch(console.error);
      
      return cachedResponse;
    }
  }
  
  // Busca novo da rede
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-time', new Date().toISOString());
      
      const response = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      
      await cache.put(request, response.clone());
      return response;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// ==============================================
// INTERCEPTAÇÃO DE REQUISIÇÕES
// ==============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignora requisições específicas
  if (url.protocol === 'chrome-extension:' || 
      url.href.includes('service-worker.min.js') ||
      url.href.includes('3nbf4.com/act/files/')) {
    return;
  }
  
  // Requisições de navegação (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigation(event.request));
    return;
  }
  
  // API do Google Apps Script
  if (url.href.includes('script.google.com')) {
    event.respondWith(handleGoogleScript(event.request));
    return;
  }
  
  // Outras APIs
  if (url.search.includes('action=') || url.pathname.includes('/api/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Recursos estáticos (CSS, JS, Imagens, Fontes)
  if (url.origin === self.location.origin ||
      url.href.includes('fonts.googleapis.com') ||
      url.href.includes('fonts.gstatic.com') ||
      url.href.includes('cdnjs.cloudflare.com') ||
      /\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/.test(url.pathname)) {
    event.respondWith(cacheFirstWithUpdate(event.request));
    return;
  }
  
  // Para todas as outras requisições
  event.respondWith(handleNavigation(event.request));
});

// ==============================================
// FUNÇÕES AUXILIARES
// ==============================================

async function notifyAboutUpdate() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'DATA_UPDATED',
      message: 'Dados atualizados disponíveis',
      timestamp: new Date().toISOString()
    });
  });
}

// ==============================================
// BACKGROUND SYNC
// ==============================================
self.addEventListener('sync', (event) => {
  console.log(`[SW] 🔄 Sync event: ${event.tag}`);
  
  if (event.tag === 'sync-updates') {
    event.waitUntil(syncUpdates());
  }
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncChatMessages());
  }
});

async function syncUpdates() {
  try {
    console.log('[SW] Sincronizando atualizações...');
    // Implementar lógica de sync
  } catch (error) {
    console.error('[SW] Erro no sync:', error);
  }
}

async function syncChatMessages() {
  try {
    // Lógica para sincronizar mensagens offline
    const pendingMessages = await getPendingMessages();
    
    for (const message of pendingMessages) {
      try {
        await sendMessageToServer(message);
        await removePendingMessage(message.id);
        console.log('[SW] Mensagem sincronizada:', message.id);
      } catch (error) {
        console.error('[SW] Erro ao sincronizar mensagem:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Erro no sync de mensagens:', error);
  }
}

// Funções auxiliares para IndexedDB
async function getPendingMessages() {
  // Implementar conforme seu banco de dados
  return [];
}

async function sendMessageToServer(message) {
  // Implementar envio para servidor
  return Promise.resolve();
}

async function removePendingMessage(id) {
  // Implementar remoção
  return Promise.resolve();
}

// ==============================================
// PUSH NOTIFICATIONS
// ==============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nova atualização do comboio disponível',
      icon: './icon-192.png',
      badge: './icon-72.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'cfm-update',
      renotify: true,
      actions: [
        {
          action: 'view',
          title: 'Ver',
          icon: './icon-96.png'
        },
        {
          action: 'dismiss',
          title: 'Fechar',
          icon: './close-icon.png'
        }
      ],
      data: {
        url: data.url || './',
        timestamp: Date.now(),
        type: data.type || 'update'
      },
      requireInteraction: data.important || false
    };
    
    // Adicionar imagem se disponível
    if (data.image) {
      options.image = data.image;
    }
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || '🚆 CFM Atualizações', 
        options
      )
    );
  } catch (error) {
    // Fallback para texto simples
    const title = 'CFM Atualizações';
    const options = {
      body: event.data.text() || 'Nova atualização disponível',
      icon: './icon-192.png',
      badge: './icon-72.png',
      vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Verifica se já tem uma janela aberta
        for (const client of windowClients) {
          if (client.url.includes(event.notification.data.url) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Abre nova janela
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || './');
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Apenas fecha a notificação
    console.log('[SW] Notificação dispensada pelo usuário');
  } else {
    // Clique na notificação (sem ação específica)
    event.waitUntil(
      clients.openWindow(event.notification.data.url || './')
    );
  }
});

// ==============================================
// PERIODIC SYNC (Background updates)
// ==============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-updates') {
    console.log('[SW] ⏰ Verificando atualizações em background...');
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycby7_IGl4-vf2A81zi9STdIWQrBS31M3Ornq1m_6R2lh33a7EcXbP8l2xNBLQUk_S0JJ/exec?action=lastupdate');
    
    if (response.ok) {
      const data = await response.json();
      
      // Verifica se há novas atualizações
      const lastUpdate = localStorage.getItem('cfm_last_update');
      
      if (!lastUpdate || data.lastUpdate !== lastUpdate) {
        // Mostra notificação
        await self.registration.showNotification('🚆 CFM Actualizações', {
          body: 'Há novas actualizações disponíveis para o comboio',
          icon: './icon-192.png',
          badge: './icon-72.png',
          tag: 'background-update',
          data: {
            url: './',
            update: data.lastUpdate
          }
        });
        
        // Atualiza localStorage
        localStorage.setItem('cfm_last_update', data.lastUpdate);
      }
    }
  } catch (error) {
    console.error('[SW] ❌ Erro ao verificar actualizações:', error);
  }
}

// ==============================================
// MENSAGENS DO CLIENTE
// ==============================================
self.addEventListener('message', (event) => {
  console.log('[SW] 📩 Mensagem recebida:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.keys().then(cacheNames => {
        event.ports[0].postMessage({
          caches: cacheNames,
          version: '3.0'
        });
      });
      break;
      
    case 'CHECK_UPDATE':
      checkForUpdates().then(() => {
        event.ports[0].postMessage({ status: 'checked' });
      });
      break;
  }
});

// ==============================================
// INICIALIZAÇÃO
// ==============================================
console.log('[SW] 🚀 Service Worker CFM Actualizações v3.0 carregado');
console.log('[SW] 🎯 PWA Vertical Fullscreen configurado');
console.log('[SW] 🟢 Cor tema: #4CAF50 (Verde CFM)');

// Adicione suas configurações de anúncios no FINAL do arquivo
// SW para Anúncios
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 10379001
};
self.lary = "";
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
