/* المستخدمين والصلاحيات + الإعدادات + النسخ الاحتياطي + السجل + عن البرنامج */
'use strict';
Pages.users = el => {
  const draw = () => {
    el.innerHTML = `<div class="row mb"><button class="btn" id="uadd">➕ مستخدم جديد</button><span class="muted">المدير (الأدمن) يتحكم في صلاحيات كل المستخدمين، والمطور يتحكم في الكل.</span></div>` +
      tableHTML([{ l: 'اسم الدخول', f: u => `<b class="ltr">${esc(u.username)}</b>` }, { l: 'الاسم', k: 'name' }, { l: 'الدور', f: u => u.role === 'admin' ? `<span class="tag vio">مدير${u.owner ? ' (المالك)' : ''}</span>` : '<span class="tag">مستخدم</span>' },
        { l: 'الصلاحيات', f: u => u.role === 'admin' ? 'كل الصلاحيات' : (u.perms || []).length + ' صلاحية' }, { l: 'آخر دخول', f: u => fmtDT(u.lastLogin) }, { l: 'الحالة', f: u => u.active ? '<span class="tag ok">نشط</span>' : '<span class="tag bad">موقوف</span>' },
        { l: '', f: u => `<button class="btn sm ghost" data-e="${u.id}">✏️ تعديل</button>` }], DB.users);
    $('#uadd').onclick = () => userForm(null, draw);
    $$('[data-e]', el).forEach(b => b.onclick = () => userForm(find('users', b.dataset.e), draw));
  };
  draw();
};
function userForm(u, cb) {
  const F = [{ k: 'username', l: 'اسم الدخول', req: true }, { k: 'name', l: 'الاسم', req: true }, { k: 'password', l: u ? 'كلمة مرور جديدة (اتركها فاضية للإبقاء)' : 'كلمة المرور', t: 'password', req: !u }, { k: 'role', l: 'الدور', t: 'select', o: [['user', 'مستخدم (حسب الصلاحيات)'], ['admin', 'مدير (كل الصلاحيات)']] }, { k: 'active', l: 'نشط', t: 'check', d: true }];
  const presets = { cashier: ['dashboard', 'pos', 'sales', 'customers', 'finops', 'returns', 'imei', 'shifts', 'reservations'], tech: ['repairs', 'imei', 'items', 'customers'], manager: PERMS.map(p => p[0]).filter(p => !['users', 'settings', 'backup', 'audit'].includes(p)) };
  const o = modal({ title: u ? 'تعديل مستخدم' : 'مستخدم جديد', xwide: true, body: formHTML(F, u || { role: 'user', active: true }, 3) +
    `<h3 class="mt">الصلاحيات</h3><div class="row mb"><button class="btn sm ghost" data-pre="cashier">قالب: كاشير</button><button class="btn sm ghost" data-pre="tech">قالب: فني صيانة</button><button class="btn sm ghost" data-pre="manager">قالب: مشرف</button><button class="btn sm ghost" data-pre="all">تحديد الكل</button><button class="btn sm ghost" data-pre="none">إلغاء الكل</button></div>
    <div class="perm-grid">${PERMS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-perm="${k}" ${(u?.perms || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>`,
    buttons: [{ text: 'حفظ', click: async o => {
      const d = readForm(o, F);
      if (DB.users.some(x => x.username.toLowerCase() === d.username.toLowerCase() && x !== u) || d.username === DEV.user) { toast('اسم الدخول مستخدم', 'bad'); return false; }
      if (u?.owner && (d.role !== 'admin' || !d.active)) { toast('لا يمكن إيقاف أو تخفيض حساب المالك', 'bad'); return false; }
      const perms = $$('[data-perm]', o).filter(c => c.checked).map(c => c.dataset.perm);
      const t = u || { id: uid(), created: nowISO() };
      Object.assign(t, { username: d.username, name: d.name, role: d.role, active: d.active, perms });
      if (d.password) { t.salt = uid(); t.hash = await api.hash(d.password, t.salt); t.mustChange = false; }
      if (!u) DB.users.push(t);
      audit(u ? 'تعديل مستخدم' : 'إضافة مستخدم', d.username); await saveNow(); cb && cb(); if (SESSION.user.id === t.id) renderSide();
    } }, ...(u && !u.owner ? [{ text: '🗑️ حذف', cls: 'bad', click: async () => { if (!(await confirmBox('حذف المستخدم؟'))) return false; DB.users.splice(DB.users.indexOf(u), 1); audit('حذف مستخدم', u.username); save(); cb && cb(); } }] : []), { text: 'إلغاء', cls: 'ghost' }] });
  $$('[data-pre]', o).forEach(b => b.onclick = () => { const p = b.dataset.pre; $$('[data-perm]', o).forEach(c => c.checked = p === 'all' ? true : p === 'none' ? false : presets[p].includes(c.dataset.perm)); });
}

