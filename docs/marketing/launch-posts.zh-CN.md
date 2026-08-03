# 中文发布素材

发布前根据社区语气改写开头，只保留一个主链接，确认引用页面已经部署并返回 HTTP 200，并明确说明自己是 Panerelay 维护者。不要在多个社区同一天复制粘贴同一篇内容。

## V2EX

**标题**

[分享创造] Panerelay：让 AI Agent 使用现有 Chrome，可授权当前页或全部网页

**正文**

我是 Panerelay 的维护者。

做浏览器 Agent 时，我一直遇到一个很具体的问题：Agent 可以启动一个新浏览器，但真正有用的登录态、已经打开的页面、浏览器扩展和工作上下文，都在我平时使用的 Chrome 里。

Panerelay 是一个开源本地桥接层，让 agent-browser、Browser Use 和 Playwright CLI 接入现有 Chrome / Edge 会话。它没有重新实现这些工具的自动化能力，而是负责本地连接、授权范围和控制边界。

目前的授权模型是：

- 专注处理一个页面时，只授权当前标签页；
- 需要跨页面协作时，授权全部受支持网页；
- 授权范围不等于活动控制，扩展会持续显示控制状态；
- 可以随时 Release，结束活动控制，但不会偷偷扩大或清除已经选择的授权范围；
- Cookie 和凭据留在浏览器里，Panerelay 默认不导出它们。

它并不替代云浏览器、无头浏览器或隔离环境。需要干净 Profile、代理、远程并发时，那些方案更合适。Panerelay 解决的是另一种场景：用户日常浏览器本身就是 Agent 应该工作的环境。

官网和安装：https://f-loat.github.io/panerelay/

连接方式对比：https://f-loat.github.io/panerelay/zh-CN/compare/

GitHub：https://github.com/F-loat/panerelay

比较想听听大家的意见：你们会把哪些任务只开放给当前标签页，哪些任务才会开放全部网页？

## 掘金技术文章

**标题**

AI Agent 如何安全复用现有 Chrome 登录态：从裸 CDP 到标签页授权

**摘要**

AI Agent 操作浏览器时，真正困难的往往不是“能不能点击”，而是如何接入用户已经登录、已经打开、正在工作的浏览器，同时保留清晰的授权和撤销边界。本文对比托管浏览器、裸 CDP、Playwright Chrome Extension 和 Panerelay 四种连接方式，并介绍当前页/全部网页授权与活动控制租约为什么应该分开。

**正文草稿**

很多浏览器自动化工具默认启动一个新的 Chromium。对于测试、隔离和批量任务，这很合理；但对于企业后台、内部工具、内容平台或个人工作流，真正需要的登录态往往已经存在于用户日常 Chrome 中。

直接复用这个浏览器并不只是“连上 CDP”这么简单。至少需要回答四个问题：

1. Agent 能看到哪些标签页？
2. 页面获得焦点是否意味着授权？
3. 什么时候算真正开始控制？
4. 用户如何立即撤销，而不必关闭整个浏览器？

托管或隔离浏览器拥有完整的进程和 Profile，适合干净环境、代理和远程并发。裸 CDP 提供底层调试传输，但本身不是面向最终用户的标签页授权管理器。Playwright Chrome Extension 可以复用现有登录态，并从用户选择的标签页建立连接；官方文档还提供默认逐连接确认和 Token 两种连接方式。

Panerelay 选择在自动化工具和浏览器之间增加一个本地策略边界：

- 用户明确选择当前标签页或全部受支持网页；
- Focus 永远不自动授予权限；
- 授权范围、目标观察和活动控制租约彼此分开；
- 只有需要修改页面的操作才要求当前控制租约；
- 扩展持续显示活动控制，并提供立即 Release；
- Release 不会静默改变已经选择的授权范围。

Panerelay 保留 agent-browser、Browser Use 和 Playwright CLI 的命令、等待和页面语义，只负责连接、路由与策略。它不拥有浏览器进程，也不承诺隔离 Profile、启动代理或关闭用户浏览器。

完整连接方式对比：https://f-loat.github.io/panerelay/zh-CN/compare/

项目源码：https://github.com/F-loat/panerelay

安装入口：https://f-loat.github.io/panerelay/

## 知乎回答

**适合的问题**

- 如何让 AI Agent 使用已经登录的 Chrome？
- Playwright MCP 如何复用现有浏览器登录态？
- 浏览器 Agent 用 CDP 还是 Chrome 扩展更合适？

**回答草稿**

先按目标区分方案，而不是只比较“能不能操作网页”。

如果需要干净 Profile、远程并发、代理或可销毁环境，托管/隔离浏览器通常更合适。如果已经有一个通过调试参数启动的浏览器，且你自己能够管理端点和暴露范围，裸 CDP 最直接。Playwright Chrome Extension 适合希望 Playwright MCP 复用现有登录态的用户，官方流程会先让用户选择连接的标签页，默认逐连接确认，也可以配置 Token。

如果需求是让多个现有 Agent 工具复用日常 Chrome，同时由用户选择“只开放当前页”还是“开放全部受支持网页”，可以看 Panerelay。它把授权范围和活动控制分开：Focus 不代表授权，控制状态持续可见，Release 可以立即结束活动控制，但不会暗中扩大或清除授权范围。

Panerelay 不是云浏览器或隔离环境，也不拥有浏览器进程。它更像一个位于自动化工具和浏览器之间的本地策略边界，目前接入 agent-browser、Browser Use 和 Playwright CLI。

我参与维护这个项目。详细对比和证据链接在这里：

https://f-loat.github.io/panerelay/zh-CN/compare/

源码：

https://github.com/F-loat/panerelay

## 开发者群 / 即刻 / 少数派式短文

AI Agent 不一定需要再启动一个浏览器。

如果任务依赖你已经登录的后台、已经打开的标签页或现有浏览器扩展，真正需要的是把 Agent 接到日常 Chrome，同时控制它能看到和操作的范围。

Panerelay 支持授权当前标签页或全部受支持网页，并把授权范围和活动控制分开。控制状态始终可见，也可以随时释放。它目前支持 agent-browser、Browser Use 和 Playwright CLI。

https://f-loat.github.io/panerelay/

## 中文社交平台串文

**1/5**

浏览器 Agent 最常见的割裂感：它启动了一个干净浏览器，但你的登录态、标签页和工作上下文都在另一个 Chrome 里。

**2/5**

Panerelay 让 agent-browser、Browser Use 和 Playwright CLI 接入现有 Chrome / Edge，不需要导出 Cookie。

**3/5**

授权范围可以选：

- 当前标签页：专注单页任务
- 全部受支持网页：跨页面工作

Focus 本身不会自动授权。

**4/5**

授权不等于控制。扩展会持续显示活动控制，可以随时 Release，而且不会偷偷改变已经选择的授权范围。

**5/5**

官网：https://f-loat.github.io/panerelay/

连接方式对比：https://f-loat.github.io/panerelay/zh-CN/compare/

源码：https://github.com/F-loat/panerelay
