// img-translator.js - Image Translation Engine
// Uses Tesseract.js for OCR, then translates extracted text

let currentImage = null;
let ocrResult = null;
let isTranslating = false;
let settings = {};

// Load settings
async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'targetLang', 'engines', 'activeEngineId', 'maxConcurrent', 'glossary'
  ]);
  settings = { ...{ targetLang: 'zh-CN' }, ...data };
}

async function getActiveEngine() {
  const { engines = [], activeEngineId } = settings;
  return engines.find(e => e.id === activeEngineId) || engines[0];
}

async function translateText(text) {
  if (!text || text.length < 3) return text;

  const engine = await getActiveEngine();
  if (!engine) throw new Error('No active translation engine');

  const url = `${engine.base}/chat/completions`;
  const body = {
    model: engine.model,
    messages: [
      { role: 'system', content: engine.system || 'You are a professional translator. Translate accurately while preserving the original tone and style. Output only the translation without explanations.' },
      { role: 'user', content: `Translate the following text to ${settings.targetLang}:

${text}` }
    ],
    temperature: engine.temp || 0.3,
    max_tokens: Math.max(100, text.length * 2)
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${engine.key}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}

// OCR image
async function ocrImage(imageFile) {
  showStatus('正在 OCR 识别...（首次使用需要下载语言模型，约 10MB）', 'info');
  document.getElementById('btn-translate').disabled = true;
  document.getElementById('btn-translate').textContent = '识别中...';

  try {
    const { createWorker } = Tesseract;
    const worker = await createWorker('eng+chi_sim+jpn+deu+fra+spa+rus+kor+por+ita+vie+tha+ara+hin');

    const result = await worker.recognize(imageFile);
    await worker.terminate();

    ocrResult = result.data;
    showStatus(`OCR 完成：识别到 ${ocrResult.text.length} 字符，置信度 ${Math.round(ocrResult.confidence)}%`, 'success');
    document.getElementById('btn-translate').disabled = false;
    document.getElementById('btn-translate').textContent = '翻译';

    return ocrResult;
  } catch (e) {
    showStatus(`OCR 失败: ${e.message}`, 'error');
    document.getElementById('btn-translate').disabled = false;
    document.getElementById('btn-translate').textContent = 'OCR + 翻译';
    throw e;
  }
}

// Translate OCR result
async function translateOCRResult() {
  if (!ocrResult || !ocrResult.text) {
    showStatus('请先上传图片并完成 OCR', 'error');
    return;
  }

  if (isTranslating) return;
  isTranslating = true;

  showStatus('正在翻译...', 'info');
  document.getElementById('btn-translate').disabled = true;
  document.getElementById('btn-translate').textContent = '翻译中...';

  try {
    const text = ocrResult.text;
    const paragraphs = text.split('\n').filter(p => p.trim().length > 0);

    const translated = await translateText(text);
    const translatedParagraphs = translated.split('\n').filter(p => p.trim().length > 0);

    const container = document.getElementById('translated-text');
    container.innerHTML = '';

    // Show bilingual comparison
    for (let i = 0; i < Math.max(paragraphs.length, translatedParagraphs.length); i++) {
      const orig = paragraphs[i] || '';
      const trans = translatedParagraphs[i] || '';

      if (orig) {
        const origEl = document.createElement('p');
        origEl.style.cssText = 'opacity: 0.7; font-size: 0.9em; margin-bottom: 2px;';
        origEl.textContent = orig;
        container.appendChild(origEl);
      }

      if (trans) {
        const transEl = document.createElement('p');
        transEl.style.cssText = 'color: #667eea; margin-bottom: 12px; border-left: 2px solid #667eea; padding-left: 8px;';
        transEl.textContent = trans;
        container.appendChild(transEl);
      }
    }

    showStatus('翻译完成！', 'success');
  } catch (e) {
    showStatus(`翻译失败: ${e.message}`, 'error');
  }

  isTranslating = false;
  document.getElementById('btn-translate').disabled = false;
  document.getElementById('btn-translate').textContent = '重新翻译';
}

// Load image
async function loadImage(file) {
  currentImage = file;

  const url = URL.createObjectURL(file);
  const img = document.getElementById('original-img');
  img.src = url;

  document.getElementById('image-container').style.display = 'flex';
  document.getElementById('controls').style.display = 'flex';

  // Auto OCR on load
  await ocrImage(file);
}

// UI helpers
function showStatus(msg, type) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = `status ${type}`;
}

// Event handlers
document.getElementById('drop-zone').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) {
    loadImage(e.target.files[0]);
  }
});

document.getElementById('drop-zone').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.style.background = 'rgba(102,126,234,0.1)';
});

document.getElementById('drop-zone').addEventListener('dragleave', (e) => {
  e.currentTarget.style.background = '';
});

document.getElementById('drop-zone').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.style.background = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImage(file);
  } else {
    showStatus('请上传图片文件', 'error');
  }
});

document.getElementById('btn-translate').addEventListener('click', translateOCRResult);
document.getElementById('btn-clear').addEventListener('click', () => {
  currentImage = null;
  ocrResult = null;
  document.getElementById('original-img').src = '';
  document.getElementById('translated-text').innerHTML = '';
  document.getElementById('image-container').style.display = 'none';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('btn-translate').textContent = 'OCR + 翻译';
});

// Initialize
loadSettings();
