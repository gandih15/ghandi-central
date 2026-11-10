/* الصيانة */
'use strict';
const REPAIR_ST = {
  received: ['تم الاستلام', 'pri'], checking: ['جاري الفحص', 'pri'], waiting_approval: ['انتظار موافقة العميل', 'warn'], waiting_parts: ['انتظار قطع غيار', 'warn'],
  repairing: ['جاري الإصلاح', 'vio'], outside: ['عند فني خارجي', 'vio'], ready: ['جاهز للتسليم', 'ok'], cant_fix: ['لم يتم الإصلاح', 'bad'],
  delivered: ['تم التسليم', ''], returned: ['تم التسليم بدون إصلاح', '']
};
const OPEN_ST = ['received', 'checking', 'waiting_approval', 'waiting_parts', 'repairing', 'outside', 'ready', 'cant_fix'];
const repTotal = r => r2(num(r.labor) + sum(r.parts || [], p => p.qty * p.price) + num(r.outsideCharge) - num(r.discount));
const repPaid = r => r2(sum(r.payments || [], 'amount'));
const repCost = r => r2(sum(r.parts || [], p => p.qty * p.cost) + num(r.outsideCost));
const techs = () => DB.employees.filter(e => e.active !== false && (e.isTech || /فني|صيان/.test(e.job || '')));

Pages.repairs = (el, arg) => {
  let q = '', fst = arg || 'open', ftech = '';
  el.innerHTML = `<div class="row mb"><button class="btn lg" id="radd">➕ استلام جهاز للصيانة</button>
  <input id="rq" placeholder="🔍 رقم الإيصال / الاسم / الموبايل / IMEI / الجهاز" style="flex:1">
  <select id="rtech" style="width:160px"><option value="">كل الفنيين</option>${techs().map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
  <div class="tabs" id="rtabs"></div><div id="rtbl"></div>`;
  const tabs = [['open', 'المفتوحة'], ...Object.entries(REPAIR_ST).map(([k, v]) => [k, v[0]]), ['all', 'الكل']];
  const drawTabs = () => { $('#rtabs').innerHTML = tabs.map(([k, l]) => { const n = k === 'all' ? DB.repairs.length : k === 'open' ? DB.repairs.filter(r => OPEN_ST.includes(r.status)).length : DB.repairs.filter(r => r.status === k).length; return `<button class="${k === fst ? 'act' : ''}" data-t="${k}">${l} <small>(${n})</small></button>`; }).join(''); $$('#rtabs button').forEach(b => b.onclick = () => { fst = b.dataset.t; drawTabs(); draw(); }); };
  const draw = () => {
    const rows = DB.repairs.filter(r => (fst === 'all' || (fst === 'open' ? OPEN_ST.includes(r.status) : r.status === fst)) && (!ftech || r.techId === ftech) && match(q, r.no, r.custName, r.phone, r.imei, r.device, r.problem)).slice().reverse();
    $('#rtbl').innerHTML = tableHTML([{ l: 'رقم', f: r => `<b>${r.no}</b>` }, { l: 'التاريخ', f: r => fmtDate(r.date) + `<br><small class="muted">${daysBetween(dOnly(r.date), today())} يوم</small>` }, { l: 'العميل', f: r => `${esc(r.custName)}<br><small class="ltr muted">${esc(r.phone)}</small>` },
      { l: 'الجهاز', f: r => `${esc(r.device)}${r.warrantyOf ? ' <span class="tag warn">ضمان</span>' : ''}` }, { l: 'العطل', f: r => esc((r.problem || '').slice(0, 40)) }, { l: 'الفني', f: r => esc(find('employees', r.techId)?.name || '-') },
      { l: 'الحالة', f: r => `<span class="tag ${REPAIR_ST[r.status][1]}">${REPAIR_ST[r.status][0]}</span>` }, { l: 'التكلفة', f: r => fmt(repTotal(r) || r.estimate) }, { l: 'المتبقي', f: r => { const d = repTotal(r) - repPaid(r); return d > 0 ? `<b class="bad-t">${fmt(d)}</b>` : '0'; } },
      { l: '', f: r => `<button class="btn sm" data-o="${r.id}">فتح</button>` }], rows, { limit: 400 });
    $$('[data-o]', el).forEach(b => b.onclick = () => repairView(b.dataset.o, draw));
  };
  $('#rq').oninput = debounce(e => { q = e.target.value; if (q) { fst = 'all'; drawTabs(); } draw(); }, 200);
  $('#rq').onkeydown = e => { if (e.key === 'Enter') { const r = DB.repairs.find(x => String(x.no) === e.target.value.trim().replace(/^R/i, '')); if (r) repairView(r.id, draw); } };
  $('#rtech').onchange = e => { ftech = e.target.value; draw(); };
  $('#radd').onclick = () => repairForm(null, r => { draw(); drawTabs(); });
  drawTabs(); draw();
};

