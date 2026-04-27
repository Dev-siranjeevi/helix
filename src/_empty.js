// Empty shim — electron APIs are only available in the main process.
// The renderer accesses them exclusively via window.electronAPI (preload).
export default {};
