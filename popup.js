// popup.js - YaYacal Translation Settings Panel
const PRESETS = {
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temp: 0.3 },
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temp: 0.3 },
  aliyun: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', temp: 0.3 },
  ollama: { base: 'http://localhost:11434/v1', model: 'llama3', temp: 0.3 },
  custom: { base: '', model: '', temp: 0.3 }
};

const DEFAULT_SYSTEM = "你是一个专业翻译助手。将用户输入的文本翻译成目标语言，保持原文的语气和风格。只输出翻译结果，不添加解释。";

let currentEngines = [];
let activeEngineId = null;

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
    });
  });
}

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'enableTranslate', 'bilingualMode', 'selectionTranslate', 'inputTranslate',
    'targetLang', 'fontSize', 'transColor', 'showOriginal', 'hoverTranslate',
    'autoDetect', 'enableCache', 'maxConcurrent', 'engines', 'activeEngineId'
  ]);
  
  document.getElementById('enable-translate').checked = data.enableTranslate || false;
  document.getElementById('bilingual-mode').checked = data.bilingualMode !== false;
  document.getElementById('selection-translate').checked = data.selectionTranslate || false;
  document.getElementById('input-translate').checked = data.inputTranslate || false;
  document.getElementById('target-lang').value = data.targetLang || 'zh-CN';
  document.getElementById('font-size').value = data.fontSize || 14;
  document.getElementById('trans-color').value = data.transColor || '#667eea';
  document.getElementById('show-original').checked = data.showOriginal !== false;
  document.getElementById('hover-translate').checked = data.hoverTranslate || false;
  document.getElementById('auto-detect').checked = data.autoDetect !== false;
  document.getElementById('enable-cache').checked = data.enableCache !== false;
  document.getElementById('max-concurrent').value = data.maxConcurrent || 3;
  
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
      document.getElementById('system-prompt').value = engine.system || DEFAULT_SYSTEM;
    }
  }
  
  updateStatus();
}

function renderEngineList() {
  const list = document.getElementById('engine-list');
  list.innerHTML = '';
  currentEngines.forEach(engine => {
    const div = document.createElement('div');
    div.className = 'engine-item';
    div.innerHTML = `
      <div class="engine-info">
        <div class="engine-name">${engine.name || '未命名'} ${engine.id === activeEngineId ? '✓' : ''}</div>
        <div class="engine-url">${engine.model || '无模型'} @ ${engine.base || '无URL'}</div>
      </div>
      <div class="engine-actions">
        <button class="icon-btn" data-action="activate" data-id="${engine.id}">启用</button>
        <button class="icon-btn" data-action="edit" data-id="${engine.id}">编辑</button>
        <button class="icon-btn" data-action="delete" data-id="${engine.id}">删除</button>
      </div>
    `;
    list.appendChild(div);
  });
  
  list.querySelectorAll('.icon-btn').forEach(btn => {
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
          document.getElementById('system-prompt').value = engine.system || DEFAULT_SYSTEM;
          document.querySelector('.tab[data-panel="engines"]').click();
        }
      }
    });
  });
}

function updateStatus() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!activeEngineId) {
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
    
    const resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      })
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    if (data.choices?.[0]?.message?.content) {
      result.className = 'test-result success';
      result.textContent = `✓ 连接成功！模型: ${model || 'unknown'}`;
    } else {
      throw new Error('响应格式异常');
    }
  } catch (e) {
    result.className = 'test-result error';
    result.textContent = `✗ 连接失败: ${e.message}`;
  }
}

async function saveEngine() {
  const base = document.getElementById('api-base').value.trim();
  const key = document.getElementById('api-key').value.trim();
  const model = document.getElementById('model-name').value.trim();
  const temp = parseFloat(document.getElementById('temperature').value);
  const system = document.getElementById('system-prompt').value.trim();
  
  if (!base || !key || !model) {
    alert('请填写 API Base URL、API Key 和模型名称');
    return;
  }
  
  const engine = {
    id: activeEngineId || `engine_${Date.now()}`,
    name: `${model}@${new URL(base).hostname}`,
    base, key, model, temp, system
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
    enableTranslate: document.getElementById('enable-translate').checked,
    bilingualMode: document.getElementById('bilingual-mode').checked,
    selectionTranslate: document.getElementById('selection-translate').checked,
    inputTranslate: document.getElementById('input-translate').checked,
    targetLang: document.getElementById('target-lang').value,
    fontSize: parseInt(document.getElementById('font-size').value),
    transColor: document.getElementById('trans-color').value,
    showOriginal: document.getElementById('show-original').checked,
    hoverTranslate: document.getElementById('hover-translate').checked,
    autoDetect: document.getElementById('auto-detect').checked,
    enableCache: document.getElementById('enable-cache').checked,
    maxConcurrent: parseInt(document.getElementById('max-concurrent').value)
  });
  alert('设置已保存');
}

function loadLogs() {
  chrome.storage.local.get(['logs'], ({ logs = [] }) => {
    const area = document.getElementById('logs-area');
    area.innerHTML = logs.slice(-50).map(l => {
      const cls = l.level === 'error' ? 'log-error' : l.level === 'info' ? 'log-info' : '';
      return `<div class="log-entry"><span class="log-time">${new Date(l.time).toLocaleTimeString()}</span> <span class="${cls}">${l.msg}</span></div>`;
    }).join('');
    area.scrollTop = area.scrollHeight;
  });
}

function init() {
  initTabs();
  initPresets();
  loadSettings();
  loadLogs();
  
  document.getElementById('test-engine').addEventListener('click', testEngine);
  document.getElementById('save-engine').addEventListener('click', saveEngine);
  document.getElementById('save-settings').addEventListener('click', saveAllSettings);
  document.getElementById('clear-logs').addEventListener('click', () => {
    chrome.storage.local.set({ logs: [] });
    loadLogs();
  });
}

document.addEventListener('DOMContentLoaded', init);
