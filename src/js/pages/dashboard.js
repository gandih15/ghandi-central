/* لوحة التحكم + حساب الأرباح للفترة */
'use strict';
function periodStats(from, to) {
  const inR = d => dOnly(d) >= from && dOnly(d) <= to;
  const sales = DB.sales.filter(s => s.status !== 'void' && inR(s.date));
  const rets = DB.returns.filter(r => inR(r.date));
  const salesRev = r2(sum(sales, 'total') - sum(rets, 'total'));
  const salesCost = r2(sum(sales, 'cost') - sum(rets.filter(r => r.condition === 'good'), 'cost'));
  const reps = DB.repairs.filter(r => ['delivered', 'returned'].includes(r.status) && inR(r.deliveredAt || r.date));
  const repRev = r2(sum(reps, repTotal)), repCostV = r2(sum(reps, repCost));
  const fin = DB.finops.filter(x => !x.void && inR(x.date));
  const finProfit = r2(sum(fin, 'profit'));
  const plans = DB.installments.filter(p => p.status !== 'cancelled' && inR(p.date));
  const interest = r2(sum(plans, 'interestAmount'));
  const lateFees = r2(sum(DB.installments.flatMap(p => p.payments || []).filter(x => inR(x.date)), 'lateFee'));
  const exps = DB.expenses.filter(x => inR(x.date));
  const expenses = r2(sum(exps.filter(x => x.kind !== 'income'), 'amount')), otherIncome = r2(sum(exps.filter(x => x.kind === 'income'), 'amount'));
  const payroll = r2(sum(DB.payroll.filter(p => inR(p.date) && p.type !== 'deduction'), 'amount') - sum(DB.payroll.filter(p => inR(p.date) && p.type === 'deduction'), 'amount') * 0);
  const salesProfit = r2(salesRev - salesCost), repProfit = r2(repRev - repCostV);
  const gross = r2(salesProfit + repProfit + finProfit + interest + lateFees + otherIncome);
  return { sales, rets, salesRev, salesCost, salesProfit, reps, repRev, repCost: repCostV, repProfit, fin, finProfit, interest, lateFees, expenses, otherIncome, payroll, gross, net: r2(gross - expenses - payroll) };
}

