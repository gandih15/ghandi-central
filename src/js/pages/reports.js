/* التقارير */
'use strict';
Pages.reports = el => {
  const R = [['summary', 'ملخص الأرباح والخسائر'], ['daily', 'التقرير اليومي'], ['sales', 'المبيعات تفصيلي'], ['items', 'مبيعات الأصناف'], ['cats', 'المبيعات حسب القسم'], ['users', 'المبيعات حسب الكاشير'],
    ['repairs', 'تقرير الصيانة'], ['techs', 'أداء الفنيين'], ['fin', 'الخدمات المالية'], ['stock', 'جرد وقيمة المخزون'], ['low', 'النواقص'], ['stagnant', 'أصناف راكدة'], ['serials', 'الأجهزة بالمخزن (IMEI)'],
    ['inst', 'الأقساط المستحقة'], ['debts', 'مديونيات العملاء'], ['supdebts', 'أرصدة الموردين'], ['purch', 'المشتريات'], ['exp', 'المصروفات'], ['used', 'شراء المستعمل'], ['moves', 'حركة الحسابات']];
  let rep = 'summary', from = today().slice(0, 8) + '01', to = today();
  el.innerHTML = `<div class="row mb"><select id="rr" style="width:240px">${R.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
    <label>من</label><input type="date" id="rf" value="${from}" style="width:150px"><label>إلى</label><input type="date" id="rt" value="${to}" style="width:150px">
    ${[['اليوم', 0], ['أمس', 1], ['الأسبوع', 7], ['الشهر', 'm'], ['السنة', 'y']].map(([l, v]) => `<button class="btn sm ghost" data-q="${v}">${l}</button>`).join('')}
    <span class="sp"></span><button class="btn ghost" id="rprint">🖨️ طباعة</button><button class="btn ghost" id="rpdf">📄 PDF</button><button class="btn ghost" id="rcsv">📤 Excel</button></div><div id="rout"></div>`;
  let current = { cols: [], rows: [], html: '' };
  const showCost = can('items_cost');
  const inR = d => dOnly(d) >= from && dOnly(d) <= to;
  const T = (cols, rows, extra = '') => { current = { cols, rows }; return extra + tableHTML(cols, rows, { foot: true }); };
  const builders = {
    summary() {
      if (!showCost) return '<div class="alert bad">تحتاج صلاحية رؤية الأرباح</div>';
      const s = periodStats(from, to); current = { cols: [], rows: [] };
      const line = (l, v, c = '') => `<div class="sum-row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${l}</span><b class="${c}">${fmt(v)}</b></div>`;
      return `<div class="grid g2"><div class="card"><h3>الإيرادات والأرباح</h3>${line('إجمالي المبيعات (بعد المرتجع)', s.salesRev)}${line('تكلفة البضاعة المباعة', s.salesCost, 'bad-t')}${line('ربح المبيعات', s.salesProfit, 'ok-t')}
        ${line('إيراد الصيانة', s.repRev)}${line('تكلفة قطع الغيار والفني الخارجي', s.repCost, 'bad-t')}${line('ربح الصيانة', s.repProfit, 'ok-t')}${line('ربح الخدمات المالية (كاش/رصيد/فواتير)', s.finProfit, 'ok-t')}
        ${line('فوائد التقسيط', s.interest, 'ok-t')}${line('غرامات تأخير', s.lateFees, 'ok-t')}${line('إيرادات أخرى', s.otherIncome, 'ok-t')}${line('إجمالي الربح', s.gross, 'ok-t')}</div>
        <div class="card"><h3>المصروفات وصافي الربح</h3>${line('المصروفات', s.expenses, 'bad-t')}${line('الرواتب والسلف والعمولات', s.payroll, 'bad-t')}<div class="sum-row" style="font-size:24px;padding:14px 0"><span>صافي الربح</span><b class="${s.net >= 0 ? 'ok-t' : 'bad-t'}">${fmt(s.net)}</b></div>
        <div class="muted">عدد الفواتير: ${s.sales.length} — المرتجعات: ${s.rets.length} — تذاكر مسلمة: ${s.reps.length} — عمليات مالية: ${s.fin.length}</div></div></div>`;
    },
    daily() {
      const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
      const rows = days.map(d => { const s = periodStats(d, d); return { id: d, d, sales: s.salesRev, sp: s.salesProfit, rep: s.repRev, rp: s.repProfit, fin: s.finProfit, exp: s.expenses + s.payroll, net: s.net }; }).filter(r => r.sales || r.rep || r.fin || r.exp);
      return T([{ l: 'اليوم', f: r => fmtDate(r.d) }, { l: 'المبيعات', k: 'sales', money: true, sum: true }, ...(showCost ? [{ l: 'ربح المبيعات', k: 'sp', money: true, sum: true }] : []), { l: 'الصيانة', k: 'rep', money: true, sum: true }, ...(showCost ? [{ l: 'ربح الصيانة', k: 'rp', money: true, sum: true }] : []), { l: 'ربح الخدمات', k: 'fin', money: true, sum: true }, { l: 'مصروفات', k: 'exp', money: true, sum: true }, ...(showCost ? [{ l: 'الصافي', k: 'net', money: true, sum: true }] : [])], rows);
    },
    sales() { return T([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: s => fmtDT(s.date) }, { l: 'العميل', f: s => esc(custName(s.customerId)) }, { l: 'النوع', f: s => ({ cash: 'نقدي', credit: 'آجل', installment: 'تقسيط' }[s.type]) }, { l: 'الإجمالي', k: 'subtotal', money: true, sum: true }, { l: 'الخصم', k: 'discount', money: true, sum: true }, { l: 'الصافي', k: 'total', money: true, sum: true }, { l: 'المدفوع', k: 'paid', money: true, sum: true }, ...(showCost ? [{ l: 'التكلفة', k: 'cost', money: true, sum: true }, { l: 'الربح', f: s => s.total - s.cost, money: true, sum: true }] : []), { l: 'الكاشير', k: 'user' }], DB.sales.filter(s => s.status !== 'void' && inR(s.date))); },
    items() {
      const m = {}; DB.sales.filter(s => s.status !== 'void' && inR(s.date)).forEach(s => s.lines.forEach(l => { const k = l.itemId; m[k] = m[k] || { id: k, name: l.name, q: 0, v: 0, c: 0 }; m[k].q += l.qty; m[k].v += l.qty * l.price; m[k].c += l.qty * l.cost; }));
      return T([{ l: 'الصنف', k: 'name' }, { l: 'الكمية', k: 'q', money: true, sum: true }, { l: 'القيمة', k: 'v', money: true, sum: true }, ...(showCost ? [{ l: 'التكلفة', k: 'c', money: true, sum: true }, { l: 'الربح', f: r => r.v - r.c, money: true, sum: true }, { l: 'هامش %', f: r => r.v ? fmt((r.v - r.c) / r.v * 100) + '%' : '' }] : [])], Object.values(m).sort((a, b) => b.v - a.v));
    },
    cats() {
      const m = {}; DB.sales.filter(s => s.status !== 'void' && inR(s.date)).forEach(s => s.lines.forEach(l => { const c = find('categories', find('items', l.itemId)?.cat)?.name || 'بدون قسم'; m[c] = m[c] || { id: c, name: c, q: 0, v: 0, c: 0 }; m[c].q += l.qty; m[c].v += l.qty * l.price; m[c].c += l.qty * l.cost; }));
      const rows = Object.values(m).sort((a, b) => b.v - a.v);
      return `<div class="card mb">${barChart(rows.map(r => r.name), [{ name: 'المبيعات', values: rows.map(r => r.v) }, ...(showCost ? [{ name: 'الربح', values: rows.map(r => r.v - r.c) }] : [])])}</div>` + T([{ l: 'القسم', k: 'name' }, { l: 'الكمية', k: 'q', money: true, sum: true }, { l: 'المبيعات', k: 'v', money: true, sum: true }, ...(showCost ? [{ l: 'الربح', f: r => r.v - r.c, money: true, sum: true }] : [])], rows);
    },
    users() { const m = {}; DB.sales.filter(s => s.status !== 'void' && inR(s.date)).forEach(s => { m[s.user] = m[s.user] || { id: s.user, u: s.user, n: 0, v: 0 }; m[s.user].n++; m[s.user].v += s.total; }); return T([{ l: 'المستخدم', k: 'u' }, { l: 'عدد الفواتير', k: 'n', sum: true }, { l: 'المبيعات', k: 'v', money: true, sum: true }], Object.values(m)); },
    repairs() {
      const rows = DB.repairs.filter(r => inR(r.date));
      const byS = Object.entries(REPAIR_ST).map(([k, v]) => `<span class="tag ${v[1]}">${v[0]}: ${rows.filter(r => r.status === k).length}</span>`).join(' ');
      return T([{ l: 'رقم', k: 'no' }, { l: 'الاستلام', f: r => fmtDate(r.date) }, { l: 'التسليم', f: r => fmtDate(r.deliveredAt) }, { l: 'العميل', k: 'custName' }, { l: 'الجهاز', k: 'device' }, { l: 'العطل', k: 'problem' }, { l: 'الفني', f: r => esc(find('employees', r.techId)?.name || '') }, { l: 'الحالة', f: r => REPAIR_ST[r.status][0] }, { l: 'الإجمالي', f: repTotal, money: true, sum: true }, { l: 'المدفوع', f: repPaid, money: true, sum: true }, ...(showCost ? [{ l: 'التكلفة', f: repCost, money: true, sum: true }, { l: 'الربح', f: r => repTotal(r) - repCost(r), money: true, sum: true }] : [])], rows, `<div class="mb">${byS}</div>`);
    },
    techs() {
      const rows = DB.employees.map(e => { const rs = DB.repairs.filter(r => r.techId === e.id && inR(r.deliveredAt || r.date)); const d = rs.filter(r => r.status === 'delivered'); return { id: e.id, name: e.name, all: rs.length, done: d.length, fail: rs.filter(r => ['cant_fix', 'returned'].includes(r.status)).length, labor: sum(d, 'labor'), rev: sum(d, repTotal), comm: sum(d, r => num(r.techCommission)), warr: DB.repairs.filter(r => r.warrantyOf && find('repairs', r.warrantyOf)?.techId === e.id && inR(r.date)).length }; });
      return T([{ l: 'الفني', k: 'name' }, { l: 'التذاكر', k: 'all', sum: true }, { l: 'تم الإصلاح', k: 'done', sum: true }, { l: 'لم يصلح', k: 'fail', sum: true }, { l: 'رجعت ضمان', k: 'warr', sum: true }, { l: 'المصنعية', k: 'labor', money: true, sum: true }, { l: 'الإيراد', k: 'rev', money: true, sum: true }, { l: 'العمولة المستحقة', k: 'comm', money: true, sum: true }], rows);
    },
    fin() {
      const rows = DB.finops.filter(x => !x.void && inR(x.date));
      const byAcc = DB.accounts.filter(a => ['wallet', 'recharge', 'provider'].includes(a.type)).map(a => { const l = rows.filter(x => x.accountId === a.id); return { id: a.id, name: a.name, n: l.length, amt: sum(l, 'amount'), fee: sum(l, 'fee'), profit: sum(l, 'profit') }; });
      return `<h3>حسب الحساب</h3>` + tableHTML([{ l: 'الحساب', k: 'name' }, { l: 'عدد العمليات', k: 'n', sum: true }, { l: 'إجمالي القيم', k: 'amt', money: true, sum: true }, { l: 'العمولات', k: 'fee', money: true, sum: true }, { l: 'الربح', k: 'profit', money: true, sum: true }], byAcc, { foot: true }) + '<h3 class="mt">تفصيلي</h3>' +
        T([{ l: 'رقم', k: 'no' }, { l: 'الوقت', f: x => fmtDT(x.date) }, { l: 'النوع', f: x => FIN_KINDS[x.kind][0] }, { l: 'الحساب', f: x => esc(accName(x.accountId)) }, { l: 'رقم العميل', k: 'phone' }, { l: 'القيمة', k: 'amount', money: true, sum: true }, { l: 'كاش', k: 'cash', money: true, sum: true }, { l: 'الربح', k: 'profit', money: true, sum: true }, { l: 'بواسطة', k: 'user' }], rows);
    },
    stock() { return T([{ l: 'الباركود', k: 'code' }, { l: 'الصنف', k: 'name' }, { l: 'القسم', f: i => esc(find('categories', i.cat)?.name || '') }, { l: 'الكمية', k: 'qty', money: true, sum: true }, ...(showCost ? [{ l: 'التكلفة', k: 'cost', money: true }, { l: 'قيمة بالتكلفة', f: i => Math.max(0, num(i.qty)) * num(i.cost), money: true, sum: true }] : []), { l: 'سعر البيع', k: 'price', money: true }, { l: 'قيمة بالبيع', f: i => Math.max(0, num(i.qty)) * num(i.price), money: true, sum: true }], DB.items.filter(i => i.active !== false && i.type !== 'service')); },
    low() { return T([{ l: 'الصنف', k: 'name' }, { l: 'الكمية', k: 'qty', money: true }, { l: 'حد الطلب', f: i => fmt(i.min ?? DB.settings.lowStockDefault) }, { l: 'آخر مورد', f: i => esc(find('suppliers', i.lastSupplier)?.name || '') }, { l: 'آخر تكلفة', f: i => fmt(i.lastCost || i.cost) }], lowStock()); },
    stagnant() {
      const lastSale = {}; DB.sales.filter(s => s.status !== 'void').forEach(s => s.lines.forEach(l => { if (!lastSale[l.itemId] || s.date > lastSale[l.itemId]) lastSale[l.itemId] = s.date; }));
      const rows = DB.items.filter(i => i.active !== false && i.type !== 'service' && num(i.qty) > 0 && (!lastSale[i.id] || dOnly(lastSale[i.id]) < from));
      return T([{ l: 'الصنف', k: 'name' }, { l: 'الكمية', k: 'qty', money: true, sum: true }, { l: 'آخر بيع', f: i => lastSale[i.id] ? fmtDate(lastSale[i.id]) : 'لم يبع أبداً' }, ...(showCost ? [{ l: 'قيمة راكدة', f: i => num(i.qty) * num(i.cost), money: true, sum: true }] : [])], rows, '<p class="muted">أصناف بالمخزن لم تبع منذ تاريخ "من"</p>');
    },
    serials() { return T([{ l: 'الصنف', f: s => esc(find('items', s.itemId)?.name) }, { l: 'IMEI', f: s => `<span class="ltr">${esc(s.imei)}</span>` }, { l: 'اللون', k: 'color' }, { l: 'الحالة', f: s => s.condition === 'used' ? 'مستعمل' : 'جديد' }, { l: 'تاريخ الدخول', f: s => fmtDate(s.date) }, { l: 'أيام بالمخزن', f: s => daysBetween(dOnly(s.date), today()) }, ...(showCost ? [{ l: 'التكلفة', k: 'cost', money: true, sum: true }] : []), { l: 'السعر', f: s => num(s.price) || num(find('items', s.itemId)?.price), money: true, sum: true }], DB.serials.filter(s => s.status === 'in')); },
    inst() { const rows = DB.installments.filter(p => p.status === 'active').flatMap(p => p.schedule.filter(x => x.amount - num(x.paid) > 0.01 && x.due <= to).map(x => ({ id: p.id + x.n, p, x }))); return T([{ l: 'الخطة', f: r => r.p.no }, { l: 'العميل', f: r => esc(custName(r.p.customerId)) }, { l: 'الموبايل', f: r => esc(find('customers', r.p.customerId)?.phone || '') }, { l: 'القسط', f: r => r.x.n }, { l: 'الاستحقاق', f: r => fmtDate(r.x.due) }, { l: 'التأخير', f: r => r.x.due < today() ? daysBetween(r.x.due, today()) + ' يوم' : '' }, { l: 'المتبقي', f: r => r.x.amount - num(r.x.paid), money: true, sum: true }], rows); },
    debts() { return T([{ l: 'العميل', k: 'name' }, { l: 'الموبايل', k: 'phone' }, { l: 'الرصيد', f: c => custBalance(c.id), money: true, sum: true }], DB.customers.filter(c => custBalance(c.id) > 0).sort((a, b) => custBalance(b.id) - custBalance(a.id))); },
    supdebts() { return T([{ l: 'المورد', k: 'name' }, { l: 'الموبايل', k: 'phone' }, { l: 'الرصيد (لهم)', f: s => supBalance(s.id), money: true, sum: true }], DB.suppliers.filter(s => supBalance(s.id) !== 0)); },
    purch() { return T([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: p => fmtDate(p.date) }, { l: 'النوع', f: p => p.kind === 'return' ? 'مرتجع' : 'شراء' }, { l: 'المورد', f: p => esc(find('suppliers', p.supplierId)?.name || 'نقدي') }, { l: 'الإجمالي', f: p => p.kind === 'return' ? -p.total : p.total, money: true, sum: true }, { l: 'المدفوع', k: 'paid', money: true, sum: true }], DB.purchases.filter(p => inR(p.date))); },
    exp() { return T([{ l: 'التاريخ', f: x => fmtDT(x.date) }, { l: 'النوع', f: x => x.kind === 'income' ? 'إيراد' : 'مصروف' }, { l: 'البند', k: 'cat' }, { l: 'المبلغ', f: x => x.kind === 'income' ? -x.amount : x.amount, money: true, sum: true }, { l: 'بيان', k: 'note' }, { l: 'بواسطة', k: 'user' }], DB.expenses.filter(x => inR(x.date))); },
    used() { return T([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: u => fmtDate(u.date) }, { l: 'الجهاز', k: 'device' }, { l: 'IMEI', k: 'imei' }, { l: 'البائع', k: 'sellerName' }, { l: 'الرقم القومي', k: 'sellerNid' }, { l: 'السعر', k: 'price', money: true, sum: true }], DB.usedBuys.filter(u => inR(u.date))); },
    moves() { return T([{ l: 'الوقت', f: m => fmtDT(m.date) }, { l: 'الحساب', f: m => esc(accName(m.accountId)) }, { l: 'وارد', f: m => m.amount > 0 ? m.amount : 0, money: true, sum: true }, { l: 'منصرف', f: m => m.amount < 0 ? -m.amount : 0, money: true, sum: true }, { l: 'البيان', f: m => esc(m.ref) + ' ' + esc(m.note || '') }, { l: 'المستخدم', k: 'user' }], DB.moves.filter(m => inR(m.date))); }
  };
  const draw = () => { const name = R.find(x => x[0] === rep)[1]; try { $('#rout').innerHTML = `<div id="rbody">${builders[rep]()}</div>`; } catch (e) { $('#rout').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; } current.title = `${name} — من ${fmtDate(from)} إلى ${fmtDate(to)}`; };
  $('#rr').onchange = e => { rep = e.target.value; draw(); };
  $('#rf').onchange = e => { from = e.target.value; draw(); }; $('#rt').onchange = e => { to = e.target.value; draw(); };
  $$('[data-q]', el).forEach(b => b.onclick = () => { const v = b.dataset.q, t = today(); if (v === 'm') { from = t.slice(0, 8) + '01'; to = t; } else if (v === 'y') { from = t.slice(0, 5) + '01-01'; to = t; } else if (v === '1') { from = to = addDays(t, -1); } else { from = addDays(t, -num(v)); to = t; } $('#rf').value = from; $('#rt').value = to; draw(); });
  const printable = () => `${shopHeader()}<div class="c b lg">${esc(current.title)}</div><div class="a4">${$('#rbody').innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '')}</div>${devFooter()}`;
  $('#rprint').onclick = () => printDoc(printable(), 'A4');
  $('#rpdf').onclick = () => savePDF(printable(), current.title);
  $('#rcsv').onclick = () => current.rows?.length ? exportCSV(R.find(x => x[0] === rep)[1], current.cols, current.rows) : toast('لا يوجد جدول للتصدير', 'warn');
  draw();
};
