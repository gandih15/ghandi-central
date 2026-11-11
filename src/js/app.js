/* غاندي — السنترالات | التشغيل، التفعيل، الدخول، القائمة */
'use strict';
const Pages = {};
let INFO = {}, LIC = {}, currentPage = null;
const PAGE_PERM = { limits: 'finops' };

const NAV = [
  ['الرئيسية', [['dashboard', '📊', 'لوحة التحكم'], ['pos', '🛒', 'نقطة البيع'], ['finops', '💸', 'كاش ورصيد وفواتير'], ['limits', '📶', 'متابعة ليمت المحافظ']]],
  ['الصيانة', [['repairs', '🔧', 'تذاكر الصيانة'], ['imei', '🔍', 'بحث IMEI / سيريال']]],
  ['المبيعات', [['sales', '🧾', 'فواتير البيع'], ['returns', '↩️', 'المرتجعات'], ['installments', '📅', 'الأقساط'], ['reservations', '📌', 'الحجوزات والطلبات'], ['customers', '👥', 'العملاء']]],
  ['المخزون', [['items', '📦', 'الأصناف والمخزون'], ['purchases', '🚚', 'المشتريات'], ['used', '📱', 'شراء مستعمل'], ['suppliers', '🏭', 'الموردين'], ['labels', '🏷️', 'طباعة باركود']]],
  ['الحسابات', [['accounts', '🏦', 'الخزن والمحافظ'], ['expenses', '💰', 'المصروفات والإيرادات'], ['shifts', '⏱️', 'الورديات'], ['employees', '🧑‍🔧', 'الموظفين والرواتب'], ['reports', '📈', 'التقارير']]],
  ['النظام', [['users', '🔐', 'المستخدمين والصلاحيات'], ['settings', '⚙️', 'الإعدادات'], ['backup', '💾', 'النسخ الاحتياطي'], ['audit', '📜', 'سجل العمليات'], ['about', 'ℹ️', 'عن البرنامج']]]
];

async function boot() {
  INFO = await api.info();
  await loadDB();
  applyTheme();
  api.onBeforeClose(async () => { try { await saveNow(); await doBackup('close', true); } catch (e) { } api.closeNow(); });
  LIC = await api.license.status();
  if (!LIC.ok) showActivation(); else showLogin();
}
function applyTheme() { document.body.classList.toggle('dark', DB.settings.theme === 'dark'); }

/* ---------- التفعيل ---------- */
function showActivation() {
  $('#gate').classList.remove('hidden');
  $('#gate').innerHTML = `<div class="card">
    <div class="logo"><img src="logo.png"><div><h1>تفعيل نظام غاندي</h1><div class="sub">إدارة السنترالات ومحلات الموبايل والصيانة</div></div></div>
    <div class="alert ${LIC.clock ? 'bad' : 'warn'}">⚠️ ${esc(LIC.reason || 'البرنامج غير مفعل')}</div>
    <label class="f">بصمة هذا الجهاز — ابعتها للمطور</label>
    <div class="fp" id="fpv">${esc(LIC.fingerprint || INFO.fingerprint)}</div>
    <div class="row"><button class="btn ghost sp" id="cpfp">📋 نسخ البصمة</button><button class="btn ok sp" id="wafp">💬 إرسال واتساب للمطور</button></div>
    <label class="f mt">مفتاح التفعيل</label><textarea id="lickey" class="ltr" style="height:80px" placeholder="GC1...."></textarea>
    <button class="btn lg mt" style="width:100%" id="actbtn">🔓 تفعيل</button>
    <div class="dev">للتفعيل تواصل مع المطور: ${DEV.name} — <b class="ltr">${DEV.phone}</b><br><a href="#" id="devlogin">دخول المطور</a></div></div>`;
  $('#cpfp').onclick = () => { navigator.clipboard.writeText(LIC.fingerprint || INFO.fingerprint); toast('تم نسخ البصمة', 'ok'); };
  $('#wafp').onclick = () => waLink(DEV.phone, `طلب تفعيل نظام غاندي للسنترالات\nاسم المحل: ${DB.settings.shopName}\nالبصمة: ${LIC.fingerprint || INFO.fingerprint}`);
  $('#actbtn').onclick = async () => {
    const r = await api.license.activate($('#lickey').value);
    if (r.ok) { LIC = r; toast('تم التفعيل بنجاح ✔', 'ok'); audit('تفعيل البرنامج', 'ينتهي: ' + r.data.exp); showLogin(); }
    else toast(r.reason, 'bad');
  };
  $('#devlogin').onclick = e => { e.preventDefault(); showLogin(true); };
}