Pages.settings = el => {
  const s = DB.settings;
  const TABS = {
    shop: ['بيانات المحل', [{ k: 'shopName', l: 'اسم المحل', req: true }, { k: 'shopPhone', l: 'تليفون 1' }, { k: 'shopPhone2', l: 'تليفون 2' }, { k: 'shopAddress', l: 'العنوان', full: true }, { k: 'taxNo', l: 'الرقم الضريبي / السجل' }, { k: 'currency', l: 'العملة' }]],
    print: ['الطباعة', [{ k: 'receiptSize', l: 'مقاس الإيصال', t: 'select', o: [['80mm', 'حراري 80 مم'], ['58mm', 'حراري 58 مم'], ['A4', 'A4']] }, { k: 'printer', l: 'طابعة الإيصالات', t: 'select', o: [['', 'الافتراضية']] }, { k: 'labelPrinter', l: 'طابعة الباركود', t: 'select', o: [['', 'نفس طابعة الإيصالات']] },
      { k: 'receiptCopies', l: 'عدد النسخ', t: 'number' }, { k: 'autoPrint', l: 'طباعة الفاتورة تلقائياً بعد البيع', t: 'check' }, { k: 'silentPrint', l: 'طباعة مباشرة بدون نافذة (يحتاج تحديد الطابعة)', t: 'check' }, { k: 'showLogoOnReceipt', l: 'إظهار اللوجو في الإيصال', t: 'check' }, { k: 'receiptFooter', l: 'تذييل الفاتورة', t: 'textarea', full: true }]],
    sell: ['البيع والمخزون', [{ k: 'allowNegativeStock', l: 'السماح بالبيع بالسالب (بدون رصيد)', t: 'check' }, { k: 'allowBelowCost', l: 'السماح للمستخدمين بالبيع أقل من التكلفة', t: 'check' }, { k: 'requireShift', l: 'لازم فتح وردية قبل البيع', t: 'check' }, { k: 'requireCustomerForCredit', l: 'لازم اختيار عميل للبيع الآجل', t: 'check' },
      { k: 'lowStockDefault', l: 'حد الطلب الافتراضي', t: 'number' }, { k: 'defaultInterest', l: 'نسبة زيادة التقسيط الافتراضية %', t: 'number' }, { k: 'installmentLateFee', l: 'غرامة تأخير القسط', t: 'number' }]],
    repair: ['الصيانة', [{ k: 'defaultWarranty', l: 'ضمان الإصلاح الافتراضي (أيام)', t: 'number' }, { k: 'repairTerms', l: 'شروط إيصال الصيانة', t: 'textarea', full: true }, { k: 'repairFaultsTxt', l: 'الأعطال السريعة (افصل بفاصلة)', t: 'textarea', full: true }, { k: 'deviceBrandsTxt', l: 'الماركات (افصل بفاصلة)', t: 'textarea', full: true }]],
    wa: ['رسائل واتساب', [{ k: 'whatsappReady', l: 'رسالة الجهاز جاهز — {name} {device} {shop} {due} {no}', t: 'textarea', full: true }, { k: 'whatsappInstallment', l: 'رسالة تذكير القسط — {name} {n} {amount} {date} {shop}', t: 'textarea', full: true }]],
    sec: ['الأمان', [{ k: 'lockMinutes', l: 'قفل الشاشة تلقائياً بعد (دقائق، 0 = بدون)', t: 'number' }, { k: 'theme', l: 'المظهر', t: 'select', o: [['light', 'فاتح'], ['dark', 'داكن']] }]]
  };
  let tab = 'shop';
  const v = { ...s, repairFaultsTxt: s.repairFaults.join('، '), deviceBrandsTxt: s.deviceBrands.join('، ') };
  const draw = async () => {
    const F = TABS[tab][1];
    if (tab === 'print') { const ps = await api.printers(); const po = [['', 'الافتراضية'], ...ps.map(p => [p.name, p.displayName || p.name])]; F[1].o = po; F[2].o = [['', 'نفس طابعة الإيصالات'], ...ps.map(p => [p.name, p.displayName || p.name])]; }
    el.innerHTML = `<div class="tabs">${Object.entries(TABS).map(([k, t]) => `<button class="${k === tab ? 'act' : ''}" data-t="${k}">${t[0]}</button>`).join('')}</div><div class="card" style="max-width:900px">${formHTML(F, v, 2)}
      ${tab === 'shop' ? `<div class="row mt"><img src="${s.logo || 'logo.png'}" style="width:80px;height:80px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff"><button class="btn ghost" id="slogo">🖼️ اختيار لوجو</button><button class="btn ghost" id="snologo">إزالة</button></div>` : ''}
      ${tab === 'print' ? '<div class="row mt"><button class="btn ghost" id="stest">🖨️ طباعة تجربة</button></div>' : ''}
      <div class="row mt"><button class="btn ok" id="ssave">💾 حفظ الإعدادات</button></div></div>`;
    $$('.tabs button', el).forEach(b => b.onclick = () => { collect(); tab = b.dataset.t; draw(); });
    $('#ssave').onclick = () => { collect(); Object.assign(s, v); s.repairFaults = v.repairFaultsTxt.split(/[،,]/).map(x => x.trim()).filter(Boolean); s.deviceBrands = v.deviceBrandsTxt.split(/[،,]/).map(x => x.trim()).filter(Boolean); delete s.repairFaultsTxt; delete s.deviceBrandsTxt; applyTheme(); audit('تعديل الإعدادات'); saveNow(); renderSide(); toast('تم الحفظ ✔', 'ok'); };
    if ($('#slogo')) $('#slogo').onclick = async () => { const img = await api.dialog.openImage(); if (img) { s.logo = await shrinkImage(img, 300); save(); renderSide(); draw(); } };
    if ($('#snologo')) $('#snologo').onclick = () => { s.logo = ''; save(); renderSide(); draw(); };
    if ($('#stest')) $('#stest').onclick = () => { collect(); Object.assign(s, v); printDoc(`${shopHeader()}<div class="c b lg">طباعة تجريبية ✔</div><div class="c">${barcodeSVG('123456789', {})}</div>${devFooter()}`); };
  };
  const collect = () => { try { Object.assign(v, readForm(el, TABS[tab][1])); } catch (e) { } };
  draw();
};
function shrinkImage(src, max) {
  return new Promise(res => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); }; im.onerror = () => res(src); im.src = src; });
}

