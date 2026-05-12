# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导.

Read @AGENTS.md

## 工具使用规则

- 禁止使用 bash 命令操作文件 (cat/sed/awk/head/tail/grep/find 等), 必须使用 Read/Edit/Write 工具
- 代码定位优先使用 LSP (定义/引用/符号/大纲)
- GitHub 仓库信息必须使用 gh 命令, 禁止使用 web reader 爬取 GitHub 页面
