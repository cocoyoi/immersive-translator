// epub-translator.js - ePub Translation Engine
// Parses ePub files, extracts HTML content, translates, and repackages

let jszip = null;
let epubZip = null;
let epubFiles = {};
let spine = [];
let metadata = {};
let translatedChapters = [];
let isTranslating = false;
let settings = {};

// Load JSZip
async function loadJSZip() {
  if (!jszip) {
    // Load from CDN if not available
    const script = document.createElement('script');
    script.src = 'lib/jszip.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
    jszip = window.JSZip;
  }
}

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

// Parse ePub
async function parseEPub(file) {
  showStatus('正在解析 ePub...', 'info');
  await loadJSZip();
  
  const arrayBuffer = await file.arrayBuffer();
  epubZip = await jszip.loadAsync(arrayBuffer);
  
  epubFiles = {};
  epubZip.forEach((path, zipEntry) => {
    epubFiles[path] = zipEntry;
  });
  
  // Find container.xml
  const containerPath = Object.keys(epubFiles).find(p => p.endsWith('META-INF/container.xml'));
  if (!containerPath) throw new Error('无效的 ePub 文件：找不到 META-INF/container.xml');
  
  const containerXml = await epubFiles[containerPath].async('text');
  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) throw new Error('找不到 OPF 文件路径');
  
  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
  
  // Parse OPF
  const opfXml = await epubFiles[opfPath].async('text');
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  
  // Metadata
  const titleEl = opfDoc.querySelector('metadata > title, metadata > dc\\:title');
  const authorEl = opfDoc.querySelector('metadata > creator, metadata > dc\\:creator');
  metadata = {
    title: titleEl?.textContent || '未知书名',
    author: authorEl?.textContent || '未知作者',
    opfDir
  };
  
  // Spine (reading order)
  const itemRefs = opfDoc.querySelectorAll('spine > itemref');
  const manifestItems = opfDoc.querySelectorAll('manifest > item');
  const idMap = {};
  manifestItems.forEach(item => {
    idMap[item.getAttribute('id')] = item.getAttribute('href');
  });
  
  spine = [];
  itemRefs.forEach((ref, idx) => {
    const id = ref.getAttribute('idref');
    const href = idMap[id];
    if (href) {
      spine.push({
        id: idx + 1,
        href: opfDir + href,
        title: `章节 ${idx + 1}`
      });
    }
  });
  
  // Try to get chapter titles from NCX
  const ncxItem = Array.from(manifestItems).find(i => i.getAttribute('media-type') === 'application/x-dtbncx+xml');
  if (ncxItem) {
    const ncxPath = opfDir + ncxItem.getAttribute('href');
    if (epubFiles[ncxPath]) {
      const ncxXml = await epubFiles[ncxPath].async('text');
      const ncxDoc = parser.parseFromString(ncxXml, 'application/xml');
      const navPoints = ncxDoc.querySelectorAll('navPoint');
      navPoints.forEach((np, idx) => {
        if (spine[idx]) {
          const label = np.querySelector('navLabel > text');
          if (label) spine[idx].title = label.textContent;
        }
      });
    }
  }
  
  showStatus(`ePub 解析完成：${metadata.title}，共 ${spine.length} 章`, 'success');
  renderBookInfo();
  renderChapterList();
  document.getElementById('controls').style.display = 'flex';
}

// Extract text from HTML chapter
async function extractChapterText(chapter) {
  const htmlContent = await epubFiles[chapter.href].async('text');
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  // Extract text from paragraphs
  const paragraphs = [];
  const textElements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div');
  
  textElements.forEach(el => {
    const text = el.textContent.trim();
    if (text.length > 10) {
      paragraphs.push({
        original: text,
        element: el.tagName.toLowerCase(),
        html: el.outerHTML
      });
    }
  });
  
  return { chapter, htmlContent, doc, paragraphs };
}

