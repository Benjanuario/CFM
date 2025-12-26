// sw.js - Service Worker para CFM Actualizações
const CACHE_NAME = 'cfm-updates-v1.8';
const STATIC_CACHE = 'cfm-static-v1.8';
const API_CACHE = 'cfm-api-v1.8';

// URLs para cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './termos.html',
  './politicas.html',
  './sound.mp3',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Cacheando recursos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Instalação completa');
        return self.skipWaiting();
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  
  // Limpar caches antigos
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== STATIC_CACHE && 
              cacheName !== API_CACHE) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[SW] Ativação completa');
      return self.clients.claim();
    })
  );
});

// Estratégia de cache: Network First com fallback para cache
async function networkFirstWithCache(request) {
  try {
    // Tenta buscar da rede primeiro
    const networkResponse = await fetch(request);
    
    // Se sucesso, atualiza o cache
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
  } catch (error) {
    // Se falhar, busca do cache
    console.log('[SW] Rede falhou, usando cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Se não tiver no cache, retorna página offline
    if (request.headers.get('Accept').includes('text/html')) {
      return caches.match('./index.html');
    }
    
    throw error;
  }
}

// Estratégia para API: Cache First com atualização em background
async function cacheFirstWithUpdate(request) {
  // Primeiro verifica no cache
  const cachedResponse = await caches.match(request);
  
  // Busca da rede em background para atualizar cache
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      // Atualiza cache com nova resposta
      caches.open(API_CACHE)
        .then(cache => cache.put(request, networkResponse.clone()))
        .catch(console.error);
      
      return networkResponse;
    })
    .catch(console.error);
  
  // Retorna do cache imediatamente se existir
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Se não tem cache, espera pela rede
  return fetchPromise;
}

// Estratégia para atualizações: Stale-While-Revalidate
async function staleWhileRevalidate(request) {
  // Abre cache
  const cache = await caches.open(CACHE_NAME);
  
  // Tenta buscar do cache primeiro
  const cachedResponse = await cache.match(request);
  
  // Busca da rede em background
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      // Atualiza cache
      cache.put(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(error => {
      console.log('[SW] Falha ao buscar:', request.url, error);
      return cachedResponse;
    });
  
  // Retorna cache imediatamente, rede em background
  return cachedResponse || fetchPromise;
}

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignora requisições de extensões do Chrome
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Para Google Apps Script - usa cache com atualização
  if (url.href.includes('script.google.com')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
  
  // Para API de atualizações - cache first
  if (url.search.includes('action=')) {
    event.respondWith(cacheFirstWithUpdate(event.request));
    return;
  }
  
  // Para recursos estáticos - cache first
  if (url.origin === self.location.origin || 
      url.href.includes('fonts.googleapis.com') ||
      url.href.includes('cdnjs.cloudflare.com')) {
    event.respondWith(cacheFirstWithUpdate(event.request));
    return;
  }
  
  // Para tudo mais - network first
  event.respondWith(networkFirstWithCache(event.request));
});

// Background Sync para enviar mensagens offline
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-chat-messages') {
    console.log('[SW] Sincronizando mensagens do chat...');
    event.waitUntil(syncChatMessages());
  }
});

async function syncChatMessages() {
  try {
    // Recupera mensagens pendentes do IndexedDB
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
    console.error('[SW] Erro no sync:', error);
  }
}

// Funções auxiliares para IndexedDB
async function getPendingMessages() {
  // Implementar lógica para buscar mensagens pendentes
  return [];
}

async function sendMessageToServer(message) {
  // Implementar envio para servidor
  return Promise.resolve();
}

async function removePendingMessage(id) {
  // Implementar remoção de mensagem pendente
  return Promise.resolve();
}

// Notificações push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'Nova atualização disponível',
    icon: './icon-192.png',
    badge: './badge-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'CFM Atualizações', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(windowClients => {
        // Se já tem uma janela aberta, focar nela
        for (const client of windowClients) {
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Se não tem, abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});

// Background fetch para conteúdo importante
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    console.log('[SW] Verificando atualizações em background...');
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycby7_IGl4-vf2A81zi9STdIWQrBS31M3Ornq1m_6R2lh33a7EcXbP8l2xNBLQUk_S0JJ/exec?action=lastupdate');
    const data = await response.json();
    
    // Se há novas atualizações, mostrar notificação
    if (data.lastUpdate) {
      self.registration.showNotification('CFM Atualizações', {
        body: 'Há novas atualizações disponíveis',
        icon: './icon-192.png',
        badge: './badge-72.png',
        vibrate: [200, 100, 200]
      });
    }
  } catch (error) {
    console.error('[SW] Erro ao verificar atualizações:', error);
  }
}
