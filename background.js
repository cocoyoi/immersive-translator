// background.js - YaYacal Translation Service Worker
// Handles API calls, health checks, caching, and context menus

const DEFAULT_SETTINGS = {
  enableTranslate: false,
  bilingualMode: true,
  selectionTranslate: false,
  inputTranslate: false,
  targetLang: 'zh-CN',
  fontSize: 14,
  transColor: '#667eea',
  showOriginal: true,
  hoverTranslate: false,
  autoDetect: true,
  enableCache: true,
  maxConcurrent: 3,
  engines: [],
  activeEngineId: null
};

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const LOG_RETENTION = 1000; // max logs

let healthCheckTimer = null;
let engineHealth = new Map(); // engineId -> { status: 'ok'|'down'|'error', lastCheck, latency }

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    await log('info', 'YaYacal Translation installed');
  }
  await setupContextMenus();
  startHealthChecks();
});

chrome.runtime.onStartup.addListener(() => {
  startHealthChecks();
});

// Context menus
async function setupContextMenus() {
  await chrome.contextMenus.removeAll();
  
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中内容',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'translate-page',
    title: '翻译整个页面',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'translate-input',
    title: '翻译输入框',
    contexts: ['editable']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-selection') {
    await chrome.tabs.sendMessage(tab.id, { action: 'translateSelection', text: info.selectionText });
  } else if (info.menuItemId === 'translate-page') {
    await chrome.tabs.sendMessage(tab.id, { action: 'translate' });
  } else if (info.menuItemId === 'translate-input') {
    await chrome.tabs.sendMessage(tab.id, { action: 'translateInput' });
  }
});

// Health check for all engines
async function checkEngineHealth(engine) {
  const start = Date.now();
  try {
    const resp = await fetch(`${engine.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${engine.key}`
      },
      body: JSON.stringify({
        model: engine.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      })
    });
    const latency = Date.now() - start;
    if (resp.ok) {
      engineHealth.set(engine.id, { status: 'ok', lastCheck: Date.now(), latency });
      return true;
    } else {
      engineHealth.set(engine.id, { status: 'error', lastCheck: Date.now(), latency, error: `HTTP ${resp.status}` });
      return false;
    }
  } catch (e) {
    engineHealth.set(engine.id, { status: 'down', lastCheck: Date.now(), latency: Date.now() - start, error: e.message });
    return false;
  }
}

async function runHealthChecks() {
  const { engines = [] } = await chrome.storage.sync.get(['engines']);
  for (const engine of engines) {
    await checkEngineHealth(engine);
  }
  
  // Auto-failover: if active engine is down, switch to first healthy one
  const { activeEngineId } = await chrome.storage.sync.get(['activeEngineId']);
  const activeHealth = engineHealth.get(activeEngineId);
  if (activeHealth?.status !== 'ok') {
    const healthy = engines.find(e => engineHealth.get(e.id)?.status === 'ok');
    if (healthy) {
      await chrome.storage.sync.set({ activeEngineId: healthy.id });
      await log('info', `Auto-failover: switched to ${healthy.name}`);
    }
  }
}

function startHealthChecks() {
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  runHealthChecks();
  healthCheckTimer = setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL);
}

// Logging system
async function log(level, msg) {
  const { logs = [] } = await chrome.storage.local.get(['logs']);
  logs.push({ time: Date.now(), level, msg });
  if (logs.length > LOG_RETENTION) logs.shift();
  await chrome.storage.local.set({ logs });
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'translate': {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await chrome.tabs.sendMessage(tab.id, { action: 'translate' });
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
          break;
        }
        case 'getHealth': {
          sendResponse({ health: Object.fromEntries(engineHealth) });
          break;
        }
        case 'testEngine': {
          const result = await checkEngineHealth(request.engine);
          sendResponse({ success: result, health: engineHealth.get(request.engine.id) });
          break;
        }
        case 'getLogs': {
          const { logs = [] } = await chrome.storage.local.get(['logs']);
          sendResponse({ logs });
          break;
        }
        case 'clearCache': {
          await chrome.storage.local.set({ translationCache: {} });
          sendResponse({ success: true });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (e) {
      await log('error', e.message);
      sendResponse({ success: false, error: e.message });
    }
  })();
  return true; // async response
});

// Tab badge updater
async function updateBadge(tabId) {
  const { enableTranslate } = await chrome.storage.sync.get(['enableTranslate']);
  chrome.action.setBadgeText({ text: enableTranslate ? 'ON' : '', tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await updateBadge(tabId);
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' && changes.enableTranslate) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await updateBadge(tab.id);
  }
});

// Export for testing
self.YaYacalBackground = { checkEngineHealth, engineHealth, log };