Pages.backup = el => {
  const s = DB.settings;
  const draw = async () => {
    const list = await api.backup.list(s.backupPaths);
    el.innerHTML = `<div class="grid g2"><div class="card"><h3>📁 أماكن النسخ الاحتياطي</h3>
      <div class="alert pri">المكان الافتراضي (دايماً): <b class="ltr">${esc(INFO.defaultBackup)}</b></div>
      ${[0, 1, 2].map(i => `<label class="f mt">المكان ${i + 1} (يفضل فلاشة أو هارد تاني أو جوجل درايف)</label><div class="row"><input readonly class="ltr" value="${esc(s.backupPaths[i] || '')}" placeholder="غير محدد" style="flex:1"><button class="btn sm ghost" data-pick="${i}">اختيار</button><button class="btn sm ghost" data-clr="${i}">✕</button></div>`).join('')}
      <div class="grid g2 mt"><div><label class="f">نسخة تلقائية كل (ساعات)</label><input type="number" id="bevery" value="${s.backupEveryHours}"></div><div><label class="f">عدد النسخ المحفوظة في كل مكان</label><input type="number" id="bkeep" value="${s.backupKeep}"></div></div>
      <p class="muted">البرنامج بيعمل نسخة تلقائياً: عند الفتح، كل فترة، وعند القفل — في كل الأماكن.</p>
      <div class="row"><button class="btn ok" id="bsave">حفظ</button><button class="btn" id="bnow">💾 نسخة احتياطية الآن</button><button class="btn ghost" id="bopen">📂 فتح المجلد</button></div>
      <div class="muted mt">آخر نسخة: ${fmtDT(DB.meta.lastBackup) || 'لا يوجد'}</div></div>
      <div class="card"><h3>♻️ استرجاع نسخة</h3><button class="btn warn" id="bfile">📥 استرجاع من ملف...</button><p class="muted">قبل أي استرجاع بيتعمل نسخة من البيانات الحالية تلقائياً.</p>
      ${tableHTML([{ l: 'الوقت', f: b => fmtDT(b.time.replace('Z', '')) }, { l: 'المكان', f: b => `<small class="ltr">${esc(b.dir)}</small>` }, { l: 'الحجم', f: b => (b.size / 1024).toFixed(0) + ' KB' }, { l: '', f: b => `<button class="btn sm warn" data-r="${esc(b.file)}">استرجاع</button>` }], list.slice(0, 60).map((b, i) => ({ ...b, id: i })), { empty: 'لا توجد نسخ' })}</div></div>`;
    $$('[data-pick]', el).forEach(b => b.onclick = async () => { const d = await api.dialog.folder(); if (d) { s.backupPaths[+b.dataset.pick] = d; await saveNow(); draw(); } });
    $$('[data-clr]', el).forEach(b => b.onclick = async () => { s.backupPaths[+b.dataset.clr] = ''; await saveNow(); draw(); });
    $('#bsave').onclick = () => { s.backupEveryHours = Math.max(1, num($('#bevery').value)); s.backupKeep = Math.max(5, num($('#bkeep').value)); saveNow(); toast('تم — يطبق بعد إعادة الفتح', 'ok'); };
    $('#bnow').onclick = async () => { await doBackup('manual'); draw(); };
    $('#bopen').onclick = () => api.backup.openFolder();
    $('#bfile').onclick = async () => { const txt = await api.backup.pickFile(); if (txt) restoreFrom(txt); };
    $$('[data-r]', el).forEach(b => b.onclick = async () => restoreFrom(await api.backup.read(b.dataset.r)));
  };
  draw();
};
async function restoreFrom(txt) {
  let data; try { data = JSON.parse(txt); } catch (e) { return toast('ملف تالف', 'bad'); }
  if (!data.meta || !Array.isArray(data.items) || !Array.isArray(data.users)) return toast('الملف ليس نسخة من نظام غاندي للسنترالات', 'bad');
  if (!(await confirmBox(`استرجاع النسخة؟ (${data.sales.length} فاتورة، ${data.items.length} صنف) — البيانات الحالية هتتحفظ نسخة قبل الاستبدال.`, 'استرجاع', 'warn'))) return;
  await doBackup('before-restore', true);
  DB = data; migrate(); await saveNow(); audit('استرجاع نسخة احتياطية'); await saveNow();
  toast('تم الاسترجاع — جاري إعادة التشغيل', 'ok'); setTimeout(() => api.relaunch(), 1200);
}

