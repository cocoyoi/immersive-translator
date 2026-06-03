# immersive-translator

沉浸式翻译 Chrome 扩展，支持自定义模型接入。

对标: https://immersivetranslate.com/

- **网页双语对照翻译** — 自动翻译页面内容，保留原文对照
- **划词翻译** — 选中文字即时翻译
- **输入框翻译** — 自动翻译输入框内容
- **悬停翻译** — 鼠标悬停即可查看翻译
- **自定义模型接入** — 支持任意 OpenAI 兼容 API

## 支持的引擎

| 引擎 | 预设 | 说明 |
|------|------|------|
| OpenAI | ✅ | gpt-4o-mini 等 |
| DeepSeek | ✅ | deepseek-chat |
| 阿里云 | ✅ | 通义千问 |
| Ollama | ✅ | 本地部署 |
| 自定义 | ✅ | 任意 OpenAI 兼容端点 |

## 安装

1. 下载源码或从 Chrome Web Store 安装
2. 打开 `chrome://extensions/`
3. 开启开发者模式
4. 加载已解压的扩展

## 配置

点击扩展图标打开设置面板：
1. 选择或添加翻译引擎
2. 填写 API Base URL、API Key 和模型名称
3. 测试连接并保存
4. 启用翻译功能

## 快捷键

- `Alt + T` — 翻译当前页面
- `Alt + S` — 划词翻译

## 开发

```bash
git clone https://github.com/cocoyoi/immersive-translator.git
cd immersive-translator
# 加载到 Chrome 开发者模式
```

## License

MIT
