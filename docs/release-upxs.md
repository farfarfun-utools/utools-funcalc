本次提供使用新打包工具生成的 **`.upxs` 安装测试版**，插件项目 ID 为 `zacvi5vk`。

下载 `utools-funcalc-0.1.3.upxs`，导入 uTools 测试。成功后输入「算有所得」或 `FunCalc`，可试用变量、矩阵、LaTeX 显示与持久化历史记录。同一份 Web 插件供 Windows、macOS、Linux 使用。

全部构建、测试与打包通过 GitHub Actions 执行。采用固定版本 `utools-devtools`，打包后重新认证解密，校验清单、资源、ASAR 完整性和插件 ID；提供 `SHA256SUMS` 核对下载文件。

这不是 ZIP 改名，也不是此前的旧 `.upx`。目前已验证文件格式及 Web 插件行为，**尚待真实 uTools 客户端安装验收**，因此标记为预览版。如安装失败，请保留客户端的具体提示。
