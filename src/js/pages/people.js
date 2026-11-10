/* العملاء + الموردين + الموظفين والرواتب */
'use strict';
function ledgerDialog(title, rows, opening = 0) {
  let bal = opening;
  const r = rows.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ ...x, bal: (bal = r2(bal + x.amount)) }));
  const inner = `<table class="a4"><thead><tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${r.map(x => `<tr><td>${fmtDT(x.date)}</td><td>${esc(x.ref)} ${esc(x.note || '')}</td><td>${x.amount > 0 ? fmt(x.amount) : ''}</td><td>${x.amount < 0 ? fmt(-x.amount) : ''}</td><td><b>${fmt(x.bal)}</b></td></tr>`).join('')}</tbody></table>`;
  modal({ title, xwide: true, body: `<div style="max-height:60vh;overflow:auto">${inner}</div><div class="mt" style="font-size:18px">الرصيد النهائي: <b>${fmt(bal)}</b></div>`, buttons: [{ text: '🖨️ طباعة كشف الحساب', close: false, click: () => printDoc(`${shopHeader()}<div class="c b lg">${title}</div><div>حتى ${fmtDate(today())}</div>${inner}<p class="b lg">الرصيد: ${fmt(bal)}</p>${devFooter()}`, 'A4') }, { text: 'إغلاق', cls: 'ghost' }] });
}

