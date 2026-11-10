/* نقطة البيع */
'use strict';
let CART = null;
const newCart = () => ({ customerId: 'walkin', lines: [], discount: 0, note: '' });

Pages.pos = el => {
  if (DB.settings.requireShift && !currentShift() && !SESSION.isDev) {
    el.innerHTML = `<div class="card" style="max-width:480px;margin:40px auto;text-align:center"><h3>⏱️ لازم تفتح وردية الأول</h3><p class="muted">الإعدادات تتطلب فتح وردية قبل البيع.</p><button class="btn" onclick="go('shifts')">فتح وردية</button></div>`;
    return;
  }
  CART = CART || newCart();
  let cat = '', q = '';
  el.innerHTML = `<div class="pos">
    <div class="left">
      <div class="row"><input id="pq" placeholder="🔍 باركود / IMEI / اسم الصنف — (Enter للإضافة)" style="flex:1;font-size:16px;padding:11px">
        <button class="btn ghost" id="pHold">⏸️ تعليق</button><button class="btn ghost" id="pHeld">📂 المعلقة <span id="heldN"></span></button></div>
      <div class="cats" id="pcats"></div>
      <div class="prods" id="pprods"></div>
    </div>
    <div class="cart">
      <div style="padding:10px;border-bottom:1px solid var(--line)" class="row">
        <select id="pcust" style="flex:1"></select><button class="btn sm ghost" id="pnewc" title="عميل جديد">➕</button>
      </div>
      <div id="pcustinfo" class="muted" style="padding:0 10px;font-size:12px"></div>
      <div class="lines" id="plines"></div>
      <div class="tot">
        <div class="sum-row"><span>الإجمالي</span><b id="psub">0</b></div>
        <div class="sum-row"><span>خصم</span><input id="pdisc" type="number" step="any" style="width:110px;padding:4px" ${can('sell_discount') ? '' : 'disabled'}></div>
        <div class="sum-row"><span>الصافي</span><span class="big" id="ptot">0</span></div>
        <input id="pnote" placeholder="ملاحظة على الفاتورة" style="margin:6px 0">
        <div class="row"><button class="btn ok lg sp" id="ppay">💵 دفع (F9)</button><button class="btn bad" id="pclr">🗑️</button></div>
        <div class="row mt"><button class="btn vio sm sp" id="pinst">📅 بيع بالتقسيط</button><button class="btn ghost sm sp" id="pquote">📄 عرض سعر</button></div>
      </div>
    </div></div>`;

  const cats = [['', 'الكل'], ...DB.categories.map(c => [c.id, c.name])];
  $('#pcats').innerHTML = cats.map(([id, n]) => `<button class="btn sm ${id === cat ? '' : 'ghost'}" data-c="${id}">${esc(n)}</button>`).join('');
  $$('#pcats button').forEach(b => b.onclick = () => { cat = b.dataset.c; $$('#pcats button').forEach(x => x.classList.toggle('ghost', x !== b)); drawProds(); });

  function drawProds() {
    const list = DB.items.filter(i => i.active !== false && (!cat || i.cat === cat) && match(q, i.name, i.code, i.brand, i.model)).slice(0, 200);
    $('#pprods').innerHTML = list.map(i => `<div class="prod ${i.type !== 'service' && num(i.qty) <= 0 ? 'out' : ''}" data-id="${i.id}"><b>${esc(i.name)}</b><div class="p">${fmt(i.price)}</div><div class="q">${i.type === 'service' ? 'خدمة' : 'متاح: ' + fmt(i.qty)}${i.serialized ? ' • IMEI' : ''}</div></div>`).join('') || '<div class="empty">لا توجد أصناف — أضف من شاشة الأصناف</div>';
    $$('#pprods .prod').forEach(p => p.onclick = () => addItem(p.dataset.id));
  }
  function drawCust() {
    $('#pcust').innerHTML = DB.customers.filter(c => c.active !== false).map(c => `<option value="${c.id}" ${c.id === CART.customerId ? 'selected' : ''}>${esc(c.name)}${c.phone ? ' — ' + esc(c.phone) : ''}</option>`).join('');
    const b = custBalance(CART.customerId);
    $('#pcustinfo').innerHTML = CART.customerId !== 'walkin' ? `رصيد العميل: <b class="${b > 0 ? 'bad-t' : 'ok-t'}">${fmt(b)}</b>` : '';
  }
  function drawCart() {
    $('#plines').innerHTML = CART.lines.map((l, i) => `<div class="cline"><div><b>${esc(l.name)}</b><small>${l.imei ? 'IMEI: ' + esc(l.imei) : fmt(l.price) + ' × ' + fmt(l.qty)}</small></div>
      <input type="number" step="any" value="${l.qty}" data-q="${i}" ${l.serialId ? 'disabled' : ''}>
      <input type="number" step="any" value="${l.price}" data-p="${i}" ${can('sell_price_edit') ? '' : 'disabled'}>
      <button class="btn bad sm" data-x="${i}">✕</button></div>`).join('') || '<div class="empty">السلة فاضية<br><small>امسح الباركود أو اختار صنف</small></div>';
    $$('#plines [data-q]').forEach(x => x.onchange = () => { CART.lines[x.dataset.q].qty = Math.max(0.01, num(x.value)); drawCart(); });
    $$('#plines [data-p]').forEach(x => x.onchange = () => { CART.lines[x.dataset.p].price = num(x.value); drawCart(); });
    $$('#plines [data-x]').forEach(x => x.onclick = () => { CART.lines.splice(x.dataset.x, 1); drawCart(); });
    const sub = sum(CART.lines, l => l.qty * l.price);
    $('#psub').textContent = fmt(sub); $('#pdisc').value = CART.discount || ''; $('#ptot').textContent = fmt(sub - num(CART.discount));
    $('#pnote').value = CART.note || '';
    $('#heldN').textContent = (DB.meta.held || []).length ? `(${DB.meta.held.length})` : '';
  }
  function addItem(id, serial) {
    const it = find('items', id); if (!it) return;
    if (it.serialized && !serial) {
      const avail = DB.serials.filter(s => s.itemId === id && s.status === 'in' && !CART.lines.some(l => l.serialId === s.id));
      if (!avail.length) return toast('لا يوجد سيريالات متاحة لهذا الصنف', 'warn');
      if (avail.length === 1) return addItem(id, avail[0]);
      return modal({ title: 'اختر الجهاز (IMEI) — ' + esc(it.name), body: tableHTML([{ l: 'IMEI', f: s => `<span class="ltr">${esc(s.imei)}</span>` }, { l: 'اللون', k: 'color' }, { l: 'الحالة', f: s => s.condition === 'used' ? 'مستعمل' : 'جديد' }, { l: 'سعر', f: s => fmt(s.price || it.price) }, { l: '', f: s => `<button class="btn sm" data-pick="${s.id}">اختيار</button>` }], avail), wide: true, onOpen: (o, c) => $$('[data-pick]', o).forEach(b => b.onclick = () => { c(); addItem(id, find('serials', b.dataset.pick)); }) });
    }
    if (serial) { CART.lines.push({ itemId: id, name: it.name, qty: 1, price: num(serial.price) || num(it.price), cost: num(serial.cost) || num(it.cost), serialId: serial.id, imei: serial.imei }); }
    else {
      const ex = CART.lines.find(l => l.itemId === id && !l.serialId);
      if (it.type !== 'service' && !DB.settings.allowNegativeStock && num(it.qty) < (ex ? ex.qty + 1 : 1)) return toast('الكمية غير متاحة في المخزون', 'warn');
      if (ex) ex.qty++; else CART.lines.push({ itemId: id, name: it.name, qty: 1, price: num(it.price), cost: num(it.cost) });
    }
    drawCart();
  }
  const pq = $('#pq');
  pq.oninput = debounce(() => { q = pq.value; drawProds(); }, 150);
  pq.onkeydown = e => {
    if (e.key !== 'Enter') return;
    const v = pq.value.trim(); if (!v) return;
    const s = serialByImei(v);
    if (s) { if (s.status !== 'in') toast('هذا الجهاز غير متاح (' + (s.status === 'sold' ? 'مباع' : s.status) + ')', 'warn'); else addItem(s.itemId, s); }
    else { const it = itemByCode(v); if (it) addItem(it.id); else { const l = DB.items.filter(i => i.active !== false && match(v, i.name, i.code)); if (l.length === 1) addItem(l[0].id); else return toast('الصنف غير موجود', 'warn'); } }
    pq.value = ''; q = ''; drawProds();
  };
  $('#pcust').onchange = e => { CART.customerId = e.target.value; drawCust(); };
  $('#pnewc').onclick = () => quickCustomer(c => { CART.customerId = c.id; drawCust(); });
  $('#pdisc').onchange = e => { CART.discount = num(e.target.value); drawCart(); };
  $('#pnote').onchange = e => CART.note = e.target.value;
  $('#pclr').onclick = async () => { if (CART.lines.length && !(await confirmBox('مسح السلة؟'))) return; CART = newCart(); drawCust(); drawCart(); };
  $('#pHold').onclick = () => { if (!CART.lines.length) return; DB.meta.held = DB.meta.held || []; DB.meta.held.push({ ...CART, at: nowISO(), by: me() }); CART = newCart(); save(); drawCust(); drawCart(); toast('تم تعليق الفاتورة', 'ok'); };
  $('#pHeld').onclick = () => {
    const h = DB.meta.held || []; if (!h.length) return toast('لا توجد فواتير معلقة');
    modal({ title: 'الفواتير المعلقة', body: tableHTML([{ l: 'الوقت', f: x => fmtDT(x.at) }, { l: 'العميل', f: x => esc(custName(x.customerId)) }, { l: 'الأصناف', f: x => x.lines.length }, { l: 'الإجمالي', f: x => fmt(sum(x.lines, l => l.qty * l.price) - num(x.discount)) }, { l: '', f: (x) => `<button class="btn sm" data-r="${h.indexOf(x)}">استرجاع</button> <button class="btn sm bad" data-d="${h.indexOf(x)}">حذف</button>` }], h), wide: true, onOpen: (o, c) => { $$('[data-r]', o).forEach(b => b.onclick = () => { if (CART.lines.length) { h.push({ ...CART, at: nowISO(), by: me() }); } CART = h.splice(+b.dataset.r, 1)[0]; save(); c(); drawCust(); drawCart(); }); $$('[data-d]', o).forEach(b => b.onclick = () => { h.splice(+b.dataset.d, 1); save(); c(); drawCart(); }); } });
  };
  $('#ppay').onclick = () => payDialog(false);
  $('#pinst').onclick = () => { if (!can('installments')) return toast('ليس لديك صلاحية الأقساط', 'bad'); payDialog(true); };
  $('#pquote').onclick = () => { if (!CART.lines.length) return; printQuote(CART); };

  function payDialog(installment) {
    if (!CART.lines.length) return toast('السلة فاضية', 'warn');
    const sub = sum(CART.lines, l => l.qty * l.price), total = r2(sub - num(CART.discount));
    if (!DB.settings.allowBelowCost && CART.lines.some(l => l.price < l.cost) && !isAdmin()) return toast('يوجد صنف سعره أقل من التكلفة', 'bad');
    if (installment && CART.customerId === 'walkin') return toast('اختار العميل الأول للتقسيط', 'warn');
    if (installment) return installmentDialog(total, CART, done);
    const accs = payAccounts();
    const o = modal({
      title: '💵 الدفع — الصافي: ' + money(total), wide: true,
      body: `<div class="grid g2"><div>${accs.map(a => `<div class="row mb"><label style="width:150px">${esc(a.name)}</label><input type="number" step="any" data-acc="${a.id}" value="${a.id === 'cash' ? total : ''}" style="flex:1"></div>`).join('')}</div>
      <div class="card"><div class="sum-row"><span>الصافي</span><b>${fmt(total)}</b></div><div class="sum-row"><span>المدفوع</span><b id="ppaid">0</b></div>
      <div class="sum-row"><span>الباقي للعميل</span><b id="pchg" class="ok-t">0</b></div><div class="sum-row"><span>متبقي (آجل)</span><b id="pdue" class="bad-t">0</b></div>
      <label class="chk mt"><input type="checkbox" id="pprint" ${DB.settings.autoPrint ? 'checked' : ''}> طباعة الفاتورة</label>
      <div class="row mt">${[50, 100, 200, 500, 1000].map(v => `<button class="btn sm ghost" data-cash="${v}">${v}</button>`).join('')}<button class="btn sm ghost" data-cash="exact">بالظبط</button></div></div></div>`,
      buttons: [{ text: '✔ إتمام البيع', cls: 'ok', click: o => finish(o) }, { text: 'إلغاء', cls: 'ghost' }]
    });
    const calc = () => { const paid = sum($$('[data-acc]', o), i => num(i.value)); $('#ppaid', o).textContent = fmt(paid); $('#pchg', o).textContent = fmt(Math.max(0, paid - total)); $('#pdue', o).textContent = fmt(Math.max(0, total - paid)); };
    $$('[data-acc]', o).forEach(i => i.oninput = calc);
    $$('[data-cash]', o).forEach(b => b.onclick = () => { const c = $('[data-acc=cash]', o); c.value = b.dataset.cash === 'exact' ? total : b.dataset.cash; calc(); });
    calc(); setTimeout(() => { const c = $('[data-acc=cash]', o); c.focus(); c.select(); }, 60);
    o.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('.mf .btn.ok', o).click(); } });
    async function finish(o) {
      const pays = $$('[data-acc]', o).map(i => ({ accountId: i.dataset.acc, amount: num(i.value) })).filter(p => p.amount > 0);
      const paid = sum(pays, 'amount'); let change = Math.max(0, paid - total);
      const due = r2(Math.max(0, total - paid));
      if (due > 0) {
        if (!can('sell_credit')) { toast('ليس لديك صلاحية البيع الآجل', 'bad'); return false; }
        if (CART.customerId === 'walkin' && DB.settings.requireCustomerForCredit) { toast('اختار عميل للبيع الآجل', 'warn'); return false; }
      }
      if (change > 0) { const c = pays.find(p => p.accountId === 'cash'); if (!c || c.amount < change) { toast('الباقي لازم يكون من الكاش', 'warn'); return false; } c.amount = r2(c.amount - change); }
      const sale = createSale(CART, pays.filter(p => p.amount > 0), { change });
      if ($('#pprint', o).checked) printSale(sale);
      done(sale);
    }
  }
  function done(sale) { toast(`تم البيع — فاتورة رقم ${sale.no} ✔`, 'ok'); CART = newCart(); drawCust(); drawCart(); drawProds(); renderSide(); setTimeout(() => $('#pq')?.focus(), 50); }
  document.onkeydown = e => { if (currentPage !== 'pos' || $('.ovl')) return; if (e.key === 'F9') { e.preventDefault(); payDialog(false); } if (e.key === 'F2') { e.preventDefault(); pq.focus(); } };
  drawProds(); drawCust(); drawCart(); pq.focus();
};

