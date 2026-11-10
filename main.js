// نظام غاندي لإدارة السنترالات ومحلات الموبايل — العملية الرئيسية (Electron)
// المطور: م. محمد علي — 01098811581
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getFingerprint, verifyLicense } = require('./lib/license-core');

const USER = app.getPath('userData');
const DATA_DIR = path.join(USER, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const LIC_FILE = path.join(USER, 'license.json');
const DEFAULT_BACKUP = path.join(app.getPath('documents'), 'Ghandi-Central-Backups');
fs.mkdirSync(DATA_DIR, { recursive: true });

let win = null, fingerprint = null, allowClose = false;

if (!app.requestSingleInstanceLock()) { app.exit(0); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 800, minWidth: 1024, minHeight: 640, show: false,
    title: 'غاندي — إدارة السنترالات ومحلات الموبايل',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0f172a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.on('close', e => {
    if (allowClose) return;
    e.preventDefault();
    win.webContents.send('app:before-close');
    setTimeout(() => { allowClose = true; if (win) win.close(); }, 15000); // أمان لو الواجهة علّقت
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
}

app.whenReady().then(() => { fingerprint = getFingerprint(); createWindow(); });
app.on('window-all-closed', () => app.quit());

/* ---------------- التفعيل ---------------- */
function readLic() { try { return JSON.parse(fs.readFileSync(LIC_FILE, 'utf8')); } catch (e) { return {}; } }
function writeLic(o) { fs.writeFileSync(LIC_FILE, JSON.stringify(o)); }
function licenseStatus() {
  const lic = readLic();
  if (!lic.key) return { ok: false, reason: 'البرنامج غير مفعل', fingerprint };
  // منع الرجوع بالتاريخ للخلف
  const today = new Date().toISOString().slice(0, 10);
  if (lic.lastSeen && today < lic.lastSeen) {
    const diff = (new Date(lic.lastSeen) - new Date(today)) / 864e5;
    if (diff > 1) return { ok: false, reason: 'تاريخ الجهاز تم تغييره للخلف — صحح التاريخ', fingerprint, clock: true };
  }
  const r = verifyLicense(lic.key, fingerprint);
  if (r.ok && (!lic.lastSeen || today > lic.lastSeen)) { lic.lastSeen = today; writeLic(lic); }
  return { ...r, fingerprint };
}
ipcMain.handle('license:status', () => licenseStatus());
ipcMain.handle('license:activate', (e, key) => {
  const r = verifyLicense(key, fingerprint);
  if (r.ok) { const lic = readLic(); writeLic({ key: String(key).replace(/\s+/g, ''), activatedAt: new Date().toISOString(), lastSeen: (lic.lastSeen && lic.lastSeen > new Date().toISOString().slice(0, 10)) ? lic.lastSeen : new Date().toISOString().slice(0, 10) }); }
  return { ...r, fingerprint };
});
ipcMain.handle('license:remove', () => { const l = readLic(); delete l.key; writeLic(l); return true; });

/* ---------------- معلومات ---------------- */
ipcMain.handle('app:info', () => ({ version: app.getVersion(), fingerprint, dataPath: DATA_DIR, defaultBackup: DEFAULT_BACKUP, platform: process.platform }));
ipcMain.handle('app:close-now', () => { allowClose = true; if (win) win.close(); });
ipcMain.handle('app:relaunch', () => { app.relaunch(); allowClose = true; app.exit(0); });

/* ---------------- قاعدة البيانات ---------------- */
ipcMain.handle('db:load', () => {
  for (const f of [DB_FILE, DB_FILE + '.bak']) {
    try { if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); } catch (e) { }
  }
  return null;
});
ipcMain.handle('db:save', (e, json) => {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, json, 'utf8');
  JSON.parse(fs.readFileSync(tmp, 'utf8')); // تأكد إن الملف سليم قبل الاستبدال
  if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_FILE + '.bak');
  fs.renameSync(tmp, DB_FILE);
  return true;
});
ipcMain.handle('hash', (e, pw, salt) => crypto.pbkdf2Sync(String(pw), String(salt), 20000, 32, 'sha256').toString('hex'));

/* ---------------- النسخ الاحتياطي ---------------- */
function stamp() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; }
ipcMain.handle('backup:now', (e, extraPaths, keep, reason) => {
  const results = [];
  if (!fs.existsSync(DB_FILE)) return [{ path: DEFAULT_BACKUP, ok: false, error: 'لا توجد بيانات' }];
  const targets = [DEFAULT_BACKUP, ...(extraPaths || []).filter(Boolean)];
  for (const dir of [...new Set(targets)]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const name = `ghandi-central_${stamp()}${reason ? '_' + reason : ''}.gcb`;
      fs.copyFileSync(DB_FILE, path.join(dir, name));
      const files = fs.readdirSync(dir).filter(f => f.startsWith('ghandi-central_') && f.endsWith('.gcb')).sort();
      while (files.length > (keep || 60)) fs.unlinkSync(path.join(dir, files.shift()));
      results.push({ path: dir, ok: true, file: name });
    } catch (err) { results.push({ path: dir, ok: false, error: err.message }); }
  }
  return results;
});
ipcMain.handle('backup:list', (e, extraPaths) => {
  const out = [];
  for (const dir of [...new Set([DEFAULT_BACKUP, ...(extraPaths || []).filter(Boolean)])]) {
    try { for (const f of fs.readdirSync(dir)) if (f.endsWith('.gcb')) { const st = fs.statSync(path.join(dir, f)); out.push({ file: path.join(dir, f), name: f, dir, size: st.size, time: st.mtime.toISOString() }); } } catch (e) { }
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
});
ipcMain.handle('backup:read', (e, file) => fs.readFileSync(file, 'utf8'));
ipcMain.handle('backup:pick-file', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'اختر ملف نسخة احتياطية', filters: [{ name: 'Ghandi Backup', extensions: ['gcb', 'json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('backup:open-folder', (e, dir) => shell.openPath(dir || DEFAULT_BACKUP));

/* ---------------- ملفات وحوارات ---------------- */
ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'اختر مكان النسخ الاحتياطي', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:open-text', async (e, exts) => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'ملف', extensions: exts || ['csv', 'txt'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('dialog:open-image', async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'صورة', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const ext = path.extname(r.filePaths[0]).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,` + fs.readFileSync(r.filePaths[0]).toString('base64');
});
ipcMain.handle('dialog:save-text', async (e, name, content) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, content, 'utf8');
  return r.filePath;
});
ipcMain.handle('open:external', (e, url) => shell.openExternal(url));

/* ---------------- الطباعة ---------------- */
ipcMain.handle('printers:list', async () => { try { return await win.webContents.getPrintersAsync(); } catch (e) { return []; } });
ipcMain.handle('print:html', (e, html, opts = {}) => new Promise(resolve => {
  const pw = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  pw.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      const o = { silent: !!opts.silent, printBackground: true, margins: { marginType: 'none' } };
      if (opts.printer) o.deviceName = opts.printer;
      if (opts.copies) o.copies = opts.copies;
      pw.webContents.print(o, (ok, err) => { resolve({ ok, err }); pw.close(); });
    }, 300);
  });
}));
ipcMain.handle('print:pdf', async (e, html, name) => {
  const pw = new BrowserWindow({ show: false });
  await pw.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  const pdf = await pw.webContents.printToPDF({ printBackground: true });
  pw.close();
  const r = await dialog.showSaveDialog(win, { defaultPath: (name || 'تقرير') + '.pdf' });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, pdf);
  shell.openPath(r.filePath);
  return r.filePath;
});
