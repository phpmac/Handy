# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导.

Read @AGENTS.md

## 工具使用规则

- 禁止使用 bash 命令操作文件 (cat/sed/awk/head/tail/grep/find 等), 必须使用 Read/Edit/Write 工具
- 代码定位优先使用 LSP (定义/引用/符号/大纲)
- GitHub 仓库信息必须使用 gh 命令, 禁止使用 web reader 爬取 GitHub 页面
- Bash 命令必须使用绝对路径, 禁止依赖当前工作目录; 如果需要 cd, 必须在命令链末尾恢复到项目根目录 /Users/a/Downloads/Handy
- 打包构建 (tauri build/cargo build 等) 必须在后台运行 (run_in_background: true)

## 代码规范

- 新增/修改的代码注释必须使用中文
- 新增/修改的日志信息 (debug/error/warn/info) 必须使用中文