function createSale(cart, pays, extra = {}) {
  const sub = r2(sum(cart.lines, l => l.qty * l.price)), total = r2(sub - num(cart.discount));
  const paid = r2(sum(pays, 'amount'));
  const no = nextNo('sale');
  const sale = {
    id: uid(), no, date: nowISO(), customerId: cart.customerId, lines: cart.lines.map(l => ({ ...l })), subtotal: sub, discount: num(cart.discount), total,
    cost: r2(sum(cart.lines, l => l.qty * l.cost)), payments: pays, paid, change: extra.change || 0, due: r2(Math.max(0, total - paid)),
    type: extra.installmentId ? 'installment' : (total - paid > 0.001 ? 'credit' : 'cash'), installmentId: extra.installmentId || '', note: cart.note || '', user: me(), userId: meId(), shiftId: currentShift()?.id || '', status: 'ok'
  };
  for (const l of sale.lines) {
    stockMove(l.itemId, -l.qty, 'sale', 'فاتورة ' + no, l.cost);
    if (l.serialId) { const s = find('serials', l.serialId); if (s) { s.status = 'sold'; s.saleId = sale.id; s.soldAt = sale.date; s.customerId = sale.customerId; s.salePrice = l.price; } }
  }
  pays.forEach(p => addMove(p.accountId, p.amount, 'sale', 'فاتورة ' + no, custName(sale.customerId)));
  if (sale.due > 0 && !extra.installmentId) custTx(sale.customerId, sale.due, 'sale', 'فاتورة ' + no, 'باقي فاتورة');
  DB.sales.push(sale);
  audit('فاتورة بيع', `رقم ${no} — ${fmt(total)}`);
  save();
  return sale;
}

