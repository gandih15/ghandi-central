/* فواتير البيع + المرتجعات + الحجوزات */
'use strict';
Pages.sales = el => {
  let from = today(), to = today(), q = '', ft = '';
  el.innerHTML = `<div class="row mb"><input id="sq" placeholder="🔍 رقم الفاتورة / العميل / IMEI" style="flex:1"><select id="stype" style="width:150px"><option value="">كل الأنواع</option><option value="cash">نقدي</option><option value="credit">آجل</option><option value="installment">تقسيط</option><option value="void">ملغاة</option></select>
  <input type="date" id="sf" value="${from}" style="width:150px"><input type="date" id="st" value="${to}" style="width:150px"><button class="btn ghost" id="sexp">📤 تصدير</button></div><div id="stbl"></div>`;
  const showCost = can('items_cost');
  const cols = [{ l: 'رقم', f: s => `<b>${s.no}</b>` }, { l: 'التاريخ', f: s => fmtDT(s.date) }, { l: 'العميل', f: s => esc(custName(s.customerId)) }, { l: 'الأصناف', f: s => s.lines.length },
    { l: 'النوع', f: s => s.status === 'void' ? '<span class="tag bad">ملغاة</span>' : { cash: '<span class="tag ok">نقدي</span>', credit: '<span class="tag warn">آجل</span>', installment: '<span class="tag vio">تقسيط</span>' }[s.type] },
    { l: 'الصافي', f: s => s.status === 'void' ? 0 : s.total, money: true, sum: true }, { l: 'المدفوع', f: s => s.status === 'void' ? 0 : s.paid, money: true, sum: true },
    ...(showCost ? [{ l: 'الربح', f: s => s.status === 'void' ? 0 : s.total - s.cost - sum(DB.returns.filter(r => r.saleId === s.id), r => r.total - r.cost), money: true, sum: true }] : []),
    { l: 'الكاشير', k: 'user' }, { l: '', f: s => `<button class="btn sm ghost" data-v="${s.id}">👁️</button>` }];
  const rows = () => DB.sales.filter(s => dOnly(s.date) >= from && dOnly(s.date) <= to && (!ft || (ft === 'void' ? s.status === 'void' : s.type === ft && s.status !== 'void')) && (!q || match(q, s.no, custName(s.customerId), ...s.lines.map(l => l.imei)))).slice().reverse();
  const draw = () => { $('#stbl').innerHTML = tableHTML(cols, rows(), { foot: true, limit: 500 }); $$('[data-v]', el).forEach(b => b.onclick = () => viewSale(b.dataset.v, draw)); };
  $('#sq').oninput = debounce(e => { q = e.target.value; if (q) { from = '2000-01-01'; $('#sf').value = from; } draw(); }, 250);
  $('#stype').onchange = e => { ft = e.target.value; draw(); };
  $('#sf').onchange = e => { from = e.target.value; draw(); }; $('#st').onchange = e => { to = e.target.value; draw(); };
  $('#sexp').onclick = () => exportCSV('المبيعات', cols.slice(0, -1), rows());
  draw();
};
function viewSale(id, cb) {
  const s = find('sales', id);
  const rets = DB.returns.filter(r => r.saleId === id);
  modal({ title: 'فاتورة رقم ' + s.no, wide: true, body: `<div style="background:#fff;color:#000;padding:10px;border-radius:8px;max-width:420px;margin:auto">${saleInner(s)}</div>${rets.length ? '<h3 class="mt">مرتجعات على الفاتورة</h3>' + tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: r => fmtDT(r.date) }, { l: 'القيمة', k: 'total', money: true }], rets) : ''}`,
    buttons: [{ text: '🖨️ طباعة', close: false, click: () => printSale(s) }, { text: '📄 A4', cls: 'ghost', close: false, click: () => printDoc(saleInner(s), 'A4') },
      ...(s.status !== 'void' && can('returns') ? [{ text: '↩️ مرتجع', cls: 'warn', click: () => returnForm(s, cb) }] : []),
      ...(s.status !== 'void' && can('sales_delete') ? [{ text: '🚫 إلغاء الفاتورة', cls: 'bad', click: () => voidSale(s, cb) }] : []), { text: 'إغلاق', cls: 'ghost' }] });
}
async function voidSale(s, cb) {
  if (DB.returns.some(r => r.saleId === s.id)) return toast('الفاتورة عليها مرتجع — لا يمكن إلغاؤها', 'bad');
  const reason = await promptBox('إلغاء الفاتورة ' + s.no, 'سبب الإلغاء'); if (reason === null) return;
  for (const l of s.lines) { stockMove(l.itemId, l.qty, 'void', 'إلغاء فاتورة ' + s.no, l.cost); if (l.serialId) { const sr = find('serials', l.serialId); if (sr) { sr.status = 'in'; sr.saleId = ''; } } }
  s.payments.forEach(p => addMove(p.accountId, -p.amount, 'void', 'إلغاء فاتورة ' + s.no));
  if (s.due > 0 && s.type === 'credit') custTx(s.customerId, -s.due, 'void', 'إلغاء فاتورة ' + s.no);
  if (s.installmentId) { const p = find('installments', s.installmentId); if (p) { p.status = 'cancelled'; (p.schedule || []).forEach(x => { if (x.paid) addMove('cash', -x.paid, 'void', 'إلغاء قسط ' + p.no); }); } }
  s.status = 'void'; s.voidReason = reason; s.voidBy = me(); s.voidAt = nowISO();
  audit('إلغاء فاتورة', `${s.no} — ${reason}`); save(); toast('تم الإلغاء', 'ok'); cb && cb();
}
function returnForm(s, cb) {
  const prev = id => sum(DB.returns.filter(r => r.saleId === s.id).flatMap(r => r.lines).filter(l => l.lineIdx === id), 'qty');
  const lines = s.lines.map((l, i) => ({ ...l, idx: i, max: l.qty - prev(i) })).filter(l => l.max > 0);
  if (!lines.length) return toast('كل أصناف الفاتورة مرتجعة بالفعل', 'warn');
  const o = modal({ title: '↩️ مرتجع من فاتورة ' + s.no, wide: true,
    body: tableHTML([{ l: 'الصنف', f: l => esc(l.name) + (l.imei ? `<br><small class="ltr">${esc(l.imei)}</small>` : '') }, { l: 'المباع', k: 'qty' }, { l: 'متاح للإرجاع', k: 'max' }, { l: 'السعر', k: 'price', money: true }, { l: 'كمية المرتجع', f: l => `<input type="number" step="any" min="0" max="${l.max}" data-r="${l.idx}" value="0" style="width:80px">` }], lines) +
      `<div class="grid g3 mt"><div><label class="f">رد المبلغ من</label><select id="racc">${payAccounts().map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}${s.customerId !== 'walkin' ? '<option value="__credit">خصم من حساب العميل</option>' : ''}</select></div>
      <div><label class="f">حالة المرتجع</label><select id="rcond"><option value="good">سليم — يرجع للمخزن</option><option value="damaged">تالف — لا يرجع للمخزن</option></select></div><div><label class="f">السبب</label><input id="rreason"></div></div><div class="mt" style="font-size:18px">قيمة المرتجع: <b id="rtot">0</b></div>`,
    buttons: [{ text: '✔ حفظ المرتجع', cls: 'ok', click: o => {
      const rl = $$('[data-r]', o).map(i => ({ l: s.lines[+i.dataset.r], idx: +i.dataset.r, qty: Math.min(num(i.value), num(i.max)) })).filter(x => x.qty > 0);
      if (!rl.length) { toast('حدد الكمية', 'warn'); return false; }
      const ratio = s.subtotal ? s.total / s.subtotal : 1;
      const total = r2(sum(rl, x => x.qty * x.l.price * ratio)), cost = r2(sum(rl, x => x.qty * x.l.cost));
      const acc = $('#racc', o).value, good = $('#rcond', o).value === 'good';
      const no = nextNo('ret', 'M');
      const ret = { id: uid(), no, date: nowISO(), saleId: s.id, customerId: s.customerId, lines: rl.map(x => ({ itemId: x.l.itemId, name: x.l.name, qty: x.qty, price: x.l.price, lineIdx: x.idx, serialId: x.l.serialId })), total, cost, accountId: acc, condition: good ? 'good' : 'damaged', reason: $('#rreason', o).value, user: me() };
      rl.forEach(x => { if (good) stockMove(x.l.itemId, x.qty, 'return_sale', 'مرتجع ' + no, x.l.cost); if (x.l.serialId) { const sr = find('serials', x.l.serialId); if (sr) { sr.status = good ? 'in' : 'damaged'; sr.saleId = ''; } } });
      if (acc === '__credit') custTx(s.customerId, -total, 'return', 'مرتجع ' + no); else addMove(acc, -total, 'return', 'مرتجع ' + no, custName(s.customerId));
      DB.returns.push(ret); audit('مرتجع مبيعات', `${no} من فاتورة ${s.no} — ${fmt(total)}`); save();
      printDoc(`${shopHeader()}<div class="c b lg">إشعار مرتجع ${no}</div><div class="sm">من فاتورة ${s.no} — ${fmtDT(ret.date)}</div><table><thead><tr><th>الصنف</th><th>ك</th><th>سعر</th></tr></thead><tbody>${ret.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${fmt(l.price)}</td></tr>`).join('')}</tbody></table><table class="tot"><tr class="b lg"><td>المرتد</td><td>${fmt(total)}</td></tr></table>${devFooter()}`);
      toast('تم المرتجع ✔', 'ok'); cb && cb();
    } }, { text: 'إلغاء', cls: 'ghost' }] });
  const calc = () => { const ratio = s.subtotal ? s.total / s.subtotal : 1; $('#rtot', o).textContent = fmt(sum($$('[data-r]', o), i => Math.min(num(i.value), num(i.max)) * s.lines[+i.dataset.r].price * ratio)); };
  $$('[data-r]', o).forEach(i => i.oninput = calc);
}
Pages.returns = el => {
  el.innerHTML = `<div class="card mb" style="max-width:640px"><h3>↩️ مرتجع جديد</h3><div class="row"><input id="rsn" placeholder="رقم الفاتورة أو IMEI أو امسح باركود الفاتورة" style="flex:1"><button class="btn" id="rgo">بحث</button></div></div><div id="rtbl"></div>`;
  const go_ = () => {
    let v = $('#rsn').value.trim().replace(/^S/i, '');
    let s = DB.sales.find(x => String(x.no) === v);
    if (!s) { const sr = serialByImei(v); if (sr?.saleId) s = find('sales', sr.saleId); }
    if (!s) return toast('الفاتورة غير موجودة', 'bad');
    if (s.status === 'void') return toast('الفاتورة ملغاة', 'bad');
    returnForm(s, draw);
  };
  $('#rgo').onclick = go_; $('#rsn').onkeydown = e => e.key === 'Enter' && go_();
  const draw = () => { $('#rtbl').innerHTML = '<h3>المرتجعات السابقة</h3>' + tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: r => fmtDT(r.date) }, { l: 'الفاتورة', f: r => find('sales', r.saleId)?.no }, { l: 'العميل', f: r => esc(custName(r.customerId)) }, { l: 'الأصناف', f: r => r.lines.map(l => esc(l.name) + ' ×' + l.qty).join('، ') }, { l: 'القيمة', k: 'total', money: true, sum: true }, { l: 'الحالة', f: r => r.condition === 'good' ? 'سليم' : 'تالف' }, { l: 'السبب', k: 'reason' }, { l: 'بواسطة', k: 'user' }], DB.returns.slice().reverse(), { foot: true, limit: 300 }); };
  draw(); $('#rsn').focus();
};

/* -------- الحجوزات وطلبات العملاء -------- */
Pages.reservations = el => {
  let fs = 'open';
  el.innerHTML = `<div class="row mb"><button class="btn" id="radd">➕ حجز / طلب جديد</button><div class="tabs" style="margin:0;border:0" id="rvt"></div></div><div id="rvtbl"></div>`;
  const ST = { open: 'مفتوح', arrived: 'وصل — بانتظار العميل', done: 'تم التسليم', cancelled: 'ملغي' };
  const draw = () => {
    $('#rvt').innerHTML = Object.entries({ open: 'المفتوحة', arrived: 'وصلت', done: 'المنتهية', cancelled: 'الملغاة', all: 'الكل' }).map(([k, l]) => `<button class="${k === fs ? 'act' : ''}" data-t="${k}">${l}</button>`).join('');
    $$('#rvt button').forEach(b => b.onclick = () => { fs = b.dataset.t; draw(); });
    const rows = DB.reservations.filter(r => fs === 'all' || r.status === fs).slice().reverse();
    $('#rvtbl').innerHTML = tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: r => fmtDate(r.date) }, { l: 'العميل', f: r => esc(r.name) + `<br><small class="ltr">${esc(r.phone)}</small>` }, { l: 'المطلوب', k: 'item' }, { l: 'السعر المتفق', k: 'price', money: true }, { l: 'العربون', k: 'deposit', money: true, sum: true }, { l: 'الحالة', f: r => `<span class="tag">${ST[r.status]}</span>` },
      { l: '', f: r => ['open', 'arrived'].includes(r.status) ? `<button class="btn sm" data-a="${r.id}">وصل</button> <button class="btn sm ok" data-d="${r.id}">تسليم</button> <button class="btn sm ghost" data-w="${r.id}">💬</button> <button class="btn sm bad" data-c="${r.id}">إلغاء</button>` : '' }], rows, { foot: true });
    $$('[data-a]', el).forEach(b => b.onclick = () => { const r = find('reservations', b.dataset.a); r.status = 'arrived'; save(); draw(); renderSide(); if (r.phone) waLink(r.phone, `مرحباً ${r.name}، طلبك (${r.item}) وصل ${DB.settings.shopName}. المتبقي ${fmt(r.price - r.deposit)} ج.م`); });
    $$('[data-w]', el).forEach(b => b.onclick = () => { const r = find('reservations', b.dataset.w); waLink(r.phone, `مرحباً ${r.name}، بخصوص طلبك: ${r.item} — ${DB.settings.shopName}`); });
    $$('[data-d]', el).forEach(b => b.onclick = async () => { const r = find('reservations', b.dataset.d); if (await confirmBox(`تسليم الطلب؟ العربون (${fmt(r.deposit)}) هيتخصم من فاتورة البيع — اعمل الفاتورة من نقطة البيع وخصم العربون منها كخصم أو دفعة.`, 'تم', 'ok')) { r.status = 'done'; r.doneAt = nowISO(); save(); draw(); renderSide(); } });
    $$('[data-c]', el).forEach(b => b.onclick = async () => { const r = find('reservations', b.dataset.c); const refund = r.deposit > 0 && await confirmBox(`رد العربون (${fmt(r.deposit)}) للعميل؟`, 'رد العربون', 'warn'); if (refund) addMove(r.accountId || 'cash', -r.deposit, 'reservation', 'إلغاء حجز ' + r.no); r.status = 'cancelled'; audit('إلغاء حجز', r.no); save(); draw(); renderSide(); });
  };
  $('#radd').onclick = () => {
    const F = [{ k: 'name', l: 'اسم العميل', req: true }, { k: 'phone', l: 'الموبايل', req: true }, { k: 'item', l: 'الصنف / الجهاز المطلوب', req: true, full: true }, { k: 'price', l: 'السعر المتفق عليه', t: 'number' }, { k: 'deposit', l: 'العربون', t: 'number' }, { k: 'accountId', l: 'العربون في', t: 'select', o: opts(payAccounts) }, { k: 'expected', l: 'الموعد المتوقع', t: 'date' }, { k: 'notes', l: 'ملاحظات', full: true }];
    modal({ title: '📌 حجز / طلب عميل', body: formHTML(F), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); const r = { id: uid(), no: nextNo('resv'), date: nowISO(), status: 'open', ...d, user: me() }; DB.reservations.push(r); if (d.deposit) addMove(d.accountId, d.deposit, 'reservation', 'عربون حجز ' + r.no, d.name); audit('حجز جديد', r.no); save(); draw(); renderSide(); printDoc(`${shopHeader()}<div class="c b lg">إيصال حجز ${r.no}</div><table class="tot"><tr><td>العميل</td><td>${esc(r.name)}</td></tr><tr><td>المطلوب</td><td>${esc(r.item)}</td></tr><tr><td>السعر</td><td>${fmt(r.price)}</td></tr><tr class="b"><td>العربون</td><td>${fmt(r.deposit)}</td></tr><tr><td>الموعد</td><td>${fmtDate(r.expected)}</td></tr></table>${devFooter()}`); } }, { text: 'إلغاء', cls: 'ghost' }] });
  };
  draw();
};
