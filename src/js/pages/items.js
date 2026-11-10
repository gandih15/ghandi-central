/* الأصناف والمخزون + السيريالات + الباركود + بحث IMEI */
'use strict';
const ITEM_F = () => [
  { k: 'name', l: 'اسم الصنف', req: true, full: true },
  { k: 'type', l: 'النوع', t: 'select', o: Object.entries(ITEM_TYPES) },
  { k: 'cat', l: 'القسم', t: 'select', o: opts(() => DB.categories, 'id', 'name', '— بدون —') },
  { k: 'brand', l: 'الماركة', list: 'dl-brands' }, { k: 'model', l: 'الموديل' },
  { k: 'code', l: 'الباركود (فاضي = توليد تلقائي)' }, { k: 'unit', l: 'الوحدة', d: 'قطعة' },
  { k: 'cost', l: 'سعر التكلفة', t: 'number' }, { k: 'price', l: 'سعر البيع', t: 'number', req: true },
  { k: 'wholesale', l: 'سعر الجملة', t: 'number' }, { k: 'min', l: 'حد الطلب (تنبيه نقص)', t: 'number', d: DB.settings.lowStockDefault },
  { k: 'warranty', l: 'الضمان (أيام)', t: 'number' }, { k: 'location', l: 'مكان التخزين (رف/درج)' },
  { k: 'serialized', l: 'تتبع بالسيريال / IMEI (للموبايلات)', t: 'check' }, { k: 'active', l: 'نشط', t: 'check', d: true },
  { k: 'notes', l: 'ملاحظات', t: 'textarea', full: true }
];
function fillBrands() { $('#dl-brands').innerHTML = [...new Set([...DB.settings.deviceBrands, ...DB.items.map(i => i.brand).filter(Boolean)])].map(b => `<option value="${esc(b)}">`).join(''); }

