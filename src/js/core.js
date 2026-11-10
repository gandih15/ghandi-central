/* غاندي — السنترالات | النواة: البيانات والأدوات المشتركة
   المطور: م. محمد علي — 01098811581 */
'use strict';
const DEV = { name: 'م. محمد علي', phone: '01098811581', user: 'gandy', hash: 'e80e6e098e29d2f4543e8ac63d70c23477c2f7178a81e0fcc07bdcdffc72e7fd' };

/* -------- وضع المتصفح (للتجربة فقط) -------- */
if (!window.api) {
  const LS = localStorage;
  window.api = {
    isDesktop: false,
    info: async () => ({ version: '1.0.0', fingerprint: 'DEMO-BROW-SERM-ODE0-0000', dataPath: 'المتصفح', defaultBackup: 'المتصفح', platform: 'web' }),
    license: { status: async () => ({ ok: true, data: { exp: 'LIFE', shop: 'نسخة تجريبية' }, fingerprint: 'DEMO-BROW-SERM-ODE0-0000' }), activate: async () => ({ ok: false, reason: 'متاح في نسخة الويندوز فقط' }), remove: async () => true },
    db: { load: async () => LS.getItem('gc_db'), save: async j => { LS.setItem('gc_db', j); return true; } },
    hash: async (p, s) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s + '|' + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); },
    backup: { now: async () => [{ path: 'المتصفح', ok: true }], list: async () => [], read: async () => null, pickFile: async () => null, openFolder: async () => { } },
    dialog: { folder: async () => prompt('مسار المجلد'), openText: async () => null, openImage: async () => null, saveText: async (n, c) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([c])); a.download = n; a.click(); return n; } },
    openExternal: async u => window.open(u, '_blank'), printers: async () => [], printHtml: null, printPdf: null,
    closeNow: async () => { }, relaunch: async () => location.reload(), onBeforeClose: () => { }
  };
}

/* -------- أدوات -------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowISO = () => { const d = new Date(); return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const dOnly = s => (s || '').slice(0, 10);
const tOnly = s => (s || '').slice(11, 16);
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addMonths = (s, n) => { const d = new Date(s + 'T12:00:00'); const day = d.getDate(); d.setMonth(d.getMonth() + n); if (d.getDate() < day) d.setDate(0); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const num = v => { const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const r2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
const fmt = n => { n = r2(n); return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
const money = n => fmt(n) + ' ' + (DB?.settings?.currency || 'ج.م');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (arr, f) => arr.reduce((a, x) => a + num(typeof f === 'function' ? f(x) : x[f]), 0);
const by = (arr, key) => Object.fromEntries(arr.map(x => [x[key], x]));
const fmtDate = s => s ? dOnly(s).split('-').reverse().join('/') : '';
const fmtDT = s => s ? fmtDate(s) + ' ' + tOnly(s) : '';
const norm = s => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
const match = (q, ...fields) => { q = norm(q); if (!q) return true; return fields.some(f => norm(f).includes(q)); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* -------- قاعدة البيانات -------- */
let DB = null;
const COLLECTIONS = ['users', 'categories', 'brands', 'items', 'serials', 'customers', 'suppliers', 'sales', 'purchases', 'returns', 'repairs',
  'accounts', 'moves', 'finops', 'installments', 'expenses', 'employees', 'payroll', 'shifts', 'custTx', 'supTx', 'stockMoves', 'usedBuys', 'audit', 'reservations', 'notes'];