Pages.customers = el => {
  let q = '', fd = '';
  el.innerHTML = `<div class="row mb"><button class="btn" id="cadd">➕ عميل جديد</button><input id="cq" placeholder="🔍 بحث بالاسم / الموبايل / الرقم القومي" style="flex:1"><select id="cdeb" style="width:170px"><option value="">كل العملاء</option><option value="d">عليهم فلوس</option><option value="i">عندهم أقساط</option></select><button class="btn ghost" id="cexp">📤 تصدير</button></div><div id="ctbl"></div>`;
  const instRem = id => sum(DB.installments.filter(p => p.customerId === id && p.status === 'active'), planRemaining);
  const cols = [{ l: 'الاسم', f: c => `<b>${esc(c.name)}</b>${c.vip ? ' <span class="tag warn">VIP</span>' : ''}` }, { l: 'الموبايل', f: c => `<span class="ltr">${esc(c.phone || '')}</span>` }, { l: 'العنوان', k: 'address' },
    { l: 'المشتريات', f: c => fmt(sum(DB.sales.filter(s => s.customerId === c.id && s.status !== 'void'), 'total')) }, { l: 'صيانات', f: c => DB.repairs.filter(r => r.customerId === c.id).length },
    { l: 'الرصيد (آجل)', f: c => { const b = custBalance(c.id); return `<b class="${b > 0 ? 'bad-t' : b < 0 ? 'ok-t' : ''}">${fmt(b)}</b>`; }, sum: c => custBalance(c.id) }, { l: 'أقساط متبقية', f: c => fmt(instRem(c.id)), sum: c => instRem(c.id) },
    { l: '', f: c => c.system ? '' : `<button class="btn sm ghost" data-e="${c.id}">✏️</button> <button class="btn sm ghost" data-l="${c.id}">📒</button> <button class="btn sm ok" data-p="${c.id}">تحصيل</button> <button class="btn sm ghost" data-w="${c.id}">💬</button>` }];
  const rows = () => DB.customers.filter(c => match(q, c.name, c.phone, c.nid) && (!fd || (fd === 'd' ? custBalance(c.id) > 0 : instRem(c.id) > 0)));
  const draw = () => {
    $('#ctbl').innerHTML = tableHTML(cols, rows(), { foot: true, limit: 500 });
    $$('[data-e]', el).forEach(b => b.onclick = () => customerForm(find('customers', b.dataset.e), draw));
    $$('[data-l]', el).forEach(b => b.onclick = () => customerStatement(b.dataset.l));
    $$('[data-p]', el).forEach(b => b.onclick = () => collectCustomer(b.dataset.p, draw));
    $$('[data-w]', el).forEach(b => b.onclick = () => { const c = find('customers', b.dataset.w); const bal = custBalance(c.id); waLink(c.phone, bal > 0 ? `مرحباً ${c.name}، نذكركم برصيد مستحق ${fmt(bal)} ج.م — ${DB.settings.shopName}` : `مرحباً ${c.name} — ${DB.settings.shopName}`); });
  };
  $('#cq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#cdeb').onchange = e => { fd = e.target.value; draw(); };
  $('#cadd').onclick = () => customerForm(null, draw);
  $('#cexp').onclick = () => exportCSV('العملاء', cols.slice(0, -1), rows());
  draw();
};
function customerForm(c, cb) {
  const F = [{ k: 'name', l: 'الاسم', req: true }, { k: 'phone', l: 'الموبايل' }, { k: 'phone2', l: 'موبايل آخر' }, { k: 'nid', l: 'الرقم القومي' }, { k: 'job', l: 'الوظيفة' }, { k: 'address', l: 'العنوان' }, { k: 'creditLimit', l: 'حد الآجل المسموح', t: 'number' }, { k: 'vip', l: 'عميل مميز VIP', t: 'check' }, ...(c ? [] : [{ k: 'opening', l: 'رصيد سابق عليه (مديونية)', t: 'number' }]), { k: 'notes', l: 'ملاحظات', t: 'textarea', full: true }];
  modal({ title: c ? 'تعديل عميل' : 'عميل جديد', body: formHTML(F, c || {}), buttons: [{ text: 'حفظ', click: o => {
    const d = readForm(o, F);
    if (d.phone && DB.customers.some(x => x.phone === d.phone && x !== c)) { toast('رقم الموبايل مسجل لعميل آخر', 'warn'); return false; }
    if (c) Object.assign(c, d); else { const op = d.opening; delete d.opening; const n = { id: uid(), ...d, created: nowISO() }; DB.customers.push(n); if (op) custTx(n.id, op, 'opening', 'رصيد سابق'); }
    audit(c ? 'تعديل عميل' : 'إضافة عميل', d.name); save(); cb && cb();
  } }, ...(c && !c.system ? [{ text: '🗑️', cls: 'bad', click: async () => { if (DB.sales.some(s => s.customerId === c.id) || custBalance(c.id) || DB.repairs.some(r => r.customerId === c.id)) { c.active = false; toast('العميل له حركات — تم إيقافه', 'warn'); } else if (await confirmBox('حذف العميل؟')) DB.customers.splice(DB.customers.indexOf(c), 1); else return false; save(); cb && cb(); } }] : []), { text: 'إلغاء', cls: 'ghost' }] });
}
function customerStatement(id) {
  const c = find('customers', id);
  ledgerDialog('كشف حساب العميل: ' + c.name, DB.custTx.filter(t => t.customerId === id));
}
function collectCustomer(id, cb) {
  const c = find('customers', id), bal = custBalance(id);
  const F = [{ k: 'amount', l: 'المبلغ', t: 'number', req: true, d: Math.max(0, bal) }, { k: 'accountId', l: 'الحساب', t: 'select', o: opts(payAccounts) }, { k: 'note', l: 'بيان' }];
  modal({ title: `تحصيل من ${esc(c.name)} — الرصيد ${fmt(bal)}`, body: formHTML(F, {}, 1) + '<p class="muted">لو المبلغ بالسالب = إضافة مديونية / رد فلوس للعميل.</p>', buttons: [{ text: 'حفظ', cls: 'ok', click: o => {
    const d = readForm(o, F); if (!d.amount) return false;
    const no = nextNo('rcpt');
    custTx(id, -d.amount, 'payment', 'سند قبض ' + no, d.note); addMove(d.accountId, d.amount, 'cust_payment', 'سند قبض ' + no, c.name);
    audit('تحصيل من عميل', `${c.name}: ${fmt(d.amount)}`); save();
    printDoc(`${shopHeader()}<div class="c b lg">سند قبض رقم ${no}</div><table class="tot"><tr><td>التاريخ</td><td>${fmtDT(nowISO())}</td></tr><tr><td>استلمنا من</td><td>${esc(c.name)}</td></tr><tr class="b lg"><td>مبلغ</td><td>${fmt(d.amount)}</td></tr><tr><td>بيان</td><td>${esc(d.note)}</td></tr><tr><td>الرصيد المتبقي</td><td>${fmt(custBalance(id))}</td></tr></table>${devFooter()}`);
    cb && cb();
  } }, { text: 'إلغاء', cls: 'ghost' }] });
}

