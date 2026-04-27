/**
 * useElectron — IPC transport layer.
 * All calls go through window.electronAPI (contextBridge via preload).
 */

const hasElectron = () => Boolean(window.electronAPI);

export const useElectron = () => {
  const onFileEvent = (channel, callback) => {
    if (hasElectron()) return window.electronAPI.on(channel, callback);
    return () => {};
  };

  const openFolderDialog = () => window.electronAPI?.openFolderDialog();
  const openFileDialog = () => window.electronAPI?.openFileDialog();
  const scanFolder = (folderPath) => window.electronAPI?.scanFolder(folderPath);
  const startWatcher = (folderPath) =>
    window.electronAPI?.startWatcher(folderPath);
  const stopWatcher = () => window.electronAPI?.stopWatcher();
  const openFile = (fp) => window.electronAPI?.openFile(fp);
  const reloadFile = (fp) => window.electronAPI?.reloadFile(fp);
  const openFilePath = (fp) =>
    window.electronAPI?.openFilePath(fp) ?? Promise.resolve();

  return {
    openFolderDialog,
    openFileDialog,
    scanFolder,
    startWatcher,
    stopWatcher,
    openFile,
    reloadFile,
    onFileEvent,
    openFilePath,
    isElectron: hasElectron(),
  };
};