function defaultSettings() {
  return {
    shopName: 'سنترال غاندي', shopPhone: '', shopPhone2: '', shopAddress: '', taxNo: '', logo: '', currency: 'ج.م',
    receiptSize: '80mm', receiptFooter: 'شكراً لزيارتكم — البضاعة المباعة تستبدل خلال 14 يوم بحالتها',
    showLogoOnReceipt: true, autoPrint: false, silentPrint: false, printer: '', receiptCopies: 1,
    repairTerms: 'المحل غير مسئول عن الأجهزة بعد 30 يوم من تاريخ الإشعار بالجاهزية.\nالمحل غير مسئول عن البيانات والشرائح وكروت الذاكرة.\nالضمان على القطعة المغيرة فقط ولا يشمل الكسر أو المياه.',
    defaultWarranty: 30, allowNegativeStock: false, allowBelowCost: false, requireShift: false, requireCustomerForCredit: true,
    lowStockDefault: 3, lockMinutes: 0, theme: 'light', backupPaths: ['', '', ''], backupEveryHours: 4, backupKeep: 60,
    expenseCats: ['إيجار', 'كهرباء', 'مياه', 'إنترنت', 'نقل ومواصلات', 'بوفيه', 'صيانة المحل', 'ضرائب ورسوم', 'دعاية', 'أخرى'],
    deviceBrands: ['Samsung', 'Apple iPhone', 'Oppo', 'Realme', 'Xiaomi', 'Redmi', 'Infinix', 'Tecno', 'Vivo', 'Huawei', 'Honor', 'Nokia', 'Lenovo', 'Itel', 'أخرى'],
    repairFaults: ['تغيير شاشة', 'تغيير بطارية', 'سوكت شحن', 'سماعة', 'مايك', 'سوفت وير / فلاشة', 'فك باسورد / FRP', 'مياه', 'باغة / بوردة', 'كاميرا', 'زرار', 'ضهر / باك كفر', 'شبكة / IC', 'تسطيب برامج'],
    installmentLateFee: 0, defaultInterest: 0, invoiceNote: '', whatsappReady: 'مرحباً {name}، جهازك {device} جاهز للاستلام في {shop}. المطلوب: {due} ج.م. رقم الإيصال {no}',
    whatsappInstallment: 'مرحباً {name}، نذكركم بموعد القسط رقم {n} بقيمة {amount} ج.م بتاريخ {date}. {shop}'
  };
}
function defaultDB() {
  const db = { meta: { version: 1, created: nowISO(), seq: {} }, settings: defaultSettings() };
  COLLECTIONS.forEach(c => db[c] = []);
  db.accounts = [
    { id: 'cash', name: 'الخزنة (كاش)', type: 'cash', active: true, system: true },
    { id: uid(), name: 'فودافون كاش', type: 'wallet', provider: 'Vodafone', phone: '', dayLimit: 60000, monthLimit: 200000, feeFixed: 0, feePct: 1, feeMin: 5, active: true },
    { id: uid(), name: 'إنستاباي', type: 'wallet', provider: 'InstaPay', phone: '', dayLimit: 0, monthLimit: 0, feeFixed: 0, feePct: 0, feeMin: 0, active: true },
    { id: uid(), name: 'رصيد فودافون', type: 'recharge', provider: 'Vodafone', costRate: 0.97, active: true },
    { id: uid(), name: 'رصيد أورنج', type: 'recharge', provider: 'Orange', costRate: 0.97, active: true },
    { id: uid(), name: 'رصيد اتصالات', type: 'recharge', provider: 'Etisalat', costRate: 0.97, active: true },
    { id: uid(), name: 'رصيد WE', type: 'recharge', provider: 'WE', costRate: 0.97, active: true },
    { id: uid(), name: 'فوري', type: 'provider', provider: 'Fawry', feeFixed: 3, feePct: 0, feeMin: 0, active: true },
    { id: uid(), name: 'فيزا / ماكينة', type: 'bank', active: true }
  ];
  db.categories = ['موبايلات جديدة', 'موبايلات مستعملة', 'إكسسوارات', 'شواحن وكابلات', 'سماعات', 'جرابات واسكرينات', 'قطع غيار', 'كروت شحن', 'خطوط', 'خدمات'].map(n => ({ id: uid(), name: n }));
  db.customers = [{ id: 'walkin', name: 'عميل نقدي', phone: '', system: true }];
  return db;
}
async function loadDB() {
  const raw = await api.db.load();
  if (raw) { try { DB = JSON.parse(raw); } catch (e) { DB = null; } }
  if (!DB) { DB = defaultDB(); }
  migrate();
  if (!DB.users.length) {
    const salt = uid();
    DB.users.push({ id: 'admin', username: 'admin', name: 'مدير النظام', salt, hash: await api.hash('1234', salt), role: 'admin', perms: [], active: true, owner: true, mustChange: true });
  }
  await saveNow();
}
function migrate() {
  DB.meta = DB.meta || { version: 1, seq: {} }; DB.meta.seq = DB.meta.seq || {};
  DB.settings = Object.assign(defaultSettings(), DB.settings || {});
  COLLECTIONS.forEach(c => { if (!Array.isArray(DB[c])) DB[c] = []; });
  if (!DB.accounts.find(a => a.id === 'cash')) DB.accounts.unshift({ id: 'cash', name: 'الخزنة (كاش)', type: 'cash', active: true, system: true });
  if (!DB.customers.find(c => c.id === 'walkin')) DB.customers.unshift({ id: 'walkin', name: 'عميل نقدي', phone: '', system: true });
}
let saving = null, dirty = false;
const save = debounce(() => saveNow(), 500);
async function saveNow() {
  dirty = false;
  try { await api.db.save(JSON.stringify(DB)); } catch (e) { toast('خطأ في حفظ البيانات: ' + e.message, 'bad'); }
}
function nextNo(key, prefix = '') { DB.meta.seq[key] = (DB.meta.seq[key] || 0) + 1; return prefix + DB.meta.seq[key]; }
const find = (col, id) => DB[col].find(x => x.id === id);

