## Why

Panerelay 目前已通过 agent-browser 0.33.0 的浏览器级连接、页面操作、标签页和基础网络验收，但大量高级命令仍停留在“理论可透传”状态。下一阶段需要用真实日常 Chrome 逐组验证、补齐实现缺口，并把可支持与必须拒绝的边界变成稳定契约。

## What Changes

- 为 agent-browser 0.33.0 建立高级命令验收矩阵，覆盖页面状态、网络诊断、文件与页面产物、仿真、可访问性和调试产物。
- 优先验证并补强 cookies、HAR/请求详情、PDF、上传下载、viewport/media/offline/headers、a11y、trace/profiler 和录屏。
- 扩展本地 fixture、Bridge/Extension 合同测试和真实 Chrome 验收证据，只有通过验收的能力才标为 `Verified`。
- 对需要浏览器进程所有权、隔离上下文或启动前配置的能力继续返回明确错误，不以部分模拟冒充完整支持。
- 保持现有授权、按需 debugger attach、单租约和目标级故障隔离不变。

非目标：

- 不支持或模拟 `Browser.close`、隔离 browser context/incognito、代理、Profile、启动参数、浏览器引擎切换或 `--allowed-domains`。
- 不读取、记录或输出用户现有标签页中的 cookie 值、授权头、请求正文或其他敏感内容。
- 不为了兼容命令而扩大 Extension 站点权限或降低用户可见的控制与撤销能力。

## Capabilities

### New Capabilities

- `agent-browser-advanced-commands`: 定义 Panerelay 对 agent-browser 0.33.0 高级页面级命令的支持、验证、授权和显式不支持行为。

### Modified Capabilities

无。

## Impact

- 受影响代码：`packages/bridge`、`apps/extension`、`packages/protocol` 和必要时的 `packages/agent-browser` Provider。
- 受影响测试：Bridge CDP 路由、Extension 授权与 Native Messaging 大消息测试，以及本地 fixture 的真实 Chrome 验收。
- 受影响文档：`docs/compatibility/agent-browser-0.33.0.md`，必要时更新 RFC-0002；长期架构不变时不新增 RFC。
- 外部基线：agent-browser 固定为 0.33.0；升级版本需要重新运行代表性命令组。
