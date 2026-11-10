/* المشتريات + مرتجع المشتريات + شراء الأجهزة المستعملة */
'use strict';
Pages.purchases = el => {
  let q = '', from = addDays(today(), -30), to = today();
  el.innerHTML = `<div class="row mb"><button class="btn" id="padd">➕ فاتورة شراء</button><button class="btn ghost" id="pret">↩️ مرتجع لمورد</button><span class="sp"></span>
  <input id="pq" placeholder="بحث" style="width:200px"><input type="date" id="pf" value="${from}" style="width:150px"><input type="date" id="pt" value="${to}" style="width:150px"></div><div id="ptbl"></div>`;
  const draw = () => {
    const rows = DB.purchases.filter(p => dOnly(p.date) >= from && dOnly(p.date) <= to && match(q, p.no, p.supInv, find('suppliers', p.supplierId)?.name)).slice().reverse();
    $('#ptbl').innerHTML = tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: p => fmtDate(p.date) }, { l: 'المورد', f: p => esc(find('suppliers', p.supplierId)?.name || '-') }, { l: 'فاتورة المورد', k: 'supInv' },
      { l: 'النوع', f: p => p.kind === 'return' ? '<span class="tag warn">مرتجع</span>' : '<span class="tag pri">شراء</span>' }, { l: 'الأصناف', f: p => p.lines.length },
      { l: 'الإجمالي', k: 'total', money: true, sum: true }, { l: 'المدفوع', k: 'paid', money: true, sum: true }, { l: 'المتبقي', f: p => fmt(p.total - p.paid), sum: p => p.total - p.paid },
      { l: '', f: p => `<button class="btn sm ghost" data-v="${p.id}">👁️</button>` }], rows, { foot: true });
    $$('[data-v]', el).forEach(b => b.onclick = () => viewPurchase(b.dataset.v));
  };
  $('#pq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#pf').onchange = e => { from = e.target.value; draw(); }; $('#pt').onchange = e => { to = e.target.value; draw(); };
  $('#padd').onclick = () => purchaseForm('buy', draw);
  $('#pret').onclick = () => purchaseForm('return', draw);
  draw();
};

