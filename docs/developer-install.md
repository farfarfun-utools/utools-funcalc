# 算有所得 FunCalc：开发者构建目录

本目录是 GitHub Actions 已编译的 Web 插件文件，**不是 `.upxs` 安装包**，不能直接拖入 uTools 安装，也不能通过改扩展名变成 `.upxs`。

解压后应看到 `plugin.json`、`preload.js`、`logo.png` 和 `dist/`，入口为 `dist/index.html`。资源已经构建好，无需在本机运行 pnpm、Vite 或编译源码。

## 开发模式

在 uTools 应用市场安装「uTools 开发者工具」，按工具界面将本目录作为插件工程配置。工程的插件配置文件为本目录的 `plugin.json`，应保留整个目录及相对路径。

完成工程配置后，使用工具中的「安装（开发模式）」和「打开」测试。官方流程参考：https://www.u-tools.cn/docs/getting-started/create-plugin.html

项目需要支持的最终安装格式为 `.upxs`。目前没有已验证的自动 `.upxs` 导出方案，需通过官方工具完成导出，并在目标 uTools 客户端验证；本仓库不声称已完成这一步。

## 已知发布问题

之前的 0.1.0 / 0.1.1 `.upx` 附件不是当前客户端可识别的安装包，已停止作为安装方式提供。CI、浏览器测试、压缩格式检查及 SHA-256 校验均不能代替 uTools 安装验收。

源码：https://github.com/farfarfun-utools/utools-funcalc
