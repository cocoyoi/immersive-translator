// popup.js - immersive-translator Settings Panel

const PRESETS = {
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temp: 0.3 },
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temp: 0.3 },
  aliyun: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', temp: 0.3 },
  ollama: { base: 'http://localhost:11434/v1', model: 'llama3', temp: 0.3 },
  custom: { base: '', model: '', temp: 0.3 }
};

let currentEngines = [];
let activeEngineId = null;
let currentGlossary = {};
let currentExpert = 'general';
let currentStyle = 'bilingual-inline';

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel + '-panel').classList.add('active');
    });
  });
}

function initPresets() {
  document.querySelectorAll('.preset-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.preset-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      const preset = PRESETS[tag.dataset.preset];
      document.getElementById('api-base').value = preset.base;
      document.getElementById('model-name').value = preset.model;
      document.getElementById('temperature').value = preset.temp;
      document.getElementById('temp-value').textContent = preset.temp;
    });
  });
}

function initStyles() {
  document.querySelectorAll('.style-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentStyle = card.dataset.style;
    });
  });
}

function initExperts() {
  document.querySelectorAll('.expert-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.expert-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentExpert = card.dataset.expert;
    });
  });
}

function initRanges() {
  const fontSize = document.getElementById('font-size');
  if (fontSize) {
    fontSize.addEventListener('input', () => {
      document.getElementById('font-size-value').textContent = fontSize.value;
    });
  }
  const temp = document.getElementById('temperature');
  if (temp) {
    temp.addEventListener('input', () => {
      document.getElementById('temp-value').textContent = temp.value;
    });
  }
  const concurrent = document.getElementById('max-concurrent');
  if (concurrent) {
    concurrent.addEventListener('input', () => {
      document.getElementById('concurrent-value').textContent = concurrent.value;
    });
  }
}

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'enableTranslate', 'bilingualMode', 'selectionTranslate', 'inputTranslate',
    'targetLang', 'fontSize', 'transColor', 'showOriginal', 'hoverTranslate',
    'autoDetect', 'enableCache', 'maxConcurrent', 'engines', 'activeEngineId',
    'hoverModifier', 'inputTrigger', 'glossary', 'aiExpert', 'transStyle',
    'pronounceEnabled'
  ]);
  
  const toggle = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val || false;
  };
  
  toggle('enable-translate', data.enableTranslate);
  toggle('selection-translate', data.selectionTranslate);
  toggle('input-translate', data.inputTranslate);
  toggle('hover-translate', data.hoverTranslate);
  toggle('show-original', data.showOriginal !== false);
  toggle('enable-cache', data.enableCache !== false);
  toggle('pronounce-enabled', data.pronounceEnabled);
  
  const targetLang = document.getElementById('target-lang');
  if (targetLang) targetLang.value = data.targetLang || 'zh-CN';
  
  const fontSize = document.getElementById('font-size');
  if (fontSize) {
    fontSize.value = data.fontSize || 14;
    document.getElementById('font-size-value').textContent = data.fontSize || 14;
  }
  
  const transColor = document.getElementById('trans-color');
  if (transColor) transColor.value = data.transColor || '#667eea';
  
  const hoverModifier = document.getElementById('hover-modifier');
  if (hoverModifier) hoverModifier.value = data.hoverModifier || 'ctrl';
  
  const inputTrigger = document.getElementById('input-trigger');
  if (inputTrigger) inputTrigger.value = data.inputTrigger || 'triple-space';
  
  const maxConcurrent = document.getElementById('max-concurrent');
  if (maxConcurrent) {
    maxConcurrent.value = data.maxConcurrent || 3;
    document.getElementById('concurrent-value').textContent = data.maxConcurrent || 3;
  }
  
  // Style
  currentStyle = data.transStyle || 'bilingual-inline';
  document.querySelectorAll('.style-card').forEach(c => {
    c.classList.toggle('active', c.dataset.style === currentStyle);
  });
  
  // Engines
  currentEngines = data.engines || [];
  activeEngineId = data.activeEngineId;
  renderEngineList();
  
  if (activeEngineId) {
    const engine = currentEngines.find(e => e.id === activeEngineId);
    if (engine) {
      document.getElementById('api-base').value = engine.base || '';
      document.getElementById('api-key').value = engine.key || '';
      document.getElementById('model-name').value = engine.model || '';
      document.getElementById('temperature').value = engine.temp || 0.3;
      document.getElementById('temp-value').textContent = engine.temp || 0.3;
    }
  }
  
  // Glossary
  currentGlossary = data.glossary || {};
  renderGlossary();
  
  // Expert
  currentExpert = data.aiExpert || 'general';
  document.querySelectorAll('.expert-card').forEach(c => {
    c.classList.toggle('active', c.dataset.expert === currentExpert);
  });
  
  updateStatus();
}