Pages.items = el => {
  fillBrands();
  let q = '', fcat = '', ftype = '', fstock = '';
  const showCost = can('items_cost');
  el.innerHTML = `<div class="row mb">
    <input id="iq" placeholder="🔍 بحث بالاسم / الباركود / الماركة" style="flex:2">
    <select id="icat" style="flex:1"><option value="">كل الأقسام</option>${DB.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <select id="itype" style="flex:1"><option value="">كل الأنواع</option>${Object.entries(ITEM_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select id="istock" style="flex:1"><option value="">كل الكميات</option><option value="low">ناقص</option><option value="zero">نفد</option><option value="has">متوفر</option></select>
  </div><div class="row mb">
    <button class="btn" id="iadd">➕ صنف جديد</button><button class="btn ghost" id="icats">📁 الأقسام</button>
    ${can('stock_adjust') ? '<button class="btn ghost" id="icount">📋 جرد المخزون</button>' : ''}
    <button class="btn ghost" id="iimp">📥 استيراد CSV</button><button class="btn ghost" id="iexp">📤 تصدير</button><span class="sp"></span><span id="isum" class="muted"></span></div>
  <div id="itbl"></div>`;
  const cols = [
    { l: 'الباركود', f: i => `<span class="ltr">${esc(i.code)}</span>` }, { l: 'الصنف', f: i => `<b>${esc(i.name)}</b>${i.serialized ? ' <span class="tag pri">IMEI</span>' : ''}${i.active === false ? ' <span class="tag bad">موقوف</span>' : ''}` },
    { l: 'النوع', f: i => ITEM_TYPES[i.type] || '' }, { l: 'القسم', f: i => esc(find('categories', i.cat)?.name || '') }, { l: 'الماركة', k: 'brand' },
    ...(showCost ? [{ l: 'التكلفة', k: 'cost', money: true }] : []), { l: 'البيع', k: 'price', money: true },
    { l: 'الكمية', f: i => i.type === 'service' ? '—' : `<b class="${num(i.qty) <= num(i.min ?? DB.settings.lowStockDefault) ? 'bad-t' : ''}">${fmt(i.qty)}</b>`, sum: i => i.type === 'service' ? 0 : num(i.qty) },
    ...(showCost ? [{ l: 'قيمة المخزون', f: i => fmt(num(i.qty) * num(i.cost)), sum: i => Math.max(0, num(i.qty)) * num(i.cost) }] : []),
    { l: '', f: i => `<button class="btn sm ghost" data-e="${i.id}">✏️</button> <button class="btn sm ghost" data-m="${i.id}" title="حركة الصنف">📜</button>${i.serialized ? ` <button class="btn sm ghost" data-s="${i.id}" title="السيريالات">📱</button>` : ''}${can('stock_adjust') && i.type !== 'service' ? ` <button class="btn sm ghost" data-a="${i.id}" title="تسوية">⚖️</button>` : ''}` }
  ];
  const rows = () => DB.items.filter(i => match(q, i.name, i.code, i.brand, i.model) && (!fcat || i.cat === fcat) && (!ftype || i.type === ftype) &&
    (!fstock || (fstock === 'low' ? i.type !== 'service' && num(i.qty) <= num(i.min ?? DB.settings.lowStockDefault) : fstock === 'zero' ? i.type !== 'service' && num(i.qty) <= 0 : num(i.qty) > 0))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const draw = () => {
    const r = rows();
    $('#itbl').innerHTML = tableHTML(cols, r, { foot: true, limit: 500 });
    $('#isum').textContent = `${r.length} صنف`;
    $$('[data-e]', el).forEach(b => b.onclick = () => itemForm(find('items', b.dataset.e), draw));
    $$('[data-m]', el).forEach(b => b.onclick = () => itemHistory(b.dataset.m));
    $$('[data-s]', el).forEach(b => b.onclick = () => serialsDialog(b.dataset.s, draw));
    $$('[data-a]', el).forEach(b => b.onclick = () => adjustDialog(b.dataset.a, draw));
  };
  $('#iq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#icat').onchange = e => { fcat = e.target.value; draw(); };
  $('#itype').onchange = e => { ftype = e.target.value; draw(); };
  $('#istock').onchange = e => { fstock = e.target.value; draw(); };
  $('#iadd').onclick = () => itemForm(null, draw);
  $('#icats').onclick = () => simpleList('categories', 'الأقسام', draw);
  if ($('#icount')) $('#icount').onclick = () => stockCount(draw);
  $('#iexp').onclick = () => exportCSV('الأصناف', [{ l: 'name', k: 'name' }, { l: 'code', k: 'code' }, { l: 'type', k: 'type' }, { l: 'category', f: i => find('categories', i.cat)?.name || '' }, { l: 'brand', k: 'brand' }, { l: 'cost', k: 'cost' }, { l: 'price', k: 'price' }, { l: 'wholesale', k: 'wholesale' }, { l: 'qty', k: 'qty' }, { l: 'min', k: 'min' }], rows());
  $('#iimp').onclick = importItems.bind(null, draw);
  draw();
};

function itemForm(item, cb) {
  fillBrands();
  const isNew = !item; const F = ITEM_F();
  const v = item || { type: 'accessory', active: true, unit: 'قطعة', min: DB.settings.lowStockDefault, warranty: 0 };
  if (isNew) F.splice(7, 0, { k: 'qty', l: 'رصيد أول المدة', t: 'number' });
  modal({
    title: isNew ? 'صنف جديد' : 'تعديل: ' + esc(item.name), body: formHTML(F, v, 3), wide: true,
    buttons: [{
      text: 'حفظ', click: o => {
        const d = readForm(o, F);
        if (!d.code) d.code = genBarcode();
        if (DB.items.some(i => i.code === d.code && i !== item)) { toast('الباركود مستخدم لصنف آخر', 'bad'); return false; }
        if (d.type === 'phone' && isNew && !$('[name=serialized]', o).checked) d.serialized = true;
        if (isNew) {
          const q0 = num(d.qty); delete d.qty;
          const it = { id: uid(), ...d, qty: 0, created: nowISO() }; DB.items.push(it);
          if (q0 && !it.serialized) stockMove(it.id, q0, 'opening', 'رصيد أول المدة', it.cost);
          audit('إضافة صنف', d.name);
        } else {
          if (item.price !== d.price || item.cost !== d.cost) DB.stockMoves.push({ id: uid(), date: nowISO(), itemId: item.id, qty: 0, kind: 'price', ref: `سعر ${fmt(item.price)}→${fmt(d.price)} / تكلفة ${fmt(item.cost)}→${fmt(d.cost)}`, user: me() });
          Object.assign(item, d); audit('تعديل صنف', d.name);
        }
        save(); cb && cb();
      }
    }, ...(item ? [{ text: '🗑️ حذف', cls: 'bad', click: async () => {
      if (DB.sales.some(s => s.lines.some(l => l.itemId === item.id)) || DB.purchases.some(p => p.lines.some(l => l.itemId === item.id))) { toast('الصنف له حركات — تم إيقافه بدلاً من الحذف', 'warn'); item.active = false; }
      else if (await confirmBox('حذف الصنف نهائياً؟')) DB.items.splice(DB.items.indexOf(item), 1); else return false;
      audit('حذف/إيقاف صنف', item.name); save(); cb && cb();
    } }, { text: '🏷️ باركود', cls: 'ghost', close: false, click: () => printLabels([{ item, n: 1 }]) }] : []), { text: 'إلغاء', cls: 'ghost' }]
  });
}
function itemHistory(id) {
  const it = find('items', id);
  const moves = DB.stockMoves.filter(m => m.itemId === id).slice().reverse();
  const K = { sale: 'بيع', purchase: 'شراء', opening: 'أول المدة', adjust: 'تسوية', count: 'جرد', return_sale: 'مرتجع بيع', return_purchase: 'مرتجع شراء', repair: 'صيانة', used: 'شراء مستعمل', price: 'تغيير سعر', void: 'إلغاء فاتورة' };
  modal({ title: '📜 حركة الصنف: ' + esc(it.name), wide: true, body: `<div class="mb">الرصيد الحالي: <b>${fmt(it.qty)}</b></div>` + tableHTML([{ l: 'التاريخ', f: m => fmtDT(m.date) }, { l: 'الحركة', f: m => K[m.kind] || m.kind }, { l: 'الكمية', f: m => `<b class="${m.qty < 0 ? 'bad-t' : 'ok-t'}">${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</b>` }, { l: 'المرجع', k: 'ref' }, { l: 'المستخدم', k: 'user' }], moves, { limit: 1000 }) });
}
function adjustDialog(id, cb) {
  const it = find('items', id);
  const F = [{ k: 'qty', l: 'الكمية الفعلية الموجودة', t: 'number', d: it.qty, req: true }, { k: 'reason', l: 'السبب', t: 'select', o: [['جرد', 'جرد'], ['تالف', 'تالف'], ['فقد', 'فقد / سرقة'], ['هدية', 'هدية / عينة'], ['استخدام داخلي', 'استخدام داخلي'], ['تصحيح', 'تصحيح خطأ']] }];
  modal({ title: '⚖️ تسوية: ' + esc(it.name), body: `<p>الرصيد الحالي بالسيستم: <b>${fmt(it.qty)}</b></p>` + formHTML(F), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); const diff = r2(d.qty - num(it.qty)); if (!diff) return; stockMove(id, diff, 'adjust', d.reason); audit('تسوية مخزون', `${it.name}: ${diff > 0 ? '+' : ''}${diff} (${d.reason})`); save(); cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function stockCount(cb) {
  const items = DB.items.filter(i => i.active !== false && i.type !== 'service' && !i.serialized);
  const o = modal({
    title: '📋 جرد المخزون', xwide: true,
    body: `<div class="row mb"><input id="scq" placeholder="بحث / امسح باركود"></div><div class="tbl-wrap" style="max-height:55vh"><table class="t"><thead><tr><th>الصنف</th><th>الباركود</th><th>بالسيستم</th><th>الفعلي</th><th>الفرق</th></tr></thead><tbody>${items.map(i => `<tr data-n="${esc(norm(i.name + ' ' + i.code))}"><td>${esc(i.name)}</td><td class="ltr">${esc(i.code)}</td><td>${fmt(i.qty)}</td><td><input type="number" step="any" data-c="${i.id}" style="width:90px"></td><td data-d="${i.id}"></td></tr>`).join('')}</tbody></table></div><p class="muted">اترك الخانة فاضية للأصناف اللي ماتجردتش. الأجهزة بسيريال تتجرد من شاشة السيريالات.</p>`,
    buttons: [{ text: '✔ اعتماد الجرد', cls: 'ok', click: async o => {
      const ch = $$('[data-c]', o).filter(i => i.value !== '');
      if (!ch.length) return;
      if (!(await confirmBox(`اعتماد جرد ${ch.length} صنف؟`, 'اعتماد', 'ok'))) return false;
      const no = nextNo('count');
      ch.forEach(i => { const it = find('items', i.dataset.c); const d = r2(num(i.value) - num(it.qty)); if (d) stockMove(it.id, d, 'count', 'جرد رقم ' + no); });
      audit('جرد مخزون', `رقم ${no} — ${ch.length} صنف`); save(); cb(); toast('تم اعتماد الجرد', 'ok');
    } }, { text: 'إلغاء', cls: 'ghost' }]
  });
  $$('[data-c]', o).forEach(i => i.oninput = () => { const it = find('items', i.dataset.c); const d = r2(num(i.value) - num(it.qty)); $(`[data-d="${it.id}"]`, o).innerHTML = i.value === '' ? '' : `<b class="${d < 0 ? 'bad-t' : d > 0 ? 'ok-t' : ''}">${d > 0 ? '+' : ''}${fmt(d)}</b>`; });
  $('#scq', o).oninput = e => { const v = norm(e.target.value); $$('tbody tr', o).forEach(tr => tr.style.display = !v || tr.dataset.n.includes(v) ? '' : 'none'); };
  $('#scq', o).onkeydown = e => { if (e.key === 'Enter') { const tr = $$('tbody tr', o).find(t => t.style.display !== 'none'); if (tr) { const inp = $('input', tr); inp.value = num(inp.value) + 1; inp.oninput(); e.target.value = ''; e.target.oninput({ target: e.target }); } } };
}
function serialsDialog(itemId, cb) {
  const it = find('items', itemId);
  const ST = { in: ['متاح', 'ok'], sold: ['مباع', 'pri'], returned_sup: ['مرتجع للمورد', 'warn'], reserved: ['محجوز', 'vio'], damaged: ['تالف', 'bad'] };
  const draw = o => {
    const list = DB.serials.filter(s => s.itemId === itemId);
    $('.mb', o).innerHTML = `<div class="row mb"><button class="btn" id="sadd">➕ إضافة أجهزة (رصيد أول / تسوية)</button><span class="muted">متاح: ${list.filter(s => s.status === 'in').length} من ${list.length}</span></div>` +
      tableHTML([{ l: 'IMEI 1', f: s => `<span class="ltr">${esc(s.imei)}</span>` }, { l: 'IMEI 2', f: s => `<span class="ltr">${esc(s.imei2 || '')}</span>` }, { l: 'اللون', k: 'color' }, { l: 'المساحة', k: 'storage' }, { l: 'الحالة', f: s => s.condition === 'used' ? 'مستعمل' : 'جديد' },
        { l: 'التكلفة', f: s => can('items_cost') ? fmt(s.cost) : '—' }, { l: 'السعر', f: s => fmt(s.price || it.price) }, { l: 'الوضع', f: s => `<span class="tag ${(ST[s.status] || ['', ''])[1]}">${(ST[s.status] || [s.status])[0]}</span>` },
        { l: '', f: s => s.status === 'in' ? `<button class="btn sm ghost" data-ed="${s.id}">✏️</button> <button class="btn sm ghost" data-lbl="${s.id}">🏷️</button>` : '' }], list.slice().reverse());
    $('#sadd', o).onclick = () => addSerials(it, () => { stockCountFix(it); draw(o); cb && cb(); });
    $$('[data-ed]', o).forEach(b => b.onclick = () => editSerial(find('serials', b.dataset.ed), () => { stockCountFix(it); draw(o); cb && cb(); }));
    $$('[data-lbl]', o).forEach(b => b.onclick = () => { const s = find('serials', b.dataset.lbl); printLabels([{ item: { ...it, code: s.imei, price: s.price || it.price }, n: 1 }]); });
  };
  const o = modal({ title: '📱 أجهزة: ' + esc(it.name), xwide: true });
  draw(o);
}
function stockCountFix(it) { const n = DB.serials.filter(s => s.itemId === it.id && s.status === 'in').length; if (n !== num(it.qty)) { stockMove(it.id, n - num(it.qty), 'adjust', 'مزامنة السيريالات'); save(); } }
function addSerials(it, cb) {
  const F = [{ k: 'imeis', l: 'IMEI (كل جهاز في سطر — ممكن IMEI1,IMEI2)', t: 'textarea', full: true, req: true }, { k: 'color', l: 'اللون' }, { k: 'storage', l: 'المساحة / الرامات' },
    { k: 'condition', l: 'الحالة', t: 'select', o: [['new', 'جديد'], ['used', 'مستعمل']] }, { k: 'cost', l: 'التكلفة للجهاز', t: 'number', d: it.cost }, { k: 'price', l: 'سعر البيع', t: 'number', d: it.price }];
  modal({ title: 'إضافة أجهزة', body: formHTML(F), wide: true, buttons: [{ text: 'حفظ', click: o => {
    const d = readForm(o, F); let n = 0;
    for (const line of d.imeis.split(/\r?\n/).map(x => x.trim()).filter(Boolean)) {
      const [a, b] = line.split(/[,\s]+/);
      if (serialByImei(a)) { toast('مكرر: ' + a, 'warn'); continue; }
      DB.serials.push({ id: uid(), itemId: it.id, imei: a, imei2: b || '', color: d.color, storage: d.storage, condition: d.condition, cost: d.cost, price: d.price, status: 'in', date: nowISO(), source: 'manual' }); n++;
    }
    audit('إضافة سيريالات', `${it.name}: ${n}`); save(); cb(); toast(`تم إضافة ${n} جهاز`, 'ok');
  } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function editSerial(s, cb) {
  const F = [{ k: 'imei', l: 'IMEI 1', req: true }, { k: 'imei2', l: 'IMEI 2' }, { k: 'color', l: 'اللون' }, { k: 'storage', l: 'المساحة' }, { k: 'condition', l: 'الحالة', t: 'select', o: [['new', 'جديد'], ['used', 'مستعمل']] },
    { k: 'cost', l: 'التكلفة', t: 'number' }, { k: 'price', l: 'السعر', t: 'number' }, { k: 'status', l: 'الوضع', t: 'select', o: [['in', 'متاح'], ['reserved', 'محجوز'], ['damaged', 'تالف']] }, { k: 'notes', l: 'ملاحظات', full: true }];
  modal({ title: 'تعديل جهاز', body: formHTML(F, s), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); Object.assign(s, d); audit('تعديل سيريال', s.imei); save(); cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
async function importItems(cb) {
  const txt = await api.dialog.openText(['csv', 'txt']);
  if (!txt) return toast('اختار ملف CSV بالأعمدة: name,code,type,category,brand,cost,price,wholesale,qty,min', 'warn');
  const lines = txt.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  let n = 0;
  for (const ln of lines) {
    const cells = ln.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    const r = Object.fromEntries(head.map((h, i) => [h, cells[i] || '']));
    if (!r.name) continue;
    let cat = DB.categories.find(c => c.name === r.category); if (r.category && !cat) { cat = { id: uid(), name: r.category }; DB.categories.push(cat); }
    let it = r.code && DB.items.find(i => i.code === r.code);
    if (!it) { it = { id: uid(), name: r.name, code: r.code || genBarcode(), type: ITEM_TYPES[r.type] ? r.type : 'accessory', cat: cat?.id || '', brand: r.brand, cost: num(r.cost), price: num(r.price), wholesale: num(r.wholesale), min: r.min ? num(r.min) : DB.settings.lowStockDefault, qty: 0, active: true, unit: 'قطعة', created: nowISO() }; DB.items.push(it); if (num(r.qty)) stockMove(it.id, num(r.qty), 'opening', 'استيراد'); }
    else Object.assign(it, { name: r.name, cost: num(r.cost) || it.cost, price: num(r.price) || it.price });
    n++;
  }
  audit('استيراد أصناف', n); save(); cb(); toast(`تم استيراد ${n} صنف`, 'ok');
}
function simpleList(col, title, cb) {
  const draw = o => {
    $('.mb', o).innerHTML = `<div class="row mb"><input id="sln" placeholder="اسم جديد"><button class="btn" id="sla">إضافة</button></div>` + tableHTML([{ l: 'الاسم', k: 'name' }, { l: 'عدد الأصناف', f: x => DB.items.filter(i => i.cat === x.id).length }, { l: '', f: x => `<button class="btn sm ghost" data-r="${x.id}">✏️</button> <button class="btn sm bad" data-d="${x.id}">🗑️</button>` }], DB[col]);
    $('#sla', o).onclick = () => { const v = $('#sln', o).value.trim(); if (!v) return; DB[col].push({ id: uid(), name: v }); save(); draw(o); cb && cb(); };
    $$('[data-r]', o).forEach(b => b.onclick = async () => { const x = find(col, b.dataset.r); const v = await promptBox('تعديل', 'الاسم', x.name); if (v) { x.name = v; save(); draw(o); cb && cb(); } });
    $$('[data-d]', o).forEach(b => b.onclick = async () => { if (DB.items.some(i => i.cat === b.dataset.d)) return toast('القسم مستخدم في أصناف', 'warn'); if (await confirmBox('حذف؟')) { DB[col] = DB[col].filter(x => x.id !== b.dataset.d); save(); draw(o); cb && cb(); } });
  };
  draw(modal({ title, wide: true }));
}

/* -------- طباعة الباركود -------- */
function printLabels(list, size) {
  const s = size || DB.settings.labelSize || '38x25';
  const [w, h] = s.split('x').map(Number);
  const one = (it) => `<div style="width:${w}mm;height:${h}mm;box-sizing:border-box;padding:1mm;text-align:center;page-break-after:always;overflow:hidden;font-family:Arial">
    <div style="font-size:7pt;font-weight:bold;white-space:nowrap;overflow:hidden">${esc(DB.settings.shopName)}</div><div style="font-size:7pt;white-space:nowrap;overflow:hidden">${esc(it.name)}</div>
    ${barcodeSVG(it.code, { h: Math.max(18, h * 2.2 - 30), scale: 1 })}<div style="font-size:9pt;font-weight:bold">${fmt(it.price)} ${esc(DB.settings.currency)}</div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${w}mm ${h}mm;margin:0}body{margin:0}</style></head><body dir="rtl">${list.flatMap(({ item, n }) => Array(n).fill(one(item))).join('')}</body></html>`;
  if (api.printHtml) api.printHtml(html, { printer: DB.settings.labelPrinter || DB.settings.printer, silent: false });
  else { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(f); f.contentDocument.write(html); f.contentDocument.close(); setTimeout(() => f.contentWindow.print(), 300); }
}
Pages.labels = el => {
  const sel = new Map();
  el.innerHTML = `<div class="grid g2"><div class="card"><h3>اختيار الأصناف</h3><input id="lq" placeholder="بحث أو امسح باركود" class="mb"><div id="lres"></div></div>
  <div class="card"><h3>قائمة الطباعة</h3><div class="row mb"><label>مقاس الملصق</label><select id="lsz" style="width:140px">${['38x25', '40x30', '50x25', '50x30', '58x40', '30x20'].map(s => `<option ${s === (DB.settings.labelSize || '38x25') ? 'selected' : ''}>${s}</option>`).join('')}</select><span class="muted">مم</span></div>
  <div id="lsel"></div><div class="row mt"><button class="btn ok" id="lprint">🖨️ طباعة</button><button class="btn ghost" id="lclr">مسح</button></div></div></div>`;
  const res = q => { const l = DB.items.filter(i => i.active !== false && i.type !== 'service' && match(q, i.name, i.code)).slice(0, 60); $('#lres').innerHTML = tableHTML([{ l: 'الصنف', k: 'name' }, { l: 'الباركود', f: i => `<span class="ltr">${esc(i.code)}</span>` }, { l: 'الكمية', f: i => fmt(i.qty) }, { l: '', f: i => `<button class="btn sm" data-add="${i.id}">➕</button>` }], l); $$('[data-add]', el).forEach(b => b.onclick = () => add(b.dataset.add)); };
  const add = (id, n) => { const it = find('items', id); sel.set(id, (sel.get(id) || 0) + (n || 1)); drawSel(); };
  const drawSel = () => { $('#lsel').innerHTML = tableHTML([{ l: 'الصنف', f: x => esc(find('items', x.id).name) }, { l: 'عدد الملصقات', f: x => `<input type="number" value="${x.n}" data-n="${x.id}" style="width:80px">` }, { l: '', f: x => `<button class="btn sm bad" data-rm="${x.id}">✕</button>` }], [...sel].map(([id, n]) => ({ id, n }))); $$('[data-n]', el).forEach(i => i.onchange = () => sel.set(i.dataset.n, Math.max(1, num(i.value)))); $$('[data-rm]', el).forEach(b => b.onclick = () => { sel.delete(b.dataset.rm); drawSel(); }); };
  $('#lq').oninput = debounce(e => res(e.target.value), 200);
  $('#lq').onkeydown = e => { if (e.key === 'Enter') { const it = itemByCode(e.target.value); if (it) add(it.id); e.target.value = ''; } };
  $('#lsz').onchange = e => { DB.settings.labelSize = e.target.value; save(); };
  $('#lprint').onclick = () => { if (!sel.size) return toast('اختار أصناف', 'warn'); printLabels([...sel].map(([id, n]) => ({ item: find('items', id), n })), $('#lsz').value); };
  $('#lclr').onclick = () => { sel.clear(); drawSel(); };
  $('#lprint').insertAdjacentHTML('afterend', ' <button class="btn ghost" id="lstock">كل المخزون بالكميات</button>');
  $('#lstock').onclick = () => { DB.items.filter(i => i.active !== false && i.type !== 'service' && num(i.qty) > 0 && !i.serialized).forEach(i => sel.set(i.id, Math.ceil(num(i.qty)))); drawSel(); };
  res(''); drawSel();
};

/* -------- بحث IMEI -------- */
Pages.imei = el => {
  el.innerHTML = `<div class="card" style="max-width:700px"><h3>🔍 تتبع جهاز بالـ IMEI / السيريال</h3><div class="row"><input id="imq" class="ltr" placeholder="اكتب أو امسح IMEI" style="flex:1;font-size:18px"><button class="btn" id="imb">بحث</button></div><p class="muted">بيظهر تاريخ الجهاز كامل: شراء، بيع، مرتجع، صيانة.</p></div><div id="imr" class="mt"></div>`;
  const run = () => {
    const v = $('#imq').value.trim(); if (!v) return;
    const s = DB.serials.filter(x => (x.imei || '').includes(v) || (x.imei2 || '').includes(v));
    const reps = DB.repairs.filter(r => (r.imei || '').includes(v));
    const used = DB.usedBuys.filter(u => (u.imei || '').includes(v));
    let h = '';
    s.forEach(x => {
      const it = find('items', x.itemId), sale = x.saleId && find('sales', x.saleId), pur = x.purchaseId && find('purchases', x.purchaseId);
      h += `<div class="card mb"><h3>📱 ${esc(it?.name)} — <span class="ltr">${esc(x.imei)}</span></h3>
      <div class="grid g3"><div>الحالة: <b>${{ in: 'متاح بالمخزن', sold: 'مباع', returned_sup: 'مرتجع للمورد', reserved: 'محجوز', damaged: 'تالف' }[x.status] || x.status}</b></div><div>اللون: ${esc(x.color || '-')} — ${esc(x.storage || '')}</div><div>${x.condition === 'used' ? 'مستعمل' : 'جديد'}</div>
      <div>دخل المخزن: ${fmtDT(x.date)}</div><div>${pur ? 'من فاتورة شراء ' + pur.no + ' — ' + esc(find('suppliers', pur.supplierId)?.name || '') : x.source === 'used' ? 'شراء مستعمل' : 'إضافة يدوية'}</div><div>${can('items_cost') ? 'التكلفة: ' + fmt(x.cost) : ''}</div>
      ${sale ? `<div>تم البيع: ${fmtDT(sale.date)}</div><div>فاتورة ${sale.no} — للعميل: ${esc(custName(sale.customerId))}</div><div>بسعر: ${fmt(x.salePrice)}</div>` : ''}</div>
      ${sale ? `<button class="btn sm ghost mt" onclick="viewSale('${sale.id}')">عرض الفاتورة</button>` : ''}</div>`;
    });
    used.forEach(u => h += `<div class="card mb"><h3>📥 شراء مستعمل — ${esc(u.device)}</h3>من: ${esc(u.sellerName)} (${esc(u.sellerNid || '')}) — ${fmtDT(u.date)} — بمبلغ ${fmt(u.price)}</div>`);
    reps.forEach(r => h += `<div class="card mb"><h3>🔧 صيانة رقم ${r.no} — ${esc(r.device)}</h3>${fmtDT(r.date)} — ${esc(r.custName)} — ${esc(r.problem)} — <span class="tag">${REPAIR_ST[r.status]?.[0]}</span> <button class="btn sm ghost" onclick="repairView('${r.id}')">فتح</button></div>`);
    $('#imr').innerHTML = h || '<div class="empty">لا توجد نتائج</div>';
  };
  $('#imb').onclick = run; $('#imq').onkeydown = e => e.key === 'Enter' && run(); $('#imq').focus();
};
