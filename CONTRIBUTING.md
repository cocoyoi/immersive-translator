# CONTRIBUTING.md

## 感谢你的贡献！

immersive-translator 是一个开源项目，欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

1. 搜索现有 issue，确认是否已有人报告
2. 使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.md) 创建新 issue
3. 提供详细的复现步骤和环境信息

### 请求新功能

1. 搜索现有 issue，确认是否已有人请求
2. 使用 [Feature Request 模板](.github/ISSUE_TEMPLATE/feature_request.md) 创建新 issue
3. 描述清楚需求的优先级和使用场景

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature-name`
3. 编写代码和测试
4. 确保所有测试通过：`cd tests && npm test`
5. 提交代码：`git commit -m "feat: description"`
6. 推送分支：`git push origin feature/your-feature-name`
7. 创建 Pull Request

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `test:` 测试相关
- `refactor:` 重构
- `chore:` 构建/工具/依赖更新

### 测试要求

- 所有新功能必须包含测试
- 测试覆盖率不低于 80%
- 运行 `cd tests && npm test` 确认通过

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 使用分号
- 注释使用中文或英文，保持一致

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/cocoyoi/immersive-translator.git
cd immersive-translator

# 安装测试依赖
cd tests && npm install

# 运行测试
npm test

# 运行特定测试
npm run test:background
npm run test:content
npm run test:popup
```

## 功能优先级

参考 [PLAN.md](PLAN.md) 了解当前功能规划和优先级。

## 联系我们

如有问题，欢迎在 issue 中讨论。