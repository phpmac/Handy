# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导.

Read @AGENTS.md

## 工具使用规则

- **禁止使用 bash 命令操作文件 (cat/sed/awk/head/tail/grep/find 等), 必须使用 Read/Edit/Write 工具** -- 此规则不可违反, 包括在 Agent/SubAgent 中也不允许
- 代码定位优先使用 LSP (定义/引用/符号/大纲), 搜索代码使用 LSP workspaceSymbol/findReferences 而非 grep
- GitHub 仓库信息必须使用 gh 命令, 禁止使用 web reader 爬取 GitHub 页面
- Bash 命令必须使用绝对路径, 禁止依赖当前工作目录; 如果需要 cd, 必须在命令链末尾恢复到项目根目录 /Users/a/Downloads/handy
- 打包构建 (tauri build/cargo build 等) 必须在后台运行 (run_in_background: true)
- 搜索代码库内容时, 使用 Agent(subagent_type="Explore") 会调用 Grep 工具(底层是 bash grep), 在用户明确禁止 grep 时应改用 Read 工具逐文件阅读 + LSP 定位

## 代码规范

- 新增/修改的代码注释必须使用中文
- 新增/修改的日志信息 (debug/error/warn/info) 必须使用中文
