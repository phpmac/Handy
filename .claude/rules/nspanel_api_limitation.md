# NSPanel (tauri-nspanel) API 限制

- NSPanel 是 macOS 原生面板, 不响应 Tauri 前端 Window API: `setSize()`/`set_position()`/`center()` 对 NSPanel 无效
- 前端调用这些方法不报错(返回 Ok/resolve), 但窗口实际不变, 具有欺骗性
- `inner_size()` 返回的是窗口创建时的初始尺寸, 不会反映前端的 CSS 变化
- CSS `width: fit-content` 只改变渲染内容的大小, 不改变窗口本身的尺寸
- NSPanel 的尺寸和位置变更必须通过 Rust 端 `set_size()`/`set_position()` 完成
- 前端事件机制(`emit`)与 Rust 端事件监听(`app.listen`/`window.listen`)在 overlay 场景下可能不匹配(全局事件 vs 窗口事件), 不可靠

> 来源: overlay 居中问题排查, 花费 5 轮修改才发现前端 API 对 NSPanel 无效, 日志显示 `inner_size()` 始终返回 180.0 才定位到根因
