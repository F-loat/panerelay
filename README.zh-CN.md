# Panerelay

中文版 ｜ [English](README.md)

[官网](https://f-loat.github.io/panerelay/) · [Chrome 应用商店](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi) · [文档导航](docs/README.zh-CN.md) · [版本发布](https://github.com/F-loat/panerelay/releases)

**让 Agent 使用你常用的浏览器——授权当前页还是全部受支持网页，由你决定。**

Panerelay 是连接 AI Agent 与现有 Chrome 或 Microsoft Edge 会话的开源本地桥梁。专注单页任务时授权当前标签页，跨页面工作时授权全部受支持网页；浏览器 Profile、Cookie 和登录状态始终留在浏览器里。

- **授权范围由你选择。** 可以把 Agent 限定在当前标签页，也可以让它跨全部受支持网页工作。
- **复用现有登录态。** 直接使用日常浏览器中已经打开的网站和账号，无需导出 Cookie，也不用重新登录。
- **不打断当前操作。** Agent 选择标签页和在后台自动化时，不会切走你正在查看的页面。
- **控制始终可见。** 当前控制状态清晰可见，并且可以随时释放，不会暗中改变你选择的授权范围。

Panerelay 提供两种接入方式：

| 方向 | 适合场景 | 使用体验 |
| --- | --- | --- |
| **Agent 侧边栏** | 希望本地 Agent 就在当前页面旁工作 | 在侧边栏打开 Codex、Claude Code 或 Qoder，完成对话、审批、活动查看和项目关联会话 |
| **自动化工具接入** | 希望其他应用或终端中的 Agent 操作浏览器 | 按需接入 [agent-browser](https://agent-browser.dev/) 或 [browser-use](https://docs.browser-use.com/open-source/browser-use-cli)，也可以让 Playwright CLI 显式连接；它们只能访问已授权标签页 |

![Panerelay](https://github.com/user-attachments/assets/2eba77ae-5362-4803-9190-cf134dd2b8d7)

## 快速开始

环境要求：macOS、Linux 或 Windows 上的 Chrome 或 Microsoft Edge，以及 Node.js 20 或更高版本。

### 1. 安装扩展

从 [Chrome 应用商店安装 Panerelay](https://chromewebstore.google.com/detail/panerelay/panplnkjlkoceaonlmpdekjphgmbggmi)。Microsoft Edge 可能会先要求允许来自其他商店的扩展。

### 2. 安装 Panerelay Skill

把统一 Skill 安装到你使用的 Agent：

```bash
npx skills add F-loat/panerelay --skill panerelay-browser
```

然后让 Agent 使用 `$panerelay-browser` 接入 agent-browser、Browser Use 或 Playwright CLI。Skill 会检查环境，只在需要时安装或修复所选上游工具，通过 setup 管理对应的 Panerelay 集成，运行 doctor，并在需要你通过扩展授权标签页时暂停。

之后只要告诉 Agent 要完成的浏览器任务和希望使用的工具；它会调用 `$panerelay-browser`，并在需要你通过扩展授权时暂停。

## 工作方式

```text
外部 Agent ─┬─ agent-browser CLI / MCP ─┐
            ├─ browser-use CLI / MCP ───┤
            └─ Playwright CLI / CDP ────┤
                                        ▼
                                 Panerelay Bridge
                                        ↕ Native Messaging
本地 Agent ← 浏览器侧边栏 ← Panerelay 扩展 ↔ 已授权标签页
```

- 自动化工具保留自己的命令、helper、等待和页面状态语义。
- 本地 Bridge 在自动化工具、本地 Agent Runtime 与扩展之间负责路由并执行策略。
- 扩展负责用户授权、受控状态展示和释放，不保存模型凭证，也不启动本地 Agent 进程。

## 高级设置与安装管理

<details>
<summary>展开高级设置、手动使用和管理命令</summary>

### 手动运行 setup

基础 setup 会安装侧边栏需要的 Native Host：

```bash
npx --yes @panerelay/setup
```

在交互式终端中，它只会先用一次多选让你选择 agent-browser、Browser Use 和 Playwright CLI，然后最多再询问一次，是否把所选 agent-browser / Browser Use 集成设为用户级默认。Playwright 始终保持显式连接。

自动化调用或定向修复时，可以直接传入参数：

```bash
npx --yes @panerelay/setup --agent-browser
npx --yes @panerelay/setup --browser-use
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --agent-browser --browser-use --playwright
```

setup 仍负责探测所选程序，并管理 Panerelay 自有的 Provider/adapter、Browser Use 环境和受支持的默认项；它不会安装第三方自动化工具、修改 `PATH` 或管理 Skill。

### 授权并验证标签页

从浏览器工具栏打开 Panerelay：专注单页任务时授权当前网页标签页，跨页面工作时授权所有受支持的网页标签页。释放会结束当前控制，但保留已选授权范围；需要取消授权时，再次点击已选范围。页面获得焦点不代表获得授权。

agent-browser 最短的边界验证命令是：

```bash
agent-browser --provider panerelay tab list
```

它只能列出你已授权的标签页。空列表通常表示当前没有符合条件的已授权标签页，不一定代表安装失败。

Browser Use 直接使用官方 CLI，并显式传入 Panerelay 的固定发现地址：

```bash
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use browser-use <<'PY'
print(list_tabs())
PY
```

PowerShell：

```powershell
$env:BU_CDP_URL = 'http://127.0.0.1:43827/cdp/browser-use'
@'
print(list_tabs())
'@ | browser-use
```

命令提示符：

```bat
set "BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use"
echo print(list_tabs()) | browser-use
```

结果同样只能包含你明确授权的标签页。Windows 或 browser-use 不在 `PATH` 时，请使用其官方可执行文件路径；setup 不会替换它，也不会修改 `PATH`。

Extension 模式下，Setup 管理的环境文件会包含固定的发现地址：

```dotenv
BU_CDP_URL=http://127.0.0.1:43827/cdp/browser-use
```

官方 `browser-use` 和 `browser-use --cli-mcp` 会直接读取这个变量。这个地址只是稳定的本机发现入口，不是可长期复用的 CDP 凭证；Panerelay 仍会在入口后面选择默认浏览器，并生成短期 CDP 凭证。使用以下任一命令切换持久化模式：

```bash
panerelay connection use browser-use extension
panerelay connection use browser-use direct
```

保存为 Extension 模式后可以省略命令前的 `BU_CDP_URL=`，Direct 模式会移除 Panerelay 管理的配置，而单次进程显式传入的环境变量优先级更高。

使用 Playwright CLI 前，请先按照[上游项目](https://github.com/microsoft/playwright-cli)说明安装 0.1.17 或更高版本，并参阅 [Playwright 接入说明](packages/playwright/README.md)，然后显式指定 Panerelay CDP 地址：

```bash
npx --yes @panerelay/setup --playwright
npx --yes @panerelay/setup doctor --playwright
playwright-cli attach --cdp http://127.0.0.1:43827/cdp/playwright
playwright-cli tab-list
playwright-cli tab-select <tab-id-from-tab-list>
playwright-cli tab-list
playwright-cli snapshot
```

从第一次 `tab-list` 的结果中选择目标已授权标签页的 ID。执行 `tab-select` 后再次运行 `tab-list`，确认选中的标签页正确再继续。Panerelay 不会安装 shim，也不会把 Playwright 设为默认连接；需要多个具名会话时，继续使用 Playwright CLI 自身的 session 参数。

### 管理或排查 Skill

```bash
npx skills add F-loat/panerelay --skill panerelay-browser
npx skills update panerelay-browser
npx skills remove panerelay-browser
```

如果安装时选择的是用户级范围，请在对应 `npx skills` 命令中使用 `--global`。Agent 无法加载 Skill 时，先核对安装时选择的 Agent 和范围；自动化命令缺失时，再按该工具的官方来源安装。Skill 本身包含 Skill、三个上游程序、setup/doctor、扩展连接和浏览器授权的完整分层排错流程。

### 管理 Panerelay 本身

下面这些命令用于管理 Panerelay 安装：

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

</details>

## 安全与运行边界

- 复用登录态是指在已授权的现有标签页中工作。Panerelay 默认不会导出或记录 Cookie、凭证、Prompt、截图、页面内容或请求体。
- 修改操作需要持有当前独占控制租约。释放控制不会暗中扩大或移除你选择的授权范围。
- Panerelay 不接管隔离 Profile、启动期代理或关闭用户浏览器进程等 browser-process 能力。
- `webNavigation` 只用于识别浏览器报告的关联标签页，以便共享会话上下文；它不会读取浏览历史，也不会授予网站访问权限。
- 扩展、协议、Bridge、Provider 与 adapter、setup 包、浏览器注册库和可选管理 CLI 作为同一个锁步兼容单元发布。

## 开发与发布检查

工作区开发需要 Node.js 20.19 或更高版本和 pnpm：

```bash
pnpm install
pnpm run check
```

运行 `pnpm run dev`，然后在 Chrome 或 Edge 中将 `apps/extension/dist` 加载为未打包扩展。本地测试 agent-browser Provider：

```bash
pnpm build
node packages/setup/dist/cli.js --agent-browser --global-default
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
