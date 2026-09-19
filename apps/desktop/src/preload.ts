import { contextBridge, ipcRenderer } from 'electron';

const apiArgument = process.argv.find(value => value.startsWith('--saraya-api-base-url='));
const apiBaseUrl = apiArgument ? decodeURIComponent(apiArgument.slice('--saraya-api-base-url='.length)) : undefined;

contextBridge.exposeInMainWorld('electronAPI', {
  apiBaseUrl,
  readSerialScale: (options?: any) => ipcRenderer.invoke('read-serial-scale', options),
  printReceipt: (data: any) => ipcRenderer.invoke('print-receipt', data),
  getStationInfo: () => ipcRenderer.invoke('get-station-info'),
  getRefreshToken: () => ipcRenderer.invoke('session:get-refresh-token'),
  setRefreshToken: (token: string) => ipcRenderer.invoke('session:set-refresh-token', token),
  clearRefreshToken: () => ipcRenderer.invoke('session:clear-refresh-token'),
});