/* -------- الجلسة والصلاحيات -------- */
let SESSION = null; // {user, isDev}
const PERMS = [
  ['dashboard', 'لوحة التحكم'], ['pos', 'نقطة البيع'], ['sell_discount', 'عمل خصم في البيع'], ['sell_price_edit', 'تعديل سعر البيع'], ['sell_credit', 'البيع الآجل'],
  ['sales', 'عرض الفواتير'], ['sales_delete', 'إلغاء الفواتير'], ['returns', 'المرتجعات'], ['items', 'الأصناف والمخزون'], ['items_cost', 'رؤية سعر التكلفة والأرباح'],
  ['stock_adjust', 'تسوية وجرد المخزون'], ['purchases', 'المشتريات'], ['suppliers', 'الموردين'], ['customers', 'العملاء'], ['used', 'شراء الأجهزة المستعملة'],
  ['repairs', 'الصيانة'], ['repairs_delete', 'حذف تذاكر الصيانة'], ['finops', 'الخدمات المالية (كاش/رصيد/فواتير)'], ['accounts', 'الخزن والمحافظ'], ['transfer', 'التحويل بين الحسابات'],
  ['installments', 'الأقساط'], ['expenses', 'المصروفات'], ['employees', 'الموظفين والرواتب'], ['shifts', 'الورديات'], ['reports', 'التقارير'],
  ['labels', 'طباعة الباركود'], ['imei', 'البحث بالسيريال IMEI'], ['reservations', 'الحجوزات والطلبات'], ['settings', 'الإعدادات'], ['users', 'المستخدمين'], ['backup', 'النسخ الاحتياطي'], ['audit', 'سجل العمليات']
];
const isAdmin = () => SESSION && (SESSION.isDev || SESSION.user.role === 'admin');
const can = p => SESSION && (isAdmin() || (SESSION.user.perms || []).includes(p));
const me = () => SESSION ? (SESSION.isDev ? 'المطور' : SESSION.user.name) : '';
const meId = () => SESSION ? (SESSION.isDev ? 'dev' : SESSION.user.id) : '';
function audit(action, details = '') {
  DB.audit.push({ id: uid(), date: nowISO(), user: me(), action, details: String(details).slice(0, 300) });
  if (DB.audit.length > 20000) DB.audit.splice(0, DB.audit.length - 20000);
  save();
}

/* -------- الحسابات (خزنة / محافظ / رصيد) -------- */
function addMove(accountId, amount, kind, ref = '', note = '') {
  if (!accountId || !num(amount)) return;
  DB.moves.push({ id: uid(), date: nowISO(), accountId, amount: r2(amount), kind, ref, note, user: me(), shiftId: currentShift()?.id || '' });
}
const accBalance = (id, until) => r2(sum(DB.moves.filter(m => m.accountId === id && (!until || m.date <= until)), 'amount'));
const accName = id => find('accounts', id)?.name || '-';
const ACC_TYPES = { cash: 'خزنة نقدية', wallet: 'محفظة إلكترونية', recharge: 'رصيد شبكة', provider: 'خدمة دفع (فوري/أمان..)', bank: 'بنك / فيزا' };
const payAccounts = () => DB.accounts.filter(a => a.active && ['cash', 'wallet', 'bank'].includes(a.type));
function walletUsage(acc) {
  const t = today(), m = t.slice(0, 7);
  const outs = DB.moves.filter(x => x.accountId === acc.id && x.amount < 0);
  return { day: -sum(outs.filter(x => dOnly(x.date) === t), 'amount'), month: -sum(outs.filter(x => x.date.slice(0, 7) === m), 'amount') };
}

