# Panerelay

中文版 ｜ [English](README.md)

**让 AI Agent 直接在你正在使用的浏览器中工作。**

Panerelay 是连接 AI Agent 与用户现有 Chrome、Edge 或 Firefox 会话的开源本地桥梁。它在确保浏览器访问明确、可见且可撤销的前提下，解决两个问题：

1. **让 Agent 直接控制你的 Chrome、Edge 或显式托管启动的 Firefox。** 任何能通过 CLI 或 MCP 调用 [agent-browser](https://github.com/vercel-labs/agent-browser) 的 Agent，都可以使用当前浏览器 Profile 和登录态控制你授权的标签页，无需启动独立浏览器、重复登录或导出 Cookie。
2. **把本地 Agent 带进浏览器侧边栏。** 完成一次 Panerelay 安装后，扩展会自动发现支持的本地 Agent，并提供浏览器原生的对话、会话历史、审批、活动展示和立即释放控制。

登录凭证始终留在浏览器中；Panerelay 只操作你明确授权的标签页，浏览器焦点不会被当作权限。

![Panerelay](https://github.com/user-attachments/assets/a54dfbaa-1c9f-45a3-b3ab-aa2e6ec4a5f6)

## 工作方式

```text
任意 AI Agent → agent-browser CLI / MCP → Panerelay Bridge
                                             ↕ Native Messaging
本地 Agent ← 浏览器侧边栏 ← Panerelay 扩展 ↔ 已授权标签页
```

- **agent-browser 继续负责浏览器自动化语义**，包括 snapshot、定位、输入、等待、标签页和截图。
- **本地 Bridge 负责路由与策略**，连接 agent-browser、本地 Agent Runtime 与扩展。
- **扩展负责用户授权和状态可见性**，不保存模型凭证，也不启动本地 Agent 进程。

## 快速开始

环境要求：macOS、Linux 或 Windows 上的 Chrome、Edge 或 Firefox、Node.js 20+，以及兼容的 agent-browser。Firefox 自动化还需要 geckodriver 和支持 WebDriver existing-session Provider 的 agent-browser 构建。

Firefox 正常启动时仍可使用 Native Messaging、Agent 对话、项目选择和页面批注。自动化使用显式 WebDriver 通路：检测到 Firefox 和 geckodriver 后，setup 会安装独立的 Panerelay Firefox 启动器；Panerelay 只通过参与者级虚拟会话暴露已授权窗口。CDP 专属能力仍明确不支持。

Firefox Provider 目前仍是协同开发契约：agent-browser 尚未发布带 `browser.provider.webdriver-existing-session` 的语义最低版本。精确源码 fixture 和命令级状态见 [Firefox WebDriver 开发兼容性记录](docs/compatibility/firefox-webdriver-development.md)；未打补丁的 agent-browser 0.33.x 仍可用于 Chrome/Edge。

1. 在 Chrome 或 Edge 中从 [Chrome 应用商店安装 Panerelay](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi)，或在候选版本测试中临时加载对应 Release 的 Firefox 包。
2. 安装本地集成：

   ```bash
   npx --yes @panerelay/setup
   ```

3. 在 Chrome 或 Edge 中从工具栏打开 Panerelay，授权当前网页标签页或所有受支持的网页标签页。若要在 Firefox 中自动化，请先关闭正常启动的 Firefox，再运行 `~/.panerelay/bin/panerelay-firefox`（Windows 为 `%USERPROFILE%\.panerelay\bin\panerelay-firefox.cmd`），打开侧边栏并授权当前标签页或所有受支持标签页；正常启动仍可用于对话和页面批注。
4. 验证任意 Agent 可以通过 agent-browser 访问已授权的浏览器：

   ```bash
   agent-browser --provider panerelay tab list
   ```

5. 打开浏览器侧边栏并选择本机已安装的 Agent。Panerelay 会自动发现支持的本地 Agent；对应的 Agent CLI 仍需提前安装并登录。

如需在后续命令中省略 `--provider panerelay`，可在扩展设置中将 Panerelay 设为用户级默认 Agent，或安装时加上 `--global-provider`；如果只想影响当前项目，请改用 `--project-provider`。默认 Agent 只改变路由，不会授予浏览器权限，也不会授权任何标签页。

## Panerelay 提供什么

- 已授权标签页中的 agent-browser 工作流。Chrome/Edge 支持文档列出的 CDP 命令组；Firefox 转发兼容的 WebDriver 页面交互、导航、snapshot、输入和截图命令，并拒绝 CDP 专属操作。
- 本地 Agent 侧边栏，支持对话、会话历史、审批、中断、活动展示和标签页关联会话。
- macOS、Linux 和 Windows 用户级 Native Messaging 安装。
- Local-first 路由，不依赖 Panerelay 云服务。

每个版本可用的侧边栏 Agent 见对应发布说明；具体的 agent-browser 支持范围见 [兼容性记录](docs/compatibility)。

## 管理安装

省略 action 时会安装或更新本地集成：

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

扩展设置可以随时设为或取消 Panerelay 用户级默认 Agent，不会卸载任何集成。安装时也可以直接选择默认范围：

```bash
npx --yes @panerelay/setup --global-provider
npx --yes @panerelay/setup --project-provider
```

agent-browser 从 `~/.agent-browser/config.json` 读取用户级默认值，当前项目的 `./agent-browser.json` 优先级更高。如需恢复其他默认 Agent，修改或删除对应配置中的 `provider` 字段即可。Panerelay 会继续保留，始终可以通过 `--provider panerelay` 使用。

官方构建使用扩展 ID `panplnkjlkoceaonlmpdekjphgmbggmi`。自行构建的扩展可以注册自己的 32 位 ID：

```bash
npx --yes @panerelay/setup --extension-id <32位扩展ID>
```

ID 必须由 32 个 `a` 到 `p` 的小写字母组成。

Firefox 构建使用 ID `panerelay@f-loat.dev`。自行构建时可通过 `--firefox-extension-id <id>` 或 `PANERELAY_FIREFOX_EXTENSION_ID` 覆盖。

Setup/update 只替换 Panerelay 管理的 Firefox 启动器和运行时文件；uninstall 不会删除 Firefox、Profile 或正常快捷方式。回滚时请运行目标旧版本的 setup 包，并重新加载同版本扩展产物。

## 安全与运行边界

- 浏览器网站权限、标签页授权与独占自动化控制租约相互独立。聚焦标签页不会授予权限；修改操作必须持有当前控制租约。
- 复用登录态是指在已授权的现有标签页内工作。Panerelay 默认不会导出或记录 Cookie、凭证、Prompt、截图、页面内容或请求体。
- Panerelay 无法接管隔离 Profile、启动期代理或关闭用户浏览器进程等 browser-process 能力。
- Firefox 自动化使用独立的显式启动器。Panerelay 只拥有并清理自己启动的 geckodriver，绝不会自动关闭 Firefox。
- `webNavigation` 只用于识别浏览器报告的关联标签页，以便继承会话上下文；它不会读取浏览历史，也不会授予网站访问权限。
- 扩展、协议、Bridge、Provider 与 setup CLI 构成锁步兼容单元。

## 开发与发布检查

工作区开发需要 Node.js `20.19` 或更高版本和 pnpm：

```bash
pnpm install
pnpm run check
```

运行 `pnpm run build`，然后在 Chrome/Edge 中加载 `apps/extension/dist/chromium`，或在 Firefox 中加载 `apps/extension/dist/firefox`。本地测试 Provider：

```bash
pnpm build
node packages/setup/dist/cli.js --project-provider
agent-browser --provider panerelay tab list
```

构建和验证未发布候选：

```bash
pnpm package
pnpm run release:check
pnpm run release:pack
```

这些命令只创建被忽略的本地产物，不会发布包、创建 tag 或上传文件。更多信息见 [发布清单](docs/releasing.md)和[架构 RFC](docs/rfcs)。

## License

[MIT](LICENSE)