Pages.suppliers = el => {
  let q = '';
  el.innerHTML = `<div class="row mb"><button class="btn" id="sadd">➕ مورد جديد</button><input id="sq" placeholder="🔍 بحث" style="flex:1"></div><div id="stbl"></div>`;
  const draw = () => {
    const rows = DB.suppliers.filter(s => match(q, s.name, s.phone, s.company));
    $('#stbl').innerHTML = tableHTML([{ l: 'المورد', f: s => `<b>${esc(s.name)}</b>` }, { l: 'الشركة', k: 'company' }, { l: 'الموبايل', f: s => `<span class="ltr">${esc(s.phone || '')}</span>` }, { l: 'المشتريات', f: s => fmt(sum(DB.purchases.filter(p => p.supplierId === s.id && p.kind === 'buy'), 'total')) },
      { l: 'الرصيد (لهم)', f: s => { const b = supBalance(s.id); return `<b class="${b > 0 ? 'bad-t' : ''}">${fmt(b)}</b>`; }, sum: s => supBalance(s.id) },
      { l: '', f: s => `<button class="btn sm ghost" data-e="${s.id}">✏️</button> <button class="btn sm ghost" data-l="${s.id}">📒</button> <button class="btn sm warn" data-p="${s.id}">سداد</button>` }], rows, { foot: true });
    $$('[data-e]', el).forEach(b => b.onclick = () => supplierForm(find('suppliers', b.dataset.e), draw));
    $$('[data-l]', el).forEach(b => b.onclick = () => { const s = find('suppliers', b.dataset.l); ledgerDialog('كشف حساب المورد: ' + s.name, DB.supTx.filter(t => t.supplierId === s.id)); });
    $$('[data-p]', el).forEach(b => b.onclick = () => {
      const s = find('suppliers', b.dataset.p), bal = supBalance(s.id);
      const F = [{ k: 'amount', l: 'المبلغ المدفوع للمورد', t: 'number', req: true, d: Math.max(0, bal) }, { k: 'accountId', l: 'من حساب', t: 'select', o: opts(payAccounts) }, { k: 'note', l: 'بيان' }];
      modal({ title: `سداد لـ ${esc(s.name)} — الرصيد ${fmt(bal)}`, body: formHTML(F, {}, 1), buttons: [{ text: 'حفظ', cls: 'ok', click: o => { const d = readForm(o, F); const no = nextNo('pay'); supTx(s.id, -d.amount, 'payment', 'سند صرف ' + no, d.note); addMove(d.accountId, -d.amount, 'sup_payment', 'سند صرف ' + no, s.name); audit('سداد لمورد', `${s.name}: ${fmt(d.amount)}`); save(); draw(); } }, { text: 'إلغاء', cls: 'ghost' }] });
    });
  };
  $('#sq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#sadd').onclick = () => supplierForm(null, draw);
  draw();
};
function supplierForm(s, cb) {
  const F = [{ k: 'name', l: 'الاسم', req: true }, { k: 'company', l: 'الشركة' }, { k: 'phone', l: 'الموبايل' }, { k: 'address', l: 'العنوان' }, ...(s ? [] : [{ k: 'opening', l: 'رصيد سابق لهم (علينا)', t: 'number' }]), { k: 'notes', l: 'ملاحظات', t: 'textarea', full: true }];
  modal({ title: s ? 'تعديل مورد' : 'مورد جديد', body: formHTML(F, s || {}), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); if (s) Object.assign(s, d); else { const op = d.opening; delete d.opening; const n = { id: uid(), ...d }; DB.suppliers.push(n); if (op) supTx(n.id, op, 'opening', 'رصيد سابق'); } audit('مورد', d.name); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}

/* -------- الموظفين والرواتب -------- */
Pages.employees = el => {
  const m = today().slice(0, 7);
  el.innerHTML = `<div class="row mb"><button class="btn" id="eadd">➕ موظف / فني</button><span class="sp"></span><label>الشهر</label><input type="month" id="em" value="${m}" style="width:170px"></div><div id="etbl"></div><h3 class="mt">حركات الرواتب للشهر</h3><div id="ptbl"></div>`;
  let mon = m;
  const PT = { salary: 'راتب', advance: 'سلفة', bonus: 'مكافأة', deduction: 'خصم', commission: 'عمولة' };
  const draw = () => {
    const comm = e => sum(DB.repairs.filter(r => r.techId === e.id && r.status === 'delivered' && (r.deliveredAt || '').startsWith(mon)), r => num(r.techCommission));
    const pay = (e, t) => sum(DB.payroll.filter(p => p.empId === e.id && p.month === mon && p.type === t), 'amount');
    $('#etbl').innerHTML = tableHTML([{ l: 'الاسم', f: e => `<b>${esc(e.name)}</b>${e.isTech ? ' <span class="tag pri">فني</span>' : ''}${e.active === false ? ' <span class="tag bad">موقوف</span>' : ''}` }, { l: 'الوظيفة', k: 'job' }, { l: 'الموبايل', f: e => `<span class="ltr">${esc(e.phone || '')}</span>` },
      { l: 'الراتب', k: 'salary', money: true }, { l: 'عمولة صيانة', f: e => fmt(comm(e)) }, { l: 'سلف', f: e => fmt(pay(e, 'advance')) }, { l: 'مكافآت', f: e => fmt(pay(e, 'bonus')) }, { l: 'خصومات', f: e => fmt(pay(e, 'deduction')) },
      { l: 'المستحق', f: e => `<b>${fmt(num(e.salary) + comm(e) + pay(e, 'bonus') - pay(e, 'deduction') - pay(e, 'advance') - pay(e, 'salary') - pay(e, 'commission'))}</b>` },
      { l: '', f: e => `<button class="btn sm ghost" data-e="${e.id}">✏️</button> <button class="btn sm" data-p="${e.id}">💵 صرف/حركة</button>` }], DB.employees);
    $('#ptbl').innerHTML = tableHTML([{ l: 'التاريخ', f: p => fmtDT(p.date) }, { l: 'الموظف', f: p => esc(find('employees', p.empId)?.name) }, { l: 'النوع', f: p => PT[p.type] }, { l: 'المبلغ', k: 'amount', money: true, sum: true }, { l: 'الحساب', f: p => p.accountId ? esc(accName(p.accountId)) : '-' }, { l: 'ملاحظة', k: 'note' }], DB.payroll.filter(p => p.month === mon).slice().reverse(), { foot: true });
    $$('[data-e]', el).forEach(b => b.onclick = () => empForm(find('employees', b.dataset.e), draw));
    $$('[data-p]', el).forEach(b => b.onclick = () => {
      const e = find('employees', b.dataset.p);
      const F = [{ k: 'type', l: 'النوع', t: 'select', o: Object.entries(PT) }, { k: 'amount', l: 'المبلغ', t: 'number', req: true, d: e.salary }, { k: 'accountId', l: 'من حساب (للخصم: بدون)', t: 'select', o: opts(payAccounts) }, { k: 'note', l: 'ملاحظة' }];
      modal({ title: 'حركة راتب — ' + esc(e.name), body: formHTML(F, {}, 1), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); DB.payroll.push({ id: uid(), date: nowISO(), month: mon, empId: e.id, ...d, user: me() }); if (d.type !== 'deduction') addMove(d.accountId, -d.amount, 'payroll', PT[d.type] + ' ' + e.name, d.note); audit('رواتب', `${e.name}: ${PT[d.type]} ${fmt(d.amount)}`); save(); draw(); } }, { text: 'إلغاء', cls: 'ghost' }] });
    });
  };
  $('#em').onchange = e => { mon = e.target.value; draw(); };
  $('#eadd').onclick = () => empForm(null, draw);
  draw();
};
function empForm(e, cb) {
  const F = [{ k: 'name', l: 'الاسم', req: true }, { k: 'phone', l: 'الموبايل' }, { k: 'job', l: 'الوظيفة', d: 'فني صيانة' }, { k: 'nid', l: 'الرقم القومي' }, { k: 'salary', l: 'الراتب الشهري', t: 'number' }, { k: 'commission', l: 'عمولة % من المصنعية', t: 'number' }, { k: 'hireDate', l: 'تاريخ التعيين', t: 'date' }, { k: 'isTech', l: 'فني صيانة (يظهر في تذاكر الصيانة)', t: 'check', d: true }, { k: 'active', l: 'نشط', t: 'check', d: true }];
  modal({ title: e ? 'تعديل موظف' : 'موظف جديد', body: formHTML(F, e || {}), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); if (e) Object.assign(e, d); else DB.employees.push({ id: uid(), ...d }); audit('موظف', d.name); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