/* ---------- تسجيل الدخول ---------- */
function showLogin(devOnly = false) {
  $('#app').classList.add('hidden');
  $('#gate').classList.remove('hidden');
  const s = DB.settings;
  $('#gate').innerHTML = `<div class="card">
    <div class="logo"><img src="${s.logo || 'logo.png'}"><div><h1>${esc(s.shopName)}</h1><div class="sub">نظام غاندي لإدارة السنترالات ومحلات الموبايل</div></div></div>
    ${devOnly ? '<div class="alert warn">دخول المطور فقط — البرنامج غير مفعل</div>' : ''}
    <label class="f">اسم المستخدم</label><input id="lu" autocomplete="off" value="${devOnly ? 'gandy' : ''}">
    <label class="f mt">كلمة المرور</label><input id="lp" type="password">
    <button class="btn lg mt" style="width:100%" id="lbtn">دخول</button>
    ${devOnly ? '<button class="btn ghost mt" style="width:100%" id="lback">رجوع للتفعيل</button>' : ''}
    <div class="dev">${LIC.ok ? (LIC.data.exp === 'LIFE' ? 'ترخيص مدى الحياة' : 'الترخيص ساري حتى ' + fmtDate(LIC.data.exp)) : ''}<br>برمجة ${DEV.name} — <span class="ltr">${DEV.phone}</span></div></div>`;
  const go = async () => {
    const u = $('#lu').value.trim(), p = $('#lp').value;
    if (u === DEV.user) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('GHANDI-CENTRAL|' + u + '|' + p));
      if ([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') === DEV.hash) {
        SESSION = { isDev: true, user: { id: 'dev', name: 'المطور', role: 'admin', perms: [] } };
        audit('دخول المطور');
        return LIC.ok ? enterApp('dev') : devPanel(true);
      }
      return toast('بيانات الدخول غير صحيحة', 'bad');
    }
    if (devOnly || !LIC.ok) return toast('البرنامج غير مفعل', 'bad');
    const user = DB.users.find(x => x.username.toLowerCase() === u.toLowerCase());
    if (!user || !user.active) return toast('بيانات الدخول غير صحيحة', 'bad');
    if (user.lockedUntil && user.lockedUntil > Date.now()) return toast('الحساب مقفول مؤقتاً بسبب محاولات خاطئة', 'bad');
    if (await api.hash(p, user.salt) !== user.hash) {
      user.fails = (user.fails || 0) + 1; if (user.fails >= 5) { user.lockedUntil = Date.now() + 5 * 60000; user.fails = 0; }
      save(); return toast('بيانات الدخول غير صحيحة', 'bad');
    }
    user.fails = 0; user.lastLogin = nowISO(); SESSION = { user, isDev: false };
    audit('تسجيل دخول');
    enterApp();
    if (user.mustChange) setTimeout(() => { toast('يفضل تغيير كلمة المرور الافتراضية', 'warn'); changeMyPassword(); }, 600);
  };
  $('#lbtn').onclick = go;
  $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#lu').onkeydown = e => { if (e.key === 'Enter') $('#lp').focus(); };
  if ($('#lback')) $('#lback').onclick = showActivation;
  setTimeout(() => $(devOnly ? '#lp' : '#lu').focus(), 50);
}
async function changeMyPassword() {
  if (SESSION.isDev) return toast('كلمة مرور المطور ثابتة', 'warn');
  modal({
    title: 'تغيير كلمة المرور', body: formHTML([{ k: 'old', l: 'كلمة المرور الحالية', t: 'password' }, { k: 'n1', l: 'الجديدة', t: 'password' }, { k: 'n2', l: 'تأكيد الجديدة', t: 'password' }], {}, 1),
    buttons: [{
      text: 'حفظ', click: async o => {
        const u = SESSION.user, old = $('[name=old]', o).value, n1 = $('[name=n1]', o).value, n2 = $('[name=n2]', o).value;
        if (await api.hash(old, u.salt) !== u.hash) { toast('كلمة المرور الحالية خطأ', 'bad'); return false; }
        if (n1.length < 4 || n1 !== n2) { toast('كلمة المرور الجديدة قصيرة أو غير متطابقة', 'bad'); return false; }
        u.salt = uid(); u.hash = await api.hash(n1, u.salt); u.mustChange = false; audit('تغيير كلمة المرور'); await saveNow(); toast('تم ✔', 'ok');
      }
    }, { text: 'إلغاء', cls: 'ghost' }]
  });
}