Pages.audit = el => {
  let q = '', from = addDays(today(), -7), to = today();
  el.innerHTML = `<div class="row mb"><input id="aq" placeholder="بحث" style="flex:1"><input type="date" id="af" value="${from}" style="width:150px"><input type="date" id="at" value="${to}" style="width:150px"></div><div id="atbl"></div>`;
  const draw = () => $('#atbl').innerHTML = tableHTML([{ l: 'الوقت', f: a => fmtDT(a.date) }, { l: 'المستخدم', k: 'user' }, { l: 'العملية', k: 'action' }, { l: 'التفاصيل', k: 'details' }], DB.audit.filter(a => dOnly(a.date) >= from && dOnly(a.date) <= to && match(q, a.user, a.action, a.details)).slice().reverse(), { limit: 1000 });
  $('#aq').oninput = debounce(e => { q = e.target.value; draw(); }, 200); $('#af').onchange = e => { from = e.target.value; draw(); }; $('#at').onchange = e => { to = e.target.value; draw(); };
  draw();
};

Pages.about = el => {
  el.innerHTML = `<div class="card" style="max-width:720px;margin:auto;text-align:center"><img src="logo.png" style="width:96px;border-radius:20px"><h2>نظام غاندي لإدارة السنترالات ومحلات الموبايل</h2>
  <p class="muted">الإصدار ${esc(INFO.version)} — يعمل بدون إنترنت</p>
  <div class="alert pri" style="justify-content:center;font-size:16px">برمجة وتطوير: <b>${DEV.name}</b> — <b class="ltr">${DEV.phone}</b></div>
  <div class="grid g2" style="text-align:right"><div class="card"><h3>🔑 الترخيص</h3><div>البصمة: <b class="ltr">${esc(INFO.fingerprint)}</b></div><div>الحالة: ${LIC.ok ? '<span class="tag ok">مفعل</span>' : '<span class="tag bad">غير مفعل</span>'}</div><div>الانتهاء: ${LIC.ok ? (LIC.data.exp === 'LIFE' ? 'مدى الحياة' : fmtDate(LIC.data.exp)) : '-'}</div></div>
  <div class="card"><h3>⌨️ اختصارات</h3><div>F1 نقطة البيع — F2 البحث في البيع</div><div>F3 الصيانة — F4 كاش ورصيد</div><div>F6 الأصناف — F7 العملاء — F8 التقارير</div><div>F9 الدفع — Esc إغلاق النافذة</div></div></div>
  <div class="row mt" style="justify-content:center"><button class="btn ok" onclick="waLink('${DEV.phone}','استفسار بخصوص نظام غاندي للسنترالات — ${esc(DB.settings.shopName)}')">💬 تواصل مع المطور</button></div></div>`;
};