function quickCustomer(cb) {
  const F = [{ k: 'name', l: 'الاسم', req: true }, { k: 'phone', l: 'الموبايل', t: 'tel' }, { k: 'nid', l: 'الرقم القومي' }, { k: 'address', l: 'العنوان' }];
  modal({
    title: 'عميل جديد', body: formHTML(F), buttons: [{
      text: 'حفظ', click: o => {
        const v = readForm(o, F);
        if (v.phone && DB.customers.some(c => c.phone === v.phone)) { toast('العميل موجود بنفس الرقم', 'warn'); return false; }
        const c = { id: uid(), ...v, created: nowISO() }; DB.customers.push(c); audit('إضافة عميل', v.name); save(); cb && cb(c);
      }
    }, { text: 'إلغاء', cls: 'ghost' }]
  });
}

function saleInner(s) {
  const c = find('customers', s.customerId);
  return `${shopHeader()}<div class="c b">${s.status === 'void' ? '*** ملغاة ***<br>' : ''}فاتورة بيع رقم ${s.no}</div>
  <div class="sm">التاريخ: ${fmtDT(s.date)} — الكاشير: ${esc(s.user)}</div>
  ${c && c.id !== 'walkin' ? `<div class="sm">العميل: ${esc(c.name)} ${c.phone ? '— <span class="ltr">' + esc(c.phone) + '</span>' : ''}</div>` : ''}
  <table><thead><tr><th>الصنف</th><th>ك</th><th>سعر</th><th>إجمالي</th></tr></thead><tbody>
  ${s.lines.map(l => `<tr><td>${esc(l.name)}${l.imei ? `<br><span class="sm ltr">IMEI: ${esc(l.imei)}</span>` : ''}</td><td>${fmt(l.qty)}</td><td>${fmt(l.price)}</td><td>${fmt(l.qty * l.price)}</td></tr>`).join('')}</tbody></table>
  <table class="tot"><tr><td>الإجمالي</td><td>${fmt(s.subtotal)}</td></tr>${s.discount ? `<tr><td>الخصم</td><td>${fmt(s.discount)}</td></tr>` : ''}
  <tr class="b lg"><td>الصافي</td><td>${fmt(s.total)}</td></tr>
  ${s.payments.map(p => `<tr><td>${esc(accName(p.accountId))}</td><td>${fmt(p.amount + (p.accountId === 'cash' ? s.change : 0))}</td></tr>`).join('')}
  ${s.change ? `<tr><td>الباقي للعميل</td><td>${fmt(s.change)}</td></tr>` : ''}${s.due ? `<tr class="b"><td>المتبقي (${s.type === 'installment' ? 'تقسيط' : 'آجل'})</td><td>${fmt(s.due)}</td></tr>` : ''}</table>
  ${s.lines.some(l => l.imei) ? `<div class="box sm">ضمان الأجهزة حسب ضمان الوكيل / المحل. يرجى الاحتفاظ بالفاتورة.</div>` : ''}
  ${s.note ? `<div class="sm">ملاحظة: ${esc(s.note)}</div>` : ''}
  <div class="c">${barcodeSVG('S' + s.no, { h: 30 })}</div><div class="c sm">${esc(DB.settings.receiptFooter)}</div>${devFooter()}`;
}
const printSale = s => printDoc(saleInner(s), DB.settings.receiptSize, num(DB.settings.receiptCopies) || 1);
function printQuote(cart) {
  const sub = sum(cart.lines, l => l.qty * l.price);
  printDoc(`${shopHeader()}<div class="c b lg">عرض سعر</div><div class="sm">التاريخ: ${fmtDT(nowISO())} — العميل: ${esc(custName(cart.customerId))}</div>
  <table><thead><tr><th>الصنف</th><th>ك</th><th>سعر</th><th>إجمالي</th></tr></thead><tbody>${cart.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${fmt(l.price)}</td><td>${fmt(l.qty * l.price)}</td></tr>`).join('')}</tbody></table>
  <table class="tot"><tr class="b lg"><td>الإجمالي</td><td>${fmt(sub - num(cart.discount))}</td></tr></table><div class="sm c">العرض ساري لمدة 3 أيام</div>${devFooter()}`);
}