/* ---------- لوحة المطور ---------- */
function devPanel(standalone = false) {
  const lic = LIC.ok ? LIC.data : null;
  const body = `<div class="grid g2">
    <div class="card"><h3>🔑 الترخيص</h3>
      <div class="sum-row"><span>البصمة</span><b class="ltr">${esc(INFO.fingerprint)}</b></div>
      <div class="sum-row"><span>الحالة</span><b>${LIC.ok ? '<span class="tag ok">مفعل</span>' : '<span class="tag bad">' + esc(LIC.reason || 'غير مفعل') + '</span>'}</b></div>
      ${lic ? `<div class="sum-row"><span>ينتهي</span><b>${lic.exp === 'LIFE' ? 'مدى الحياة' : fmtDate(lic.exp)}</b></div><div class="sum-row"><span>المحل في المفتاح</span><b>${esc(lic.shop)}</b></div><div class="sum-row"><span>تاريخ الإصدار</span><b>${fmtDate(lic.iat)}</b></div>` : ''}
      <label class="f mt">إدخال مفتاح جديد (تجديد / مد المدة)</label><textarea id="dkey" class="ltr"></textarea>
      <div class="row mt"><button class="btn ok" id="dact">تفعيل المفتاح</button><button class="btn bad" id="dunlic">إلغاء تفعيل الجهاز</button></div>
    </div>
    <div class="card"><h3>🛠️ أدوات المطور</h3>
      <div class="sum-row"><span>إصدار البرنامج</span><b>${esc(INFO.version)}</b></div>
      <div class="sum-row"><span>مسار البيانات</span><b class="ltr" style="font-size:11px">${esc(INFO.dataPath)}</b></div>
      <div class="sum-row"><span>عدد المستخدمين</span><b>${DB.users.length}</b></div>
      <div class="sum-row"><span>عدد الفواتير</span><b>${DB.sales.length}</b></div>
      <div class="row mt"><button class="btn warn" id="dreset">إعادة تعيين باسورد الأدمن إلى 1234</button>
      <button class="btn ghost" id="dunlock">فك قفل كل المستخدمين</button></div>
      <div class="row mt"><button class="btn bad" id="dwipe">مسح كل البيانات (تسليم جديد)</button></div>
      ${standalone ? '<div class="row mt"><button class="btn ghost" id="dout">خروج</button></div>' : ''}
    </div></div>`;
  const o = modal({ title: '👨‍💻 لوحة المطور — ' + DEV.name, body, wide: true });
  $('#dact', o).onclick = async () => { const r = await api.license.activate($('#dkey', o).value); if (r.ok) { LIC = r; toast('تم التفعيل ✔', 'ok'); o.close(); if (standalone) showLogin(); else devPanel(); } else toast(r.reason, 'bad'); };
  $('#dunlic', o).onclick = async () => { if (await confirmBox('إلغاء تفعيل هذا الجهاز؟')) { await api.license.remove(); LIC = await api.license.status(); o.close(); audit('إلغاء التفعيل (المطور)'); logout(); } };
  $('#dreset', o).onclick = async () => { const a = DB.users.find(u => u.owner) || DB.users.find(u => u.role === 'admin'); a.salt = uid(); a.hash = await api.hash('1234', a.salt); a.active = true; a.lockedUntil = 0; a.mustChange = true; audit('إعادة تعيين باسورد الأدمن (المطور)'); await saveNow(); toast('تم: admin / 1234', 'ok'); };
  $('#dunlock', o).onclick = () => { DB.users.forEach(u => { u.lockedUntil = 0; u.fails = 0; }); save(); toast('تم', 'ok'); };
  $('#dwipe', o).onclick = async () => {
    if (!(await confirmBox('سيتم مسح كل البيانات نهائياً (مع عمل نسخة احتياطية أولاً). متأكد؟'))) return;
    if ((await promptBox('تأكيد نهائي', 'اكتب كلمة: مسح')) !== 'مسح') return;
    await doBackup('before-wipe', true); DB = defaultDB(); await loadDB(); await saveNow(); toast('تم مسح البيانات', 'ok'); o.close(); logout();
  };
  if ($('#dout', o)) $('#dout', o).onclick = () => { o.close(); SESSION = null; showActivation(); };
}

