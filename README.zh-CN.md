# Panerelay

[English](README.md)

Panerelay 将 AI Agent 连接到用户当前 Chrome 中显式授权的标签页。外部 Agent 可以继续使用标准 `agent-browser` 命令；扩展侧边栏则提供 Agent 会话、活动展示、授权审批和立即释放控制权。

当前发布目标是 `0.1.0`。候选验证不会发布包、创建 Git tag 或上传产物。

## 工作方式

```text
外部 Agent → agent-browser → Panerelay Bridge
                                  ↕ Native Messaging
侧边栏 Agent ← Panerelay 扩展 ↔ 已授权的 Chrome 标签页
```

本地 Bridge 是统一的路由与策略边界。扩展不保存模型凭证，也不启动本地 Agent 进程；浏览器访问始终限制在用户明确授权的标签页内。

## 环境要求

- macOS、Linux 或 Windows 上的 Chrome
- Node.js 20 或更高版本
- agent-browser 0.33.0 或更高版本
- 版本匹配的 Panerelay 扩展与 npm 包

Codex 与 Qoder 是可选的侧边栏 Agent Provider。选择器会始终展示两者，默认选择已安装的 Provider；两者都未安装时回退到 Codex。

## 快速开始

1. 解压 `panerelay-extension-0.1.0.zip`，打开 `chrome://extensions`，启用开发者模式并加载解压目录。
2. 安装本地集成，并将 Panerelay 设为用户级默认 Provider：

   ```bash
   npx --yes @panerelay/setup --global-provider
   ```

3. 从 Chrome 工具栏打开 Panerelay，授权当前网页标签页或所有受支持的网页标签页。
4. 验证已注册的 Provider：

   ```bash
   agent-browser --provider panerelay tab list
   ```

省略 action 时默认执行 setup。如果只想影响当前项目，可以用 `--project-provider` 代替 `--global-provider`。选择 Provider 只改变路由，不会授予 Chrome 权限或授权标签页。

### 更新、卸载与问题检测

```bash
npx --yes @panerelay/setup update
npx --yes @panerelay/setup uninstall
npx --yes @panerelay/setup doctor
```

### 自定义扩展 ID

官方扩展 ID 是 `panplnkjlkoceaonlmpdekjphgmbggmi`。自行构建或使用其他签名的扩展时可传入实际 ID：

```bash
npx --yes @panerelay/setup --extension-id <32位扩展ID>
```

ID 必须恰好由 32 个 `a` 到 `p` 的小写字母组成；也可使用环境变量 `PANERELAY_EXTENSION_ID`。

## 运行边界

- Chrome 权限、标签页授权与独占控制租约相互独立且可撤销。
- Panerelay 复用正在运行的 Chrome Profile。隔离浏览器上下文、修改启动期代理或 Profile、
  关闭 Chrome 等浏览器进程级操作不受支持，并会显式失败。
- 活动信息经过脱敏、有数量上限且仅保存在内存中。默认不记录页面内容、Cookie、凭证、
  Prompt、截图或请求体。
- agent-browser 0.33.0 是最低支持版本和首个 Verified 基线。更高版本不会在缺少专项证据时
  自动继承版本验证结论。
- `0.1.0` 的扩展与 npm 包是锁步兼容单元。

命令覆盖范围见 [agent-browser 兼容性矩阵](docs/compatibility/agent-browser-0.33.0.md)，候选发布前仍需完成的检查见 [发布清单](docs/releasing.md)。

## 开发

工作区开发需要 Node.js 20.19 或更高版本和 pnpm：

```bash
pnpm install
pnpm run check
```

运行 `pnpm run dev`，然后将 `apps/extension/dist` 加载为未打包扩展。本地测试 Provider：

```bash
pnpm build
node packages/setup/dist/cli.js --project-provider
agent-browser --provider panerelay tab list
```

构建或验证未发布产物：

```bash
pnpm package
pnpm run release:check
pnpm run release:pack
```

候选产物保存在被忽略的 `.artifacts/` 目录中；这些命令都不会发布、打 tag 或上传。

架构与安全决策记录在 [`docs/rfcs`](docs/rfcs)。

## License

[MIT](LICENSE)
