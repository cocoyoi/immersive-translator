# immersive-translator 开发计划

对标: https://immersivetranslate.com/zh-Hans/

## 测试策略

- 测试框架: Jest + jsdom
- 覆盖率目标: >= 80%
- 当前状态: 53/53 测试通过
- 测试文件:
  - `tests/background.test.js` - 背景脚本/引擎配置/缓存测试
  - `tests/content.test.js` - 内容脚本/DOM操作/语言检测测试
  - `tests/popup.test.js` - 弹出界面/UI元素测试
- CI/CD: GitHub Actions (Node.js 18/20/22)
- 提交前必须运行 `npm test`

## 维护计划

- 每周: 代码审查和 issue 清理
- 每月: 依赖更新和安全审计
- 每季度: 功能规划回顾和路线图更新
- 版本发布: 遵循 semver，changelog 记录

## P0 核心（已完成 ✅）

- [x] 网页双语对照翻译（基础版）
- [x] 自定义翻译引擎（OpenAI 兼容）
- [x] 输入框翻译（连按 3 次空格 / 2 次空格）
- [x] 鼠标悬停翻译（Ctrl/Alt/Shift + 悬停段落）
- [x] 划词翻译完善（弹窗 + 复制 + 发音）
- [x] 16+ 语言支持（可扩展至 100+）
- [x] 术语库 / AI 翻译专家设置
- [x] 翻译样式多样化（行内双语 / 段落双语 / 纯译文）
- [x] 翻译缓存系统（LRU，最大 5000 条）
- [x] 快捷键支持（Alt+T / Alt+S）
- [x] 发音功能（SpeechSynthesis API）
- [x] 设置面板（Tab 切换）

## P1 文档翻译（已完成 ✅）

- [x] PDF 翻译（PDF.js 集成，双语对照，下载 HTML）
- [x] ePub 翻译（JSZip 解析，章节提取，双语重打包）
- [x] 图片翻译（Tesseract.js OCR，文本提取 + 翻译）
- [ ] HTML 离线翻译
- [ ] TXT 翻译
- [ ] Docx 翻译
- [ ] Markdown 翻译
- [ ] 字幕文件翻译（SRT/ASS）
- [ ] PDF OCR 扫描件翻译（增强版）

## P2 多媒体翻译（进行中 🚧）

- [x] YouTube 字幕翻译（DOM 拦截，实时双语）
- [ ] Netflix 字幕翻译（Netflix 播放器集成）
- [ ] 图片网页翻译（网页中右键图片翻译）
- [ ] 漫画翻译（OCR + Inpaint 图像修复）
- [ ] 在线会议翻译（Zoom、Google Meet、Teams）
- [ ] 无字幕视频翻译（AI 语音识别）

## P3 平台扩展（规划中 📋）

- [ ] Edge 浏览器支持
- [ ] Safari 浏览器支持
- [ ] Firefox 浏览器支持
- [ ] iOS 支持
- [ ] Android 支持
- [ ] 桌面应用（Electron）

## 当前优先级
P0 已完成，P1 已完成，P2 进行中，P3 规划中。

## 开发节奏
- 每次完成一组功能后 push 到仓库并运行测试
- 每次 push 自动触发 CI 构建和测试
- 优先修 bug，后加功能
- 测试覆盖率不下降
