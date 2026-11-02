v0.1.5：统一通过根目录 `build.sh` 构建前端，npm 包名调整为 `@farfarfun/utools-funcalc`；插件显示名和用户数据格式不变。

本次提供使用新打包工具生成的 **`.upxs` 安装包**，插件项目 ID 为 `zacvi5vk`。

此前版本新增 `calculate_expression` AI/MCP 工具，可独立计算表达式，不读取或修改笔记本变量与历史。

下载 `utools-funcalc-0.1.5.upxs`，导入 uTools 使用。成功后输入「算有所得」或 `FunCalc`，可试用变量、矩阵、LaTeX 显示与持久化历史记录。同一份 Web 插件供 Windows、macOS、Linux 使用。

全部构建、测试与打包通过 GitHub Actions 执行。采用固定版本 `utools-devtools`，打包后重新认证解密，校验清单、资源、ASAR 完整性和插件 ID；提供 `SHA256SUMS` 核对下载文件。

2026-10-27，用户确认 v0.1.3 可以在真实 uTools 客户端安装，新的打包链路验证通过。v0.1.4 的工具调用仍需实机验收；三平台构建通过不代表每个平台都已实机安装测试。