Pages.dashboard = el => {
  const t = today(), st = periodStats(t, t), ms = periodStats(t.slice(0, 8) + '01', t);
  const showP = can('items_cost');
  const cashBal = accBalance('cash');
  const open = DB.repairs.filter(r => OPEN_ST.includes(r.status)), ready = DB.repairs.filter(r => r.status === 'ready');
  const recToday = DB.repairs.filter(r => dOnly(r.date) === t).length;
  const alerts = [];
  const low = lowStock(); if (low.length) alerts.push(['warn', `📦 ${low.length} صنف وصل لحد الطلب`, 'items']);
  const od = overdueInstallments(); if (od.length) alerts.push(['bad', `📅 ${od.length} قسط متأخر بإجمالي ${fmt(sum(od, o => o.x.amount - num(o.x.paid)))}`, 'installments']);
  const oldReady = ready.filter(r => daysBetween(dOnly(r.readyAt || r.date), t) > 7); if (oldReady.length) alerts.push(['warn', `🔧 ${oldReady.length} جهاز جاهز من أكتر من أسبوع ولم يستلم`, 'repairs']);
  const late = open.filter(r => r.expected && r.expected < t && r.status !== 'ready'); if (late.length) alerts.push(['bad', `⏰ ${late.length} جهاز صيانة تعدى موعد التسليم`, 'repairs']);
  DB.accounts.filter(a => a.active && a.type === 'wallet' && num(a.dayLimit)).forEach(a => { const u = walletUsage(a); if (u.day > num(a.dayLimit) * 0.85) alerts.push(['warn', `💳 ${a.name} قربت من الحد اليومي (${fmt(u.day)}/${fmt(a.dayLimit)})`, 'accounts']); });
  DB.accounts.filter(a => a.active && ['recharge', 'provider'].includes(a.type) && DB.moves.some(m => m.accountId === a.id) && accBalance(a.id) < 200).forEach(a => alerts.push(['warn', `📶 رصيد ${a.name} قليل: ${fmt(accBalance(a.id))}`, 'accounts']));
  if (LIC.ok && LIC.data.exp !== 'LIFE' && daysBetween(t, LIC.data.exp) <= 15) alerts.push(['bad', `🔑 الترخيص ينتهي ${fmtDate(LIC.data.exp)} — كلم المطور ${DEV.phone}`, '']);
  if (!DB.meta.lastBackup || daysBetween(dOnly(DB.meta.lastBackup), t) > 1) alerts.push(['warn', '💾 لم يتم عمل نسخة احتياطية حديثة', 'backup']);
  if (DB.users.some(u => u.owner && u.mustChange) && isAdmin()) alerts.push(['bad', '🔐 كلمة مرور الأدمن لسه الافتراضية 1234 — غيّرها', '']);
  const resv = DB.reservations.filter(r => r.status === 'arrived'); if (resv.length) alerts.push(['pri', `📌 ${resv.length} طلب وصل وبانتظار العميل`, 'reservations']);

  const days = [...Array(14)].map((_, i) => addDays(t, i - 13));
  const salesBy = days.map(d => sum(DB.sales.filter(s => s.status !== 'void' && dOnly(s.date) === d), 'total'));
  const repBy = days.map(d => sum(DB.repairs.filter(r => r.status === 'delivered' && dOnly(r.deliveredAt || '') === d), repTotal));
  const finBy = days.map(d => sum(DB.finops.filter(x => !x.void && dOnly(x.date) === d), 'profit'));
  const top = {}; ms.sales.forEach(s => s.lines.forEach(l => { top[l.name] = top[l.name] || { q: 0, v: 0 }; top[l.name].q += l.qty; top[l.name].v += l.qty * l.price; }));
  const topL = Object.entries(top).sort((a, b) => b[1].v - a[1].v).slice(0, 8);

  el.innerHTML = `<div class="grid g6 mb">
    <div class="kpi c1"><div class="ic">🛒</div><div class="l">مبيعات اليوم (${st.sales.length})</div><div class="v">${fmt(st.salesRev)}</div></div>
    <div class="kpi c4"><div class="ic">🔧</div><div class="l">صيانة اليوم (سُلم ${st.reps.length} / استلم ${recToday})</div><div class="v">${fmt(st.repRev)}</div></div>
    <div class="kpi c3"><div class="ic">💸</div><div class="l">ربح خدمات مالية (${st.fin.length})</div><div class="v">${fmt(st.finProfit)}</div></div>
    <div class="kpi c5"><div class="ic">💰</div><div class="l">مصروفات اليوم</div><div class="v">${fmt(st.expenses)}</div></div>
    ${showP ? `<div class="kpi c2"><div class="ic">📈</div><div class="l">صافي ربح اليوم</div><div class="v">${fmt(st.net)}</div></div>` : ''}
    <div class="kpi c1"><div class="ic">🏦</div><div class="l">الخزنة الآن</div><div class="v">${fmt(cashBal)}</div></div></div>
  <div class="grid g3 mb">
    <div class="card" style="grid-column:span 2"><h3>آخر 14 يوم</h3>${barChart(days.map(d => d.slice(8) + '/' + d.slice(5, 7)), [{ name: 'مبيعات', values: salesBy }, { name: 'صيانة', values: repBy }, { name: 'ربح خدمات مالية', values: finBy }])}</div>
    <div class="card"><h3>🔔 تنبيهات</h3>${alerts.length ? alerts.map(([c, m, p]) => `<div class="alert ${c}" ${p ? `style="cursor:pointer" onclick="go('${p}')"` : ''}>${m}</div>`).join('') : '<div class="alert ok">✔ كله تمام</div>'}</div></div>
  <div class="grid g3">
    <div class="card"><h3>📅 الشهر الحالي</h3><div class="sum-row"><span>المبيعات</span><b>${fmt(ms.salesRev)}</b></div>${showP ? `<div class="sum-row"><span>ربح المبيعات</span><b>${fmt(ms.salesProfit)}</b></div>` : ''}<div class="sum-row"><span>إيراد الصيانة</span><b>${fmt(ms.repRev)}</b></div>${showP ? `<div class="sum-row"><span>ربح الصيانة</span><b>${fmt(ms.repProfit)}</b></div>` : ''}<div class="sum-row"><span>ربح الخدمات المالية</span><b>${fmt(ms.finProfit)}</b></div><div class="sum-row"><span>المصروفات + الرواتب</span><b class="bad-t">${fmt(ms.expenses + ms.payroll)}</b></div>${showP ? `<div class="sum-row" style="font-size:18px"><span>صافي الربح</span><b class="ok-t">${fmt(ms.net)}</b></div>` : ''}</div>
    <div class="card"><h3>🔧 الصيانة</h3><div class="sum-row"><span>أجهزة تحت الصيانة</span><b>${open.length}</b></div><div class="sum-row"><span>جاهزة للتسليم</span><b class="ok-t">${ready.length}</b></div><div class="sum-row"><span>انتظار قطع غيار</span><b>${DB.repairs.filter(r => r.status === 'waiting_parts').length}</b></div>
      ${ready.slice(-5).reverse().map(r => `<div class="alert ok" style="cursor:pointer" onclick="repairView('${r.id}')">#${r.no} ${esc(r.device)} — ${esc(r.custName)}</div>`).join('')}</div>
    <div class="card"><h3>🏆 الأكثر مبيعاً هذا الشهر</h3>${topL.length ? tableHTML([{ l: 'الصنف', f: x => esc(x[0]) }, { l: 'الكمية', f: x => fmt(x[1].q) }, { l: 'القيمة', f: x => fmt(x[1].v) }], topL) : '<div class="empty">لا توجد مبيعات</div>'}</div></div>
  <div class="row mt">${[['pos', '🛒 بيع جديد F1'], ['repairs', '🔧 استلام صيانة F3'], ['finops', '💸 كاش ورصيد F4'], ['items', '📦 الأصناف F6'], ['reports', '📈 التقارير F8']].filter(([p]) => can(p)).map(([p, l]) => `<button class="btn ghost lg" onclick="go('${p}')">${l}</button>`).join('')}</div>`;
};
