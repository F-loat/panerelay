# PaneRelay

[English](README.md)

PaneRelay 是一个开放的浏览器中继项目，为用户、浏览器与 AI Agent 提供双向互操作能力。

项目通过浏览器扩展把外部 Agent 连接到用户正在使用的浏览器，同时提供侧边栏，让用户可以与
Agent 对话、共享浏览器上下文、查看活动、批准敏感操作并随时收回控制权。

> 状态：正在准备首个稳定版 `0.1.0`。候选构建与正式发布相互独立；仓库验证流程不会发布、
> 打 tag 或上传产物。

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
Codex 和可选 Qoder 标准化会话适配器。

## RFC

重要协议、安全与架构决策记录在 [`docs/rfcs`](docs/rfcs)：

- [RFC-0001：扩展连接与 Agent 双向互操作](docs/rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0002：浏览器级 CDP 与 agent-browser 兼容性](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)
- [RFC-0003：控制会话生命周期与外部 Agent 活动](docs/rfcs/0003-control-session-lifecycle-and-activity.md)

## 稳定版快速开始

PaneRelay `0.1.0` 支持 macOS、Linux，以及当前用户范围的 Windows Native Messaging 安装。
请使用 Node.js 20 或更高版本和 agent-browser 0.33.0 或更高版本。`0.1.0` 扩展与四个 npm
包共同组成一个锁步兼容单元。

1. 下载并解压 `panerelay-extension-0.1.0.zip`，打开 `chrome://extensions`，启用开发者模式
   并加载解压目录。扩展保留的公开 manifest key 会确定性生成官方 ID
   `panplnkjlkoceaonlmpdekjphgmbggmi`；发行物不包含私钥。
2. 安装并诊断本地集成：

   ```bash
   npx --yes @panerelay/setup@0.1.0 setup
   npx --yes @panerelay/setup@0.1.0 doctor
   ```

3. 从 Chrome 工具栏打开 PaneRelay，在侧边栏中显式授权当前网页标签页或所有受支持网页标签页。
4. 显式选择已注册的 Provider：

   ```bash
   agent-browser --session panerelay-stable --provider panerelay snapshot -i
   agent-browser --session panerelay-stable --provider panerelay close
   ```

命令行 `--provider panerelay` 优先级最高。运行 `setup --project` 可设为当前项目默认值，
`setup --global-provider` 可设为用户级默认值。选择 Provider 只改变路由，不会授予 Chrome
站点权限、授权标签页或取得独占控制租约。

侧边栏始终列出 Codex 与 Qoder，并默认选择一个已安装的 Provider；两者都未安装时选择
Codex。Codex 可独立使用；Qoder 是可选 Provider。检测到兼容的 `qodercli --acp` 后即可使用
Qoder；选择未安装的 Provider 时，侧边栏会显示安装、登录和文档引导，但不会让 `doctor`
整体失败。

### 自定义扩展 ID

官方构建使用上述 ID。自行构建或用其他签名加载扩展时，请一致传入实际 ID：

```bash
npx --yes @panerelay/setup@0.1.0 setup --extension-id <32位扩展ID>
npx --yes @panerelay/setup@0.1.0 doctor --extension-id <32位扩展ID>
```

ID 必须恰好由 32 个 `a` 到 `p` 的小写字母组成。解析优先级依次是 CLI
`--extension-id`、`PANERELAY_EXTENSION_ID`、已持久化的安装值、官方默认值。不传新覆盖值
时，`update` 会保留已有自定义 ID。Host 只允许生效 ID 对应的精确扩展来源，并在注册时再次
核对扩展实际的 `chrome.runtime.id`。

### 更新、回滚与卸载

```bash
npx --yes @panerelay/setup@0.1.0 update
npx --yes @panerelay/setup@0.1.0 doctor --json
npx --yes @panerelay/setup@0.1.0 uninstall --yes
```

需要继续维护项目或用户默认 Provider 时，请重复对应 flag。回滚时安装更早的 setup 包并加载
其匹配的扩展产物，不要混用 PaneRelay 组件版本。Windows 安装使用用户自有目录和精确的
当前用户 Chrome 注册表项，不需要管理员权限；卸载只删除 PaneRelay 管理的文件与注册信息。

CLI 会跟随中文或英文系统语言，也可通过 `--lang zh-CN`、`--lang en` 或
`PANERELAY_LANG` 覆盖；`doctor --json` 保持语言无关。

## 兼容性与运行边界

### 浏览器所有权

PaneRelay 复用正在运行的日常 Chrome Profile，因此不能真实提供隔离浏览器上下文、选择浏览器
可执行文件、修改启动期代理/Profile 参数或关闭浏览器进程。Profile 全局 Cookie、Chrome
全局下载路径、顶层请求拦截等浏览器进程级操作会失败关闭。这些是所有权边界，不是安装缺陷。

### 隐私与保留

Chrome 权限、PaneRelay 标签页授权与控制租约相互独立且可撤销。活动信息经过脱敏、有数量上限
且仅保存在内存中；默认不会持久化页面内容、Cookie、凭证、Prompt、截图、请求体或审计历史。

### 版本

agent-browser 0.33.0 是最低支持版本，也是首个有版本专项证据的 Verified 基线。更高版本满足
版本下限，但在记录自身验证证据前不会继承 `Verified` 分类。PaneRelay `0.1.0` 组件仍需锁步，
因为 Native Messaging 协议尚未协商跨版本兼容性。

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
[RFC-0002](docs/rfcs/0002-browser-level-cdp-and-agent-browser-compatibility.md)，首个 Verified 版本的命令
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
pnpm run publish -- --otp=<验证码>
```

每个包都会在发布前通过 `prepublishOnly` 自动构建。发布前请查看
[发布清单](docs/releasing.md)。

## License

[MIT](LICENSE)