/* ---------- التطبيق ---------- */
function enterApp() {
  $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
  renderSide();
  const first = NAV.flatMap(g => g[1]).find(([k]) => k === 'about' || can(k));
  go(can('dashboard') ? 'dashboard' : first[0]);
  startTimers();
  if (LIC.ok && LIC.data.exp !== 'LIFE') { const d = daysBetween(today(), LIC.data.exp); if (d <= 10) toast(`تنبيه: الترخيص ينتهي بعد ${d} يوم — كلم المطور ${DEV.phone}`, 'warn'); }
}
function renderSide() {
  const s = DB.settings;
  $('#side .brand').innerHTML = `<img src="${s.logo || 'logo.png'}"><div><b>${esc(s.shopName)}</b><small>غاندي للسنترالات</small></div>`;
  $('#nav').innerHTML = NAV.map(([g, items]) => {
    const vis = items.filter(([k]) => k === 'about' || can(PAGE_PERM[k] || k));
    return vis.length ? `<div class="grp">${g}</div>` + vis.map(([k, ic, l]) => `<a data-p="${k}"><i>${ic}</i><span>${l}</span>${badgeFor(k)}</a>`).join('') : '';
  }).join('');
  $$('#nav a').forEach(a => a.onclick = () => go(a.dataset.p));
  $('#side .foot').innerHTML = `برمجة ${DEV.name}<br><span class="ltr">${DEV.phone}</span>`;
  $('#who').textContent = me() + (SESSION.isDev ? ' (مطور)' : '');
  $('#btnDev').classList.toggle('hidden', !SESSION.isDev);
  if (currentPage) $$('#nav a').forEach(a => a.classList.toggle('act', a.dataset.p === currentPage));
}
function badgeFor(k) {
  let n = 0;
  if (k === 'repairs') n = DB.repairs.filter(r => r.status === 'ready').length;
  if (k === 'items') n = lowStock().length;
  if (k === 'installments') n = overdueInstallments().length;
  if (k === 'reservations') n = DB.reservations.filter(r => r.status === 'open').length;
  return n ? `<span class="badge">${n}</span>` : '';
}
function go(page, arg) {
  if (page !== 'about' && !can(PAGE_PERM[page] || page)) return toast('ليس لديك صلاحية', 'bad');
  if (!Pages[page]) return toast('الصفحة غير موجودة', 'bad');
  currentPage = page;
  $$('#nav a').forEach(a => a.classList.toggle('act', a.dataset.p === page));
  const title = NAV.flatMap(g => g[1]).find(x => x[0] === page);
  $('#ptitle').textContent = title ? title[1] + ' ' + title[2] : '';
  const el = $('#page'); el.innerHTML = ''; el.scrollTop = 0;
  try { Pages[page](el, arg); } catch (e) { console.error(e); el.innerHTML = `<div class="alert bad">خطأ: ${esc(e.message)}</div>`; }
}
const refresh = () => { renderSide(); go(currentPage); };
function logout() { audit('تسجيل خروج'); SESSION = null; saveNow(); showLogin(); }

