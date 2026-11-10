// نظام غاندي لإدارة السنترالات — قلب التفعيل (بصمة الجهاز + التحقق من مفتاح التفعيل)
// المطور: م. محمد علي — 01098811581
'use strict';
const crypto = require('crypto');
const { execSync } = require('child_process');

// المفتاح العام فقط داخل البرنامج. المفتاح الخاص موجود في keygen/ عند المطور فقط.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAnUtDOJvl6pUuHjczHHDOA+bkPII/EMDnFjaOekrOzdE=
-----END PUBLIC KEY-----`;

const PRODUCT = 'GHANDI-CENTRAL';

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', windowsHide: true, timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return ''; }
}
function wmic(cls, prop) {
  let out = run(`wmic ${cls} get ${prop} /value`);
  let m = out.match(new RegExp(prop + '=(.+)', 'i'));
  if (m && m[1].trim()) return m[1].trim();
  // ويندوز 11 الجديد ممكن يكون wmic مش موجود → PowerShell
  const map = { csproduct: 'Win32_ComputerSystemProduct', baseboard: 'Win32_BaseBoard', cpu: 'Win32_Processor', diskdrive: 'Win32_DiskDrive' };
  out = run(`powershell -NoProfile -Command "(Get-CimInstance ${map[cls]} | Select-Object -First 1).${prop}"`);
  return (out || '').split(/\r?\n/)[0].trim();
}
function machineGuid() {
  const out = run('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid');
  const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
  return m ? m[1] : '';
}

function getFingerprint() {
  let parts;
  if (process.platform === 'win32') {
    parts = [machineGuid(), wmic('csproduct', 'UUID'), wmic('baseboard', 'SerialNumber'), wmic('cpu', 'ProcessorId')];
  } else {
    const os = require('os');
    parts = [os.hostname(), os.cpus()[0] && os.cpus()[0].model, os.arch(), run('cat /etc/machine-id')];
  }
  const raw = PRODUCT + '|' + parts.map(p => (p || '').toUpperCase()).join('|');
  const h = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase().slice(0, 20);
  return h.match(/.{4}/g).join('-');
}

const b64u = {
  enc: buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
};

// شكل المفتاح: GC1.<payload>.<signature>
function verifyLicense(key, fingerprint) {
  try {
    key = String(key || '').replace(/\s+/g, '');
    const [ver, p, s] = key.split('.');
    if (ver !== 'GC1' || !p || !s) return { ok: false, reason: 'صيغة المفتاح غير صحيحة' };
    const pub = crypto.createPublicKey(PUBLIC_KEY_PEM);
    const valid = crypto.verify(null, Buffer.from(ver + '.' + p), pub, b64u.dec(s));
    if (!valid) return { ok: false, reason: 'مفتاح التفعيل غير صالح' };
    const data = JSON.parse(b64u.dec(p).toString('utf8'));
    if (data.prod !== PRODUCT) return { ok: false, reason: 'المفتاح لنظام آخر' };
    if (data.fp !== fingerprint) return { ok: false, reason: 'المفتاح ليس لهذا الجهاز' };
    if (data.exp !== 'LIFE') {
      const end = new Date(data.exp + 'T23:59:59');
      if (isNaN(end) || end < new Date()) return { ok: false, reason: 'انتهت مدة التفعيل', data };
    }
    return { ok: true, data };
  } catch (e) { return { ok: false, reason: 'مفتاح تالف' }; }
}

// تستخدم في أداة المطور فقط (تحتاج المفتاح الخاص)
function signLicense(privatePem, { fp, days, shop, plan }) {
  let exp = 'LIFE';
  if (days && Number(days) > 0) {
    const d = new Date(); d.setDate(d.getDate() + Number(days));
    exp = d.toISOString().slice(0, 10);
  }
  const data = { prod: PRODUCT, fp: String(fp).trim().toUpperCase(), exp, shop: shop || '', plan: plan || 'full', iat: new Date().toISOString().slice(0, 10) };
  const p = b64u.enc(JSON.stringify(data));
  const sig = crypto.sign(null, Buffer.from('GC1.' + p), crypto.createPrivateKey(privatePem));
  return { key: 'GC1.' + p + '.' + b64u.enc(sig), data };
}

module.exports = { getFingerprint, verifyLicense, signLicense, PRODUCT };
