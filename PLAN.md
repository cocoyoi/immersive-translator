# immersive-translator 开发计划

对标: https://immersivetranslate.com/zh-Hans/

## P0 核心（优先实现）

- [x] 网页双语对照翻译（基础版）
- [x] 自定义翻译引擎（OpenAI 兼容）
- [ ] 输入框翻译（连按 3 次空格）
- [ ] 鼠标悬停翻译（按快捷键触发段落翻译）
- [ ] 划词翻译完善（弹窗 + 发音）
- [ ] 100+ 语言支持配置
- [ ] 术语库 / AI 专家设置
- [ ] 翻译样式多样化（垂直对照、纯译文等）
- [ ] 翻译缓存系统完善

## P1 文档翻译

- [ ] PDF 翻译（保留排版，PDF.js 集成）
- [ ] ePub 翻译
- [ ] HTML 离线翻译
- [ ] TXT 翻译
- [ ] Docx 翻译
- [ ] Markdown 翻译
- [ ] 字幕文件翻译（SRT/ASS）
- [ ] PDF OCR 扫描件翻译

## P2 多媒体翻译

- [ ] 图片翻译（OCR + 网页图片翻译）
- [ ] 漫画翻译（OCR + Inpaint）
- [ ] 在线视频字幕翻译（YouTube、Netflix）
- [ ] 在线会议翻译（Zoom、Meet、Teams）
- [ ] 无字幕视频翻译（AI 语音识别）

## P3 平台扩展

- [ ] Edge 浏览器支持
- [ ] Safari 浏览器支持
- [ ] Firefox 浏览器支持
- [ ] iOS 支持
- [ ] Android 支持
- [ ] 桌面应用（Electron）

## 当前优先级
先完成 P0，再做 P1，P2 和 P3 放后面。

## 开发节奏
- 每次完成一组功能后 push 到仓库
- 每次 push 后运行测试
- 每 3 小时维护一次（功能做完后开启）
