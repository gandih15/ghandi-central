/* الأقساط */
'use strict';
const planRemaining = p => r2(sum(p.schedule, x => x.amount - num(x.paid)));
const overdueInstallments = () => DB.installments.filter(p => p.status === 'active').flatMap(p => p.schedule.filter(x => x.amount - num(x.paid) > 0.01 && x.due < today()).map(x => ({ p, x })));

function installmentDialog(total, cart, done) {
  const c = find('customers', cart.customerId);
  const F = [{ k: 'down', l: 'المقدم', t: 'number', d: 0 }, { k: 'downAcc', l: 'المقدم في', t: 'select', o: opts(payAccounts) }, { k: 'months', l: 'عدد الشهور', t: 'number', d: 6, req: true }, { k: 'interest', l: 'نسبة الزيادة % (على المتبقي)', t: 'number', d: DB.settings.defaultInterest },
    { k: 'start', l: 'تاريخ أول قسط', t: 'date', d: addMonths(today(), 1) }, { k: 'every', l: 'كل', t: 'select', o: [['1', 'شهر'], ['0.5', 'أسبوعين'], ['0.25', 'أسبوع']] },
    { t: 'html', full: true, html: '<b>بيانات العميل والضامن</b>' }, { k: 'nid', l: 'رقم قومي العميل', d: c.nid }, { k: 'job', l: 'وظيفة العميل', d: c.job }, { k: 'address', l: 'عنوان العميل', d: c.address, full: true },
    { k: 'gName', l: 'اسم الضامن' }, { k: 'gPhone', l: 'موبايل الضامن' }, { k: 'gNid', l: 'رقم قومي الضامن' }, { k: 'gAddress', l: 'عنوان الضامن' }, { k: 'notes', l: 'ملاحظات / إيصالات أمانة', full: true }];
  const o = modal({ title: `📅 بيع بالتقسيط — ${esc(c.name)} — السعر ${money(total)}`, wide: true, body: formHTML(F, {}, 3) + '<div class="card mt" id="isch"></div>',
    buttons: [{ text: '✔ اعتماد البيع بالتقسيط', cls: 'ok', click: o => {
      const d = readForm(o, F), sch = build(d);
      if (d.down > total) { toast('المقدم أكبر من السعر', 'bad'); return false; }
      if (d.months < 1) { toast('عدد الشهور غلط', 'bad'); return false; }
      Object.assign(c, { nid: d.nid || c.nid, job: d.job || c.job, address: d.address || c.address });
      const plan = { id: uid(), no: nextNo('inst'), date: nowISO(), customerId: c.id, price: total, down: d.down, financed: sch.financed, interest: d.interest, interestAmount: sch.interestAmt, total: sch.total, months: d.months,
        schedule: sch.rows, guarantor: { name: d.gName, phone: d.gPhone, nid: d.gNid, address: d.gAddress }, notes: d.notes, status: 'active', user: me() };
      DB.installments.push(plan);
      const sale = createSale(cart, d.down > 0 ? [{ accountId: d.downAcc, amount: d.down }] : [], { installmentId: plan.id });
      plan.saleId = sale.id;
      audit('خطة تقسيط', `${plan.no} — ${c.name} — ${fmt(sch.total)}`); save();
      printInstContract(plan); done(sale);
    } }, { text: 'إلغاء', cls: 'ghost' }] });
  function build(d) {
    const financed = r2(total - d.down), interestAmt = r2(financed * d.interest / 100), tot = r2(financed + interestAmt), n = Math.max(1, Math.round(d.months));
    const m = Math.floor(tot / n), rows = [];
    for (let i = 0; i < n; i++) { const due = d.every === '1' ? addMonths(d.start, i) : addDays(d.start, Math.round(i * 30 * num(d.every))); rows.push({ n: i + 1, due, amount: i === n - 1 ? r2(tot - m * (n - 1)) : m, paid: 0 }); }
    return { financed, interestAmt, total: tot, rows };
  }
  const upd = () => { try { const d = readFormSilent(o, F); const s = build(d); $('#isch', o).innerHTML = `<div class="row"><span class="tag">المتبقي بعد المقدم: ${fmt(s.financed)}</span><span class="tag">الزيادة: ${fmt(s.interestAmt)}</span><span class="tag pri">إجمالي الأقساط: ${fmt(s.total)}</span><span class="tag ok">القسط: ${fmt(s.rows[0]?.amount)}</span></div>` + tableHTML([{ l: '#', k: 'n' }, { l: 'تاريخ الاستحقاق', f: x => fmtDate(x.due) }, { l: 'القيمة', k: 'amount', money: true }], s.rows); } catch (e) { } };
  $$('input,select', o).forEach(i => i.addEventListener('input', upd)); upd();
}
function readFormSilent(o, F) { const r = {}; F.forEach(f => { if (!f.k) return; const el = $(`[name="${f.k}"]`, o); if (el) r[f.k] = f.t === 'number' ? num(el.value) : el.value; }); return r; }