/* -------- العملاء والموردين -------- */
const custBalance = id => r2(sum(DB.custTx.filter(t => t.customerId === id), 'amount')); // موجب = عليه فلوس
const supBalance = id => r2(sum(DB.supTx.filter(t => t.supplierId === id), 'amount'));   // موجب = علينا للمورد
function custTx(customerId, amount, kind, ref, note) { if (!customerId || customerId === 'walkin' || !num(amount)) return; DB.custTx.push({ id: uid(), date: nowISO(), customerId, amount: r2(amount), kind, ref, note: note || '', user: me() }); }
function supTx(supplierId, amount, kind, ref, note) { if (!supplierId || !num(amount)) return; DB.supTx.push({ id: uid(), date: nowISO(), supplierId, amount: r2(amount), kind, ref, note: note || '', user: me() }); }
const custName = id => find('customers', id)?.name || 'عميل نقدي';

/* -------- المخزون -------- */
function stockMove(itemId, qty, kind, ref, cost) {
  const it = find('items', itemId); if (!it || it.type === 'service') return;
  it.qty = r2(num(it.qty) + qty);
  DB.stockMoves.push({ id: uid(), date: nowISO(), itemId, qty, kind, ref, cost: cost ?? it.cost, user: me() });
}
const ITEM_TYPES = { phone: 'موبايل', accessory: 'إكسسوار', part: 'قطعة غيار', card: 'كارت شحن / خط', service: 'خدمة', other: 'أخرى' };
const lowStock = () => DB.items.filter(i => i.active !== false && i.type !== 'service' && num(i.qty) <= num(i.min ?? DB.settings.lowStockDefault));
const itemByCode = code => { code = String(code).trim(); return DB.items.find(i => i.active !== false && (i.code === code || (i.codes || []).includes(code))); };
const serialByImei = imei => { imei = String(imei).trim(); return imei && DB.serials.find(s => s.imei === imei || s.imei2 === imei); };

/* -------- الورديات -------- */
const currentShift = () => DB?.shifts.find(s => !s.end && s.userId === meId()) || null;