// Translate chapter
async function translateChapter(chapterData) {
  const { chapter, htmlContent, doc, paragraphs } = chapterData;
  
  const maxConcurrent = settings.maxConcurrent || 3;
  const translatedParagraphs = [];
  
  for (let i = 0; i < paragraphs.length; i += maxConcurrent) {
    const batch = paragraphs.slice(i, i + maxConcurrent);
    const results = await Promise.all(batch.map(async p => {
      try {
        const translated = await translateText(p.original);
        return { ...p, translated };
      } catch (e) {
        return { ...p, translated: null, error: e.message };
      }
    }));
    translatedParagraphs.push(...results);
  }
  
  // Build bilingual HTML
  const bilingualDoc = doc.cloneNode(true);
  const body = bilingualDoc.body;
  
  // Insert bilingual content
  translatedParagraphs.forEach(p => {
    if (!p.translated) return;
    
    const selector = p.element;
    const textContent = p.original;
    const translatedContent = p.translated;
    
    // Find the element with matching text
    const elements = body.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.textContent.trim() === textContent) {
        if (settings.bilingualMode !== false) {
          // Bilingual mode: insert translation after original
          const transEl = document.createElement('p');
          transEl.style.cssText = 'color: #667eea; font-size: 0.95em; margin-top: 4px; border-left: 2px solid #667eea; padding-left: 8px;';
          transEl.textContent = translatedContent;
          el.insertAdjacentElement('afterend', transEl);
        } else {
          // Pure translation: replace text
          el.textContent = translatedContent;
        }
      }
    });
  });
  
  const translatedHtml = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>${metadata.title} - ${chapter.title}</title>\n<style>\nbody { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }\np { margin-bottom: 12px; }\n</style>\n</head>\n<body>\n${bilingualDoc.body.innerHTML}\n</body>\n</html>`;
  
  return { chapter, translatedHtml, translatedParagraphs };
}

// Translate all chapters
async function translateAllChapters() {
  if (isTranslating) return;
  isTranslating = true;
  
  showStatus('正在翻译...', 'info');
  document.getElementById('btn-translate').disabled = true;
  document.getElementById('btn-translate').textContent = '翻译中...';
  
  translatedChapters = [];
  const totalChapters = spine.length;
  
  for (let i = 0; i < totalChapters; i++) {
    const chapter = spine[i];
    updateChapterStatus(chapter.id, 'translating');
    
    try {
      const chapterData = await extractChapterText(chapter);
      const translated = await translateChapter(chapterData);
      translatedChapters.push(translated);
      updateChapterStatus(chapter.id, 'done');
    } catch (e) {
      console.error(`Chapter ${chapter.id} translation failed:`, e);
      updateChapterStatus(chapter.id, 'error');
    }
    
    showProgress(((i + 1) / totalChapters) * 100);
  }
  
  showProgress(100);
  showStatus('翻译完成！', 'success');
  isTranslating = false;
  document.getElementById('btn-translate').disabled = false;
  document.getElementById('btn-translate').textContent = '重新翻译';
}

// Download translated ePub
async function downloadTranslatedEPub() {
  if (!translatedChapters.length) return;
  
  showStatus('正在打包 ePub...', 'info');
  
  const newZip = await jszip.loadAsync(await epubZip.generateAsync({ type: 'arraybuffer' }));
  
  for (const chapter of translatedChapters) {
    const { chapter: ch, translatedHtml } = chapter;
    newZip.file(ch.href, translatedHtml);
  }
  
  const blob = await newZip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${metadata.title}_translated.epub`;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus('下载完成！', 'success');
}

// UI functions
function renderBookInfo() {
  document.getElementById('book-title').textContent = metadata.title;
  document.getElementById('book-author').textContent = `作者：${metadata.author}`;
  document.getElementById('book-chapters').textContent = `章节数：${spine.length}`;
  document.getElementById('book-info').style.display = 'block';
}

function renderChapterList() {
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';
  
  spine.forEach(chapter => {
    const item = document.createElement('div');
    item.className = 'chapter-item';
    item.id = `chapter-${chapter.id}`;
    item.innerHTML = `
      <span class="title">${chapter.id}. ${chapter.title}</span>
      <span class="status" id="status-${chapter.id}">等待翻译</span>
    `;
    list.appendChild(item);
  });
}

function updateChapterStatus(id, status) {
  const statusEl = document.getElementById(`status-${id}`);
  if (!statusEl) return;
  
  statusEl.className = `status ${status}`;
  switch (status) {
    case 'translating': statusEl.textContent = '翻译中...'; break;
    case 'done': statusEl.textContent = '已完成'; break;
    case 'error': statusEl.textContent = '翻译失败'; break;
    default: statusEl.textContent = '等待翻译';
  }
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

// Event handlers
document.getElementById('drop-zone').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) {
    parseEPub(e.target.files[0]);
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
  if (file && file.name.endsWith('.epub')) {
    parseEPub(file);
  } else {
    showStatus('请上传 ePub 文件', 'error');
  }
});

document.getElementById('btn-translate').addEventListener('click', translateAllChapters);
document.getElementById('btn-download').addEventListener('click', downloadTranslatedEPub);
document.getElementById('btn-clear').addEventListener('click', () => {
  epubZip = null;
  epubFiles = {};
  spine = [];
  metadata = {};
  translatedChapters = [];
  document.getElementById('chapter-list').innerHTML = '';
  document.getElementById('book-info').style.display = 'none';
  document.getElementById('controls').style.display = 'none';
  document.getElementById('status').style.display = 'none';
  document.getElementById('btn-translate').textContent = '开始翻译';
});

// Initialize
loadSettings();
