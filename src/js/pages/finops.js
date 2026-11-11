/* الخدمات المالية: محافظ (سحب/إيداع)، تحويل رصيد، فواتير وفوري */
'use strict';
const FIN_KINDS = {
  wallet_in: ['سحب كاش من محفظة', 'العميل يحوّل لمحفظتك وتديله كاش', 'wallet', '📥'],
  wallet_out: ['إيداع / تحويل لمحفظة', 'العميل يديك كاش وتحوّل له', 'wallet', '📤'],
  recharge: ['شحن رصيد / تحويل رصيد', 'تحويل رصيد كارت لخط العميل', 'recharge', '📶'],
  bill: ['دفع فواتير وخدمات', 'فوري / أمان / كهرباء / نت / غاز ...', 'provider', '🧾']
};
function calcFee(acc, amount) {
  if (!acc) return 0;
  let f = num(acc.feeFixed) + amount * num(acc.feePct) / 100;
  if (num(acc.feeMin) && f < num(acc.feeMin)) f = num(acc.feeMin);
  if (num(acc.feeMax) && f > num(acc.feeMax)) f = num(acc.feeMax);
  return r2(f);
}
Pages.finops = el => {
  const t = today();
  el.innerHTML = `<div class="grid g4 mb">${Object.entries(FIN_KINDS).map(([k, v]) => `<div class="kpi c${Object.keys(FIN_KINDS).indexOf(k) + 1}" style="cursor:pointer" data-k="${k}"><div class="ic">${v[3]}</div><div class="v" style="font-size:17px">${v[0]}</div><div class="l">${v[1]}</div></div>`).join('')}</div>
  <div class="card mb"><h3>💼 أرصدة الحسابات الآن</h3><div class="grid g6" id="fbal"></div></div>
  <div class="card"><div class="row mb"><h3 style="margin:0">عمليات</h3><input type="date" id="ff" value="${t}" style="width:150px"><input type="date" id="ft" value="${t}" style="width:150px"><select id="fk" style="width:180px"><option value="">كل الأنواع</option>${Object.entries(FIN_KINDS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select><input id="fq" placeholder="بحث برقم العميل" style="width:180px"><span class="sp"></span><button class="btn ghost sm" onclick="go('limits')">📶 متابعة الليمت</button><button class="btn ghost sm" id="fexp">📤 تصدير</button></div><div id="fsum" class="row mb"></div><div id="ftbl"></div></div>`;
  $$('[data-k]', el).forEach(c => c.onclick = () => finForm(c.dataset.k, draw));
  let from = t, to = t, fk = '', q = '';
  const cols = [{ l: 'رقم', k: 'no' }, { l: 'الوقت', f: x => fmtDT(x.date) }, { l: 'العملية', f: x => `${FIN_KINDS[x.kind][3]} ${FIN_KINDS[x.kind][0]}` }, { l: 'الحساب', f: x => esc(accName(x.accountId)) },
    { l: 'رقم العميل', f: x => `<span class="ltr">${esc(x.phone || '')}</span>` }, { l: 'القيمة', k: 'amount', money: true, sum: true }, { l: 'المحصل/المدفوع كاش', k: 'cash', money: true, sum: true },
    { l: 'الربح', f: x => x.void ? '0' : fmt(x.profit), sum: x => x.void ? 0 : x.profit }, { l: 'بواسطة', k: 'user' }, { l: '', f: x => x.void ? '<span class="tag bad">ملغاة</span>' : `<button class="btn sm ghost" data-pr="${x.id}">🖨️</button> <button class="btn sm bad" data-v="${x.id}">إلغاء</button>` }];
  const rows = () => DB.finops.filter(x => dOnly(x.date) >= from && dOnly(x.date) <= to && (!fk || x.kind === fk) && match(q, x.phone, x.custName, x.ref)).slice().reverse();
  function draw() {
    $('#fbal').innerHTML = DB.accounts.filter(a => a.active).map(a => { const b = accBalance(a.id); let lim = a.type === 'wallet' ? limitBars(a, true) : ''; return `<div class="kpi"><div class="l">${esc(a.name)}</div><div class="v ${b < 0 ? 'bad-t' : ''}" style="font-size:17px">${fmt(b)}</div>${lim}</div>`; }).join('');
    const r = rows();
    $('#ftbl').innerHTML = tableHTML(cols, r, { foot: true, limit: 500 });
    $('#fsum').innerHTML = Object.entries(FIN_KINDS).map(([k, v]) => { const l = r.filter(x => x.kind === k && !x.void); return `<span class="tag">${v[0]}: ${l.length} عملية — ${fmt(sum(l, 'amount'))} — ربح ${fmt(sum(l, 'profit'))}</span>`; }).join(' ');
    $$('[data-v]', el).forEach(b => b.onclick = () => voidFin(b.dataset.v, draw));
    $$('[data-pr]', el).forEach(b => b.onclick = () => printFin(find('finops', b.dataset.pr)));
  }
  $('#ff').onchange = e => { from = e.target.value; draw(); }; $('#ft').onchange = e => { to = e.target.value; draw(); };
  $('#fk').onchange = e => { fk = e.target.value; draw(); }; $('#fq').oninput = debounce(e => { q = e.target.value; draw(); }, 200);
  $('#fexp').onclick = () => exportCSV('الخدمات_المالية', cols.slice(0, -1), rows());
  draw();
};

