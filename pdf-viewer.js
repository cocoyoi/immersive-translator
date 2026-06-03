// pdf-viewer.js - PDF Translation Engine
// Handles PDF loading, text extraction, and translation display

pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

let pdfDoc = null;
let pdfPages = [];
let translatedPages = [];
let isTranslating = false;
let settings = {};

// Load settings
async function loadSettings() {
  const data = await chrome.storage.sync.get([
    'targetLang', 'engines', 'activeEngineId', 'maxConcurrent', 'enableCache', 'bilingualMode', 'glossary', 'aiExpert'
  ]);
  settings = { ...{ targetLang: 'zh-CN', maxConcurrent: 3, enableCache: true, bilingualMode: true }, ...data };
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

// Extract text from PDF page
async function extractPageText(page, pageNum) {
  const textContent = await page.getTextContent();
  const items = textContent.items;
  
  // Group by lines (y-position)
  const lines = [];
  let currentLine = [];
  let lastY = null;
  
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      if (currentLine.length > 0) {
        lines.push(currentLine.map(i => i.str).join(' '));
      }
      currentLine = [];
    }
    currentLine.push(item);
    lastY = y;
  }
  if (currentLine.length > 0) {
    lines.push(currentLine.map(i => i.str).join(' '));
  }
  
  return { pageNum, text: lines.join('\n'), lines };
}

// Load PDF from file
async function loadPDF(file) {
  showStatus('正在加载 PDF...', 'info');
  
  const arrayBuffer = await file.arrayBuffer();
  pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  pdfPages = [];
  const totalPages = pdfDoc.numPages;
  
  showProgress(0);
  
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const pageData = await extractPageText(page, i);
    pdfPages.push(pageData);
    showProgress((i / totalPages) * 50); // 50% for loading
  }
  
  showProgress(50);
  showStatus(`PDF 加载完成，共 ${totalPages} 页`, 'success');
  
  renderPages();
  document.getElementById('controls').style.display = 'flex';
  document.getElementById('pdf-container').style.display = 'block';
}

// Render pages (original only)
function renderPages() {
  const container = document.getElementById('pdf-pages');
  container.innerHTML = '';
  
  pdfPages.forEach(page => {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.dataset.pageNum = page.pageNum;
    pageDiv.innerHTML = `
      <div class="page-header">
        <span>第 ${page.pageNum} 页</span>
        <span class="page-status">原文</span>
      </div>
      <div class="page-content">
        <div class="page-original">
          ${page.lines.map(line => `<p>${escapeHtml(line)}</p>`).join('')}
        </div>
        <div class="page-translated" id="translated-${page.pageNum}">
          <p style="color: #888; font-style: italic;">等待翻译...</p>
        </div>
      </div>
    `;
    container.appendChild(pageDiv);
  });
}

// Translate all pages
async function translateAllPages() {
  if (isTranslating) return;
  isTranslating = true;
  
  showStatus('正在翻译...', 'info');
  document.getElementById('btn-translate').disabled = true;
  document.getElementById('btn-translate').textContent = '翻译中...';
  
  const maxConcurrent = settings.maxConcurrent || 3;
  const totalPages = pdfPages.length;
  translatedPages = [];
  
  for (let i = 0; i < totalPages; i += maxConcurrent) {
    const batch = pdfPages.slice(i, i + maxConcurrent);
    
    await Promise.all(batch.map(async page => {
      try {
        const translated = await translateText(page.text);
        translatedPages[page.pageNum - 1] = { pageNum: page.pageNum, translated };
        
        const transDiv = document.getElementById(`translated-${page.pageNum}`);
        if (transDiv) {
          // Split translated text into paragraphs
          const paragraphs = translated.split('\n').filter(p => p.trim());
          transDiv.innerHTML = paragraphs.map(p => `<p class="translated-text">${escapeHtml(p)}</p>`).join('');
        }
        
        // Update page status
        const pageDiv = document.querySelector(`.page[data-page-num="${page.pageNum}"]`);
        if (pageDiv) {
          pageDiv.querySelector('.page-status').textContent = '已翻译';
        }
      } catch (e) {
        console.error(`Page ${page.pageNum} translation failed:`, e);
        const transDiv = document.getElementById(`translated-${page.pageNum}`);
        if (transDiv) {
          transDiv.innerHTML = `<p style="color: #dc3545;">翻译失败: ${escapeHtml(e.message)}</p>`;
        }
      }
    }));
    
    showProgress(50 + ((i + batch.length) / totalPages) * 50);
  }
  
  showProgress(100);
  showStatus('翻译完成！', 'success');
  isTranslating = false;
  document.getElementById('btn-translate').disabled = false;
  document.getElementById('btn-translate').textContent = '重新翻译';
}

// Download translation result as HTML
function downloadTranslation() {
  if (!translatedPages.length) return;
  
  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>PDF 翻译结果</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
.page { margin-bottom: 40px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
.page-header { padding: 10px 16px; background: #f5f5f5; font-size: 13px; color: #666; }
.page-content { display: flex; }
.page-original { flex: 1; padding: 20px; border-right: 1px solid #eee; }
.page-translated { flex: 1; padding: 20px; color: #667eea; }
@media (max-width: 768px) { .page-content { flex-direction: column; } .page-original { border-right: none; border-bottom: 1px solid #eee; } }
</style>
</head>
<body>
<h1>PDF 翻译结果</h1>
`;

  pdfPages.forEach((page, idx) => {
    const trans = translatedPages[idx];
    html += `
<div class="page">
  <div class="page-header">第 ${page.pageNum} 页</div>
  <div class="page-content">
    <div class="page-original">${page.lines.map(l => `<p>${escapeHtml(l)}</p>`).join('')}</div>
    <div class="page-translated">${trans ? trans.translated.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('') : '<p>翻译失败</p>'}</div>
  </div>
</div>
`;
  });
  
  html += '</body></html>';
  
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'translated-pdf.html';
  a.click();
  URL.revokeObjectURL(url);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(msg, type) {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

function showProgress(percent) {
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  bar.style.display = 'block';
  fill.style.width = percent + '%';
  if (percent >= 100) {
    setTimeout(() => { bar.style.display = 'none'; }, 1000);
  }
}

// Drag and drop handlers
document.getElementById('drop-zone').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) {
    loadPDF(e.target.files[0]);
  }
});

document.getElementById('drop-zone').addEventListener('dragover', (e) => {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
});

document.getElementById('drop-zone').addEventListener('dragleave', (e) => {
  e.currentTarget.classList.remove('dragover');
});

document.getElementById('drop-zone').addEventListener('drop', (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    loadPDF(file);
  } else {
    showStatus('请上传 PDF 文件', 'error');
  }
});

document.getElementById('btn-translate').addEventListener('click', translateAllPages);
document.getElementById('btn-download').addEventListener('click', downloadTranslation);
document.getElementById('btn-clear').addEventListener('click', () => {
  pdfDoc = null;
  pdfPages = [];
  translatedPages = [];
  document.getElementById('pdf-pages').innerHTML = '';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('pdf-container').style.display = 'none';
  document.getElementById('status').style.display = 'none';
  document.getElementById('btn-translate').textContent = '开始翻译';
});

// Initialize
loadSettings();