function repairForm(rep, cb, warrantyOf) {
  fillBrands();
  const isNew = !rep;
  const base = warrantyOf ? { custName: warrantyOf.custName, phone: warrantyOf.phone, customerId: warrantyOf.customerId, brand: warrantyOf.brand, model: warrantyOf.model, imei: warrantyOf.imei, color: warrantyOf.color, problem: 'ضمان على إصلاح رقم ' + warrantyOf.no + ' — ', estimate: 0 } : {};
  const v = rep || { warrantyDays: DB.settings.defaultWarranty, ...base };
  const F = [
    { k: 'phone', l: 'موبايل العميل', req: true, attrs: 'id="rphone" list="dl-rcust"' }, { k: 'custName', l: 'اسم العميل', req: true }, { k: 'phone2', l: 'رقم آخر' },
    { k: 'brand', l: 'الماركة', list: 'dl-brands', req: true }, { k: 'model', l: 'الموديل', req: true }, { k: 'imei', l: 'IMEI / سيريال' }, { k: 'color', l: 'اللون' },
    { k: 'devType', l: 'نوع الجهاز', t: 'select', o: [['mobile', 'موبايل'], ['tablet', 'تابلت'], ['laptop', 'لابتوب'], ['watch', 'ساعة'], ['other', 'أخرى']] },
    { k: 'lockCode', l: 'باسورد / رمز الفتح' },
    { k: 'problem', l: 'العطل كما وصفه العميل', t: 'textarea', full: true, req: true },
    { t: 'html', full: true, html: `<div class="row" style="gap:4px">${DB.settings.repairFaults.map(f => `<button type="button" class="btn sm ghost" data-fault="${esc(f)}">${esc(f)}</button>`).join('')}</div>` },
    { k: 'accessories', l: 'المستلم مع الجهاز', ph: 'شريحة، كارت ميموري، جراب، شاحن...' }, { k: 'devCondition', l: 'حالة الجهاز الخارجية', ph: 'خدوش، كسر، ...' },
    { k: 'techId', l: 'الفني', t: 'select', o: opts(techs, 'id', 'name', '— لم يحدد —') }, { k: 'estimate', l: 'التكلفة المتوقعة', t: 'number' },
    { k: 'expected', l: 'موعد التسليم المتوقع', t: 'date', d: addDays(today(), 2) }, { k: 'warrantyDays', l: 'ضمان الإصلاح (أيام)', t: 'number' },
    ...(isNew ? [{ k: 'deposit', l: 'عربون / مقدم', t: 'number' }, { k: 'depAcc', l: 'العربون في', t: 'select', o: opts(payAccounts) }] : []),
    { k: 'notes', l: 'ملاحظات داخلية', t: 'textarea', full: true }
  ];
  const o = modal({ title: isNew ? (warrantyOf ? '🔁 استلام ضمان' : '🔧 استلام جهاز للصيانة') : 'تعديل تذكرة ' + rep.no, xwide: true,
    body: `<datalist id="dl-rcust">${DB.customers.filter(c => c.phone).map(c => `<option value="${esc(c.phone)}">${esc(c.name)}</option>`).join('')}</datalist>` + formHTML(F, v, 4) + `<div class="mt"><label class="f">رسم النمط (Pattern) — اضغط النقط بالترتيب</label><div class="row"><div class="pattern" id="rpat">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<span data-n="${n}">${n}</span>`).join('')}</div><div><b id="rpatv" class="ltr">${esc(v.pattern || '')}</b><br><button type="button" class="btn sm ghost" id="rpatc">مسح النمط</button></div></div></div>`,
    buttons: [{ text: '✔ حفظ' + (isNew ? ' وطباعة الإيصال' : ''), cls: 'ok', click: o => {
      const d = readForm(o, F); d.pattern = $('#rpatv', o).textContent;
      d.device = `${d.brand} ${d.model}`.trim();
      let c = DB.customers.find(x => x.phone && x.phone === d.phone);
      if (!c) { c = { id: uid(), name: d.custName, phone: d.phone, created: nowISO() }; DB.customers.push(c); }
      d.customerId = c.id;
      if (isNew) {
        const dep = num(d.deposit), acc = d.depAcc; delete d.deposit; delete d.depAcc;
        const r = { id: uid(), no: nextNo('repair'), date: nowISO(), status: 'received', parts: [], payments: [], labor: 0, discount: 0, log: [{ date: nowISO(), status: 'received', user: me() }], user: me(), warrantyOf: warrantyOf?.id || '', ...d };
        if (dep > 0) { r.payments.push({ id: uid(), date: nowISO(), amount: dep, accountId: acc, note: 'عربون', user: me() }); addMove(acc, dep, 'repair', 'صيانة ' + r.no, 'عربون'); }
        DB.repairs.push(r); audit('استلام صيانة', `${r.no} — ${r.device}`); save(); printRepairReceipt(r); cb && cb(r);
      } else { Object.assign(rep, d); audit('تعديل صيانة', rep.no); save(); cb && cb(rep); }
    } }, { text: 'إلغاء', cls: 'ghost' }] });
  $$('[data-fault]', o).forEach(b => b.onclick = () => { const t = $('[name=problem]', o); t.value = (t.value ? t.value + ' + ' : '') + b.dataset.fault; });
  $$('#rpat span', o).forEach(s => s.onclick = () => { const v = $('#rpatv', o); if (!v.textContent.includes(s.dataset.n)) { v.textContent += s.dataset.n; s.classList.add('on'); } });
  (v.pattern || '').split('').forEach(n => $(`#rpat [data-n="${n}"]`, o)?.classList.add('on'));
  $('#rpatc', o).onclick = () => { $('#rpatv', o).textContent = ''; $$('#rpat span', o).forEach(s => s.classList.remove('on')); };
  $('#rphone', o).onchange = e => { const c = DB.customers.find(x => x.phone === e.target.value.trim()); if (c) { $('[name=custName]', o).value = c.name; const last = DB.repairs.filter(r => r.phone === c.phone).pop(); if (last) toast(`عميل سابق — آخر صيانة رقم ${last.no}: ${last.device}`, ''); } };
}