function purchaseForm(kind, cb) {
  if (!DB.suppliers.length && kind === 'buy') toast('يفضل إضافة الموردين من شاشة الموردين', 'warn');
  const lines = [];
  const isRet = kind === 'return';
  const o = modal({
    title: isRet ? '↩️ مرتجع مشتريات لمورد' : '🚚 فاتورة شراء جديدة', xwide: true,
    body: `<div class="grid g4 mb"><div><label class="f">المورد</label><select id="psup"><option value="">— نقدي / بدون مورد —</option>${DB.suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div><label class="f">رقم فاتورة المورد</label><input id="pinv"></div><div><label class="f">الحساب المدفوع منه / إليه</label><select id="pacc">${payAccounts().map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
    <div><label class="f">${isRet ? 'المبلغ المسترد' : 'المدفوع'}</label><input id="ppaid" type="number" step="any"></div></div>
    <div class="row mb"><input id="pitem" placeholder="🔍 ابحث عن صنف أو امسح الباركود ثم Enter" list="dl-pitems" style="flex:1"><datalist id="dl-pitems">${DB.items.filter(i => i.active !== false && i.type !== 'service').map(i => `<option value="${esc(i.code)}">${esc(i.name)}</option>`).join('')}</datalist><button class="btn ghost" id="pnew">➕ صنف جديد</button></div>
    <div id="plines"></div><div class="row mt"><label>خصم</label><input id="pdisc" type="number" step="any" style="width:120px"><label>ملاحظات</label><input id="pnote" style="flex:1"><span class="sp"></span><b style="font-size:20px">الإجمالي: <span id="ptot">0</span></b></div>`,
    buttons: [{ text: '✔ حفظ الفاتورة', cls: 'ok', click: o => savePur(o) }, { text: 'إلغاء', cls: 'ghost' }]
  });
  const drawL = () => {
    $('#plines', o).innerHTML = tableHTML([{ l: 'الصنف', f: l => esc(l.name) }, { l: 'الكمية', f: (l) => `<input type="number" step="any" value="${l.qty}" data-q="${lines.indexOf(l)}" style="width:80px" ${l.serialized ? 'readonly' : ''}>` },
      { l: 'التكلفة', f: l => `<input type="number" step="any" value="${l.cost}" data-c="${lines.indexOf(l)}" style="width:100px">` }, ...(isRet ? [] : [{ l: 'سعر البيع', f: l => `<input type="number" step="any" value="${l.price}" data-p="${lines.indexOf(l)}" style="width:100px">` }]),
      { l: 'IMEI', f: l => l.serialized ? `<textarea data-im="${lines.indexOf(l)}" class="ltr" placeholder="${isRet ? 'IMEI المرتجع' : 'IMEI كل جهاز في سطر'}" style="min-height:36px;width:220px">${esc(l.imeis.join('\n'))}</textarea>` : '—' },
      { l: 'الإجمالي', f: l => fmt(l.qty * l.cost) }, { l: '', f: l => `<button class="btn sm bad" data-x="${lines.indexOf(l)}">✕</button>` }], lines, { empty: 'أضف أصناف' });
    $$('[data-q]', o).forEach(i => i.onchange = () => { lines[i.dataset.q].qty = num(i.value); drawL(); });
    $$('[data-c]', o).forEach(i => i.onchange = () => { lines[i.dataset.c].cost = num(i.value); drawL(); });
    $$('[data-p]', o).forEach(i => i.onchange = () => { lines[i.dataset.p].price = num(i.value); });
    $$('[data-im]', o).forEach(i => i.onchange = () => { const l = lines[i.dataset.im]; l.imeis = i.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean); l.qty = l.imeis.length; drawL(); });
    $$('[data-x]', o).forEach(b => b.onclick = () => { lines.splice(b.dataset.x, 1); drawL(); });
    const t = sum(lines, l => l.qty * l.cost) - num($('#pdisc', o).value);
    $('#ptot', o).textContent = fmt(t);
  };
  const addLine = it => { const ex = lines.find(l => l.itemId === it.id); if (ex && !it.serialized) ex.qty++; else if (!ex) lines.push({ itemId: it.id, name: it.name, qty: it.serialized ? 0 : 1, cost: num(it.cost), price: num(it.price), serialized: !!it.serialized, imeis: [] }); drawL(); };
  $('#pitem', o).onkeydown = e => { if (e.key !== 'Enter') return; const v = e.target.value.trim(); const it = itemByCode(v) || DB.items.find(i => i.name === v) || (DB.items.filter(i => match(v, i.name)).length === 1 ? DB.items.find(i => match(v, i.name)) : null); if (it) { addLine(it); e.target.value = ''; } else toast('الصنف غير موجود', 'warn'); };
  $('#pitem', o).onchange = e => { const it = itemByCode(e.target.value); if (it) { addLine(it); e.target.value = ''; } };
  $('#pnew', o).onclick = () => itemForm(null, () => { const it = DB.items[DB.items.length - 1]; addLine(it); });
  $('#pdisc', o).oninput = drawL;
  drawL();
  function savePur(o) {
    if (!lines.length) { toast('أضف أصناف', 'warn'); return false; }
    for (const l of lines) {
      if (l.serialized) {
        if (!l.imeis.length) { toast('أدخل IMEI للصنف ' + l.name, 'warn'); return false; }
        for (const im of l.imeis) {
          const ex = serialByImei(im.split(/[,\s]+/)[0]);
          if (!isRet && ex) { toast('IMEI مكرر: ' + im, 'bad'); return false; }
          if (isRet && (!ex || ex.status !== 'in')) { toast('IMEI غير متاح للإرجاع: ' + im, 'bad'); return false; }
        }
      }
      if (isRet && !l.serialized && num(find('items', l.itemId).qty) < l.qty) { toast('الكمية غير متاحة: ' + l.name, 'bad'); return false; }
    }
    const supplierId = $('#psup', o).value, acc = $('#pacc', o).value, paid = num($('#ppaid', o).value);
    const total = r2(sum(lines, l => l.qty * l.cost) - num($('#pdisc', o).value));
    if (!supplierId && paid < total) { toast('بدون مورد لازم تدفع الإجمالي كامل', 'warn'); return false; }
    const no = nextNo(isRet ? 'pret' : 'pur', isRet ? 'R' : '');
    const p = { id: uid(), no, kind, date: nowISO(), supplierId, supInv: $('#pinv', o).value, lines: lines.map(l => ({ ...l })), discount: num($('#pdisc', o).value), total, paid, accountId: acc, note: $('#pnote', o).value, user: me() };
    for (const l of lines) {
      const it = find('items', l.itemId);
      if (!isRet) {
        const oldQ = Math.max(0, num(it.qty)), newCost = (oldQ * num(it.cost) + l.qty * l.cost) / Math.max(1, oldQ + l.qty);
        it.cost = r2(newCost || l.cost); if (l.price) it.price = l.price; it.lastCost = l.cost; it.lastSupplier = supplierId;
        stockMove(it.id, l.qty, 'purchase', 'شراء ' + no, l.cost);
        l.imeis.forEach(im => { const [a, b] = im.split(/[,\s]+/); DB.serials.push({ id: uid(), itemId: it.id, imei: a, imei2: b || '', cost: l.cost, price: l.price, condition: 'new', status: 'in', date: nowISO(), purchaseId: p.id, source: 'purchase' }); });
      } else {
        stockMove(it.id, -l.qty, 'return_purchase', 'مرتجع ' + no, l.cost);
        l.imeis.forEach(im => { const s = serialByImei(im.split(/[,\s]+/)[0]); if (s) { s.status = 'returned_sup'; s.returnId = p.id; } });
      }
    }
    if (isRet) { if (paid) addMove(acc, paid, 'purchase_return', 'مرتجع ' + no); supTx(supplierId, -(total - paid), 'return', 'مرتجع ' + no); }
    else { if (paid) addMove(acc, -paid, 'purchase', 'شراء ' + no); supTx(supplierId, total - paid, 'purchase', 'شراء ' + no); }
    DB.purchases.push(p); audit(isRet ? 'مرتجع مشتريات' : 'فاتورة شراء', `${no} — ${fmt(total)}`); save(); cb && cb(); toast('تم الحفظ ✔', 'ok');
  }
}
function viewPurchase(id) {
  const p = find('purchases', id), s = find('suppliers', p.supplierId);
  const inner = `${shopHeader()}<div class="c b lg">${p.kind === 'return' ? 'مرتجع مشتريات' : 'فاتورة شراء'} رقم ${p.no}</div><div>التاريخ: ${fmtDT(p.date)} — المورد: ${esc(s?.name || 'نقدي')} ${p.supInv ? '— فاتورة المورد: ' + esc(p.supInv) : ''}</div>
  <table class="a4"><thead><tr><th>الصنف</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead><tbody>${p.lines.map(l => `<tr><td>${esc(l.name)}${l.imeis?.length ? '<br><small class="ltr">' + l.imeis.map(esc).join(' / ') + '</small>' : ''}</td><td>${fmt(l.qty)}</td><td>${fmt(l.cost)}</td><td>${fmt(l.qty * l.cost)}</td></tr>`).join('')}</tbody></table>
  <table class="tot">${p.discount ? `<tr><td>خصم</td><td>${fmt(p.discount)}</td></tr>` : ''}<tr class="b"><td>الإجمالي</td><td>${fmt(p.total)}</td></tr><tr><td>المدفوع (${esc(accName(p.accountId))})</td><td>${fmt(p.paid)}</td></tr><tr><td>المتبقي</td><td>${fmt(p.total - p.paid)}</td></tr></table>${p.note ? '<p>' + esc(p.note) + '</p>' : ''}`;
  modal({ title: 'فاتورة ' + p.no, wide: true, body: `<div style="background:#fff;color:#000;padding:10px;border-radius:8px">${inner}</div>`, buttons: [{ text: '🖨️ طباعة A4', close: false, click: () => printDoc(inner, 'A4') }, { text: 'إغلاق', cls: 'ghost' }] });
}

