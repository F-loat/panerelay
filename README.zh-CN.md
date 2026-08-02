# Panerelay

中文版 ｜ [English](README.md)

[官网](https://f-loat.github.io/panerelay/) · [Chrome 应用商店](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [版本发布](https://github.com/F-loat/panerelay/releases)

**Agent in Browser. Agent Use Browser.**

Panerelay 是连接 AI Agent 与用户现有 Chrome 或 Microsoft Edge 会话的开源本地桥梁，让浏览器上下文向两个方向流动：

- **Agent in Browser。** 在当前页面旁打开 Codex、Claude Code 或 Qoder，完成对话、审批、活动查看和立即释放控制。
- **Agent Use Browser。** 让外部 Agent 通过 [agent-browser](https://agent-browser.dev/)、[browser-use](https://docs.browser-use.com/open-source/browser-use-cli) 或两者一起操作你授权的标签页，同时保留各自原生工作流。

登录凭证始终留在浏览器中；Panerelay 只操作你明确授权的标签页。Agent 选择和操作后台标签页时，不会切走你当前正在浏览的 Chrome 或 Edge 标签页。

![Panerelay](https://github.com/user-attachments/assets/a54dfbaa-1c9f-45a3-b3ab-aa2e6ec4a5f6)

## 工作方式

```text
任意 AI Agent ─┬─ agent-browser CLI / MCP ─┐
               └─ browser-use CLI / MCP ───┤
                                           ▼
                                    Panerelay Bridge
                                           ↕ Native Messaging
本地 Agent ← 浏览器侧边栏 ← Panerelay 扩展 ↔ 已授权标签页
```

- **自动化引擎继续负责自身语义。** agent-browser 和 browser-use 仍然管理各自的命令、helper、等待和页面状态。
- **本地 Bridge 负责路由与策略**，连接自动化引擎、本地 Agent Runtime 与扩展。
- **扩展负责用户授权和状态可见性**，不保存模型凭证，也不启动本地 Agent 进程。

## 快速开始

环境要求：macOS、Linux 或 Windows 上的 Chrome 或 Microsoft Edge，以及 Node.js 20+。Panerelay 本身不要求自动化引擎；只有让 Agent 配置对应工作流时，才需要 agent-browser 0.33.0+ 或 browser-use 0.13.7+。

Microsoft Edge 运行时能力目前归类为 `Forwarded`，仍需完成有代表性的完整验收；证据边界见[浏览器平台兼容性记录](docs/compatibility/browser-platforms.md)。

1. 在 Chrome 或 Edge 中从 [Chrome 应用商店安装 Panerelay](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi)。Edge 可能会先要求允许来自其他商店的扩展。
2. 安装 Panerelay 本地集成：

   ```bash
   npx --yes @panerelay/setup
   ```

3. 从 Chrome 或 Edge 工具栏打开 Panerelay，授权当前网页标签页或所有受支持的网页标签页。安装和工具选择本身不会授权标签页。
4. 如需 **Agent in Browser**，选择本机已安装并登录的 Codex、Claude Code 或 Qoder 后开始对话。Panerelay 会保留所选项目作为 Agent 的实际工作目录，只提供经过限制的当前标签页 URL/标题上下文；浏览器 MCP 和 Skill 由 Agent 自身配置提供。
5. 如需 **Agent Use Browser**，把下面对应的安装提示发给你的 Agent。
6. 如果 Panerelay 同时连接了多个浏览器，在扩展设置中选择“默认浏览器”，或通过 CLI 明确选择：

   ```bash
   npx --yes @panerelay/cli browsers
   npx --yes @panerelay/cli browser use edge
   ```

### 让 Agent 配置浏览器自动化

把符合你使用方式的提示复制给现有 Agent。它应该先检查环境，只修改必要配置，并始终把标签页授权留给你操作。

**agent-browser**

```text
请帮我把 Panerelay 接入 agent-browser，让 Agent 可以使用我现有的 Chrome 或 Edge。先检查本机环境；仅在缺失或版本不满足要求时，按照官方方式安装或更新 agent-browser。然后使用 Panerelay 官方安装工具启用 agent-browser 集成，运行对应的 doctor 检查，并确认 agent-browser 只能列出我明确授权的标签页。不要修改无关的 Agent 配置；需要标签页权限时，请提醒我在 Panerelay 扩展中手动授权。
```

**browser-use**

```text
请帮我把 Panerelay 接入 browser-use，让 Agent 可以复用我现有且已登录的 Chrome。先检查本机环境；仅在缺失或版本不满足要求时，按照官方方式安装或更新 browser-use。然后使用 Panerelay 官方安装工具启用 browser-use 集成，运行对应的 doctor 检查，并验证 Extension 模式连接。保留 browser-use 原有工作方式，不要修改无关的 Agent 配置；需要标签页权限时，请提醒我在 Panerelay 扩展中手动授权。
```

**两个都用**

```text
请帮我同时完成 Panerelay 的 agent-browser 和 browser-use 接入，让它们使用我现有的浏览器。先检查本机环境；仅在缺失或版本不满足要求时，按照各自官方方式安装或更新工具。然后使用 Panerelay 官方安装工具一次启用两个集成，运行对应的 doctor 检查并分别验证连接。不要修改无关的 Agent 配置；需要标签页权限时，请提醒我在 Panerelay 扩展中手动授权。
```

精确的 adapter 参数和诊断命令仍可在 [`@panerelay/setup` 技术参考](packages/setup/README.md)中查阅。

### browser-use 支持边界

Panerelay 支持安装托管的 browser-use CLI、附加 Skill 与 CLI MCP。

Setup 不安装或修改 browser-use，也不改变 `PATH`。安装后的 Skill 继续使用 browser-use 原生 helper；Panerelay 只为用户明确授权的标签页提供经过认证的虚拟 CDP 连接。Direct 与 Extension 模式支持 Panerelay 自有的持久默认值和单次覆盖。browser-use 私有 daemon 会有意保持运行，并被顺序 Agent 命令共享，因此不提供 per-Agent 任务隔离。CLI、CLI MCP、生命周期、安全与不支持边界详见 [browser-use 兼容性记录](docs/compatibility/browser-use-0.13.7.md)。

Panerelay 不会透明拦截任意 browser-use Python SDK 构造；SDK 应用需要显式接入连接。精确实测基线是 browser-use 0.13.7 + Browser Harness 0.1.8；更高的受支持版本达到最低要求，但不会自动继承 `Verified` 状态。

如需在后续命令中省略 `--provider panerelay`，可在扩展设置中将 Panerelay 设为用户级默认 Agent，或安装时加上 `--global-provider`；如果只想影响当前项目，请改用 `--project-provider`。默认 Agent 只改变路由，不会授予浏览器权限，也不会授权任何标签页。

## Panerelay 提供什么

- 已授权标签页中的 agent-browser 工作流，包括页面交互、截图、导航、标签页与弹窗、诊断、网络检查和请求 Mock。
- browser-use CLI、附加 Skill 与 CLI MCP 工作流，通过显式安装的现有 Chrome 授权连接运行。
- 本地 Agent 侧边栏，支持对话、会话历史、审批、中断、活动展示和标签页关联会话。
- macOS、Linux 和 Windows 用户级 Native Messaging 安装。
- Local-first 路由，不依赖 Panerelay 云服务。

精确运行范围见 [agent-browser 记录](docs/compatibility/agent-browser-0.33.0.md)、[browser-use 记录](docs/compatibility/browser-use-0.13.7.md)、[浏览器平台记录](docs/compatibility/browser-platforms.md)和其他[兼容性记录](docs/compatibility)。

## 管理安装

给人使用的命令只管理 Panerelay 本身：

```bash
npx --yes @panerelay/setup
npx --yes @panerelay/setup doctor
npx --yes @panerelay/setup uninstall
```

adapter 专用安装、诊断与默认 Provider 参数记录在 [`@panerelay/setup` 技术参考](packages/setup/README.md)中。扩展设置可以随时设为或取消 Panerelay 用户级默认 Agent，不会卸载任何集成。

agent-browser 从 `~/.agent-browser/config.json` 读取用户级默认值，当前项目的 `./agent-browser.json` 优先级更高。如需恢复其他默认 Agent，修改或删除对应配置中的 `provider` 字段即可。Panerelay 会继续保留，始终可以通过 `--provider panerelay` 使用。

浏览器选择是另一项独立设置。Panerelay 依次使用显式的 `PANERELAY_BROWSER_ID` 或 `PANERELAY_BROWSER`、保存的默认浏览器、唯一在线且可用的浏览器。多个浏览器同时可用但没有明确选择时会直接报错，不会根据焦点或注册顺序猜测：

```bash
npx --yes @panerelay/cli browsers
npx --yes @panerelay/cli browser use chrome
# 也可以使用精确的注册 ID：
# npx --yes @panerelay/cli browser use REGISTRATION_ID
npx --yes @panerelay/cli browser clear
PANERELAY_BROWSER=edge agent-browser --provider panerelay tab list
```

如需频繁管理，可以全局安装 `@panerelay/cli`，之后使用相同的 `panerelay ...` 命令。setup 不会自动安装这个可选 CLI，也不会修改 shell 的 `PATH`。

显式选择或保存的默认浏览器离线时不会自动切换到其他浏览器。每个 agent-browser 会话在关闭前始终固定到创建它的浏览器。

官方构建使用扩展 ID `panplnkjlkoceaonlmpdekjphgmbggmi`。自行构建的扩展可以注册自己的 32 位 ID：

```bash
npx --yes @panerelay/setup --extension-id <32位扩展ID>
```

ID 必须由 32 个 `a` 到 `p` 的小写字母组成。

## 安全与运行边界

- 浏览器网站权限、标签页授权与独占自动化控制租约相互独立。聚焦标签页不会授予权限；修改操作必须持有当前控制租约。
- 复用登录态是指在已授权的现有标签页内工作。Panerelay 默认不会导出或记录 Cookie、凭证、Prompt、截图、页面内容或请求体。
- Panerelay 无法接管隔离 Profile、启动期代理或关闭用户 Chrome 或 Edge 进程等 browser-process 能力。
- `webNavigation` 只用于识别浏览器报告的关联标签页，以便继承会话上下文；它不会读取浏览历史，也不会授予网站访问权限。
- 扩展、协议、Bridge、Provider/adapter、setup 包、浏览器注册库、可选管理 CLI 与可选 browser-use 集成构成锁步兼容单元。

## 开发与发布检查

工作区开发需要 Node.js `20.19` 或更高版本和 pnpm：

```bash
pnpm install
pnpm run check
```

运行 `pnpm run dev`，然后在 Chrome 或 Edge 中将 `apps/extension/dist` 加载为未打包扩展。本地测试 Provider：

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