function repairView(id, cb) {
  const r = find('repairs', id); if (!r) return;
  const tot = repTotal(r), paid = repPaid(r), due = r2(tot - paid);
  const closed = ['delivered', 'returned'].includes(r.status);
  const warrantyLeft = r.deliveredAt && r.warrantyDays ? num(r.warrantyDays) - daysBetween(dOnly(r.deliveredAt), today()) : null;
  const body = `<div class="grid g3">
   <div class="card"><h3>👤 العميل</h3><b>${esc(r.custName)}</b><div class="ltr">${esc(r.phone)} ${esc(r.phone2 || '')}</div><div class="mt muted">استلام: ${fmtDT(r.date)}<br>بواسطة: ${esc(r.user)}<br>موعد التسليم: ${fmtDate(r.expected)}</div></div>
   <div class="card"><h3>📱 الجهاز</h3><b>${esc(r.device)}</b><div class="ltr">${esc(r.imei || '')}</div><div>اللون: ${esc(r.color || '-')}</div><div>الفتح: <b class="ltr">${esc(r.lockCode || '-')}</b> ${r.pattern ? '— نمط: <b class="ltr">' + esc(r.pattern) + '</b>' : ''}</div><div>معاه: ${esc(r.accessories || '-')}</div><div>الحالة الخارجية: ${esc(r.devCondition || '-')}</div></div>
   <div class="card"><h3>📌 الحالة</h3><span class="tag ${REPAIR_ST[r.status][1]}" style="font-size:14px">${REPAIR_ST[r.status][0]}</span>
     <div class="mt">الفني: <b>${esc(find('employees', r.techId)?.name || '-')}</b></div>${warrantyLeft !== null ? `<div class="mt">الضمان: ${warrantyLeft > 0 ? `<span class="tag ok">باقي ${warrantyLeft} يوم</span>` : '<span class="tag bad">انتهى</span>'}</div>` : ''}
     ${!closed ? `<select id="rvst" class="mt">${Object.entries(REPAIR_ST).filter(([k]) => !['delivered', 'returned'].includes(k)).map(([k, v]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>` : ''}</div></div>
  <div class="card mt"><h3>🧾 العطل</h3>${esc(r.problem)}${r.diagnosis ? `<div class="mt"><b>التشخيص:</b> ${esc(r.diagnosis)}</div>` : ''}${r.notes ? `<div class="mt muted">ملاحظات: ${esc(r.notes)}</div>` : ''}</div>
  <div class="grid g2 mt"><div class="card"><h3>🔩 قطع الغيار والمصنعية</h3>
    ${tableHTML([{ l: 'القطعة', k: 'name' }, { l: 'ك', k: 'qty' }, { l: 'السعر', k: 'price', money: true }, ...(can('items_cost') ? [{ l: 'تكلفة', k: 'cost', money: true }] : []), { l: '', f: p => closed ? '' : `<button class="btn sm bad" data-rp="${p.id}">✕</button>` }], r.parts || [], { empty: 'لا توجد قطع' })}
    ${!closed ? `<div class="row mt"><input id="rvpart" placeholder="باركود / اسم القطعة" list="dl-parts" style="flex:1"><datalist id="dl-parts">${DB.items.filter(i => i.active !== false && ['part', 'accessory', 'other', 'service'].includes(i.type)).map(i => `<option value="${esc(i.code)}">${esc(i.name)} — ${fmt(i.price)} (${fmt(i.qty)})</option>`).join('')}</datalist><button class="btn sm" id="rvaddp">➕ قطعة</button></div>
    <div class="grid g2 mt"><div><label class="f">المصنعية</label><input type="number" step="any" id="rvlab" value="${r.labor || ''}"></div><div><label class="f">خصم</label><input type="number" step="any" id="rvdisc" value="${r.discount || ''}"></div>
    <div><label class="f">تكلفة فني خارجي (علينا)</label><input type="number" step="any" id="rvoc" value="${r.outsideCost || ''}"></div><div><label class="f">اسم الفني الخارجي</label><input id="rvon" value="${esc(r.outsideName || '')}"></div>
    <div class="full" style="grid-column:1/-1"><label class="f">التشخيص / ما تم عمله</label><textarea id="rvdiag">${esc(r.diagnosis || '')}</textarea></div></div>` : ''}</div>
   <div class="card"><h3>💵 الحساب</h3><div class="sum-row"><span>المصنعية</span><b>${fmt(r.labor)}</b></div><div class="sum-row"><span>قطع الغيار</span><b>${fmt(sum(r.parts || [], p => p.qty * p.price))}</b></div>
     ${r.discount ? `<div class="sum-row"><span>خصم</span><b>${fmt(r.discount)}</b></div>` : ''}<div class="sum-row" style="font-size:18px"><span>الإجمالي</span><b>${fmt(tot)}</b></div>
     <div class="sum-row"><span>المدفوع</span><b class="ok-t">${fmt(paid)}</b></div><div class="sum-row" style="font-size:18px"><span>المتبقي</span><b class="bad-t">${fmt(due)}</b></div>
     ${can('items_cost') ? `<div class="sum-row muted"><span>تكلفة القطع + الخارجي</span><span>${fmt(repCost(r))}</span></div><div class="sum-row muted"><span>ربح التذكرة</span><span>${fmt(tot - repCost(r))}</span></div>` : ''}
     ${tableHTML([{ l: 'التاريخ', f: p => fmtDT(p.date) }, { l: 'المبلغ', k: 'amount', money: true }, { l: 'الحساب', f: p => esc(accName(p.accountId)) }, { l: 'بيان', k: 'note' }], r.payments || [], { empty: 'لا توجد مدفوعات' })}
     ${!closed ? '<button class="btn sm mt" id="rvpay">➕ تحصيل دفعة</button>' : ''}</div></div>
  <div class="card mt"><h3>🕓 سجل الحالة</h3>${(r.log || []).map(l => `<span class="tag">${fmtDT(l.date)} — ${REPAIR_ST[l.status]?.[0] || l.status} — ${esc(l.user)}${l.note ? ' — ' + esc(l.note) : ''}</span>`).join(' ')}</div>`;
  const o = modal({ title: `🔧 تذكرة صيانة رقم ${r.no}`, xwide: true, body,
    buttons: [
      ...(!closed ? [{ text: '💾 حفظ', close: false, click: o => { saveEdits(o); toast('تم الحفظ', 'ok'); repairViewRefresh(o); } },
        { text: '✅ تسليم للعميل', cls: 'ok', close: false, click: o => { saveEdits(o); deliverRepair(r, () => { o.close(); cb && cb(); }); } }] : []),
      { text: '🖨️ إيصال الاستلام', cls: 'ghost', close: false, click: () => printRepairReceipt(r) },
      { text: '🏷️ ملصق الجهاز', cls: 'ghost', close: false, click: () => printRepairSticker(r) },
      ...(closed ? [{ text: '🖨️ فاتورة التسليم', cls: 'ghost', close: false, click: () => printRepairInvoice(r) }, { text: '🔁 استلام ضمان', cls: 'warn', click: () => repairForm(null, cb, r) }] : []),
      { text: '💬 واتساب', cls: 'vio', close: false, click: () => waLink(r.phone, tpl(DB.settings.whatsappReady, { name: r.custName, device: r.device, shop: DB.settings.shopName, due: fmt(repTotal(r) - repPaid(r)), no: r.no })) },
      ...(!closed ? [{ text: '✏️ تعديل البيانات', cls: 'ghost', click: () => repairForm(r, () => repairView(r.id, cb)) }] : []),
      ...(can('repairs_delete') ? [{ text: '🗑️', cls: 'bad', click: async () => { if (repPaid(r) > 0 || (r.parts || []).length) { toast('لا يمكن الحذف — التذكرة عليها مدفوعات أو قطع. ألغِها بإرجاع القطع والمبالغ أولاً', 'bad'); return false; } if (!(await confirmBox('حذف التذكرة نهائياً؟'))) return false; DB.repairs.splice(DB.repairs.indexOf(r), 1); audit('حذف تذكرة صيانة', r.no); save(); cb && cb(); } }] : [])
    ] });
  function saveEdits(o) {
    if (closed) return;
    const st = $('#rvst', o)?.value;
    if (st && st !== r.status) { r.status = st; r.log.push({ date: nowISO(), status: st, user: me() }); if (st === 'ready') r.readyAt = nowISO(); audit('تغيير حالة صيانة', `${r.no} → ${REPAIR_ST[st][0]}`); }
    r.labor = num($('#rvlab', o)?.value); r.discount = num($('#rvdisc', o)?.value); r.outsideCost = num($('#rvoc', o)?.value); r.outsideName = $('#rvon', o)?.value || ''; r.diagnosis = $('#rvdiag', o)?.value || '';
    save(); cb && cb();
  }
  if (!closed) {
    $('#rvst', o).onchange = () => { saveEdits(o); if (r.status === 'ready' && r.phone) setTimeout(async () => { if (await confirmBox('الجهاز جاهز — إرسال رسالة واتساب للعميل؟', 'إرسال', 'ok')) waLink(r.phone, tpl(DB.settings.whatsappReady, { name: r.custName, device: r.device, shop: DB.settings.shopName, due: fmt(repTotal(r) - repPaid(r)), no: r.no })); }, 100); repairViewRefresh(o); };
    const addPart = () => {
      const v = $('#rvpart', o).value.trim(); const it = itemByCode(v) || DB.items.find(i => i.name === v); if (!it) return toast('القطعة غير موجودة', 'warn');
      if (it.type !== 'service' && num(it.qty) < 1 && !DB.settings.allowNegativeStock) return toast('القطعة غير متاحة بالمخزن', 'warn');
      saveEdits(o);
      r.parts.push({ id: uid(), itemId: it.id, name: it.name, qty: 1, price: num(it.price), cost: num(it.cost) });
      stockMove(it.id, -1, 'repair', 'صيانة ' + r.no); audit('قطعة غيار على صيانة', `${r.no}: ${it.name}`); save(); repairViewRefresh(o);
    };
    $('#rvaddp', o).onclick = addPart; $('#rvpart', o).onkeydown = e => e.key === 'Enter' && addPart();
    $$('[data-rp]', o).forEach(b => b.onclick = async () => { const p = r.parts.find(x => x.id === b.dataset.rp); if (!(await confirmBox('إرجاع القطعة للمخزن؟'))) return; saveEdits(o); stockMove(p.itemId, p.qty, 'repair', 'إرجاع من صيانة ' + r.no); r.parts.splice(r.parts.indexOf(p), 1); save(); repairViewRefresh(o); });
    $('#rvpay', o).onclick = () => { saveEdits(o); repairPay(r, () => repairViewRefresh(o)); };
  }
  function repairViewRefresh(o) { o.close(); repairView(id, cb); }
}
function repairPay(r, cb, amount) {
  const F = [{ k: 'amount', l: 'المبلغ', t: 'number', req: true, d: amount ?? Math.max(0, repTotal(r) - repPaid(r)) }, { k: 'accountId', l: 'الحساب', t: 'select', o: opts(payAccounts) }, { k: 'note', l: 'بيان', d: 'دفعة صيانة' }];
  modal({ title: 'تحصيل — صيانة ' + r.no, body: formHTML(F), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); if (d.amount <= 0) return false; r.payments.push({ id: uid(), date: nowISO(), ...d, user: me() }); addMove(d.accountId, d.amount, 'repair', 'صيانة ' + r.no, d.note); audit('تحصيل صيانة', `${r.no}: ${fmt(d.amount)}`); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function deliverRepair(r, cb) {
  const tot = repTotal(r), due = r2(tot - repPaid(r));
  const fixed = r.status !== 'cant_fix';
  const F = [{ k: 'fixed', l: 'نتيجة الإصلاح', t: 'select', o: [['1', 'تم الإصلاح'], ['0', 'لم يتم الإصلاح (تسليم بدون إصلاح)']], d: fixed ? '1' : '0' }, { k: 'amount', l: 'المبلغ المحصل الآن', t: 'number', d: Math.max(0, due) }, { k: 'accountId', l: 'الحساب', t: 'select', o: opts(payAccounts) }, { k: 'print', l: 'طباعة فاتورة التسليم', t: 'check', d: true }];
  modal({ title: `✅ تسليم الجهاز — المتبقي ${money(due)}`, body: formHTML(F), buttons: [{ text: 'تأكيد التسليم', cls: 'ok', click: o => {
    const d = readForm(o, F);
    if (d.amount > 0) { r.payments.push({ id: uid(), date: nowISO(), amount: d.amount, accountId: d.accountId, note: 'عند التسليم', user: me() }); addMove(d.accountId, d.amount, 'repair', 'صيانة ' + r.no, 'تسليم'); }
    const rest = r2(repTotal(r) - repPaid(r));
    if (rest > 0) { if (!r.customerId) { toast('المتبقي لازم يتحصل', 'bad'); return false; } custTx(r.customerId, rest, 'repair', 'صيانة ' + r.no, 'باقي صيانة'); r.onCredit = rest; }
    if (rest < 0) { addMove(d.accountId, rest, 'repair', 'صيانة ' + r.no, 'رد زيادة للعميل'); r.payments.push({ id: uid(), date: nowISO(), amount: rest, accountId: d.accountId, note: 'رد للعميل', user: me() }); }
    r.status = d.fixed === '1' ? 'delivered' : 'returned'; r.deliveredAt = nowISO(); r.deliveredBy = me(); r.log.push({ date: nowISO(), status: r.status, user: me() });
    const tech = find('employees', r.techId); if (tech && num(tech.commission)) r.techCommission = r2(num(r.labor) * num(tech.commission) / 100);
    audit('تسليم صيانة', `${r.no} — ${fmt(repTotal(r))}`); save(); if (d.print) printRepairInvoice(r); renderSide(); cb && cb();
  } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function printRepairReceipt(r) {
  const s = DB.settings;
  const copy = who => `${shopHeader()}<div class="c b lg">إيصال استلام جهاز صيانة</div><div class="c">${barcodeSVG('R' + r.no, { h: 34 })}</div><div class="c sm">(${who})</div>
  <table class="tot"><tr><td>رقم الإيصال</td><td class="b lg">${r.no}</td></tr><tr><td>التاريخ</td><td>${fmtDT(r.date)}</td></tr><tr><td>العميل</td><td>${esc(r.custName)}</td></tr><tr><td>الموبايل</td><td class="ltr">${esc(r.phone)}</td></tr>
  <tr><td>الجهاز</td><td class="b">${esc(r.device)}</td></tr>${r.imei ? `<tr><td>IMEI</td><td class="ltr">${esc(r.imei)}</td></tr>` : ''}<tr><td>العطل</td><td>${esc(r.problem)}</td></tr>
  ${r.accessories ? `<tr><td>المرفقات</td><td>${esc(r.accessories)}</td></tr>` : ''}${r.devCondition ? `<tr><td>حالة الجهاز</td><td>${esc(r.devCondition)}</td></tr>` : ''}
  ${r.estimate ? `<tr><td>التكلفة المتوقعة</td><td>${fmt(r.estimate)}</td></tr>` : ''}${repPaid(r) ? `<tr><td>المدفوع مقدم</td><td class="b">${fmt(repPaid(r))}</td></tr>` : ''}<tr><td>موعد الاستلام</td><td>${fmtDate(r.expected)}</td></tr></table>
  <div class="box sm">${esc(s.repairTerms).replace(/\n/g, '<br>')}</div><div class="sm">توقيع العميل: ...................</div>`;
  printDoc(copy('نسخة العميل') + devFooter() + '<div style="page-break-after:always"></div>' + copy('نسخة المحل') + (r.lockCode || r.pattern ? `<div class="box">الفتح: ${esc(r.lockCode || '')} ${r.pattern ? 'نمط: ' + esc(r.pattern) : ''}</div>` : ''));
}
function printRepairSticker(r) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:50mm 30mm;margin:0}body{margin:0;font-family:Arial;direction:rtl}</style></head><body><div style="width:50mm;height:30mm;padding:1mm;box-sizing:border-box;text-align:center;font-size:8pt">
  <b style="font-size:11pt">صيانة #${r.no}</b> — ${esc(r.custName)}<br>${esc(r.device)}<br>${barcodeSVG('R' + r.no, { h: 22, scale: 1 })}<span>${esc((r.problem || '').slice(0, 30))}</span></div></body></html>`;
  if (api.printHtml) api.printHtml(html, { printer: DB.settings.labelPrinter || DB.settings.printer }); else printDoc(html);
}
function printRepairInvoice(r) {
  const tot = repTotal(r), paid = repPaid(r);
  printDoc(`${shopHeader()}<div class="c b lg">فاتورة صيانة رقم ${r.no}</div><div class="sm">الاستلام: ${fmtDT(r.date)} — التسليم: ${fmtDT(r.deliveredAt || nowISO())}</div>
  <div class="sm">العميل: ${esc(r.custName)} — <span class="ltr">${esc(r.phone)}</span></div><div class="sm">الجهاز: <b>${esc(r.device)}</b> ${r.imei ? '— <span class="ltr">' + esc(r.imei) + '</span>' : ''}</div>
  ${r.diagnosis ? `<div class="sm">ما تم: ${esc(r.diagnosis)}</div>` : ''}
  <table><thead><tr><th>البيان</th><th>ك</th><th>المبلغ</th></tr></thead><tbody>${(r.parts || []).map(p => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${fmt(p.qty * p.price)}</td></tr>`).join('')}${num(r.labor) ? `<tr><td>مصنعية</td><td>1</td><td>${fmt(r.labor)}</td></tr>` : ''}</tbody></table>
  <table class="tot">${r.discount ? `<tr><td>خصم</td><td>${fmt(r.discount)}</td></tr>` : ''}<tr class="b lg"><td>الإجمالي</td><td>${fmt(tot)}</td></tr><tr><td>المدفوع</td><td>${fmt(paid)}</td></tr>${tot - paid > 0 ? `<tr class="b"><td>المتبقي</td><td>${fmt(tot - paid)}</td></tr>` : ''}</table>
  ${r.status === 'delivered' && num(r.warrantyDays) ? `<div class="box sm">ضمان ${r.warrantyDays} يوم على الإصلاح حتى ${fmtDate(addDays(dOnly(r.deliveredAt || today()), num(r.warrantyDays)))} — لا يشمل الكسر أو المياه.</div>` : r.status === 'returned' ? '<div class="box sm">تم تسليم الجهاز بدون إصلاح.</div>' : ''}
  <div class="c sm">${esc(DB.settings.receiptFooter)}</div>${devFooter()}`);
}
