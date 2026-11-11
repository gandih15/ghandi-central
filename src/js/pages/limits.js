/* متابعة ليمت المحافظ (إرسال / استقبال — يومي وشهري) */
'use strict';
Pages.limits = el => {
  const wallets = DB.accounts.filter(a => a.active && a.type === 'wallet');
  if (!wallets.length) { el.innerHTML = '<div class="empty">لا توجد محافظ — أضفها من الخزن والمحافظ</div>'; return; }
  let sel = wallets[0].id, days = 30;
  const t = today();
  const tot = wallets.reduce((o, a) => { const u = walletUsage(a); o.out += u.day; o.in += u.inDay; o.bal += accBalance(a.id); return o; }, { out: 0, in: 0, bal: 0 });
  const outRoom = sum(wallets, a => { const r = walletRoom(a, 'out'); return r === Infinity ? 0 : Math.max(0, Math.min(r, accBalance(a.id))); });
  el.innerHTML = `<div class="grid g4 mb">
    <div class="kpi c1"><div class="ic">💼</div><div class="l">إجمالي أرصدة المحافظ</div><div class="v">${fmt(tot.bal)}</div></div>
    <div class="kpi c3"><div class="ic">📤</div><div class="l">إرسال اليوم (كل المحافظ)</div><div class="v">${fmt(tot.out)}</div></div>
    <div class="kpi c2"><div class="ic">📥</div><div class="l">استقبال اليوم (كل المحافظ)</div><div class="v">${fmt(tot.in)}</div></div>
    <div class="kpi c4"><div class="ic">✅</div><div class="l">تقدر ترسل النهارده (بالرصيد والليمت)</div><div class="v">${fmt(outRoom)}</div></div></div>
  <div class="grid g3 mb">${wallets.map(a => { const u = walletUsage(a), b = accBalance(a.id), ro = walletRoom(a, 'out'), ri = walletRoom(a, 'in');
    return `<div class="card"><div class="row"><b style="flex:1">${esc(a.name)}</b>${a.phone ? `<span class="ltr muted">${esc(a.phone)}</span>` : ''}</div>
    <div class="sum-row mt"><span>الرصيد</span><b class="${b < 0 ? 'bad-t' : ''}" style="font-size:18px">${fmt(b)}</b></div>
    <div class="sum-row"><span>عدد العمليات</span><b>اليوم ${u.nDay} — الشهر ${u.nMonth}</b></div>
    <div class="sum-row"><span>تقدر ترسل</span><b class="ok-t">${ro === Infinity ? 'بدون حد' : fmt(Math.max(0, Math.min(ro, b)))}</b></div>
    <div class="sum-row"><span>تقدر تستقبل</span><b class="ok-t">${ri === Infinity ? 'بدون حد' : fmt(Math.max(0, ri))}</b></div>
    ${limitBars(a)}
    <div class="row mt"><button class="btn sm ghost" data-h="${a.id}">📊 السجل</button>${can('accounts') ? `<button class="btn sm ghost" data-e="${a.id}">⚙️ الحدود</button>` : ''}</div></div>`; }).join('')}</div>
  <div class="card"><div class="row mb"><h3 style="margin:0;flex:1">📊 حركة المحفظة يوم بيوم</h3><select id="lsel" style="width:200px">${wallets.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>
    <select id="ldays" style="width:120px"><option value="7">7 أيام</option><option value="30" selected>30 يوم</option><option value="90">90 يوم</option></select><button class="btn sm ghost" id="lexp">📤 تصدير</button></div><div id="lhist"></div></div>`;
  let rows = [];
  const cols = [{ l: 'اليوم', f: r => fmtDate(r.d) }, { l: 'إرسال', k: 'out', money: true, sum: true }, { l: 'حد الإرسال', f: r => r.ol ? fmt(r.ol) : '—' }, { l: 'استقبال', k: 'in', money: true, sum: true }, { l: 'حد الاستقبال', f: r => r.il ? fmt(r.il) : '—' }, { l: 'عدد العمليات', k: 'n', sum: true }, { l: 'رصيد آخر اليوم', f: r => fmt(r.bal) }];
  const hist = () => {
    const a = find('accounts', sel);
    rows = []; for (let i = days - 1; i >= 0; i--) { const d = addDays(t, -i), u = walletUsage(a, d); rows.push({ id: d, d, out: u.day, in: u.inDay, n: u.nDay, ol: num(a.dayLimit), il: num(a.inDayLimit), bal: accBalance(a.id, d + 'T23:59:59') }); }
    $('#lhist').innerHTML = barChart(rows.map(r => r.d.slice(8) + '/' + r.d.slice(5, 7)), [{ name: 'إرسال', values: rows.map(r => r.out) }, { name: 'استقبال', values: rows.map(r => r.in) }], { colors: ['#f59e0b', '#16a34a'] }) + tableHTML(cols, rows.slice().reverse(), { foot: true });
  };
  $('#lsel').onchange = e => { sel = e.target.value; hist(); };
  $('#ldays').onchange = e => { days = num(e.target.value); hist(); };
  $('#lexp').onclick = () => exportCSV('ليمت_' + accName(sel), cols, rows);
  $$('[data-h]', el).forEach(b => b.onclick = () => { sel = b.dataset.h; $('#lsel').value = sel; hist(); $('#lhist').scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-e]', el).forEach(b => b.onclick = () => accForm(find('accounts', b.dataset.e), () => go('limits')));
  hist();
};