Pages.installments = el => {
  let fs = 'active', q = '';
  el.innerHTML = `<div class="grid g4 mb" id="ikpi"></div><div class="row mb"><input id="iq" placeholder="🔍 بحث بالعميل / رقم الخطة" style="flex:1"><div class="tabs" style="margin:0;border:0" id="itabs"></div><button class="btn ghost" id="iremind">💬 تذكير المتأخرين</button></div><div id="itbl"></div>`;
  const draw = () => {
    const act = DB.installments.filter(p => p.status === 'active'), od = overdueInstallments();
    const dueToday = act.flatMap(p => p.schedule.filter(x => x.due === today() && x.amount - num(x.paid) > 0.01));
    $('#ikpi').innerHTML = `<div class="kpi c1"><div class="l">خطط نشطة</div><div class="v">${act.length}</div></div><div class="kpi c3"><div class="l">مستحق اليوم</div><div class="v">${fmt(sum(dueToday, x => x.amount - num(x.paid)))}</div></div><div class="kpi c5"><div class="l">متأخرات (${od.length} قسط)</div><div class="v">${fmt(sum(od, o => o.x.amount - num(o.x.paid)))}</div></div><div class="kpi c2"><div class="l">إجمالي المتبقي عند العملاء</div><div class="v">${fmt(sum(act, planRemaining))}</div></div>`;
    $('#itabs').innerHTML = Object.entries({ active: 'النشطة', late: 'المتأخرة', done: 'المنتهية', cancelled: 'الملغاة', all: 'الكل' }).map(([k, l]) => `<button class="${k === fs ? 'act' : ''}" data-t="${k}">${l}</button>`).join('');
    $$('#itabs button').forEach(b => b.onclick = () => { fs = b.dataset.t; draw(); });
    const lateIds = new Set(od.map(o => o.p.id));
    const rows = DB.installments.filter(p => (fs === 'all' || (fs === 'late' ? lateIds.has(p.id) : p.status === fs)) && match(q, p.no, custName(p.customerId), find('customers', p.customerId)?.phone)).slice().reverse();
    $('#itbl').innerHTML = tableHTML([{ l: 'رقم', k: 'no' }, { l: 'التاريخ', f: p => fmtDate(p.date) }, { l: 'العميل', f: p => esc(custName(p.customerId)) + (lateIds.has(p.id) ? ' <span class="tag bad">متأخر</span>' : '') }, { l: 'السعر', k: 'price', money: true },
      { l: 'المقدم', k: 'down', money: true }, { l: 'إجمالي الأقساط', k: 'total', money: true, sum: true }, { l: 'المدفوع', f: p => fmt(sum(p.schedule, 'paid')), sum: p => sum(p.schedule, 'paid') }, { l: 'المتبقي', f: p => `<b>${fmt(planRemaining(p))}</b>`, sum: planRemaining },
      { l: 'القسط القادم', f: p => { const n = p.schedule.find(x => x.amount - num(x.paid) > 0.01); return n ? `${fmtDate(n.due)} — ${fmt(n.amount - num(n.paid))}` : '-'; } }, { l: '', f: p => `<button class="btn sm" data-o="${p.id}">فتح</button>` }], rows, { foot: true });
    $$('[data-o]', el).forEach(b => b.onclick = () => planView(b.dataset.o, draw));
  };
  $('#iq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#iremind').onclick = () => {
    const od = overdueInstallments(); if (!od.length) return toast('لا توجد متأخرات', 'ok');
    modal({ title: 'تذكير المتأخرين', wide: true, body: tableHTML([{ l: 'العميل', f: o => esc(custName(o.p.customerId)) }, { l: 'القسط', f: o => o.x.n }, { l: 'الاستحقاق', f: o => fmtDate(o.x.due) }, { l: 'متأخر', f: o => daysBetween(o.x.due, today()) + ' يوم' }, { l: 'المبلغ', f: o => fmt(o.x.amount - num(o.x.paid)) }, { l: '', f: (o) => `<button class="btn sm vio" data-w="${o.p.id}|${o.x.n}">💬</button>` }], od), onOpen: m => $$('[data-w]', m).forEach(b => b.onclick = () => { const [pid, n] = b.dataset.w.split('|'); const p = find('installments', pid), x = p.schedule[n - 1], c = find('customers', p.customerId); waLink(c?.phone, tpl(DB.settings.whatsappInstallment, { name: c?.name, n: x.n, amount: fmt(x.amount - num(x.paid)), date: fmtDate(x.due), shop: DB.settings.shopName })); }) });
  };
  draw();
};
function planView(id, cb) {
  const p = find('installments', id), c = find('customers', p.customerId);
  const o = modal({ title: `📅 خطة تقسيط ${p.no} — ${esc(c?.name)}`, xwide: true,
    body: `<div class="grid g4 mb"><div class="kpi"><div class="l">سعر الجهاز</div><div class="v">${fmt(p.price)}</div></div><div class="kpi"><div class="l">المقدم</div><div class="v">${fmt(p.down)}</div></div><div class="kpi"><div class="l">إجمالي الأقساط</div><div class="v">${fmt(p.total)}</div></div><div class="kpi c5"><div class="l">المتبقي</div><div class="v">${fmt(planRemaining(p))}</div></div></div>
    <div class="grid g2 mb"><div class="card"><b>العميل:</b> ${esc(c?.name)} — <span class="ltr">${esc(c?.phone || '')}</span><br>رقم قومي: ${esc(c?.nid || '-')}<br>العنوان: ${esc(c?.address || '-')}</div><div class="card"><b>الضامن:</b> ${esc(p.guarantor?.name || '-')} — <span class="ltr">${esc(p.guarantor?.phone || '')}</span><br>رقم قومي: ${esc(p.guarantor?.nid || '-')}<br>العنوان: ${esc(p.guarantor?.address || '-')}</div></div>
    ${tableHTML([{ l: '#', k: 'n' }, { l: 'الاستحقاق', f: x => fmtDate(x.due) }, { l: 'القيمة', k: 'amount', money: true }, { l: 'المدفوع', f: x => fmt(x.paid) }, { l: 'تاريخ الدفع', f: x => fmtDate(x.paidDate) },
      { l: 'الحالة', f: x => x.amount - num(x.paid) <= 0.01 ? '<span class="tag ok">مدفوع</span>' : x.due < today() ? `<span class="tag bad">متأخر ${daysBetween(x.due, today())} يوم</span>` : num(x.paid) ? '<span class="tag warn">جزئي</span>' : '<span class="tag">قادم</span>' }], p.schedule)}`,
    buttons: [...(p.status === 'active' ? [{ text: '💵 تحصيل قسط', cls: 'ok', click: () => payInstallment(p, cb) }] : []), { text: '🖨️ العقد والجدول', cls: 'ghost', close: false, click: () => printInstContract(p) },
      { text: '💬 تذكير', cls: 'vio', close: false, click: () => { const x = p.schedule.find(x => x.amount - num(x.paid) > 0.01); if (x) waLink(c?.phone, tpl(DB.settings.whatsappInstallment, { name: c?.name, n: x.n, amount: fmt(x.amount - num(x.paid)), date: fmtDate(x.due), shop: DB.settings.shopName })); } },
      ...(p.status === 'active' && isAdmin() ? [{ text: '✏️ تعديل المواعيد', cls: 'ghost', click: () => editSchedule(p, cb) }] : []), { text: 'إغلاق', cls: 'ghost' }] });
}
function payInstallment(p, cb) {
  const next = p.schedule.find(x => x.amount - num(x.paid) > 0.01);
  const late = next && next.due < today() && num(DB.settings.installmentLateFee) ? num(DB.settings.installmentLateFee) : 0;
  const F = [{ k: 'amount', l: 'المبلغ المحصل', t: 'number', req: true, d: next ? r2(next.amount - num(next.paid)) : 0 }, { k: 'lateFee', l: 'غرامة تأخير', t: 'number', d: late }, { k: 'accountId', l: 'الحساب', t: 'select', o: opts(payAccounts) }, { k: 'print', l: 'طباعة إيصال', t: 'check', d: true }];
  modal({ title: `تحصيل — خطة ${p.no} (المتبقي ${fmt(planRemaining(p))})`, body: formHTML(F), buttons: [{ text: 'حفظ', cls: 'ok', click: o => {
    const d = readForm(o, F); let left = d.amount; if (left <= 0) return false;
    if (left > planRemaining(p) + 0.01) { toast('المبلغ أكبر من المتبقي', 'bad'); return false; }
    const paidN = [];
    for (const x of p.schedule) { const rem = r2(x.amount - num(x.paid)); if (rem <= 0.01 || left <= 0) continue; const pay = Math.min(rem, left); x.paid = r2(num(x.paid) + pay); x.paidDate = today(); left = r2(left - pay); paidN.push(x.n); }
    addMove(d.accountId, d.amount + d.lateFee, 'installment', 'قسط ' + p.no, custName(p.customerId));
    p.payments = p.payments || []; p.payments.push({ date: nowISO(), amount: d.amount, lateFee: d.lateFee, accountId: d.accountId, user: me(), n: paidN });
    if (planRemaining(p) <= 0.01) p.status = 'done';
    audit('تحصيل قسط', `${p.no} — ${fmt(d.amount)}`); save();
    if (d.print) printDoc(`${shopHeader()}<div class="c b lg">إيصال تحصيل قسط</div><table class="tot"><tr><td>الخطة</td><td>${p.no}</td></tr><tr><td>العميل</td><td>${esc(custName(p.customerId))}</td></tr><tr><td>التاريخ</td><td>${fmtDT(nowISO())}</td></tr><tr><td>أقساط رقم</td><td>${paidN.join('، ')}</td></tr><tr class="b lg"><td>المبلغ</td><td>${fmt(d.amount + d.lateFee)}</td></tr><tr><td>المتبقي</td><td>${fmt(planRemaining(p))}</td></tr></table>${devFooter()}`);
    cb && cb(); renderSide();
  } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function editSchedule(p, cb) {
  modal({ title: 'تعديل مواعيد الأقساط', wide: true, body: tableHTML([{ l: '#', k: 'n' }, { l: 'التاريخ', f: x => `<input type="date" data-d="${x.n}" value="${x.due}">` }, { l: 'القيمة', f: x => `<input type="number" step="any" data-a="${x.n}" value="${x.amount}" ${num(x.paid) ? 'disabled' : ''}>` }], p.schedule),
    buttons: [{ text: 'حفظ', click: o => { p.schedule.forEach(x => { x.due = $(`[data-d="${x.n}"]`, o).value; if (!num(x.paid)) x.amount = num($(`[data-a="${x.n}"]`, o).value); }); p.total = r2(sum(p.schedule, 'amount')); audit('تعديل جدول أقساط', p.no); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function printInstContract(p) {
  const c = find('customers', p.customerId), s = find('sales', p.saleId);
  printDoc(`${shopHeader()}<div class="c b lg">عقد بيع بالتقسيط رقم ${p.no}</div><p>التاريخ: ${fmtDate(p.date)}</p>
  <p>الطرف الأول (البائع): <b>${esc(DB.settings.shopName)}</b><br>الطرف الثاني (المشتري): <b>${esc(c?.name)}</b> — رقم قومي: ${esc(c?.nid || '..............')} — موبايل: <span class="ltr">${esc(c?.phone || '')}</span><br>العنوان: ${esc(c?.address || '..............')}</p>
  <p>اشترى الطرف الثاني: <b>${s ? s.lines.map(l => esc(l.name) + (l.imei ? ` (IMEI: <span class="ltr">${esc(l.imei)}</span>)` : '')).join('، ') : ''}</b><br>بسعر إجمالي ${fmt(p.price)}، دفع منه مقدم ${fmt(p.down)}، والباقي ${fmt(p.total)} على ${p.schedule.length} قسط حسب الجدول التالي:</p>
  <table class="a4"><thead><tr><th>#</th><th>تاريخ الاستحقاق</th><th>القيمة</th><th>توقيع الاستلام</th></tr></thead><tbody>${p.schedule.map(x => `<tr><td>${x.n}</td><td>${fmtDate(x.due)}</td><td>${fmt(x.amount)}</td><td></td></tr>`).join('')}</tbody></table>
  <p>الضامن: ${esc(p.guarantor?.name || '..............')} — رقم قومي: ${esc(p.guarantor?.nid || '..............')} — موبايل: <span class="ltr">${esc(p.guarantor?.phone || '')}</span></p>
  <p class="sm">يلتزم الطرف الثاني بسداد الأقساط في مواعيدها، وفي حالة التأخير عن سداد قسطين متتاليين تحل باقي الأقساط فوراً، والضامن متضامن مع المشتري في السداد.</p>
  <table class="tot"><tr><td>توقيع البائع<br><br>...........</td><td>توقيع المشتري<br><br>...........</td><td>توقيع الضامن<br><br>...........</td></tr></table>${devFooter()}`, 'A4');
}
