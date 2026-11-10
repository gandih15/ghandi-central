// جسر آمن بين الواجهة والعملية الرئيسية
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('api', {
  isDesktop: true,
  info: () => inv('app:info'),
  license: { status: () => inv('license:status'), activate: k => inv('license:activate', k), remove: () => inv('license:remove') },
  db: { load: () => inv('db:load'), save: j => inv('db:save', j) },
  hash: (p, s) => inv('hash', p, s),
  backup: {
    now: (paths, keep, reason) => inv('backup:now', paths, keep, reason), list: p => inv('backup:list', p),
    read: f => inv('backup:read', f), pickFile: () => inv('backup:pick-file'), openFolder: d => inv('backup:open-folder', d)
  },
  dialog: { folder: () => inv('dialog:folder'), openText: e => inv('dialog:open-text', e), openImage: () => inv('dialog:open-image'), saveText: (n, c) => inv('dialog:save-text', n, c) },
  openExternal: u => inv('open:external', u),
  printers: () => inv('printers:list'),
  printHtml: (h, o) => inv('print:html', h, o),
  printPdf: (h, n) => inv('print:pdf', h, n),
  closeNow: () => inv('app:close-now'),
  relaunch: () => inv('app:relaunch'),
  onBeforeClose: cb => ipcRenderer.on('app:before-close', cb)
});