function renderEngineList() {
  const list = document.getElementById('engine-list');
  if (!list) return;
  list.innerHTML = '';
  
  if (currentEngines.length === 0) {
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">暂无配置引擎，请添加一个</div>';
    return;
  }
  
  currentEngines.forEach(engine => {
    const div = document.createElement('div');
    div.className = 'engine-card' + (engine.id === activeEngineId ? ' active' : '');
    div.innerHTML = `
      <div class="engine-info">
        <h4>${escapeHtml(engine.name || '未命名')}</h4>
        <p>${escapeHtml(engine.model || '无模型')} @ ${escapeHtml(new URL(engine.base || 'http://localhost').hostname)}</p>
      </div>
      <div class="engine-actions">
        <button class="btn btn-secondary btn-sm" data-action="activate" data-id="${engine.id}">启用</button>
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${engine.id}">编辑</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${engine.id}">删除</button>
      </div>
    `;
    list.appendChild(div);
  });
  
  list.querySelectorAll('.engine-actions button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'activate') {
        activeEngineId = id;
        await chrome.storage.sync.set({ activeEngineId });
        renderEngineList();
        updateStatus();
      } else if (action === 'delete') {
        currentEngines = currentEngines.filter(e => e.id !== id);
        if (activeEngineId === id) activeEngineId = null;
        await chrome.storage.sync.set({ engines: currentEngines, activeEngineId });
        renderEngineList();
        updateStatus();
      } else if (action === 'edit') {
        const engine = currentEngines.find(e => e.id === id);
        if (engine) {
          document.getElementById('api-base').value = engine.base || '';
          document.getElementById('api-key').value = engine.key || '';
          document.getElementById('model-name').value = engine.model || '';
          document.getElementById('temperature').value = engine.temp || 0.3;
          document.getElementById('temp-value').textContent = engine.temp || 0.3;
          document.querySelector('.tab[data-panel="engines"]').click();
        }
      }
    });
  });
}

function renderGlossary() {
  const list = document.getElementById('glossary-list');
  if (!list) return;
  list.innerHTML = '';
  
  Object.entries(currentGlossary).forEach(([key, val]) => {
    const row = document.createElement('div');
    row.className = 'glossary-row';
    row.innerHTML = `
      <input type="text" value="${escapeHtml(key)}" readonly style="opacity: 0.7;">
      <input type="text" value="${escapeHtml(val)}" readonly style="opacity: 0.7;">
      <button data-key="${escapeHtml(key)}">&times;</button>
    `;
    list.appendChild(row);
  });
  
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      delete currentGlossary[btn.dataset.key];
      await chrome.storage.sync.set({ glossary: currentGlossary });
      renderGlossary();
    });
  });
}

function updateStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;
  
  if (!activeEngineId || currentEngines.length === 0) {
    dot.className = 'status-dot error';
    text.textContent = '未配置引擎';
  } else {
    dot.className = 'status-dot';
    text.textContent = '就绪';
  }
}

async function testEngine() {
  const result = document.getElementById('test-result');
  result.className = 'test-result';
  result.textContent = '测试中...';
  result.style.display = 'block';
  
  try {
    const base = document.getElementById('api-base').value.trim();
    const key = document.getElementById('api-key').value.trim();
    const model = document.getElementById('model-name').value.trim();
    
    if (!base || !key) throw new Error('请填写 API Base URL 和 API Key');
    
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      })
    });
    
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + await resp.text());
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) {
      result.className = 'test-result success';
      result.textContent = '✓ 连接成功！模型: ' + (model || 'unknown');
    } else {
      throw new Error('响应格式异常');
    }
  } catch (e) {
    result.className = 'test-result error';
    result.textContent = '✗ 连接失败: ' + e.message;
  }
}

async function saveEngine() {
  const base = document.getElementById('api-base').value.trim();
  const key = document.getElementById('api-key').value.trim();
  const model = document.getElementById('model-name').value.trim();
  const temp = parseFloat(document.getElementById('temperature').value);
  
  if (!base || !key || !model) {
    alert('请填写 API Base URL、API Key 和模型名称');
    return;
  }
  
  let hostname;
  try { hostname = new URL(base).hostname; } catch (e) { hostname = 'custom'; }
  
  const engine = {
    id: activeEngineId || 'engine_' + Date.now(),
    name: model + '@' + hostname,
    base, key, model, temp,
    system: 'You are a professional translator. Translate accurately while preserving the original tone and style. Output only the translation without explanations.'
  };
  
  const existing = currentEngines.findIndex(e => e.id === engine.id);
  if (existing >= 0) currentEngines[existing] = engine;
  else currentEngines.push(engine);
  
  activeEngineId = engine.id;
  await chrome.storage.sync.set({ engines: currentEngines, activeEngineId });
  renderEngineList();
  updateStatus();
  
  const result = document.getElementById('test-result');
  result.className = 'test-result success';
  result.textContent = '✓ 引擎已保存';
}