/* -------- شراء أجهزة مستعملة -------- */
Pages.used = el => {
  el.innerHTML = `<div class="row mb"><button class="btn" id="uadd">➕ شراء جهاز مستعمل من عميل</button><span class="sp"></span><input id="uq" placeholder="بحث بالاسم / IMEI / البطاقة" style="width:260px"></div><div id="utbl"></div>`;
  let q = '';
  const draw = () => {
    const rows = DB.usedBuys.filter(u => match(q, u.sellerName, u.imei, u.sellerNid, u.device)).slice().reverse();
    $('#utbl').innerHTML = tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: u => fmtDate(u.date) }, { l: 'الجهاز', k: 'device' }, { l: 'IMEI', f: u => `<span class="ltr">${esc(u.imei)}</span>` }, { l: 'البائع', k: 'sellerName' }, { l: 'الرقم القومي', k: 'sellerNid' },
      { l: 'سعر الشراء', k: 'price', money: true, sum: true }, { l: 'سعر البيع المقترح', k: 'sellPrice', money: true }, { l: 'الوضع', f: u => { const s = find('serials', u.serialId); return s?.status === 'sold' ? '<span class="tag pri">اتباع</span>' : '<span class="tag ok">بالمخزن</span>'; } },
      { l: '', f: u => `<button class="btn sm ghost" data-p="${u.id}">🖨️ إقرار</button>` }], rows, { foot: true });
    $$('[data-p]', el).forEach(b => b.onclick = () => printUsedDecl(find('usedBuys', b.dataset.p)));
  };
  $('#uq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#uadd').onclick = () => usedBuyForm(draw);
  draw();
};
function usedBuyForm(cb) {
  fillBrands();
  const F = [{ t: 'html', full: true, html: '<b>بيانات البائع</b>' }, { k: 'sellerName', l: 'اسم البائع', req: true }, { k: 'sellerPhone', l: 'الموبايل' }, { k: 'sellerNid', l: 'الرقم القومي', req: true }, { k: 'sellerAddress', l: 'العنوان' },
    { t: 'html', full: true, html: '<b>بيانات الجهاز</b>' }, { k: 'brand', l: 'الماركة', list: 'dl-brands', req: true }, { k: 'model', l: 'الموديل', req: true }, { k: 'imei', l: 'IMEI 1', req: true }, { k: 'imei2', l: 'IMEI 2' },
    { k: 'color', l: 'اللون' }, { k: 'storage', l: 'المساحة / الرام' }, { k: 'battery', l: 'صحة البطارية %' }, { k: 'box', l: 'الملحقات (علبة/شاحن/فاتورة)' },
    { k: 'condition', l: 'حالة الجهاز والعيوب', t: 'textarea', full: true },
    { k: 'price', l: 'سعر الشراء', t: 'number', req: true }, { k: 'sellPrice', l: 'سعر البيع المقترح', t: 'number' }, { k: 'accountId', l: 'الدفع من', t: 'select', o: opts(payAccounts) }];
  modal({ title: '📱 شراء جهاز مستعمل', wide: true, body: formHTML(F, {}, 3) + `<div class="row mt"><button class="btn ghost sm" id="uimg">📷 صورة البطاقة (اختياري)</button><span id="uimgok" class="muted"></span></div>`,
    onOpen: o => { $('#uimg', o).onclick = async () => { const img = await api.dialog.openImage(); if (img) { o.dataset.img = '1'; o._img = img; $('#uimgok', o).textContent = '✔ تم إرفاق الصورة'; } }; },
    buttons: [{ text: '✔ حفظ وطباعة الإقرار', cls: 'ok', click: o => {
      const d = readForm(o, F);
      if (serialByImei(d.imei)) { toast('الـ IMEI موجود بالفعل في المخزن', 'bad'); return false; }
      const name = `${d.brand} ${d.model} مستعمل`;
      let it = DB.items.find(i => i.name === name);
      const usedCat = DB.categories.find(c => c.name.includes('مستعمل'));
      if (!it) { it = { id: uid(), name, code: genBarcode(), type: 'phone', cat: usedCat?.id || '', brand: d.brand, model: d.model, cost: d.price, price: d.sellPrice || d.price, qty: 0, serialized: true, active: true, unit: 'جهاز', min: 0, created: nowISO() }; DB.items.push(it); }
      const s = { id: uid(), itemId: it.id, imei: d.imei, imei2: d.imei2, color: d.color, storage: d.storage, condition: 'used', cost: d.price, price: d.sellPrice || d.price, status: 'in', date: nowISO(), source: 'used', notes: d.condition };
      DB.serials.push(s); stockMove(it.id, 1, 'used', 'شراء مستعمل', d.price);
      const u = { id: uid(), no: nextNo('used'), date: nowISO(), device: `${d.brand} ${d.model}`, ...d, serialId: s.id, idImage: o._img || '', user: me() };
      DB.usedBuys.push(u); addMove(d.accountId, -d.price, 'used_buy', 'شراء مستعمل ' + u.no, d.sellerName);
      audit('شراء جهاز مستعمل', `${u.device} — ${d.imei} — ${fmt(d.price)}`); save(); printUsedDecl(u); cb && cb();
    } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function printUsedDecl(u) {
  printDoc(`${shopHeader()}<div class="c b lg">إقرار بيع جهاز محمول مستعمل</div><div class="c">رقم ${u.no} — ${fmtDT(u.date)}</div>
  <p>أقر أنا / <b>${esc(u.sellerName)}</b> — رقم قومي: <b class="ltr">${esc(u.sellerNid)}</b> — موبايل: <span class="ltr">${esc(u.sellerPhone || '')}</span> — العنوان: ${esc(u.sellerAddress || '')}</p>
  <p>بأنني قمت ببيع الجهاز التالي إلى <b>${esc(DB.settings.shopName)}</b> وأنه ملكي الخاص وخالٍ من أي مشاكل قانونية، وأتحمل كامل المسئولية القانونية في حالة ثبوت عكس ذلك.</p>
  <div class="box">الجهاز: <b>${esc(u.device)}</b><br>IMEI: <span class="ltr b">${esc(u.imei)}</span> ${u.imei2 ? ' / <span class="ltr">' + esc(u.imei2) + '</span>' : ''}<br>اللون: ${esc(u.color || '-')} — ${esc(u.storage || '')}<br>الحالة: ${esc(u.condition || '-')}<br>الملحقات: ${esc(u.box || '-')}</div>
  <p class="b lg">المبلغ المستلم: ${fmt(u.price)} ${esc(DB.settings.currency)}</p>
  <br><table class="tot"><tr><td>توقيع البائع: ..................</td><td>بصمة الإبهام</td></tr><tr><td><br>توقيع المستلم: ..................</td><td></td></tr></table>${devFooter()}`, DB.settings.receiptSize === 'A4' ? 'A4' : DB.settings.receiptSize);
}
