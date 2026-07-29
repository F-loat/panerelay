# PaneRelay

[English](README.md)

PaneRelay 是一个开放的浏览器中继项目，为用户、浏览器与 AI Agent 提供双向互操作能力。

项目通过浏览器扩展把外部 Agent 连接到用户正在使用的浏览器，同时提供侧边栏，让用户可以与
Agent 对话、共享浏览器上下文、查看活动、批准敏感操作并随时收回控制权。

> 状态：pre-alpha。版本 `0.1.0-alpha.1` 是首个经过本地验证的发布候选；npm 包和 GitHub
> prerelease 尚未发布。

## 产品方向

PaneRelay 围绕三类交互构建：

1. 外部 Agent 通过标准浏览器工具控制用户已授权的标签页。
2. 用户从浏览器侧边栏开始或恢复 Agent 会话。
3. 浏览器上下文、Agent 活动、授权审批和控制权交接可以双向流动。

首个浏览器自动化集成面向
[agent-browser](https://github.com/vercel-labs/agent-browser)。PaneRelay 会复用它的 Provider
与 CDP 接口，而不是长期维护一个 fork。

## 架构

```text
外部 Agent
    │ CLI / MCP
agent-browser
    │ CDP WebSocket
PaneRelay Bridge
    ↕ Native Messaging
PaneRelay 扩展 ↔ 已授权的浏览器标签页
    ↕
侧边栏 Chat
    │
Agent Runtime Adapter
```

本地 Bridge 是统一的策略与路由边界。它连接浏览器自动化客户端、扩展和 Agent Runtime，同时
避免把模型凭证或高权限宿主机操作放进扩展。

## Workspace

```text
apps/
  extension/           Chrome 扩展与侧边栏
packages/
  protocol/            版本化中继协议和共享类型
  bridge/              Native Messaging Host 与本地 CDP 中继
  agent-browser/       agent-browser Provider Adapter
  setup/               安装、诊断、卸载与 Agent 指引
docs/
  rfcs/                架构与产品决策
```

当前包已经实现从 `agent-browser` 到显式授权 Chrome 标签页的首条链路，以及供侧边栏使用的
Codex 标准化会话适配器。

## RFC

重要协议、安全与架构决策记录在 [`docs/rfcs`](docs/rfcs)：

- [RFC-0001：扩展连接与 Agent 双向互操作](docs/rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0002：浏览器级 CDP 与 agent-browser 兼容性](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)
- [RFC-0003：控制会话生命周期与外部 Agent 活动](docs/rfcs/0003-control-session-lifecycle-and-activity.md)

## Alpha 快速开始

Alpha 版本要求扩展与 npm 包严格匹配。`0.1.0-alpha.1` 发布后，下载并解压对应的
`panerelay-extension-0.1.0-alpha.1.zip`，然后：

1. 打开 `chrome://extensions`，启用开发者模式，将解压后的目录作为未打包扩展加载。
2. 安装本地集成；也可以同时把 PaneRelay 设为 agent-browser 的全局默认 Provider：

   ```bash
   npx --yes @panerelay/setup@0.1.0-alpha.1 setup --global-provider
   npx --yes @panerelay/setup@0.1.0-alpha.1 doctor --global-provider
   ```

3. 从 Chrome 工具栏打开 PaneRelay，在侧边栏中显式授权当前网页标签页或所有受支持网页标签页。
4. 使用标准 agent-browser 命令：

   ```bash
   agent-browser --session panerelay-alpha --provider panerelay snapshot -i
   agent-browser --session panerelay-alpha --provider panerelay close
   ```

安装 Native Host 或 Provider 不会自动授权任何浏览器标签页。Chrome 站点权限、PaneRelay
标签页授权以及外部 Agent 的控制租约始终是相互独立的。

安装 CLI 会在系统语言为中文或英文时自动跟随，也可以通过 `--lang zh-CN`、`--lang en` 或
`PANERELAY_LANG` 环境变量显式覆盖。机器可读的 `doctor --json` 输出不会被本地化。

在同一 Alpha 版本线内更新时，运行对应版本的 setup，并重新加载对应的未打包扩展：

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 update --global-provider
```

回滚时，重新安装更早的 setup 版本并加载相匹配的扩展。首个 Alpha 的协议组件采用严格锁步
版本，不要混用不同版本的扩展和 npm 包。移除本地集成：

```bash
npx --yes @panerelay/setup@0.1.0-alpha.1 uninstall --yes
```

### Alpha 限制

- Native Messaging 目前支持 macOS 和 Linux，尚未实现 Windows。
- PaneRelay 复用正在运行的日常 Chrome Profile，不提供隔离浏览器上下文、代理、浏览器可执行
  文件选择或独立权限沙箱。
- Chrome 全局下载路径、关闭浏览器、Profile 全局 Cookie 等浏览器进程级操作会失败关闭。
- agent-browser 0.33.0 是当前固定的兼容性基线。
- 侧边栏目前只实现 Codex；多 Agent Adapter 与控制权交接仍是后续工作。
- 活动记录有数量上限且仅保存在内存中；Alpha 协议组件必须使用匹配版本。

## 开发

PaneRelay 使用 pnpm workspace。开发工作区要求 Node.js 20.19 或更高版本，发布后的运行时包
保持 Node.js 20 的兼容下限。

```bash
pnpm install
pnpm run check
```

开发扩展时运行 `pnpm run dev`。Vite 和 CRXJS 会把 manifest 声明的 Service Worker 与侧边栏
构建到 `apps/extension/dist`，在开发过程中重新加载扩展 Runtime，并原样复制
`apps/extension/public` 中的资源。首次把 `apps/extension/dist` 加载为未打包扩展；权限变化或
Chrome 未识别开发服务重启时，需要手动重新加载。

只构建 Chrome 扩展并生成 zip：

```bash
pnpm package
```

产物位于 `.artifacts/panerelay-extension-<version>.zip`。只有验证完整 npm 与扩展发布候选时
才需要运行 `pnpm release:pack`。

测试基于扩展的 `agent-browser` Provider：

```bash
pnpm build
node packages/setup/dist/cli.js setup --project
```

将 `apps/extension/dist` 作为未打包扩展加载，从工具栏打开 PaneRelay 并授权一个网页标签页。
`--project` 会写入当前项目的 `agent-browser.json`，随后标准 agent-browser 命令会使用
PaneRelay：

```bash
agent-browser --session panerelay-spike snapshot -i
agent-browser --session panerelay-spike close
```

没有项目或全局默认值时，可通过 `--provider panerelay` 显式选择已注册的 Provider。将
PaneRelay 设为用户级默认 Provider：

```bash
node packages/setup/dist/cli.js setup --global-provider
node packages/setup/dist/cli.js doctor --global-provider
```

setup 包也会安装 `panerelay-browser` Agent Skill。它会引导兼容 Agent 继续使用标准
`agent-browser` 命令，并通过 PaneRelay Provider 遵守浏览器侧标签页授权。Codex 侧边栏会通过
私有 Runtime 配置自动选择 PaneRelay。

当前兼容和安全范围见
[RFC-0002](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)，固定版本的命令
覆盖情况见
[agent-browser 0.33.0 兼容性矩阵](docs/compatibility/agent-browser-0.33.0.md)。开发环境可通过
`node packages/setup/dist/cli.js uninstall --project --yes` 移除集成。

构建并完整验证尚未发布的本地候选：

```bash
pnpm run release:check
pnpm run release:pack
```

`release:check` 使用临时目录，`release:pack` 会在被忽略的 `.artifacts/` 目录中保留 npm
tarball、未打包扩展 zip、`inventory.json` 和 `SHA256SUMS`。这两个命令都不会发布、打 tag
或上传任何内容。获得明确发布授权后，可运行：

```bash
pnpm publish:alpha --otp=<验证码>
```

每个包都会通过 `prepublishOnly` 在 pnpm 使用 `alpha` dist-tag 发布前自动构建。发布前请查看
[发布清单](docs/releasing.md)。

## License

[MIT](LICENSE)