function finForm(kind, cb) {
  const [title, desc, accType] = FIN_KINDS[kind];
  const accs = DB.accounts.filter(a => a.active && a.type === accType);
  if (!accs.length) return toast(`أضف حساب من نوع "${ACC_TYPES[accType]}" من شاشة الخزن والمحافظ`, 'warn');
  const isRech = kind === 'recharge', isBill = kind === 'bill';
  const o = modal({ title: `${FIN_KINDS[kind][3]} ${title}`, wide: true,
    body: `<p class="muted">${desc}</p><div class="form" style="--cols:3">
      <div class="fld"><label class="f">${isRech ? 'الشبكة' : isBill ? 'جهة الدفع' : 'المحفظة'}</label><select id="facc">${accs.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select><small id="fbalv" class="muted"></small></div>
      <div class="fld"><label class="f">${isRech ? 'رقم الخط' : isBill ? 'رقم العداد / الحساب / الخط' : 'رقم محفظة العميل'}</label><input id="fphone" class="ltr"></div>
      <div class="fld"><label class="f">اسم العميل (اختياري)</label><input id="fname"></div>
      ${isBill ? `<div class="fld"><label class="f">نوع الخدمة</label><input id="fsvc" list="dl-svc" placeholder="كهرباء، غاز، مياه، نت أرضي، تقسيط..."><datalist id="dl-svc">${['كهرباء', 'غاز', 'مياه', 'تليفون أرضي', 'إنترنت WE', 'فاتورة موبايل', 'باقات', 'تقسيط', 'تبرعات', 'مدارس وجامعات', 'تأمينات', 'مرور'].map(x => `<option value="${x}">`).join('')}</datalist></div>` : ''}
      <div class="fld"><label class="f">${isRech ? 'قيمة الرصيد' : 'المبلغ'}</label><input id="famt" type="number" step="any" style="font-size:18px"></div>
      ${isRech ? `<div class="fld"><label class="f">السعر على العميل</label><input id="fprice" type="number" step="any" style="font-size:18px"></div>` : `<div class="fld"><label class="f">العمولة على العميل</label><input id="ffee" type="number" step="any"></div><div class="fld"><label class="f">رسوم الشبكة علينا</label><input id="fcost" type="number" step="any" value="0"></div>`}
      <div class="fld"><label class="f">الكاش ${kind === 'wallet_in' ? 'يخرج من' : 'يدخل في'}</label><select id="fcash">${DB.accounts.filter(a => a.active && ['cash', 'bank'].includes(a.type)).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
      <div class="fld"><label class="f">رقم العملية / المرجع</label><input id="fref" class="ltr"></div></div>
      ${isRech ? `<div class="row mt">${[5, 10, 15, 20, 25, 30, 50, 100, 200].map(v => `<button class="btn ghost sm" data-q="${v}">${v}</button>`).join('')}</div>` : ''}
      <div class="card mt" id="fsumm"></div><div id="fwarn"></div>`,
    buttons: [{ text: '✔ تنفيذ (Enter)', cls: 'ok', click: o => exec(o) }, { text: '✔ تنفيذ وطباعة', click: o => exec(o, true) }, { text: 'إلغاء', cls: 'ghost' }] });
  let feeTouched = false, priceTouched = false;
  const acc = () => find('accounts', $('#facc', o).value);
  const vals = () => {
    const a = acc(), amount = num($('#famt', o).value);
    if (isRech) { const price = priceTouched ? num($('#fprice', o).value) : r2(amount * (num(a.sellRate) || 1)); if (!priceTouched) $('#fprice', o).value = amount ? price : ''; const cost = r2(amount * (num(a.costRate) || 1)); return { amount, fee: r2(price - amount), price, cost, profit: r2(price - cost), cash: price }; }
    const fee = feeTouched ? num($('#ffee', o).value) : calcFee(a, amount); if (!feeTouched) $('#ffee', o).value = amount ? fee : '';
    const cost = num($('#fcost', o).value);
    const cash = kind === 'wallet_in' ? r2(amount - fee) : r2(amount + fee);
    return { amount, fee, cost, profit: r2(fee - cost), cash };
  };
  const upd = () => {
    const a = acc(), v = vals(), bal = accBalance(a.id);
    $('#fbalv', o).textContent = 'الرصيد: ' + fmt(bal);
    $('#fsumm', o).innerHTML = kind === 'wallet_in' ? `<div class="sum-row"><span>هيدخل محفظتك</span><b>${fmt(v.amount - v.cost)}</b></div><div class="sum-row" style="font-size:20px"><span>ادفع للعميل كاش</span><b class="bad-t">${fmt(v.cash)}</b></div><div class="sum-row"><span>ربحك</span><b class="ok-t">${fmt(v.profit)}</b></div>`
      : `<div class="sum-row"><span>هيخرج من ${esc(a.name)}</span><b>${fmt(isRech ? v.amount : v.amount + v.cost)}</b></div><div class="sum-row" style="font-size:20px"><span>حصّل من العميل</span><b class="ok-t">${fmt(v.cash)}</b></div><div class="sum-row"><span>ربحك</span><b class="ok-t">${fmt(v.profit)}</b></div>`;
    let w = '';
    if (kind !== 'wallet_in' && bal < (isRech ? v.amount : v.amount + v.cost)) w += `<div class="alert bad">⚠️ رصيد ${esc(a.name)} غير كافي (${fmt(bal)})</div>`;
    if (kind === 'wallet_in' && accBalance($('#fcash', o).value) < v.cash) w += `<div class="alert warn">⚠️ الكاش في الخزنة أقل من المبلغ</div>`;
    if (a.type === 'wallet' && v.amount > 0) {
      const dir = kind === 'wallet_in' ? 'in' : 'out', need = dir === 'in' ? v.amount - v.cost : v.amount + v.cost;
      const room = walletRoom(a, dir);
      if (need > room) {
        w += `<div class="alert bad">⛔ ${esc(a.name)}: العملية هتعدّي حد ${dir === 'in' ? 'الاستقبال' : 'الإرسال'} — المتبقي ${fmt(Math.max(0, room))} فقط</div>`;
        const alts = DB.accounts.filter(x => x.active && x.type === 'wallet' && x.id !== a.id && walletRoom(x, dir) >= need && (dir === 'in' || accBalance(x.id) >= need));
        if (alts.length) w += `<div class="alert ok">💡 محافظ فيها مساحة: ${alts.map(x => `<button type="button" class="btn sm ok" data-sw="${x.id}">${esc(x.name)} (تقدر ${dir === 'in' ? 'تستقبل' : 'ترسل'} ${(() => { const r = dir === 'in' ? walletRoom(x, dir) : Math.min(walletRoom(x, dir), accBalance(x.id)); return r === Infinity ? 'بدون حد' : fmt(r); })()})</button>`).join(' ')}</div>`;
        else w += `<div class="alert warn">مفيش محفظة تانية فيها مساحة كفاية للمبلغ ده — قسّم العملية أو استنى بكرة.</div>`;
      } else if (room !== Infinity) w += `<div class="alert pri">المتبقي من ليمت ${dir === 'in' ? 'الاستقبال' : 'الإرسال'} بعد العملية: <b>${fmt(room - need)}</b></div>`;
      w += limitBars(a);
    }
    $('#fwarn', o).innerHTML = w;
    $$('[data-sw]', o).forEach(b => b.onclick = () => { $('#facc', o).value = b.dataset.sw; feeTouched = false; upd(); });
  };
  $$('input,select', o).forEach(i => i.addEventListener('input', upd));
  $('#facc', o).onchange = () => { feeTouched = priceTouched = false; upd(); };
  if ($('#ffee', o)) $('#ffee', o).addEventListener('input', () => feeTouched = true);
  if ($('#fprice', o)) $('#fprice', o).addEventListener('input', () => priceTouched = true);
  $$('[data-q]', o).forEach(b => b.onclick = () => { $('#famt', o).value = b.dataset.q; priceTouched = false; upd(); });
  $('#fphone', o).onchange = e => { const last = DB.finops.filter(x => x.phone === e.target.value.trim()).pop(); if (last && !$('#fname', o).value) $('#fname', o).value = last.custName || ''; };
  o.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('.mf .btn.ok', o).click(); } });
  setTimeout(() => $('#fphone', o).focus(), 60); upd();
  function exec(o, print) {
    const a = acc(), v = vals(), cashAcc = $('#fcash', o).value;
    if (v.amount <= 0) { toast('أدخل المبلغ', 'warn'); return false; }
    if (a.type === 'wallet') { const dir = kind === 'wallet_in' ? 'in' : 'out', need = dir === 'in' ? v.amount - v.cost : v.amount + v.cost; if (need > walletRoom(a, dir) && !isAdmin()) { toast('العملية بتعدّي ليمت المحفظة — اختار محفظة تانية', 'bad'); return false; } }
    const no = nextNo('fin');
    const op = { id: uid(), no, date: nowISO(), kind, accountId: a.id, cashAccountId: cashAcc, phone: $('#fphone', o).value.trim(), custName: $('#fname', o).value.trim(), service: $('#fsvc', o)?.value || '', ref: $('#fref', o).value.trim(), ...v, user: me(), shiftId: currentShift()?.id || '' };
    const ref = `${FIN_KINDS[kind][0]} ${no}`;
    if (kind === 'wallet_in') { addMove(a.id, v.amount - v.cost, 'fin', ref, op.phone); addMove(cashAcc, -v.cash, 'fin', ref, op.phone); }
    else if (kind === 'wallet_out' || kind === 'bill') { addMove(a.id, -(v.amount + v.cost), 'fin', ref, op.phone); addMove(cashAcc, v.cash, 'fin', ref, op.phone); }
    else if (kind === 'recharge') { addMove(a.id, -v.amount, 'fin', ref, op.phone); addMove(cashAcc, v.cash, 'fin', ref, op.phone); }
    DB.finops.push(op); audit(FIN_KINDS[kind][0], `${no} — ${op.phone} — ${fmt(v.amount)}`); save();
    toast(`تمت العملية ✔ ${kind === 'wallet_in' ? 'ادفع للعميل ' + fmt(v.cash) : 'حصّل ' + fmt(v.cash)}`, 'ok');
    if (print) printFin(op);
    cb && cb();
  }
}
async function voidFin(id, cb) {
  const op = find('finops', id);
  if (!isAdmin() && dOnly(op.date) !== today()) return toast('إلغاء العمليات القديمة للمدير فقط', 'bad');
  if (!(await confirmBox(`إلغاء العملية ${op.no} وعكس الحركات؟`))) return;
  const ref = `إلغاء ${FIN_KINDS[op.kind][0]} ${op.no}`;
  DB.moves.filter(m => m.ref === `${FIN_KINDS[op.kind][0]} ${op.no}`).forEach(m => addMove(m.accountId, -m.amount, 'void', ref));
  op.void = true; op.voidBy = me(); op.voidAt = nowISO(); audit('إلغاء عملية مالية', op.no); save(); cb && cb();
}
function printFin(op) {
  printDoc(`${shopHeader()}<div class="c b">${FIN_KINDS[op.kind][0]}</div><table class="tot"><tr><td>رقم</td><td>${op.no}</td></tr><tr><td>التاريخ</td><td>${fmtDT(op.date)}</td></tr><tr><td>الحساب</td><td>${esc(accName(op.accountId))}</td></tr>
  <tr><td>رقم العميل</td><td class="ltr">${esc(op.phone)}</td></tr>${op.service ? `<tr><td>الخدمة</td><td>${esc(op.service)}</td></tr>` : ''}${op.ref ? `<tr><td>مرجع</td><td class="ltr">${esc(op.ref)}</td></tr>` : ''}
  <tr class="b"><td>القيمة</td><td>${fmt(op.amount)}</td></tr><tr class="b lg"><td>${op.kind === 'wallet_in' ? 'المسلم للعميل' : 'المدفوع'}</td><td>${fmt(op.cash)}</td></tr></table>${devFooter()}`);
}
