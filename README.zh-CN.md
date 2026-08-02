# Panerelay

中文版 ｜ [English](README.md)

[官网](https://f-loat.github.io/panerelay/) · [Chrome 应用商店](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [文档导航](docs/README.zh-CN.md) · [版本发布](https://github.com/F-loat/panerelay/releases)

**让 Agent 在你常用的浏览器里工作。**

Panerelay 是连接 AI Agent 与现有 Chrome 或 Microsoft Edge 会话的开源本地桥梁。Agent 只在你明确授权的标签页中工作，浏览器 Profile、Cookie 和登录状态始终留在浏览器里。

- **复用现有登录态。** 直接使用日常浏览器中已经打开的网站和账号，无需导出 Cookie，也不用重新登录。
- **不打断当前操作。** Agent 选择标签页和在后台自动化时，不会切走你正在查看的页面。
- **控制始终可见。** 标签页需要明确授权，受控状态清晰可见，并且随时可以释放。

Panerelay 提供两种接入方式：

| 方向 | 适合场景 | 使用体验 |
| --- | --- | --- |
| **Agent 侧边栏** | 希望本地 Agent 就在当前页面旁工作 | 在侧边栏打开 Codex、Claude Code 或 Qoder，完成对话、审批、活动查看和项目关联会话 |
| **自动化工具接入** | 希望其他应用或终端中的 Agent 操作浏览器 | 按需接入 [agent-browser](https://agent-browser.dev/) 或 [browser-use](https://docs.browser-use.com/open-source/browser-use-cli)，也可以同时接入两种工具；它们只能访问已授权标签页 |

![Panerelay](https://github.com/user-attachments/assets/a54dfbaa-1c9f-45a3-b3ab-aa2e6ec4a5f6)

## 快速开始

环境要求：macOS、Linux 或 Windows 上的 Chrome 或 Microsoft Edge，以及 Node.js 20 或更高版本。Panerelay 本身不依赖 agent-browser 或 browser-use；Browser Use 集成需要 browser-use 0.13.7+ 和 Browser Harness 0.1.8+。

### 1. 安装扩展

从 [Chrome 应用商店安装 Panerelay](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi)。Microsoft Edge 可能会先要求允许来自其他商店的扩展。

### 2. 接入 Panerelay

按照你希望的工作方式选择一条安装路径。

#### 交给 Agent 接入自动化工具

把对应提示发给你正在使用的 Agent。它会先检查环境，只在需要时通过官方来源安装或更新所选工具，然后安装 Panerelay 集成并运行诊断；需要你安装扩展或授权标签页时，会停下来提醒你。

**agent-browser**

```text
请用 curl -fsSL 读取此指南，并执行 agent-browser 场景：https://f-loat.github.io/panerelay/agent-setup.md
```

**browser-use**

```text
请用 curl -fsSL 读取此指南，并执行 browser-use 场景：https://f-loat.github.io/panerelay/agent-setup.md
```

官网发布的指南由仓库中版本受控的 [Agent 接入说明](docs/agent-setup.md)生成。`@panerelay/setup` 只安装 Panerelay 自有文件，不会自行安装或修改 agent-browser 和 browser-use。

#### 自己安装 Panerelay

```bash
npx --yes @panerelay/setup
```

它会安装侧边栏与 Panerelay 集成所需的 Native Host，并且交互式选择是否接入自动化引擎。

### 3. 授权需要共享的标签页

从浏览器工具栏打开 Panerelay，选择授权当前网页标签页或所有受支持的网页标签页。

### 4. 开始使用

- 使用 **Agent 侧边栏** 时，选择本机已安装并登录的 Codex、Claude Code 或 Qoder，可以按需选择项目目录，然后开始对话。
- 使用 **agent-browser 或 browser-use** 时，照常运行相应工具；Panerelay 只负责提供经过授权的现有浏览器连接。

agent-browser 最短的授权边界验证命令是：

```bash
agent-browser --provider panerelay tab list
```

它只能列出你已授权的标签页。空列表通常表示当前没有符合条件的已授权标签页，不一定代表安装失败。

browser-use 则通过安装时输出的托管 CLI 执行预置的 helper。下面是使用默认路径的 macOS / Linux 示例：

```bash
~/.panerelay/bin/panerelay-browser-use <<'PY'
print(list_tabs())
PY
```

结果同样只能包含你明确授权的标签页。Windows 或 browser-use 不在默认路径时，请使用 setup 输出的实际启动器和可执行文件路径。

## 支持的工作流

### Agent 侧边栏

侧边栏支持本机已安装并登录的 Codex、Claude Code 和 Qoder。所选项目会作为 Agent 的实际工作目录。Panerelay 只提供经过限制的当前标签页 URL 和标题上下文；浏览器 MCP 与 Skill 仍由 Agent 自身配置提供。

### 接入 agent-browser

Panerelay 为已授权的现有浏览器标签页提供 agent-browser Provider，标准 CLI 和 MCP 命令保持原有语义。最低支持版本和最初经过 Chrome 验证的精确基线都是 agent-browser 0.33.0。详见[接入说明](packages/agent-browser/README.md)与[兼容性记录](docs/compatibility/agent-browser-0.33.0.md)。

### 接入 browser-use

Panerelay 支持安装托管的 browser-use CLI、附加 Skill 和 CLI MCP 启动器。Browser Harness 仍负责 browser-use 的自动化语义，Panerelay 只提供经过授权的 Chrome 连接。Panerelay 不会透明接管任意 browser-use Python SDK 构造，这类应用需要显式接入连接。

最低支持版本为 browser-use 0.13.7；精确验证基线为 browser-use 0.13.7 + Browser Harness 0.1.8。详见[接入说明](packages/browser-use/README.md)与[兼容性记录](docs/compatibility/browser-use-0.13.7.md)。

Microsoft Edge 能力组在完成有代表性的验收前仍归类为 `Forwarded`，详见[浏览器平台记录](docs/compatibility/browser-platforms.md)。

## 工作方式

```text
外部 Agent ─┬─ agent-browser CLI / MCP ─┐
            └─ browser-use CLI / MCP ───┤
                                        ▼
                                 Panerelay Bridge
                                        ↕ Native Messaging
本地 Agent ← 浏览器侧边栏 ← Panerelay 扩展 ↔ 已授权标签页
```

- 自动化工具保留自己的命令、helper、等待和页面状态语义。
- 本地 Bridge 在自动化工具、本地 Agent Runtime 与扩展之间负责路由并执行策略。
- 扩展负责用户授权、受控状态展示和释放，不保存模型凭证，也不启动本地 Agent 进程。

## 管理安装

给人使用的命令只管理 Panerelay 本身：

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

如果同时连接了多个 Panerelay 浏览器，可以在扩展设置中选择默认浏览器，或使用可选管理 CLI：

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use edge
```

已保存的浏览器不可用或存在多个候选但未选择时，Panerelay 会直接报错，不会根据焦点或注册顺序猜测。集成参数、默认 Provider、自定义扩展 ID、browser-use 模式和各平台路径见 [`@panerelay/setup` 技术参考](packages/setup/README.md)。

## 安全与运行边界

- 复用登录态是指在已授权的现有标签页中工作。Panerelay 默认不会导出或记录 Cookie、凭证、Prompt、截图、页面内容或请求体。
- 修改操作需要持有当前独占控制租约。释放控制不会暗中扩大或移除你选择的授权范围。
- Panerelay 不接管隔离 Profile、启动期代理或关闭用户浏览器进程等 browser-process 能力。
- `webNavigation` 只用于识别浏览器报告的关联标签页，以便共享会话上下文；它不会读取浏览历史，也不会授予网站访问权限。
- 扩展、协议、Bridge、Provider 与 adapter、setup 包、浏览器注册库和可选管理 CLI 作为同一个锁步兼容单元发布。

## 文档

- [文档导航](docs/README.zh-CN.md)
- [Agent 接入说明](docs/agent-setup.md)
- [`@panerelay/setup` 技术参考](packages/setup/README.md)
- [兼容性记录](docs/compatibility)
- [架构 RFC](docs/rfcs)

## 开发与发布检查

工作区开发需要 Node.js 20.19 或更高版本和 pnpm：

```bash
pnpm install
pnpm run check
```

运行 `pnpm run dev`，然后在 Chrome 或 Edge 中将 `apps/extension/dist` 加载为未打包扩展。本地测试 agent-browser Provider：

```bash
pnpm build
node packages/setup/dist/cli.js --agent-browser --project-provider
agent-browser --provider panerelay tab list
```

构建和验证未发布候选：

```bash
pnpm package
pnpm run release:check
pnpm run release:pack
```

这些命令只创建被忽略的本地产物，不会发布包、创建 tag 或上传文件。更多信息见[发布清单](docs/releasing.md)和[架构 RFC](docs/rfcs)。

## License

[MIT](LICENSE)