async function saveAllSettings() {
  await chrome.storage.sync.set({
    enableTranslate: document.getElementById('enable-translate')?.checked || false,
    selectionTranslate: document.getElementById('selection-translate')?.checked || false,
    inputTranslate: document.getElementById('input-translate')?.checked || false,
    hoverTranslate: document.getElementById('hover-translate')?.checked || false,
    targetLang: document.getElementById('target-lang')?.value || 'zh-CN',
    fontSize: parseInt(document.getElementById('font-size')?.value || 14),
    transColor: document.getElementById('trans-color')?.value || '#667eea',
    showOriginal: document.getElementById('show-original')?.checked !== false,
    enableCache: document.getElementById('enable-cache')?.checked !== false,
    maxConcurrent: parseInt(document.getElementById('max-concurrent')?.value || 3),
    hoverModifier: document.getElementById('hover-modifier')?.value || 'ctrl',
    inputTrigger: document.getElementById('input-trigger')?.value || 'triple-space',
    pronounceEnabled: document.getElementById('pronounce-enabled')?.checked || false,
    transStyle: currentStyle,
    aiExpert: currentExpert,
    glossary: currentGlossary
  });
  
  // Show toast
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%); background: var(--primary); color: #fff; padding: 8px 16px; border-radius: 6px; font-size: 12px; z-index: 1000; animation: fadeIn 0.3s;';
  toast.textContent = '设置已保存';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

async function addGlossary() {
  const key = document.getElementById('glossary-key').value.trim();
  const val = document.getElementById('glossary-val').value.trim();
  if (!key || !val) return;
  
  currentGlossary[key] = val;
  await chrome.storage.sync.set({ glossary: currentGlossary });
  document.getElementById('glossary-key').value = '';
  document.getElementById('glossary-val').value = '';
  renderGlossary();
}

async function clearCache() {
  await chrome.storage.local.set({ translationCache: {} });
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'clearCache' });
  });
  const toast = document.createElement('div');
  toast.style.cssText = 'position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%); background: var(--success); color: #fff; padding: 8px 16px; border-radius: 6px; font-size: 12px; z-index: 1000;';
  toast.textContent = '缓存已清除';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function loadLogs() {
  chrome.storage.local.get(['logs'], ({ logs = [] }) => {
    const area = document.getElementById('logs-area');
    if (!area) return;
    area.innerHTML = logs.slice(-50).map(l => {
      const cls = l.level === 'error' ? 'log-error' : l.level === 'info' ? 'log-info' : '';
      return '<div class="log-entry"><span class="log-time">' + new Date(l.time).toLocaleTimeString() + '</span> <span class="' + cls + '">' + escapeHtml(l.msg) + '</span></div>';
    }).join('');
    area.scrollTop = area.scrollHeight;
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function translateCurrentPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'translate' });
    }
  });
  window.close();
}

function init() {
  initTabs();
  initPresets();
  initStyles();
  initExperts();
  initRanges();
  loadSettings();
  loadLogs();
  
  document.getElementById('test-engine')?.addEventListener('click', testEngine);
  document.getElementById('save-engine')?.addEventListener('click', saveEngine);
  document.getElementById('save-advanced')?.addEventListener('click', saveAllSettings);
  document.getElementById('add-glossary')?.addEventListener('click', addGlossary);
  document.getElementById('clear-logs')?.addEventListener('click', () => {
    chrome.storage.local.set({ logs: [] });
    loadLogs();
  });
  document.getElementById('refresh-logs')?.addEventListener('click', loadLogs);
  document.getElementById('clear-cache')?.addEventListener('click', clearCache);
  document.getElementById('btn-translate-page')?.addEventListener('click', translateCurrentPage);
  document.getElementById('btn-document-translator')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('document-translator.html') });
    window.close();
  });
  document.getElementById('btn-manga-translator')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('document-translator.html') });
    window.close();
  });
  document.getElementById('btn-speech-translate')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { action: 'toggleSpeechTranslate' });
    window.close();
  });
  document.getElementById('btn-meeting-translate')?.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) chrome.tabs.sendMessage(tab.id, { action: 'toggleMeetingTranslate', enable: true });
    window.close();
  });
}

document.addEventListener('DOMContentLoaded', init);
