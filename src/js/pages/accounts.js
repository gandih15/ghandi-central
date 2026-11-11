/* الخزن والمحافظ + التحويلات + المصروفات + الورديات */
'use strict';
const ACC_F = () => [{ k: 'name', l: 'اسم الحساب', req: true }, { k: 'type', l: 'النوع', t: 'select', o: Object.entries(ACC_TYPES) }, { k: 'provider', l: 'الشبكة / الجهة', t: 'select', o: [['', '-'], ['Vodafone', 'فودافون'], ['Orange', 'أورنج'], ['Etisalat', 'اتصالات e&'], ['WE', 'WE'], ['InstaPay', 'إنستاباي'], ['Fawry', 'فوري'], ['Aman', 'أمان'], ['Masary', 'مصاري'], ['BTech', 'Bee / غيره'], ['Bank', 'بنك']] },
  { k: 'phone', l: 'رقم الخط / المحفظة' }, { k: 'dayLimit', l: 'حد الإرسال اليومي', t: 'number' }, { k: 'monthLimit', l: 'حد الإرسال الشهري', t: 'number' }, { k: 'inDayLimit', l: 'حد الاستقبال اليومي', t: 'number' }, { k: 'inMonthLimit', l: 'حد الاستقبال الشهري', t: 'number' }, { k: 'warnPct', l: 'نبهني عند نسبة % من الحد', t: 'number' },
  { k: 'feePct', l: 'عمولة % على العميل', t: 'number' }, { k: 'feeFixed', l: 'عمولة ثابتة', t: 'number' }, { k: 'feeMin', l: 'أقل عمولة', t: 'number' }, { k: 'feeMax', l: 'أقصى عمولة', t: 'number' },
  { k: 'costRate', l: 'معامل تكلفة الرصيد (مثلاً 0.97)', t: 'number' }, { k: 'sellRate', l: 'معامل سعر بيع الرصيد (مثلاً 1)', t: 'number' }, { k: 'active', l: 'نشط', t: 'check', d: true }];