/* -------- واجهة: تنبيهات ونوافذ -------- */
function toast(msg, type = '') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3500);
}
function modal({ title, body = '', wide = false, xwide = false, buttons = [], onOpen, cols }) {
  const ovl = document.createElement('div'); ovl.className = 'ovl';
  ovl.innerHTML = `<div class="mdl ${xwide ? 'xw' : wide ? 'w' : ''}"><div class="mh"><b>${title}</b><button class="x">✕</button></div><div class="mb">${body}</div>${buttons.length ? '<div class="mf"></div>' : ''}</div>`;
  const close = () => { ovl.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape' && document.querySelector('.ovl:last-of-type') === ovl) close(); };
  document.addEventListener('keydown', onKey);
  $('.x', ovl).onclick = close;
  const mf = $('.mf', ovl);
  buttons.forEach(b => {
    const btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.innerHTML = b.text;
    btn.onclick = async () => { if (b.click) { btn.disabled = true; try { const r = await b.click(ovl, close); if (r !== false && b.close !== false) close(); } finally { btn.disabled = false; } } else close(); };
    mf.appendChild(btn);
  });
  document.body.appendChild(ovl);
  ovl.close = close;
  const f = $('input:not([type=checkbox]):not([readonly]),select,textarea', $('.mb', ovl)); if (f) setTimeout(() => f.focus(), 50);
  if (onOpen) onOpen(ovl, close);
  return ovl;
}
function confirmBox(msg, okText = 'تأكيد', cls = 'bad') {
  return new Promise(res => { modal({ title: 'تأكيد', body: `<p style="font-size:15px">${msg}</p>`, buttons: [{ text: okText, cls, click: () => res(true) }, { text: 'إلغاء', cls: 'ghost', click: () => res(false) }] }); });
}
function promptBox(title, label, value = '', type = 'text') {
  return new Promise(res => {
    modal({
      title, body: `<label class="f">${label}</label><input id="pbv" type="${type}" value="${esc(value)}">`,
      buttons: [{ text: 'موافق', click: o => res($('#pbv', o).value) }, { text: 'إلغاء', cls: 'ghost', click: () => res(null) }],
      onOpen: (o, c) => $('#pbv', o).addEventListener('keydown', e => { if (e.key === 'Enter') { res($('#pbv', o).value); c(); } })
    });
  });
}

/* -------- منشئ النماذج -------- */
// field: {k, l, t:'text|number|date|select|textarea|check|password|tel', o: options [[v,l]] أو دالة, full, req, ph, attrs}
function formHTML(fields, v = {}, cols = 2) {
  return `<div class="form" style="--cols:${cols}">` + fields.map(f => {
    if (f.t === 'html') return `<div class="${f.full ? 'full' : ''}">${f.html}</div>`;
    const val = v[f.k] ?? f.d ?? '';
    let inp;
    if (f.t === 'select') {
      const opts = typeof f.o === 'function' ? f.o() : f.o;
      inp = `<select name="${f.k}" ${f.attrs || ''}>${opts.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
    } else if (f.t === 'textarea') inp = `<textarea name="${f.k}" placeholder="${esc(f.ph || '')}" ${f.attrs || ''}>${esc(val)}</textarea>`;
    else if (f.t === 'check') return `<label class="chk ${f.full ? 'full' : ''}"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''}> ${f.l}</label>`;
    else inp = `<input name="${f.k}" type="${f.t || 'text'}" value="${esc(val)}" placeholder="${esc(f.ph || '')}" ${f.t === 'number' ? 'step="any"' : ''} ${f.list ? `list="${f.list}"` : ''} ${f.attrs || ''}>`;
    return `<div class="fld ${f.full ? 'full' : ''}"><label class="f">${f.l}${f.req ? ' <span class="bad-t">*</span>' : ''}</label>${inp}</div>`;
  }).join('') + '</div>';
}
function readForm(root, fields) {
  const o = {};
  for (const f of fields) {
    if (!f.k || f.t === 'html') continue;
    const el = $(`[name="${f.k}"]`, root); if (!el) continue;
    o[f.k] = f.t === 'check' ? el.checked : f.t === 'number' ? num(el.value) : el.value.trim();
    if (f.req && (o[f.k] === '' || (f.t === 'number' && el.value === ''))) { toast(`من فضلك أدخل: ${f.l}`, 'warn'); el.focus(); throw new Error('req'); }
  }
  return o;
}
const opts = (arr, key = 'id', lbl = 'name', blank) => () => [...(blank !== undefined ? [['', blank]] : []), ...arr().map(x => [x[key], x[lbl]])];

/* -------- منشئ الجداول -------- */
// cols: [{l, k | f:(row)=>html, cls, sum:true|fn, money:true}]
function tableHTML(cols, rows, { empty = 'لا توجد بيانات', foot = false, limit = 0 } = {}) {
  if (!rows.length) return `<div class="tbl-wrap"><div class="empty">${empty}</div></div>`;
  const shown = limit ? rows.slice(0, limit) : rows;
  const cell = (c, r) => { let v = c.f ? c.f(r) : esc(r[c.k]); if (c.money) v = fmt(c.f ? c.f(r) : r[c.k]); return `<td class="${c.cls || ''}">${v ?? ''}</td>`; };
  let ft = '';
  if (foot) ft = '<tfoot><tr>' + cols.map((c, i) => `<td>${c.sum ? fmt(sum(rows, r => typeof c.sum === 'function' ? c.sum(r) : (c.f ? c.f(r) : r[c.k]))) : i === 0 ? 'الإجمالي (' + rows.length + ')' : ''}</td>`).join('') + '</tr></tfoot>';
  return `<div class="tbl-wrap"><table class="t"><thead><tr>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr></thead><tbody>${shown.map(r => `<tr data-id="${esc(r.id)}">${cols.map(c => cell(c, r)).join('')}</tr>`).join('')}</tbody>${ft}</table>${limit && rows.length > limit ? `<div class="empty">معروض ${limit} من ${rows.length} — استخدم البحث أو الفلاتر</div>` : ''}</div>`;
}
function toCSV(cols, rows) {
  const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/"/g, '""');
  const lines = [cols.map(c => `"${strip(c.l)}"`).join(',')];
  rows.forEach(r => lines.push(cols.map(c => `"${strip(c.money ? r2(c.f ? c.f(r) : r[c.k]) : c.f ? c.f(r) : r[c.k])}"`).join(',')));
  return '﻿' + lines.join('\r\n');
}
async function exportCSV(name, cols, rows) { const p = await api.dialog.saveText(name + '_' + today() + '.csv', toCSV(cols, rows)); if (p) toast('تم التصدير ✔', 'ok'); }

/* -------- الطباعة -------- */
function printShell(inner, size = DB.settings.receiptSize) {
  const w = size === 'A4' ? '190mm' : size === '58mm' ? '54mm' : '76mm';
  const fs = size === 'A4' ? '13px' : size === '58mm' ? '10.5px' : '12px';
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@page{size:${size === 'A4' ? 'A4' : size + ' auto'};margin:${size === 'A4' ? '10mm' : '2mm'}}
body{font-family:Tahoma,Arial,sans-serif;font-size:${fs};color:#000;margin:0}
.w{width:${w};margin:auto}.c{text-align:center}.b{font-weight:bold}.lg{font-size:1.4em}.sm{font-size:.85em}
table{width:100%;border-collapse:collapse}th,td{padding:3px 2px;text-align:right;border-bottom:1px dashed #999;font-size:inherit}
th{border-bottom:1px solid #000}.tot td{border:0;padding:2px}.hr{border-top:1px dashed #000;margin:5px 0}
.box{border:1px solid #000;padding:5px;margin:4px 0;border-radius:4px}.ltr{direction:ltr;unicode-bidi:plaintext}
img.logo{max-width:60%;max-height:70px}svg{max-width:100%}
.a4 th,.a4 td{border:1px solid #444;padding:5px}.a4 th{background:#eee}
</style></head><body><div class="w">${inner}</div></body></html>`;
}
function shopHeader() {
  const s = DB.settings;
  return `<div class="c">${s.showLogoOnReceipt && s.logo ? `<img class="logo" src="${s.logo}"><br>` : ''}<div class="b lg">${esc(s.shopName)}</div>
  ${s.shopAddress ? `<div class="sm">${esc(s.shopAddress)}</div>` : ''}${s.shopPhone ? `<div class="sm ltr">${esc(s.shopPhone)} ${esc(s.shopPhone2 || '')}</div>` : ''}${s.taxNo ? `<div class="sm">رقم ضريبي: ${esc(s.taxNo)}</div>` : ''}</div><div class="hr"></div>`;
}
const devFooter = () => `<div class="hr"></div><div class="c sm">برنامج غاندي — م. محمد علي ${DEV.phone}</div>`;
async function printDoc(inner, size, copies) {
  const html = printShell(inner, size);
  const s = DB.settings;
  if (api.printHtml) { const r = await api.printHtml(html, { silent: s.silentPrint && !!s.printer, printer: s.printer, copies: copies || 1 }); if (r && !r.ok && r.err && r.err !== 'cancelled') toast('الطباعة: ' + r.err, 'warn'); return; }
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
  document.body.appendChild(f); f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
}
async function savePDF(inner, name, size = 'A4') { if (api.printPdf) await api.printPdf(printShell(inner, size), name); else printDoc(inner, size); }
function waLink(phone, text) {
  let p = String(phone || '').replace(/\D/g, ''); if (!p) return toast('لا يوجد رقم هاتف', 'warn');
  if (p.startsWith('0')) p = '2' + p; else if (p.length === 10 && p.startsWith('1')) p = '20' + p;
  api.openExternal(`https://wa.me/${p}?text=${encodeURIComponent(text)}`);
}
const tpl = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => o[k] ?? '');

/* -------- رسم بياني بسيط -------- */
function barChart(labels, series, { h = 220, colors = ['#0ea5e9', '#16a34a', '#f59e0b', '#7c3aed'] } = {}) {
  const W = 760, H = h, pl = 50, pb = 28, pt = 10;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const n = labels.length, gw = (W - pl - 10) / Math.max(1, n), bw = Math.max(3, (gw - 6) / series.length);
  let g = '';
  for (let i = 0; i <= 4; i++) { const y = pt + (H - pt - pb) * i / 4; g += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".1"/><text x="${pl - 6}" y="${y + 4}" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">${fmt(max * (1 - i / 4))}</text>`; }
  labels.forEach((l, i) => {
    series.forEach((s, j) => { const v = s.values[i] || 0, bh = (H - pt - pb) * v / max; g += `<rect x="${pl + i * gw + 3 + j * bw}" y="${H - pb - bh}" width="${bw - 1}" height="${bh}" rx="2" fill="${colors[j % colors.length]}"><title>${esc(s.name)}: ${fmt(v)}</title></rect>`; });
    if (n <= 16 || i % Math.ceil(n / 16) === 0) g += `<text x="${pl + i * gw + gw / 2}" y="${H - 8}" font-size="10" text-anchor="middle" fill="currentColor" opacity=".7">${esc(l)}</text>`;
  });
  const legend = series.map((s, j) => `<span class="tag" style="border-color:${colors[j]}"><span style="color:${colors[j]}">■</span> ${esc(s.name)}</span>`).join(' ');
  return `<div>${legend}</div><svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none" style="direction:ltr">${g}</svg>`;
}
