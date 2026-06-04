# immersive-translator

沉浸式翻译浏览器扩展 —— 双语对照网页翻译、PDF/EPUB/图片翻译、视频字幕翻译、文档上传翻译。

对标: [immersivetranslate.com](https://immersivetranslate.com/)

## 核心功能

### 1. 网页双语对照翻译
- **智能内容区识别** — 自动识别网页主内容区域，避免翻译导航栏、广告、侧边栏
- **段落级双语对照** — 原文与译文逐段对齐，保留上下文
- **最小侵入式排版** — 译文以段落下方/右侧方式呈现，不破坏原页面结构
- **支持 100+ 主流网站** — Google、X(Twitter)、Reddit、YouTube、Bloomberg、WSJ 等深度优化

### 2. 划词翻译
- 选中任意文本，即时弹出翻译浮窗
- 支持发音朗读（TTS）
- 一键复制译文

### 3. 鼠标悬停翻译
- 鼠标悬停于任意段落，按下 `Ctrl`（可自定义），译文即刻出现在段落下方
- 段落为最小翻译单元，保留完整上下文

### 4. 输入框翻译
- 在任何网页输入框输入文本后，**连按三次空格键**，自动翻译为目标语言
- 适用于搜索、写作、ChatGPT 对话等场景

### 5. 视频字幕翻译
- **YouTube** — 实时双语字幕，支持自动生成字幕的翻译
- **Netflix** — 双语字幕叠加显示
- 支持 **100+ 主流视频平台**（TED、Coursera、Khan Academy、Prime Video 等）

### 6. PDF 翻译
- 浏览器内直接翻译 PDF 文档
- 保留原文排版，双语对照显示
- 支持导出单译文或双语对照版本
- 支持扫描件 OCR 识别翻译（实验性）

### 7. EPUB 电子书翻译
- 拖入 EPUB 文件即可翻译整本书
- 保留章节结构，双语对照阅读
- 支持导出双语 EPUB

### 8. 图片翻译 (OCR)
- 鼠标悬停于网页图片，按快捷键翻译图中文字
- 支持本地图片上传翻译
- 依托 OCR 与 Inpaint 图像修复，原图风格保留

### 9. 文档上传翻译
- 独立文档翻译页面，支持拖拽上传：
  - PDF / EPUB / HTML / TXT / Markdown / SRT 字幕
- 双语对照或纯译文输出
- 保留原始排版格式

### 10. 翻译引擎
内置 20+ 翻译引擎，支持自动降级：

| 引擎 | 类型 | 说明 |
|------|------|------|
| OpenAI / GPT | AI | GPT-4o-mini, GPT-4o 等 |
| DeepSeek | AI | deepseek-chat |
| Google Translate | 免费 | 无需 API Key，自动使用 |
| DeepL | 免费/Pro | 免费版支持基础翻译 |
| Microsoft Translator | 免费 | Azure 认知服务 |
| LibreTranslate | 免费/自托管 | 开源免费，可自建 |
| 阿里云通义千问 | AI | 通义千问系列 |
| Ollama | 本地 | 本地部署大模型 |
| 自定义 | 通用 | 任意 OpenAI 兼容端点 |

引擎自动降级策略：若主引擎失败，自动切换至备用免费引擎（Google Translate → LibreTranslate），确保翻译不中断。

### 11. AI 专业领域翻译
内置多领域专家模式：
- **技术** — 精确技术术语
- **医学** — 准确医学术语
- **法律** — 精确法律用语
- **文学** — 保留隐喻与诗意
- **学术** — 正式语气，保留引用
- **商业** — 专业商务用语
- **字幕** — 简洁，适配时长

### 12. 术语表 / 词汇表
- 自定义术语对照表，全局生效
- 支持导入/导出 glossary JSON

## 支持的模块

| 模块 | 文件 | 功能 |
|------|------|------|
| 核心翻译引擎 | `content.js` | 网页内容翻译、划词、悬停、输入框翻译 |
| 引擎管理 | `engines.js` | 多引擎注册、调度、降级 |
| 内容区识别 | `content-detector.js` | Readability-style 主内容区提取 |
| 站点优化 | `site-patches.js` | Google/X/Reddit 等站点 DOM 适配 |
| 设置面板 | `popup.js` / `popup.html` | 引擎配置、偏好设置、术语表 |
| 后台服务 | `background.js` | 快捷键、菜单、跨页面状态同步 |
| PDF 翻译 | `pdf-viewer.js` / `pdf-viewer.html` | PDF 渲染与段落翻译 |
| EPUB 翻译 | `epub-translator.js` / `epub-viewer.html` | EPUB 解析与章节翻译 |
| 图片翻译 | `img-translator.js` / `img-viewer.html` | 图片 OCR 与翻译 |
| YouTube 字幕 | `youtube-translator.js` | YouTube 双语字幕注入 |
| Netflix 字幕 | `netflix-translator.js` | Netflix 双语字幕注入 |
| 文档上传 | `document-translator.html` | 独立页面，拖拽翻译多种文档 |

## 安装

### 从源码加载（开发者）

```bash
git clone https://github.com/cocoyoi/immersive-translator.git
cd immersive-translator
```

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

### Chrome Web Store
（上架中，敬请期待）

## 使用指南

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt + T` | 翻译/取消翻译当前页面 |
| `Alt + S` | 划词翻译（选中后触发） |
| `Ctrl` + 鼠标悬停段落 | 悬停翻译 |
| 输入框内连按三次空格 | 输入框翻译 |

### 首次配置

1. 点击浏览器工具栏扩展图标
2. 在「翻译引擎」标签页：
   - 选择默认引擎（推荐先用 Google Translate 免费版）
   - 若使用 AI 引擎，填写 API Key
3. 在「偏好设置」标签页选择目标语言（默认简体中文）
4. 点击「保存」

### 网页翻译

访问任意外文网页，按 `Alt + T` 即可开启双语对照翻译。再次按下取消。

### PDF 翻译

1. 在浏览器中打开 PDF 文件（本地文件可拖入浏览器窗口）
2. 点击扩展图标，选择「翻译 PDF」
3. 等待加载后，页面将呈现双语对照

### EPUB 翻译

1. 点击扩展图标，选择「翻译 EPUB」
2. 拖入 EPUB 文件
3. 选择目标语言，开始翻译

### 文档上传翻译

1. 点击扩展图标 →「文档翻译」
2. 或直接在地址栏输入 `chrome-extension://{扩展ID}/document-translator.html`
3. 拖拽文件到页面即可翻译

## 开发

### 项目结构

```
immersive-translator/
├── manifest.json          # 扩展清单（Manifest V3）
├── content.js             # 核心翻译脚本（内容脚本）
├── content.css            # 翻译样式注入
├── content-detector.js    # 主内容区智能识别
├── site-patches.js        # 站点级 DOM 适配补丁
├── engines.js             # 多翻译引擎管理
├── background.js           # Service Worker 后台逻辑
├── popup.html / popup.js   # 设置弹窗
├── youtube-translator.js # YouTube 字幕翻译
├── netflix-translator.js # Netflix 字幕翻译
├── pdf-viewer.html / pdf-viewer.js    # PDF 阅读与翻译
├── epub-translator.js / epub-viewer.html  # EPUB 阅读与翻译
├── img-translator.js / img-viewer.html    # 图片 OCR 翻译
├── document-translator.html             # 文档上传独立页
├── lib/                  # 第三方库（PDF.js 等）
├── icons/                # 扩展图标
├── tests/                # Jest 测试套件
└── README.md
```

### 运行测试

```bash
cd tests
npm install
npm test
```

### 覆盖率报告

```bash
npm run test -- --coverage
```

覆盖率配置已修复，正确统计源码文件而非测试文件。

## 安全说明

- `lib/pdf.js` 包含 PDF.js 第三方库，其中存在 `eval()` 调用，属 PDF.js 内部实现（已知的 PDF 渲染需求）。该文件不由本项目维护，建议关注 PDF.js 官方安全更新。
- 生产代码中所有 `innerHTML` 赋值均经过 `escapeHtml()` 转义，防止 XSS。
- 用户 API Key 仅存储于 `chrome.storage.sync` / `chrome.storage.local`，不上传至任何第三方服务器。

## 路线图

- [x] 网页双语对照翻译
- [x] 划词翻译
- [x] 悬停翻译
- [x] 输入框翻译
- [x] PDF 翻译
- [x] EPUB 翻译
- [x] 图片 OCR 翻译
- [x] YouTube / Netflix 字幕
- [x] 多引擎支持 + 自动降级
- [x] 术语表 / AI 专家模式
- [ ] 漫画翻译（Manga/CB 解析）
- [ ] 在线会议翻译（Zoom / Meet / Teams）
- [ ] 无字幕视频翻译（语音识别 + 翻译）
- [ ] 移动端 Safari / Firefox 扩展
- [ ] i18n 多语言界面

## License

MIT