Pages.accounts = el => {
  el.innerHTML = `<div class="row mb"><button class="btn" id="aadd">➕ حساب / محفظة</button>${can('transfer') ? '<button class="btn vio" id="atr">🔁 تحويل / تغذية رصيد</button>' : ''}<button class="btn ok" id="ain">➕ إيداع (رأس مال)</button><button class="btn warn" id="aout">➖ مسحوبات شخصية</button></div><div class="grid g4" id="acards"></div><h3 class="mt">آخر الحركات</h3><div id="amoves"></div>`;
  const draw = () => {
    $('#acards').innerHTML = DB.accounts.map(a => { const b = accBalance(a.id); const u = a.type === 'wallet' ? walletUsage(a) : null; return `<div class="card" ${a.active ? '' : 'style="opacity:.5"'}><div class="row"><b style="flex:1">${esc(a.name)}</b><span class="tag">${ACC_TYPES[a.type]}</span></div>
      <div style="font-size:24px;font-weight:800;margin:8px 0" class="${b < 0 ? 'bad-t' : ''}">${fmt(b)}</div>${a.phone ? `<div class="ltr muted">${esc(a.phone)}</div>` : ''}${u ? limitBars(a, true) : ''}
      <div class="row mt"><button class="btn sm ghost" data-l="${a.id}">📒 كشف</button>${a.system ? '' : `<button class="btn sm ghost" data-e="${a.id}">✏️</button>`}<button class="btn sm ghost" data-adj="${a.id}">⚖️ تسوية</button></div></div>`; }).join('');
    $('#amoves').innerHTML = tableHTML([{ l: 'الوقت', f: m => fmtDT(m.date) }, { l: 'الحساب', f: m => esc(accName(m.accountId)) }, { l: 'المبلغ', f: m => `<b class="${m.amount < 0 ? 'bad-t' : 'ok-t'}">${fmt(m.amount)}</b>` }, { l: 'البيان', f: m => esc(m.ref) + ' ' + esc(m.note || '') }, { l: 'المستخدم', k: 'user' }], DB.moves.slice(-150).reverse());
    $$('[data-e]', el).forEach(b => b.onclick = () => accForm(find('accounts', b.dataset.e), draw));
    $$('[data-l]', el).forEach(b => b.onclick = () => accStatement(b.dataset.l));
    $$('[data-adj]', el).forEach(b => b.onclick = () => {
      const a = find('accounts', b.dataset.adj);
      const F = [{ k: 'real', l: 'الرصيد الفعلي الموجود', t: 'number', d: accBalance(a.id), req: true }, { k: 'note', l: 'السبب' }];
      modal({ title: 'تسوية رصيد ' + esc(a.name), body: `<p>الرصيد بالسيستم: <b>${fmt(accBalance(a.id))}</b></p>` + formHTML(F, {}, 1), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); const diff = r2(d.real - accBalance(a.id)); if (diff) { addMove(a.id, diff, 'adjust', 'تسوية رصيد', d.note); audit('تسوية رصيد حساب', `${a.name}: ${fmt(diff)}`); save(); draw(); } } }, { text: 'إلغاء', cls: 'ghost' }] });
    });
  };
  $('#aadd').onclick = () => accForm(null, draw);
  if ($('#atr')) $('#atr').onclick = () => transferForm(draw);
  const capital = (sign, title) => { const F = [{ k: 'accountId', l: 'الحساب', t: 'select', o: opts(() => DB.accounts.filter(a => a.active)) }, { k: 'amount', l: 'المبلغ', t: 'number', req: true }, { k: 'note', l: 'بيان' }]; modal({ title, body: formHTML(F, {}, 1), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); addMove(d.accountId, sign * d.amount, sign > 0 ? 'capital' : 'drawing', title, d.note); audit(title, fmt(d.amount)); save(); draw(); } }, { text: 'إلغاء', cls: 'ghost' }] }); };
  $('#ain').onclick = () => capital(1, 'إيداع رأس مال');
  $('#aout').onclick = () => capital(-1, 'مسحوبات شخصية');
  draw();
};
function accForm(a, cb) {
  const F = ACC_F();
  modal({ title: a ? 'تعديل حساب' : 'حساب جديد', wide: true, body: formHTML(F, a || { type: 'wallet', active: true, costRate: 1, sellRate: 1 }, 3) + (a ? '' : formHTML([{ k: 'opening', l: 'الرصيد الافتتاحي', t: 'number' }], {}, 3)) + '<p class="muted">الحدود (الليمت): اكتب حدود شركة المحفظة لكل خط — 0 يعني بدون حد. البرنامج بيحسب الإرسال والاستقبال لوحده من العمليات.<br>العمولة بتتحسب تلقائياً في شاشة الخدمات المالية وتقدر تعدلها. معامل التكلفة لرصيد الشبكات: لو بتشتري 100 وحدة بـ 97 جنيه اكتب 0.97.</p>',
    buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); if (a) Object.assign(a, d); else { const n = { id: uid(), ...d }; DB.accounts.push(n); const op = num($('[name=opening]', o).value); if (op) addMove(n.id, op, 'opening', 'رصيد افتتاحي'); } audit('حساب', d.name); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function transferForm(cb) {
  const F = [{ k: 'from', l: 'من حساب', t: 'select', o: opts(() => DB.accounts.filter(a => a.active)) }, { k: 'to', l: 'إلى حساب', t: 'select', o: opts(() => DB.accounts.filter(a => a.active)) },
    { k: 'out', l: 'المبلغ الخارج', t: 'number', req: true }, { k: 'in', l: 'المبلغ الداخل (لو مختلف — مثلاً شحن رصيد بخصم)', t: 'number' }, { k: 'note', l: 'بيان', full: true }];
  modal({ title: '🔁 تحويل بين الحسابات / تغذية رصيد', body: formHTML(F) + '<p class="muted">مثال: تغذية رصيد فودافون: من الخزنة 970 → إلى رصيد فودافون 1000. الفرق بيتسجل كخصم شراء رصيد.</p>',
    buttons: [{ text: 'تحويل', click: o => { const d = readForm(o, F); if (d.from === d.to) { toast('اختار حسابين مختلفين', 'warn'); return false; } const inn = d.in || d.out; const no = nextNo('trf'); addMove(d.from, -d.out, 'transfer', 'تحويل ' + no + ' إلى ' + accName(d.to), d.note); addMove(d.to, inn, 'transfer', 'تحويل ' + no + ' من ' + accName(d.from), d.note); audit('تحويل بين الحسابات', `${accName(d.from)} → ${accName(d.to)}: ${fmt(d.out)}/${fmt(inn)}`); save(); cb && cb(); } }, { text: 'إلغاء', cls: 'ghost' }] });
}
function accStatement(id) {
  const a = find('accounts', id);
  const F = [{ k: 'from', l: 'من', t: 'date', d: addDays(today(), -30) }, { k: 'to', l: 'إلى', t: 'date', d: today() }];
  const o = modal({ title: '📒 كشف حساب: ' + esc(a.name), xwide: true, body: formHTML(F, {}, 2) + '<div id="ast" class="mt"></div>' });
  const draw = () => {
    const f = $('[name=from]', o).value, t = $('[name=to]', o).value;
    let bal = r2(sum(DB.moves.filter(m => m.accountId === id && dOnly(m.date) < f), 'amount'));
    const open = bal;
    const rows = DB.moves.filter(m => m.accountId === id && dOnly(m.date) >= f && dOnly(m.date) <= t).map(m => ({ ...m, bal: (bal = r2(bal + m.amount)) }));
    $('#ast', o).innerHTML = `<div class="row mb"><span class="tag">رصيد أول المدة: ${fmt(open)}</span><span class="tag ok">وارد: ${fmt(sum(rows.filter(r => r.amount > 0), 'amount'))}</span><span class="tag bad">منصرف: ${fmt(-sum(rows.filter(r => r.amount < 0), 'amount'))}</span><span class="tag pri">الرصيد: ${fmt(bal)}</span></div>` + tableHTML([{ l: 'الوقت', f: m => fmtDT(m.date) }, { l: 'وارد', f: m => m.amount > 0 ? fmt(m.amount) : '' }, { l: 'منصرف', f: m => m.amount < 0 ? fmt(-m.amount) : '' }, { l: 'الرصيد', f: m => `<b>${fmt(m.bal)}</b>` }, { l: 'البيان', f: m => esc(m.ref) + ' ' + esc(m.note || '') }, { l: 'المستخدم', k: 'user' }], rows.reverse(), { limit: 2000 });
  };
  $$('input', o).forEach(i => i.onchange = draw); draw();
}

/* -------- المصروفات والإيرادات الأخرى -------- */
Pages.expenses = el => {
  let from = today().slice(0, 8) + '01', to = today(), fc = '';
  el.innerHTML = `<div class="row mb"><button class="btn bad" id="xadd">➖ مصروف</button><button class="btn ok" id="iadd">➕ إيراد آخر</button><button class="btn ghost" id="xcats">📁 بنود المصروفات</button><span class="sp"></span>
  <select id="xc" style="width:160px"><option value="">كل البنود</option></select><input type="date" id="xf" value="${from}" style="width:150px"><input type="date" id="xt" value="${to}" style="width:150px"></div><div id="xsum" class="row mb"></div><div id="xtbl"></div>`;
  const fillC = () => $('#xc').innerHTML = '<option value="">كل البنود</option>' + DB.settings.expenseCats.map(c => `<option ${c === fc ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const draw = () => {
    const rows = DB.expenses.filter(x => dOnly(x.date) >= from && dOnly(x.date) <= to && (!fc || x.cat === fc)).slice().reverse();
    const byCat = {}; rows.filter(r => r.kind !== 'income').forEach(r => byCat[r.cat] = (byCat[r.cat] || 0) + num(r.amount));
    $('#xsum').innerHTML = `<span class="tag bad">المصروفات: ${fmt(sum(rows.filter(r => r.kind !== 'income'), 'amount'))}</span><span class="tag ok">إيرادات أخرى: ${fmt(sum(rows.filter(r => r.kind === 'income'), 'amount'))}</span>` + Object.entries(byCat).map(([k, v]) => `<span class="tag">${esc(k)}: ${fmt(v)}</span>`).join('');
    $('#xtbl').innerHTML = tableHTML([{ l: 'التاريخ', f: x => fmtDT(x.date) }, { l: 'النوع', f: x => x.kind === 'income' ? '<span class="tag ok">إيراد</span>' : '<span class="tag bad">مصروف</span>' }, { l: 'البند', k: 'cat' }, { l: 'المبلغ', k: 'amount', money: true }, { l: 'الحساب', f: x => esc(accName(x.accountId)) }, { l: 'بيان', k: 'note' }, { l: 'بواسطة', k: 'user' }, { l: '', f: x => isAdmin() ? `<button class="btn sm bad" data-d="${x.id}">🗑️</button>` : '' }], rows);
    $$('[data-d]', el).forEach(b => b.onclick = async () => { const x = find('expenses', b.dataset.d); if (!(await confirmBox('حذف وإرجاع المبلغ للحساب؟'))) return; addMove(x.accountId, x.kind === 'income' ? -x.amount : x.amount, 'void', 'حذف ' + (x.kind === 'income' ? 'إيراد' : 'مصروف') + ' ' + x.cat); DB.expenses.splice(DB.expenses.indexOf(x), 1); audit('حذف مصروف', `${x.cat}: ${fmt(x.amount)}`); save(); draw(); });
  };
  const add = kind => {
    const F = [{ k: 'cat', l: 'البند', t: kind === 'income' ? 'text' : 'select', o: DB.settings.expenseCats.map(c => [c, c]), req: true, d: kind === 'income' ? '' : undefined }, { k: 'amount', l: 'المبلغ', t: 'number', req: true }, { k: 'accountId', l: 'الحساب', t: 'select', o: opts(() => DB.accounts.filter(a => a.active && ['cash', 'wallet', 'bank'].includes(a.type))) }, { k: 'note', l: 'بيان', full: true }];
    modal({ title: kind === 'income' ? '➕ إيراد آخر' : '➖ مصروف', body: formHTML(F), buttons: [{ text: 'حفظ', click: o => { const d = readForm(o, F); DB.expenses.push({ id: uid(), date: nowISO(), kind, ...d, user: me(), shiftId: currentShift()?.id || '' }); addMove(d.accountId, kind === 'income' ? d.amount : -d.amount, kind === 'income' ? 'income' : 'expense', (kind === 'income' ? 'إيراد: ' : 'مصروف: ') + d.cat, d.note); audit(kind === 'income' ? 'إيراد' : 'مصروف', `${d.cat}: ${fmt(d.amount)}`); save(); draw(); } }, { text: 'إلغاء', cls: 'ghost' }] });
  };
  $('#xadd').onclick = () => add('expense'); $('#iadd').onclick = () => add('income');
  $('#xcats').onclick = async () => { const v = await promptBox('بنود المصروفات', 'افصل بين البنود بفاصلة ،', DB.settings.expenseCats.join('، ')); if (v !== null) { DB.settings.expenseCats = v.split(/[،,]/).map(x => x.trim()).filter(Boolean); save(); fillC(); } };
  $('#xc').onchange = e => { fc = e.target.value; draw(); };
  $('#xf').onchange = e => { from = e.target.value; draw(); }; $('#xt').onchange = e => { to = e.target.value; draw(); };
  fillC(); draw();
};

/* -------- الورديات -------- */
function shiftExpected(s) { return r2(num(s.openCash) + sum(DB.moves.filter(m => m.accountId === 'cash' && m.shiftId === s.id), 'amount')); }
Pages.shifts = el => {
  const cur = currentShift();
  el.innerHTML = `<div class="card mb" style="max-width:640px">${cur ? `<h3>⏱️ ورديتك مفتوحة منذ ${fmtDT(cur.start)}</h3><div class="sum-row"><span>نقدية البداية</span><b>${fmt(cur.openCash)}</b></div><div class="sum-row"><span>حركة الكاش في الوردية</span><b>${fmt(shiftExpected(cur) - num(cur.openCash))}</b></div><div class="sum-row" style="font-size:18px"><span>المفروض في الدرج</span><b>${fmt(shiftExpected(cur))}</b></div><button class="btn bad mt" id="scl">إغلاق الوردية وتقفيل الدرج</button>`
    : `<h3>لا توجد وردية مفتوحة</h3><div class="row"><label>نقدية البداية في الدرج</label><input type="number" step="any" id="soc" style="width:150px" value="0"><button class="btn ok" id="sop">فتح وردية</button></div>`}</div><h3>سجل الورديات</h3><div id="stbl"></div>`;
  if ($('#sop')) $('#sop').onclick = () => { DB.shifts.push({ id: uid(), no: nextNo('shift'), userId: meId(), user: me(), start: nowISO(), openCash: num($('#soc').value) }); audit('فتح وردية'); save(); go('shifts'); };
  if ($('#scl')) $('#scl').onclick = () => {
    const exp = shiftExpected(cur);
    const F = [{ k: 'counted', l: 'الكاش الفعلي في الدرج (عد الفلوس)', t: 'number', req: true }, { k: 'note', l: 'ملاحظات' }];
    modal({ title: 'تقفيل الوردية — المفروض ' + fmt(exp), body: formHTML(F, {}, 1), buttons: [{ text: 'تقفيل وطباعة', cls: 'bad', click: o => {
      const d = readForm(o, F); Object.assign(cur, { end: nowISO(), expected: exp, counted: d.counted, diff: r2(d.counted - exp), note: d.note });
      audit('إغلاق وردية', `عجز/زيادة: ${fmt(cur.diff)}`); save(); printShift(cur); go('shifts');
    } }, { text: 'إلغاء', cls: 'ghost' }] });
  };
  const rows = (isAdmin() ? DB.shifts : DB.shifts.filter(s => s.userId === meId())).slice().reverse();
  $('#stbl').innerHTML = tableHTML([{ l: 'رقم', k: 'no' }, { l: 'المستخدم', k: 'user' }, { l: 'البداية', f: s => fmtDT(s.start) }, { l: 'النهاية', f: s => s.end ? fmtDT(s.end) : '<span class="tag ok">مفتوحة</span>' }, { l: 'بداية', k: 'openCash', money: true }, { l: 'المتوقع', f: s => fmt(s.end ? s.expected : shiftExpected(s)) }, { l: 'الفعلي', f: s => s.end ? fmt(s.counted) : '' },
    { l: 'عجز/زيادة', f: s => s.end ? `<b class="${s.diff < 0 ? 'bad-t' : 'ok-t'}">${fmt(s.diff)}</b>` : '' }, { l: '', f: s => s.end ? `<button class="btn sm ghost" data-p="${s.id}">🖨️</button>` : '' }], rows);
  $$('[data-p]', el).forEach(b => b.onclick = () => printShift(find('shifts', b.dataset.p)));
};
function printShift(s) {
  const sales = DB.sales.filter(x => x.shiftId === s.id && x.status !== 'void'), fin = DB.finops.filter(x => x.shiftId === s.id && !x.void), exps = DB.expenses.filter(x => x.shiftId === s.id);
  printDoc(`${shopHeader()}<div class="c b lg">تقرير وردية ${s.no}</div><table class="tot"><tr><td>المستخدم</td><td>${esc(s.user)}</td></tr><tr><td>من</td><td>${fmtDT(s.start)}</td></tr><tr><td>إلى</td><td>${fmtDT(s.end)}</td></tr>
  <tr><td>فواتير البيع</td><td>${sales.length} — ${fmt(sum(sales, 'total'))}</td></tr><tr><td>خدمات مالية</td><td>${fin.length} — ربح ${fmt(sum(fin, 'profit'))}</td></tr><tr><td>مصروفات</td><td>${fmt(sum(exps.filter(e => e.kind !== 'income'), 'amount'))}</td></tr>
  <tr><td>نقدية البداية</td><td>${fmt(s.openCash)}</td></tr><tr class="b"><td>المتوقع</td><td>${fmt(s.expected)}</td></tr><tr class="b"><td>الفعلي</td><td>${fmt(s.counted)}</td></tr><tr class="b lg"><td>${s.diff < 0 ? 'عجز' : 'زيادة'}</td><td>${fmt(Math.abs(s.diff))}</td></tr></table>${s.note ? '<p>' + esc(s.note) + '</p>' : ''}${devFooter()}`);
}
