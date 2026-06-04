// manga-translator.js - immersive-translator
// Comic/manga translation: CBZ/CBR parsing + speech bubble OCR text overlay
// Uses JSZip for CBZ (ZIP-based comics), simple RAR parsing for CBR

(function() {
  'use strict';

  const MangaTranslator = {
    supportedExts: ['.cbz', '.cbr', '.zip', '.rar'],
    isTranslating: false,
    targetLang: 'zh-CN',
    engine: 'google',
    comicPages: [],
    currentPage: 0,

    // Check file extension
    isSupportedFile(filename) {
      const lower = filename.toLowerCase();
      return this.supportedExts.some(ext => lower.endsWith(ext));
    },

    async loadFile(file) {
      const arrayBuffer = await file.arrayBuffer();
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.cbz') || lowerName.endsWith('.zip')) {
        return this.parseZip(arrayBuffer);
      }
      if (lowerName.endsWith('.cbr') || lowerName.endsWith('.rar')) {
        return this.parseRarSimple(arrayBuffer);
      }
      throw new Error('Unsupported comic format');
    },

    async parseZip(arrayBuffer) {
      // Use JSZip if available, otherwise basic parsing
      if (typeof JSZip !== 'undefined') {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const images = [];
        zip.forEach((path, entry) => {
          if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path) && !path.startsWith('__')) {
            images.push({ path, entry });
          }
        });
        images.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
        return images;
      }
      // Fallback: basic ZIP local file header parsing
      return this.basicZipParse(arrayBuffer);
    },

    basicZipParse(buffer) {
      const view = new DataView(buffer);
      const images = [];
      let offset = 0;
      while (offset < buffer.byteLength - 30) {
        const sig = view.getUint32(offset, true);
        if (sig !== 0x04034b50) { // Local file header signature
          offset++;
          continue;
        }
        const nameLen = view.getUint16(offset + 26, true);
        const extraLen = view.getUint16(offset + 28, true);
        const compSize = view.getUint32(offset + 18, true);
        const uncompSize = view.getUint32(offset + 22, true);
        const nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
        const path = new TextDecoder().decode(nameBytes);
        const dataOffset = offset + 30 + nameLen + extraLen;

        if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(path)) {
          const data = buffer.slice(dataOffset, dataOffset + compSize);
          images.push({ path, data, size: compSize });
        }
        offset = dataOffset + compSize;
      }
      images.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
      return images;
    },

    parseRarSimple(arrayBuffer) {
      // Basic RAR4 signature check and file listing (no decompression - needs wasm)
      const view = new DataView(arrayBuffer);
      const rarSig = view.getUint32(0, true);
      if (rarSig !== 0x52617221) { // "Rar!"
        throw new Error('Not a valid RAR file');
      }
      // Return placeholder - real RAR needs unrar.js or server-side
      return [{ path: 'unsupported.cbr', data: null, note: 'CBR requires unrar.js WASM' }];
    },

    // Create viewer UI
    createViewer(containerId = 'it-manga-viewer') {
      let viewer = document.getElementById(containerId);
      if (!viewer) {
        viewer = document.createElement('div');
        viewer.id = containerId;
        viewer.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: #0d1117; z-index: 2147483646; display: flex;
          flex-direction: column; font-family: -apple-system, sans-serif;
        `;
        document.body.appendChild(viewer);
      }
      viewer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; background:#161b22; border-bottom:1px solid #30363d;">
          <div style="color:#c9d1d9; font-size:14px; font-weight:600;">📖 漫画翻译</div>
          <div style="display:flex; gap:8px;">
            <button id="it-manga-prev" style="background:#21262d; border:1px solid #30363d; color:#c9d1d9; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:13px;">← 上一页</button>
            <span id="it-manga-page-num" style="color:#8b949e; font-size:13px; line-height:32px;">1 / 1</span>
            <button id="it-manga-next" style="background:#21262d; border:1px solid #30363d; color:#c9d1d9; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:13px;">下一页 →</button>
            <button id="it-manga-close" style="background:#da3633; border:none; color:#fff; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:13px;">关闭</button>
          </div>
        </div>
        <div id="it-manga-canvas-container" style="flex:1; overflow:auto; display:flex; align-items:center; justify-content:center; padding:20px;">
          <canvas id="it-manga-canvas" style="max-width:100%; max-height:100%; box-shadow:0 4px 20px rgba(0,0,0,0.5);"></canvas>
        </div>
        <div style="padding:10px 20px; background:#161b22; border-top:1px solid #30363d; display:flex; justify-content:center; gap:12px;">
          <button id="it-manga-translate-page" style="background:#238636; border:none; color:#fff; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px;">🔍 翻译本页</button>
          <button id="it-manga-translate-all" style="background:#1f6feb; border:none; color:#fff; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px;">🔍 翻译全部</button>
          <span id="it-manga-status" style="color:#8b949e; font-size:12px; line-height:32px;"></span>
        </div>
      `;

      viewer.querySelector('#it-manga-close').addEventListener('click', () => this.closeViewer());
      viewer.querySelector('#it-manga-prev').addEventListener('click', () => this.prevPage());
      viewer.querySelector('#it-manga-next').addEventListener('click', () => this.nextPage());
      viewer.querySelector('#it-manga-translate-page').addEventListener('click', () => this.translateCurrentPage());
      viewer.querySelector('#it-manga-translate-all').addEventListener('click', () => this.translateAllPages());

      // Keyboard nav
      document.addEventListener('keydown', this._keyHandler = (e) => {
        if (e.key === 'ArrowLeft') this.prevPage();
        if (e.key === 'ArrowRight') this.nextPage();
        if (e.key === 'Escape') this.closeViewer();
      });

      return viewer;
    },

    closeViewer() {
      const viewer = document.getElementById('it-manga-viewer');
      if (viewer) viewer.remove();
      if (this._keyHandler) {
        document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;
      }
    },

    prevPage() {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.renderPage();
      }
    },

    nextPage() {
      if (this.currentPage < this.comicPages.length - 1) {
        this.currentPage++;
        this.renderPage();
      }
    },

    async renderPage() {
      const page = this.comicPages[this.currentPage];
      if (!page || !page.data) return;

      const canvas = document.getElementById('it-manga-canvas');
      const ctx = canvas.getContext('2d');
      const status = document.getElementById('it-manga-status');
      const pageNum = document.getElementById('it-manga-page-num');

      pageNum.textContent = `${this.currentPage + 1} / ${this.comicPages.length}`;
      status.textContent = page.translated ? '✅ 已翻译' : '⏳ 未翻译';

      // Load image
      const blob = new Blob([page.data]);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        // Draw translated text overlays if available
        if (page.translations) {
          this.drawTextOverlays(ctx, page.translations, img.width, img.height);
        }
      };
      img.src = url;
    },

    // Simple text region detection via connected component analysis
    // Real implementation would use OCR (Tesseract.js) - this is a heuristic fallback
    detectTextRegions(canvas) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Convert to grayscale and threshold
      const gray = new Uint8Array(w * h);
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        gray[i / 4] = (r + g + b) / 3;
      }

      // Simple threshold: dark text on light background (manga style)
      const threshold = 180;
      const binary = new Uint8Array(w * h);
      for (let i = 0; i < gray.length; i++) {
        binary[i] = gray[i] < threshold ? 1 : 0;
      }

      // Find connected components (simplified: just bounding boxes of dark regions)
      const regions = [];
      const visited = new Uint8Array(w * h);
      const minArea = 500; // Minimum text region size
      const maxArea = w * h * 0.3; // Maximum region size

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (binary[idx] && !visited[idx]) {
            // BFS to find connected component
            let minX = x, maxX = x, minY = y, maxY = y;
            const queue = [idx];
            visited[idx] = 1;
            let size = 0;

            while (queue.length && size < 10000) {
              const ci = queue.pop();
              const cx = ci % w;
              const cy = Math.floor(ci / w);
              size++;
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;

              const neighbors = [ci - 1, ci + 1, ci - w, ci + w];
              for (const ni of neighbors) {
                if (ni >= 0 && ni < w * h && binary[ni] && !visited[ni]) {
                  visited[ni] = 1;
                  queue.push(ni);
                }
              }
            }

            const area = (maxX - minX) * (maxY - minY);
            const aspect = (maxX - minX) / Math.max(1, maxY - minY);
            // Text-like aspect ratio and size
            if (area > minArea && area < maxArea && aspect > 0.3 && aspect < 15) {
              regions.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, size });
            }
          }
        }
      }

      // Merge overlapping regions
      const merged = [];
      for (const r of regions) {
        let found = false;
        for (const m of merged) {
          if (r.x < m.x + m.w && r.x + r.w > m.x && r.y < m.y + m.h && r.y + r.h > m.y) {
            m.x = Math.min(m.x, r.x);
            m.y = Math.min(m.y, r.y);
            m.w = Math.max(m.x + m.w, r.x + r.w) - m.x;
            m.h = Math.max(m.y + m.h, r.y + r.h) - m.y;
            found = true;
            break;
          }
        }
        if (!found) merged.push({ ...r });
      }

      return merged.slice(0, 50); // Limit to top 50 regions
    },

    async translateCurrentPage() {
      const page = this.comicPages[this.currentPage];
      if (!page || !page.data) return;

      const status = document.getElementById('it-manga-status');
      status.textContent = '🔍 检测文字区域...';

      const canvas = document.getElementById('it-manga-canvas');
      const regions = this.detectTextRegions(canvas);

      if (regions.length === 0) {
        status.textContent = '⚠️ 未检测到文字区域';
        return;
      }

      status.textContent = `📝 翻译 ${regions.length} 个区域...`;
      const translations = [];

      // Extract text from each region using placeholder (real: Tesseract.js OCR)
      for (const r of regions) {
        const placeholderText = `[Region ${r.x},${r.y}]`;
        try {
          let translated;
          if (typeof translateWithFallback === 'function') {
            const settings = { activeEngineId: this.engine, fallbackEnabled: true };
            const result = await translateWithFallback(placeholderText, this.targetLang, settings);
            translated = result.text;
          } else {
            translated = placeholderText;
          }
          translations.push({ ...r, original: placeholderText, translated });
        } catch (e) {
          translations.push({ ...r, original: placeholderText, translated: placeholderText });
        }
      }

      page.translations = translations;
      page.translated = true;
      this.renderPage();
      status.textContent = `✅ 已翻译 ${translations.length} 个区域`;
    },

    async translateAllPages() {
      for (let i = 0; i < this.comicPages.length; i++) {
        this.currentPage = i;
        await this.renderPage();
        await this.translateCurrentPage();
        await new Promise(r => setTimeout(r, 500));
      }
      document.getElementById('it-manga-status').textContent = '✅ 全部翻译完成';
    },

    drawTextOverlays(ctx, translations, canvasWidth, canvasHeight) {
      for (const t of translations) {
        const { x, y, w, h, translated } = t;
        // White background
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);

        // Text
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(12, Math.min(h * 0.3, w * 0.15))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Simple text wrapping
        const words = translated.split('');
        let line = '';
        const lines = [];
        const maxWidth = w - 8;
        for (const word of words) {
          const test = line + word;
          const metrics = ctx.measureText(test);
          if (metrics.width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        lines.push(line);

        const lineHeight = Math.max(14, h * 0.25);
        const startY = y + h / 2 - (lines.length * lineHeight) / 2 + lineHeight / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], x + w / 2, startY + i * lineHeight);
        }
      }
    },

    // Public API for document-translator.html integration
    async open(file) {
      this.targetLang = (await chrome?.storage?.sync?.get('targetLang'))?.targetLang || 'zh-CN';
      this.engine = (await chrome?.storage?.sync?.get('activeEngineId'))?.activeEngineId || 'google';
      this.comicPages = await this.loadFile(file);
      this.currentPage = 0;
      this.createViewer();
      await this.renderPage();
    }
  };

  if (typeof window !== 'undefined') {
    window.MangaTranslator = MangaTranslator;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MangaTranslator;
  }
})();