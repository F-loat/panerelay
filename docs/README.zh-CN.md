# Panerelay 文档

中文版 ｜ [English](README.md)

根据你要完成的事情选择入口。产品安装与用户操作保持简洁；实现证据和架构决策分别记录在对应文档中。

## 快速开始

| 目标 | 从这里开始 |
| --- | --- |
| 了解并安装 Panerelay | [中文快速开始](../README.zh-CN.md#快速开始) |
| 让 Agent 配置 Panerelay 和自动化工具 | [Agent 接入说明](agent-setup.md) |
| 只安装用于浏览器侧边栏的 Panerelay | [`@panerelay/setup` 入门说明](../packages/setup/README.md#start-here) |
| 通过 agent-browser 使用现有浏览器中已授权的标签页 | [agent-browser 接入说明](../packages/agent-browser/README.md) |
| 通过 browser-use CLI、Skill 或 CLI MCP 使用已授权的 Chrome 标签页 | [browser-use 接入说明](../packages/browser-use/README.md) |
| 让 Playwright CLI 显式连接已授权的 Chrome 标签页 | [Playwright CLI 接入说明](../packages/playwright/README.md) |

Agent 可以从 <https://f-loat.github.io/panerelay/agent-setup.md> 获取稳定、可审阅的公开接入指南。

## 运行与排障

- [`@panerelay/setup` 技术参考](../packages/setup/README.md#technical-cli-reference)：集成参数、doctor 检查、Provider 默认值、自定义扩展 ID、browser-use 连接模式、更新和卸载。
- [`@panerelay/cli` 参考](../packages/cli/README.md)：查看已连接的浏览器并选择默认路由目标。
- [`@panerelay/bridge` 概览](../packages/bridge/README.md)：本地 Native Host、Agent Runtime 和路由边界。

## 兼容性证据

兼容性记录描述实际测试过的版本和能力分类。最低支持版本并不自动等于精确验证基线。

- [浏览器平台](compatibility/browser-platforms.md)：Chrome 与 Microsoft Edge 的能力分类。
- [agent-browser 0.33.0](compatibility/agent-browser-0.33.0.md)：Provider 行为和命令覆盖范围。
- [browser-use 0.13.7](compatibility/browser-use-0.13.7.md)：Browser Harness 0.1.8 基线、支持入口、生命周期和限制。
- [Playwright CLI 0.1.17](compatibility/playwright-cli-0.1.17.md)：显式 CDP 连接、命令组、生命周期和浏览器所有权边界。
- [Claude Code](compatibility/claude-code.md)：支持的本地 Agent Runtime 边界。

## 架构与安全决策

已接受的 [RFC](rfcs/README.md) 是跨包边界、授权、控制权、浏览器路由和第三方集成的长期决策记录。建议从以下文档开始：

- [RFC-0001：扩展连接与 Agent 互操作](rfcs/0001-extension-connection-and-agent-interoperability.md)
- [RFC-0003：控制会话生命周期与活动](rfcs/0003-control-session-lifecycle-and-activity.md)
- [RFC-0004：只读观察与主动浏览器控制](rfcs/0004-read-observation-and-active-browser-control.md)

## 开发证据

- [技术验证](spikes)：有明确边界的实验和可复现兼容性探针。
- [发布清单](releasing.md)：锁步包与扩展的发布验证流程。

Panerelay 不会把生成的浏览器截图、日志、凭据或机器相关验证输出提交到文档目录。