/* ---------- مؤقتات: نسخ احتياطي تلقائي وقفل ---------- */
let timersStarted = false, lastAct = Date.now();
function startTimers() {
  if (timersStarted) return; timersStarted = true;
  ['mousemove', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, () => lastAct = Date.now()));
  setInterval(() => {
    const m = num(DB.settings.lockMinutes);
    if (SESSION && m > 0 && Date.now() - lastAct > m * 60000 && !$('.lock')) lockScreen();
  }, 20000);
  setInterval(() => doBackup('auto', true), Math.max(1, num(DB.settings.backupEveryHours) || 4) * 3600000);
  setTimeout(() => doBackup('open', true), 60000);
}
function lockScreen() {
  const d = document.createElement('div'); d.className = 'lock';
  d.innerHTML = `<div class="card" style="width:340px"><h3>🔒 الشاشة مقفولة</h3><p class="muted">${esc(me())}</p><input type="password" id="unl" placeholder="كلمة المرور"><button class="btn mt" style="width:100%" id="unb">فتح</button><button class="btn ghost mt" style="width:100%" id="unx">تسجيل خروج</button></div>`;
  document.body.appendChild(d);
  const tryU = async () => {
    const p = $('#unl', d).value;
    let ok = false;
    if (SESSION.isDev) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('GHANDI-CENTRAL|gandy|' + p)); ok = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') === DEV.hash; }
    else ok = await api.hash(p, SESSION.user.salt) === SESSION.user.hash;
    if (ok) { d.remove(); lastAct = Date.now(); } else toast('خطأ', 'bad');
  };
  $('#unb', d).onclick = tryU; $('#unl', d).onkeydown = e => e.key === 'Enter' && tryU(); $('#unx', d).onclick = () => { d.remove(); logout(); };
  $('#unl', d).focus();
}
async function doBackup(reason = '', quiet = false) {
  await saveNow();
  const r = await api.backup.now(DB.settings.backupPaths, num(DB.settings.backupKeep) || 60, reason);
  DB.meta.lastBackup = nowISO();
  if (!quiet) { const bad = r.filter(x => !x.ok); toast(bad.length ? 'فشل النسخ في: ' + bad.map(b => b.path).join('، ') : `تم النسخ الاحتياطي في ${r.length} مكان ✔`, bad.length ? 'warn' : 'ok'); }
  return r;
}

/* ---------- اختصارات ---------- */
document.addEventListener('keydown', e => {
  if (!SESSION || $('.ovl') || $('.lock')) return;
  const map = { F1: 'pos', F3: 'repairs', F4: 'finops', F5: 'limits', F6: 'items', F7: 'customers', F8: 'reports' };
  if (map[e.key] && can(map[e.key])) { e.preventDefault(); go(map[e.key]); }
});
window.addEventListener('DOMContentLoaded', () => {
  $('#btnLogout').onclick = logout;
  $('#btnLock').onclick = lockScreen;
  $('#btnPass').onclick = changeMyPassword;
  $('#btnTheme').onclick = () => { DB.settings.theme = DB.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); };
  $('#btnDev').onclick = () => SESSION?.isDev ? devPanel() : toast('للمطور فقط', 'warn');
  $('#btnBackup').onclick = () => doBackup('manual');
  boot().catch(e => { document.body.innerHTML = '<pre style="padding:20px;color:red">' + esc(e.stack) + '</pre>'; });
});
