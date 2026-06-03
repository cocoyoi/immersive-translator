// popup.js - immersive-translator Settings Panel

const PRESETS = {
  openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temp: 0.3 },
  deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temp: 0.3 },
  aliyun: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', temp: 0.3 },
  ollama: { base: 'http://localhost:11434/v1', model: 'llama3', temp: 0.3 },
  custom: { base: '', model: '', temp: 0.3 }
};

const DEFAULT_SYSTEM = "你是一个专业翻译助手。将用户输入的文本翻译成目标语言，保持原文的语气和风格。只输出翻译结果，不添加解释。";

const AI_EXPERTS = [
  { id: 'general', name: '通用翻译', description: '适合日常翻译和通用文本' },
  { id: 'tech', name: '技术文档', description: '适合软件、IT、技术文档翻译' },
  { id: 'medical', name: '医学翻译', description: '适合医学论文、报告翻译' },
  { id: 'legal', name: '法律翻译', description: '适合合同、法律文件翻译' },
  { id: 'literary', name: '文学翻译', description: '适合小说、诗歌、散文翻译' },
  { id: 'academic', name: '学术论文', description: '适合学术论文、研究报告翻译' },
  { id: 'business', name: '商务翻译', description: '适合商务邮件、提案翻译' },
  { id: 'subtitles', name: '字幕翻译', description: '适合视频字幕、对话翻译' }
];

let currentEngines = [];
let activeEngineId = null;
let currentGlossary = {};
let currentExpert = 'general';

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

function initStylePreviews() {
  document.querySelectorAll('.style-preview').forEach(preview => {
    preview.addEventListener('click', () => {
      document.querySelectorAll('.style-preview').forEach(p => p.classList.remove('active'));
      preview.classList.add('active');
    });
  });
}

async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'enableTranslate', 'bilingualMode', 'selectionTranslate', 'inputTranslate',
    'targetLang', 'fontSize', 'transColor', 'showOriginal', 'hoverTranslate',
    'autoDetect', 'enableCache', 'maxConcurrent', 'engines', 'activeEngineId',
    'hoverModifier', 'inputTrigger', 'glossary', 'aiExpert', 'transStyle',
    'pronounceEnabled', 'systemPrompt'
  ]);
  
  document.getElementById('enable-translate').checked = data.enableTranslate || false;
  document.getElementById('bilingual-mode').checked = data.bilingualMode !== false;
  document.getElementById('selection-translate').checked = data.selectionTranslate || false;
  document.getElementById('input-translate').checked = data.inputTranslate || false;
  document.getElementById('hover-translate').checked = data.hoverTranslate || false;
  document.getElementById('target-lang').value = data.targetLang || 'zh-CN';
  document.getElementById('font-size').value = data.fontSize || 14;
  document.getElementById('trans-color').value = data.transColor || '#667eea';
  document.getElementById('show-original').checked = data.showOriginal !== false;
  document.getElementById('auto-detect').checked = data.autoDetect !== false;
  document.getElementById('enable-cache').checked = data.enableCache !== false;
  document.getElementById('max-concurrent').value = data.maxConcurrent || 3;
  document.getElementById('hover-modifier').value = data.hoverModifier || 'ctrl';
  document.getElementById('input-trigger').value = data.inputTrigger || 'triple-space';
  document.getElementById('pronounce-enabled').checked = data.pronounceEnabled || false;
  document.getElementById('system-prompt').value = data.systemPrompt || DEFAULT_SYSTEM;
  
  // Style
  const style = data.transStyle || 'bilingual-inline';
  document.querySelectorAll('.style-preview').forEach(p => {
    p.classList.toggle('active', p.dataset.style === style);
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
      document.getElementById('system-prompt').value = engine.system || DEFAULT_SYSTEM;
    }
  }
  
  // Glossary
  currentGlossary = data.glossary || {};
  renderGlossary();
  
  // Expert
  currentExpert = data.aiExpert || 'general';
  renderExperts();
  
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

function renderGlossary() {
  const list = document.getElementById('glossary-list');
  list.innerHTML = '';
  Object.entries(currentGlossary).forEach(([key, val]) => {
    const row = document.createElement('div');
    row.className = 'glossary-row';
    row.innerHTML = `
      <input type="text" value="${key}" readonly style="background: #1a1a2e; color: #888;">
      <input type="text" value="${val}" readonly style="background: #1a1a2e; color: #888;">
      <button class="icon-btn" data-key="${key}">×</button>
    `;
    list.appendChild(row);
  });
  
  list.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      delete currentGlossary[btn.dataset.key];
      await chrome.storage.sync.set({ glossary: currentGlossary });
      renderGlossary();
    });
  });
}

function renderExperts() {
  const list = document.getElementById('expert-list');
  list.innerHTML = '';
  AI_EXPERTS.forEach(expert => {
    const card = document.createElement('div');
    card.className = 'expert-card' + (expert.id === currentExpert ? ' active' : '');
    card.innerHTML = `
      <h4>${expert.name}</h4>
      <p>${expert.description}</p>
    `;
    card.addEventListener('click', () => {
      currentExpert = expert.id;
      document.querySelectorAll('.expert-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
    list.appendChild(card);
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
  const styleEl = document.querySelector('.style-preview.active');
  const transStyle = styleEl ? styleEl.dataset.style : 'bilingual-inline';
  
  const expert = AI_EXPERTS.find(e => e.id === currentExpert);
  
  await chrome.storage.sync.set({
    enableTranslate: document.getElementById('enable-translate').checked,
    bilingualMode: document.getElementById('bilingual-mode').checked,
    selectionTranslate: document.getElementById('selection-translate').checked,
    inputTranslate: document.getElementById('input-translate').checked,
    hoverTranslate: document.getElementById('hover-translate').checked,
    targetLang: document.getElementById('target-lang').value,
    fontSize: parseInt(document.getElementById('font-size').value),
    transColor: document.getElementById('trans-color').value,
    showOriginal: document.getElementById('show-original').checked,
    autoDetect: document.getElementById('auto-detect').checked,
    enableCache: document.getElementById('enable-cache').checked,
    maxConcurrent: parseInt(document.getElementById('max-concurrent').value),
    hoverModifier: document.getElementById('hover-modifier').value,
    inputTrigger: document.getElementById('input-trigger').value,
    pronounceEnabled: document.getElementById('pronounce-enabled').checked,
    transStyle,
    aiExpert: currentExpert,
    glossary: currentGlossary,
    systemPrompt: document.getElementById('system-prompt').value.trim()
  });
  alert('设置已保存');
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
  alert('翻译缓存已清除');
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
  initStylePreviews();
  loadSettings();
  loadLogs();
  
  document.getElementById('test-engine').addEventListener('click', testEngine);
  document.getElementById('save-engine').addEventListener('click', saveEngine);
  document.getElementById('save-advanced').addEventListener('click', saveAllSettings);
  document.getElementById('add-glossary').addEventListener('click', addGlossary);
  document.getElementById('clear-logs').addEventListener('click', () => {
    chrome.storage.local.set({ logs: [] });
    loadLogs();
  });
  document.getElementById('clear-cache').addEventListener('click', clearCache);
}

document.addEventListener('DOMContentLoaded', init);
