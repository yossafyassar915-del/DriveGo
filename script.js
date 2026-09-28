/* ===================== DriveGo — script.js ===================== */

/* ---------- 1) طبقة البيانات (localStorage) ---------- */
const KEYS = { cars: 'dg_cars', users: 'dg_users', contracts: 'dg_contracts', tasks: 'dg_tasks', txs: 'dg_txs', notifs: 'dg_notifs' };
const db = {
  get: k => JSON.parse(localStorage.getItem(KEYS[k]) || '[]'),
  set: (k, v) => localStorage.setItem(KEYS[k], JSON.stringify(v)),
  // إضافة عنصر جديد "بدمجه" مع القديم دون استبدال المصفوفة
  push(k, item) { const all = db.get(k); item.id = Date.now() + Math.floor(Math.random() * 99); all.push(item); db.set(k, all); return item; },
  update(k, id, patch) { db.set(k, db.get(k).map(x => x.id == id ? { ...x, ...patch } : x)); },
  remove(k, id) { db.set(k, db.get(k).filter(x => x.id != id)); }
};
// حقن البيانات الوهمية فقط إذا كان المفتاح فارغاً (أول تشغيل)
Object.keys(KEYS).forEach(k => { if (localStorage.getItem(KEYS[k]) === null) db.set(k, mockData[k]); });

/* ---------- 2) ثوابت ومساعدات ---------- */
const $ = (s, r = document) => r.querySelector(s);
const money = n => `${Number(n).toLocaleString('en')} ر.س`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const me = () => JSON.parse(localStorage.getItem('dg_me') || 'null');
const param = k => new URLSearchParams(location.search).get(k);
const byId = (k, id) => db.get(k).find(x => x.id == id);
const app = html => { $('#app').innerHTML = html; observeReveal(); };
const EXTRAS = { insurance: ['تأمين شامل', 60], childSeat: ['كرسي أطفال', 25], gps: ['GPS', 20] }; // السعر لليوم
const PLACES = ['مطار الملك خالد', 'وسط الرياض', 'مطار جدة', 'كورنيش جدة', 'الدمام - الواجهة'];
const STATUS = {
  active: ['ساري', 'bg-emerald-500/20 text-emerald-300'], upcoming: ['قادم', 'bg-sky-500/20 text-sky-300'],
  completed: ['منتهي', 'bg-slate-500/20 text-slate-300'], cancelled: ['ملغي', 'bg-rose-500/20 text-rose-300']
};
const badge = s => `<span class="badge ${STATUS[s][1]}">${STATUS[s][0]}</span>`;
const ROLES = { customer: 'عميل', driver: 'سائق', admin: 'مدير' };
const HOME = { customer: 'index.html', driver: 'admin-driver.html', admin: 'admin-dashboard.html' };

// حاسبة التكلفة: السعر × الأيام + الإضافات × الأيام، وخصم 10% من الأساس للإيجار الأسبوعي (7 أيام فأكثر)
function calcTotal(car, days, extras) {
  const base = car.price * days;
  const extra = extras.reduce((s, e) => s + EXTRAS[e][1], 0) * days;
  const discount = days >= 7 ? Math.round(base * 0.1) : 0;
  return { base, extra, discount, total: base + extra - discount };
}

// ظهور العناصر تدريجياً عند التمرير
function observeReveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
  hydratePhotos();
}

/* ---------- 3) الهيكل العام والصلاحيات ---------- */
const CUSTOMER_LINKS = [['index.html', 'الرئيسية'], ['cars.html', 'السيارات'], ['booking.html', 'احجز الآن'], ['track.html', 'تتبّع رحلتي'], ['contracts.html', 'عقودي'], ['wallet.html', 'المحفظة'], ['profile.html', 'حسابي']];
const STAFF_LINKS = [['admin-dashboard.html', 'لوحة التحكم'], ['admin-cars.html', 'السيارات'], ['admin-contracts.html', 'العقود'], ['admin-users.html', 'المستخدمون'], ['admin-fleet.html', 'الأسطول المباشر'], ['admin-driver.html', 'مهام السائق'], ['admin-reports.html', 'التقارير']];

function guardAndBuildNav() {
  const { access, page } = document.body.dataset; let u = me();
  const go = url => { location.replace(url); throw new Error('redirect'); };
  if (access === 'auth' && !u) u = makeGuest();
  if (access === 'staff') {
    if (!u || u.role === 'customer') go('login.html');
    if (u.role === 'driver' && page !== 'driver') go('admin-driver.html'); // السائق يرى صفحته فقط
  }
  const links = access === 'staff' ? STAFF_LINKS.filter(l => u.role === 'admin' || l[0] === 'admin-driver.html') : CUSTOMER_LINKS;
  const cur = location.pathname.split('/').pop() || 'index.html';
  $('#nav').innerHTML = `<div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
    <a href="${HOME[u?.role] || 'index.html'}" class="text-2xl font-black text-grad">DriveGo 🚘</a>
    <nav id="menu" class="hidden md:flex flex-col md:flex-row gap-1 order-3 w-full md:order-none md:w-auto">${links.map(l => `<a class="nav-a ${cur === l[0] ? 'on' : ''}" href="${l[0]}">${l[1]}</a>`).join('')}</nav>
    <div class="flex items-center gap-2">${u ? `<button id="bell" class="nav-a" aria-label="الإشعارات">🔔<sup id="bn" class="text-rose-400 font-bold"></sup></button><span class="text-sm text-slate-300 hidden sm:inline">${esc(u.name)} <span class="badge">${ROLES[u.role]}</span></span>
      ${access === 'staff' ? '<a class="btn btn-ghost btn-sm" href="index.html">🌐 الموقع</a>' : (u.role !== 'customer' ? `<a class="btn btn-sm" href="${HOME[u.role]}">⚙️ لوحة التحكم</a>` : '')}
      <button id="logout" class="nav-a">خروج</button>` : '<a class="btn btn-ghost btn-sm" href="login.html">⚙️ بوابة الإدارة</a><a class="btn btn-sm" href="login.html">دخول</a>'}<button id="burger" class="nav-a md:hidden text-xl" aria-label="القائمة">☰</button></div></div><div id="np" class="hidden card p-3 absolute left-3 top-16 w-72 max-h-80 overflow-auto z-50 grid gap-2"></div>`;
  $('#burger').onclick = () => $('#menu').classList.toggle('hidden');
  if (u) setupBell(u);
  if ($('#logout')) $('#logout').onclick = () => { localStorage.removeItem('dg_me'); location.href = 'login.html'; };
  $('footer').innerHTML = `<div class="max-w-6xl mx-auto px-4 grid sm:grid-cols-3 gap-6 text-right"><div><b class="text-grad text-xl">DriveGo 🚘</b><p class="text-sm mt-2">تأجير سيارات ذكي مع تتبع مباشر.</p></div>
    <div class="text-sm grid gap-1"><b>روابط</b><a href="cars.html">السيارات</a><a href="track.html">التتبع المباشر</a><a href="login.html">بوابة الإدارة والسائقين</a></div><div class="text-sm"><b>تواصل</b><p>support@drivego.demo</p><p>الرياض · جدة · الدمام</p></div></div><p class="mt-6">© 2026 DriveGo — نسخة تجريبية · صور السيارات من Wikipedia</p>`;
}

/* ---------- 4) مكوّنات مشتركة ---------- */
const carCard = (c, i = 0) => `<article class="card lift reveal overflow-hidden" style="transition-delay:${i * 70}ms">
  <div class="car-img" data-name="${esc(c.name)}">${carArt(c)}</div><div class="p-4">
  <div class="flex justify-between items-start"><h3 class="font-bold">${esc(c.name)}</h3><span class="badge">${c.cat}</span></div>
  <p class="text-sm text-slate-400 my-2">${c.gear === 'Automatic' ? 'أوتوماتيك' : 'يدوي'} · ${c.seats} مقاعد</p>
  <div class="flex justify-between items-center"><b class="text-teal-300">${money(c.price)} <small class="text-slate-400 font-normal">/ يوم</small></b>
  <a class="btn btn-sm" href="booking.html?car=${c.id}">احجز</a></div></div></article>`;
const stat = (label, val, i = 0) => `<div class="card p-5 reveal" style="transition-delay:${i * 80}ms"><p class="text-slate-400 text-sm">${label}</p><p class="text-2xl font-black text-grad mt-1">${val}</p></div>`;
const table = (heads, rows) => `<div class="card wrap-x reveal"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const placeOptions = sel => PLACES.map(p => `<option ${p === sel ? 'selected' : ''}>${p}</option>`).join('');
const validContracts = () => db.get('contracts').filter(c => c.status !== 'cancelled');

/* ---------- 5) صفحات العميل ---------- */
const PAGES = {
  // الصفحة 1: الرئيسية
  home() {
    app(`<section class="hero reveal"><span class="badge text-teal-300">تأجير ذكي</span>
      <h1 class="text-4xl md:text-6xl font-black my-4">سيارتك جاهزة <span class="text-grad">أينما كنت</span></h1>
      <p class="text-slate-300 max-w-xl mb-6">أجّر باليوم أو بالأسبوع، واستلم وسلّم من الموقع الأنسب لك.</p>
      <form id="quick" class="card p-4 grid sm:grid-cols-3 gap-3 max-w-2xl"><select id="qCat" class="inp"><option value="">كل الفئات</option><option>Sedan</option><option>SUV</option><option>Electric</option></select>
      <select class="inp">${placeOptions()}</select><button class="btn">ابحث</button></form></section>
      <div class="grid sm:grid-cols-3 gap-4 mb-10">${[['🔑', 'استلام وتسليم مرن', 'اختر الموقع الذي يناسبك'], ['🛡️', 'تأمين شامل', 'قيادة بلا قلق'], ['💸', 'خصم أسبوعي', '10% عند 7 أيام فأكثر']].map((f, i) => `<div class="card p-5 reveal" style="transition-delay:${i * 100}ms"><div class="text-3xl">${f[0]}</div><b>${f[1]}</b><p class="text-sm text-slate-400">${f[2]}</p></div>`).join('')}</div>
      <h2 class="h1">سيارات مميزة</h2><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">${db.get('cars').slice(0, 3).map(carCard).join('')}</div>`);
    $('#quick').onsubmit = e => { e.preventDefault(); location.href = 'cars.html?cat=' + $('#qCat').value; };
  },

  // الصفحة 2: السيارات + الفلترة
  cars() {
    app(`<h1 class="h1">اختر سيارتك</h1><div class="card grid md:grid-cols-4 gap-3 p-4 mb-6">
      <select id="fCat" class="inp"><option value="">كل الفئات</option><option>Sedan</option><option>SUV</option><option>Electric</option></select>
      <select id="fGear" class="inp"><option value="">كل أنواع الفتيس</option><option value="Automatic">أوتوماتيك</option><option value="Manual">يدوي</option></select>
      <label class="text-sm">السعر حتى <b id="pv">600</b> ر.س<input id="fPrice" type="range" min="100" max="600" step="10" value="600" class="w-full"></label>
      <div id="cnt" class="self-center text-slate-400"></div></div><div id="list" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"></div>`);
    $('#fCat').value = param('cat') || '';
    const draw = () => {
      const [cat, gear, max] = [$('#fCat').value, $('#fGear').value, +$('#fPrice').value];
      $('#pv').textContent = max;
      const res = db.get('cars').filter(c => c.available !== false && (!cat || c.cat === cat) && (!gear || c.gear === gear) && c.price <= max);
      $('#cnt').textContent = `${res.length} سيارة`;
      $('#list').innerHTML = res.length ? res.map(carCard).join('') : '<p class="text-slate-400">لا توجد نتائج مطابقة.</p>';
      observeReveal();
    };
    ['fCat', 'fGear', 'fPrice'].forEach(id => $('#' + id).oninput = draw); draw();
  },

  // الصفحة 3: الحجز + حاسبة التكلفة
  booking() {
    const cars = db.get('cars').filter(c => c.available !== false);
    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    app(`<h1 class="h1">احجز سيارتك</h1><div class="grid lg:grid-cols-3 gap-6"><form id="bk" class="card p-5 lg:col-span-2 grid sm:grid-cols-2 gap-4 slide-up">
      <label class="sm:col-span-2 text-sm">السيارة<select id="car" class="inp mt-1">${cars.map(c => `<option value="${c.id}" ${c.id == param('car') ? 'selected' : ''}>${esc(c.name)} — ${money(c.price)}/يوم</option>`).join('')}</select></label>
      <label class="text-sm">من<input id="from" type="date" min="${day(0)}" value="${day(1)}" class="inp mt-1"></label>
      <label class="text-sm">إلى<input id="to" type="date" min="${day(1)}" value="${day(4)}" class="inp mt-1"></label>
      <label class="text-sm">مكان الاستلام<select id="pickup" class="inp mt-1">${placeOptions()}</select></label>
      <label class="text-sm">مكان التسليم<select id="dropoff" class="inp mt-1">${placeOptions()}</select></label>
      <fieldset class="sm:col-span-2 flex flex-wrap gap-4">${Object.entries(EXTRAS).map(([k, [n, p]]) => `<label class="flex gap-2 items-center"><input type="checkbox" value="${k}" class="ex"> ${n} <small class="text-slate-400">(+${p}/يوم)</small></label>`).join('')}</fieldset>
      <fieldset class="sm:col-span-2 grid sm:grid-cols-3 gap-2 text-sm"><legend class="mb-1 text-slate-400">طريقة الدفع</legend>${[['wallet', '👛 المحفظة'], ['card', '💳 بطاقة'], ['cash', '💵 كاش عند الاستلام']].map((m, i) => `<label class="card p-3 cursor-pointer flex gap-2"><input type="radio" name="pay" value="${m[0]}" ${i ? '' : 'checked'}> ${m[1]}</label>`).join('')}</fieldset>
      <div id="cardBox" class="sm:col-span-2 grid grid-cols-2 gap-2 hidden"><input class="inp col-span-2" placeholder="رقم البطاقة (تجريبي)" maxlength="19"><input class="inp" placeholder="MM/YY"><input class="inp" placeholder="CVV" maxlength="3"></div>
      <p class="sm:col-span-2 text-sm text-slate-400">رصيد المحفظة: <b id="bal" class="text-teal-300"></b></p>
      <button class="btn sm:col-span-2">تأكيد الحجز والدفع</button></form>
      <aside class="card p-5 h-fit slide-up" id="sum"></aside></div>`);
    const state = () => {
      const car = byId('cars', $('#car').value), days = Math.round((new Date($('#to').value) - new Date($('#from').value)) / 864e5);
      const extras = [...document.querySelectorAll('.ex:checked')].map(x => x.value);
      return { car, days, extras, ...calcTotal(car, Math.max(days, 0), extras) };
    };
    const paint = () => {
      const s = state();
      $('#sum').innerHTML = `<h3 class="font-bold mb-3">ملخص التكلفة</h3><p class="flex justify-between"><span>${s.days > 0 ? s.days : 0} يوم × ${money(s.car.price)}</span><span>${money(s.base)}</span></p>
        <p class="flex justify-between"><span>الإضافات</span><span>${money(s.extra)}</span></p>
        ${s.discount ? `<p class="flex justify-between text-emerald-300"><span>خصم أسبوعي</span><span>- ${money(s.discount)}</span></p>` : ''}
        <hr class="my-3 border-slate-700"><p class="flex justify-between text-lg font-black text-teal-300"><span>الإجمالي</span><span>${money(s.total)}</span></p>`;
    };
    $('#bk').oninput = () => { paint(); $('#cardBox').classList.toggle('hidden', $('input[name=pay]:checked').value !== 'card'); }; paint(); $('#bal').textContent = money(balance(me().id));
    $('#bk').onsubmit = e => {
      e.preventDefault(); const s = state(), u = me(), method = $('input[name=pay]:checked').value;
      if (s.days < 1) return toast('تاريخ التسليم يجب أن يكون بعد الاستلام', 'err');
      if (method === 'wallet' && balance(u.id) < s.total) return toast('رصيد المحفظة غير كافٍ — اشحنها أولاً', 'err');
      db.push('contracts', { userId: u.id, userName: u.name, carId: s.car.id, carName: s.car.name, from: $('#from').value, to: $('#to').value, days: s.days, pickup: $('#pickup').value, dropoff: $('#dropoff').value, extras: s.extras, total: s.total, status: 'upcoming', method, paid: method !== 'cash' });
      if (method !== 'cash') db.push('txs', { userId: u.id, via: method, amount: -s.total, note: `دفع عقد ${s.car.name}`, date: today() });
      db.push('tasks', { driverId: 3, type: 'توصيل', car: s.car.name, customer: u.name, place: $('#pickup').value, date: $('#from').value, done: false });
      notify(u.id, `تم تأكيد حجز ${s.car.name} ✅`); if (method !== 'cash') notify(u.id, `تم دفع ${money(s.total)} ${method === 'wallet' ? 'من المحفظة' : 'بالبطاقة'}`); notify(3, `مهمة توصيل جديدة: ${s.car.name}`);
      toast('تم الحجز بنجاح 🎉'); setTimeout(() => location.href = 'contracts.html', 900);
    };
  },

  // الصفحة 4: عقودي (الحالية والسابقة)
  contracts() {
    const mine = db.get('contracts').filter(c => c.userId === me().id).sort((a, b) => b.id - a.id);
    const row = c => `<div class="card p-4 flex flex-wrap gap-3 justify-between items-center slide-up"><div><b>${esc(c.carName)}</b> ${badge(c.status)}
      <p class="text-sm text-slate-400">${c.from} → ${c.to} · ${c.pickup} ← ${c.dropoff}</p>
      <p class="text-xs text-slate-500">${c.extras.map(e => EXTRAS[e][0]).join('، ') || 'بدون إضافات'}</p></div>
      <div class="text-left"><b class="text-teal-300">${money(c.total)}</b>${['upcoming', 'active'].includes(c.status) ? `<br><button data-cancel="${c.id}" class="btn btn-danger btn-sm mt-2">إلغاء</button>` : ''}${rateBtn(c)}</div></div>`;
    const cur = mine.filter(c => ['active', 'upcoming'].includes(c.status)), past = mine.filter(c => !cur.includes(c));
    app(`<h1 class="h1">عقودي</h1><h2 class="font-bold mb-3 text-teal-300">الحالية (${cur.length})</h2><div class="grid gap-3 mb-8">${cur.map(row).join('') || '<p class="text-slate-400">لا توجد عقود حالية.</p>'}</div>
      <h2 class="font-bold mb-3 text-slate-300">السابقة (${past.length})</h2><div class="grid gap-3">${past.map(row).join('') || '<p class="text-slate-400">لا توجد عقود سابقة.</p>'}</div>`);
    document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => cancelContract(b.dataset.cancel));
    document.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => rateModal(b.dataset.rate));
  },

  // الصفحة 5: الحساب
  profile() {
    const u = me(), mine = db.get('contracts').filter(c => c.userId === u.id && c.status !== 'cancelled');
    app(`<h1 class="h1">حسابي</h1><div class="card p-6 mb-6 slide-up"><p class="text-xl font-bold">${esc(u.name)}</p><p class="text-slate-400">${esc(u.email)} · ${ROLES[u.role]}</p></div>
      <div class="grid sm:grid-cols-3 gap-4 mb-6">${stat('عدد العقود', mine.length)}${stat('إجمالي الإنفاق', money(mine.reduce((s, c) => s + c.total, 0)), 1)}${stat('أيام الإيجار', mine.reduce((s, c) => s + c.days, 0), 2)}</div>
      <button id="out" class="btn btn-danger">تسجيل الخروج</button>`);
    $('#out').onclick = () => { localStorage.removeItem('dg_me'); location.href = 'login.html'; };
  },

  // الصفحة 6: الدخول / التسجيل
  login() {
    app(`<h1 class="h1">مرحباً بك 👋</h1><div class="grid md:grid-cols-2 gap-6"><section class="card p-5 slide-up"><h2 class="font-bold mb-3">حسابات تجريبية</h2><div class="grid gap-2">
      ${db.get('users').map(u => `<button data-u="${u.id}" class="inp text-right hover:border-teal-300">${esc(u.name)} <span class="badge">${ROLES[u.role]}</span></button>`).join('')}</div>
      <button id="reset" class="btn btn-ghost btn-sm mt-4">إعادة ضبط البيانات</button></section>
      <form id="reg" class="card p-5 grid gap-3 slide-up"><h2 class="font-bold">تسجيل عميل جديد</h2><input id="rn" class="inp" placeholder="الاسم" required><input id="re" type="email" class="inp" placeholder="البريد الإلكتروني" required><button class="btn">تسجيل ودخول</button></form></div>`);
    const enter = u => { localStorage.setItem('dg_me', JSON.stringify(u)); location.href = HOME[u.role]; };
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => enter(byId('users', b.dataset.u)));
    $('#reg').onsubmit = e => { e.preventDefault(); enter(db.push('users', { name: $('#rn').value, email: $('#re').value, role: 'customer' })); };
    $('#reset').onclick = () => { Object.values(KEYS).concat('dg_me').forEach(k => localStorage.removeItem(k)); location.reload(); };
  },

  /* ---------- 6) صفحات لوحة التحكم ---------- */
  // 1: نظرة عامة
  dashboard() {
    const cs = validContracts(), cars = db.get('cars');
    app(`<h1 class="h1">لوحة التحكم</h1><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      ${stat('الإيرادات', money(cs.reduce((s, c) => s + c.total, 0)))}${stat('عقود سارية', cs.filter(c => c.status === 'active').length, 1)}${stat('سيارات متاحة', cars.filter(c => c.available !== false).length, 2)}${stat('عملاء', db.get('users').filter(u => u.role === 'customer').length, 3)}</div>
      <h2 class="font-bold mb-3">آخر العقود</h2>${table(['العميل', 'السيارة', 'الفترة', 'المبلغ', 'الحالة'], db.get('contracts').slice(-6).reverse().map(c => `<tr><td>${esc(c.userName)}</td><td>${esc(c.carName)}</td><td>${c.from} → ${c.to}</td><td>${money(c.total)}</td><td>${badge(c.status)}</td></tr>`))}`);
  },

  // 2: إدارة السيارات (إضافة / تعطيل / حذف)
  adminCars() {
    const draw = () => {
      $('#tbl').innerHTML = table(['السيارة', 'الفئة', 'الفتيس', 'السعر', 'الحالة', ''], db.get('cars').map(c => `<tr><td>${esc(c.name)}</td><td>${c.cat}</td><td>${c.gear}</td><td>${money(c.price)}</td>
        <td>${c.available !== false ? 'متاحة' : 'معطلة'}</td><td class="whitespace-nowrap"><button data-t="${c.id}" class="btn btn-ghost btn-sm">تبديل</button> <button data-d="${c.id}" class="btn btn-danger btn-sm">حذف</button></td></tr>`));
      document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const c = byId('cars', b.dataset.t); db.update('cars', c.id, { available: c.available === false }); draw(); });
      document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { db.remove('cars', b.dataset.d); draw(); });
      observeReveal();
    };
    app(`<h1 class="h1">إدارة السيارات</h1><form id="nf" class="card p-4 grid sm:grid-cols-5 gap-3 mb-6"><input id="nn" class="inp sm:col-span-2" placeholder="اسم السيارة" required>
      <select id="nc" class="inp"><option>Sedan</option><option>SUV</option><option>Electric</option></select><select id="ng" class="inp"><option value="Automatic">أوتوماتيك</option><option value="Manual">يدوي</option></select>
      <input id="np" type="number" min="50" class="inp" placeholder="السعر/يوم" required><button class="btn sm:col-span-5">إضافة سيارة</button></form><div id="tbl"></div>`);
    $('#nf').onsubmit = e => { e.preventDefault(); db.push('cars', { name: $('#nn').value, cat: $('#nc').value, gear: $('#ng').value, price: +$('#np').value, seats: 5, img: '🚗', available: true }); e.target.reset(); draw(); };
    draw();
  },

  // 3: إدارة العقود (تغيير الحالة)
  adminContracts() {
    app(`<h1 class="h1">كل العقود</h1>${table(['#', 'العميل', 'السيارة', 'الفترة', 'المبلغ', 'الحالة'], db.get('contracts').slice().reverse().map(c => `<tr><td>${String(c.id).slice(-4)}</td><td>${esc(c.userName)}</td><td>${esc(c.carName)}</td><td>${c.from} → ${c.to}</td><td>${money(c.total)}</td>
      <td><select data-s="${c.id}" class="inp">${Object.keys(STATUS).map(s => `<option value="${s}" ${s === c.status ? 'selected' : ''}>${STATUS[s][0]}</option>`).join('')}</select></td></tr>`))}`);
    document.querySelectorAll('[data-s]').forEach(s => s.onchange = () => db.update('contracts', s.dataset.s, { status: s.value }));
  },

  // 4: المستخدمون والأدوار
  adminUsers() {
    const draw = () => { $('#tbl').innerHTML = table(['الاسم', 'البريد', 'الدور'], db.get('users').map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="badge">${ROLES[u.role]}</span></td></tr>`)); observeReveal(); };
    app(`<h1 class="h1">المستخدمون</h1><form id="uf" class="card p-4 grid sm:grid-cols-4 gap-3 mb-6"><input id="un" class="inp" placeholder="الاسم" required><input id="ue" type="email" class="inp" placeholder="البريد" required>
      <select id="ur" class="inp"><option value="customer">عميل</option><option value="driver">سائق</option><option value="admin">مدير</option></select><button class="btn">إضافة</button></form><div id="tbl"></div>`);
    $('#uf').onsubmit = e => { e.preventDefault(); db.push('users', { name: $('#un').value, email: $('#ue').value, role: $('#ur').value }); e.target.reset(); draw(); };
    draw();
  },

  // 5: مهام السائق (السائق يرى مهامه، المدير يرى الكل)
  driver() {
    const u = me(), tasks = db.get('tasks').filter(t => u.role === 'admin' || t.driverId === u.id);
    app(`<h1 class="h1">مهام التوصيل والاستلام</h1>${driverRatingCard()}<div class="grid md:grid-cols-2 gap-4">${tasks.map((t, i) => `<div class="card p-4 slide-up" style="animation-delay:${i * 80}ms"><div class="flex justify-between"><b>${t.type} — ${esc(t.car)}</b>
      <span class="badge ${t.done ? 'text-emerald-300' : 'text-amber-300'}">${t.done ? 'تمت' : 'قيد التنفيذ'}</span></div><p class="text-sm text-slate-400 my-2">${esc(t.customer)} · ${t.place} · ${t.date}</p>
      ${t.done ? '' : `<button data-k="${t.id}" class="btn btn-sm">تم التنفيذ</button>`}</div>`).join('') || '<p class="text-slate-400">لا توجد مهام.</p>'}</div>`);
    document.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { db.update('tasks', b.dataset.k, { done: true }); PAGES.driver(); });
  },

  // 6: التقارير (الإيراد حسب الفئة)
  reports() {
    const cars = db.get('cars'), rev = {};
    validContracts().forEach(c => { const cat = (cars.find(x => x.id == c.carId) || {}).cat || 'أخرى'; rev[cat] = (rev[cat] || 0) + c.total; });
    const max = Math.max(...Object.values(rev), 1);
    app(`<h1 class="h1">التقارير</h1><div class="card p-6 grid gap-5 reveal">${Object.entries(rev).map(([k, v]) => `<div><p class="flex justify-between mb-1"><span>${k}</span><b>${money(v)}</b></p><div class="bar" data-w="${v / max * 100}" style="width:0"></div></div>`).join('')}</div>`);
    requestAnimationFrame(() => setTimeout(() => document.querySelectorAll('.bar').forEach(b => b.style.width = b.dataset.w + '%'), 100));
  }
};

/* ---------- 8) إضافات: رسومات السيارات، الخرائط الحية، الصفحات المطوّرة ---------- */
const PALETTE = ['#2dd4bf', '#f5b942', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185', '#34d399', '#f97316'];
const PLACE_XY = { 'مطار الملك خالد': [24.9576, 46.6988], 'وسط الرياض': [24.7112, 46.6741], 'مطار جدة': [21.6796, 39.1565], 'كورنيش جدة': [21.5433, 39.1728], 'الدمام - الواجهة': [26.4207, 50.0888] };

// رسم SVG للسيارة (لون مختلف لكل سيارة، وشكل يتغير حسب الفئة)
function carArt(c) {
  const col = c.color || PALETTE[c.id % PALETTE.length], id = 'g' + c.id, suv = c.cat === 'SUV';
  const body = suv ? 'M14 92 L22 54 Q26 42 48 40 L218 40 Q244 42 254 60 L284 66 Q292 72 290 92 Z' : 'M14 92 Q16 70 52 64 L86 42 Q102 34 132 34 L188 34 Q214 36 228 54 L262 62 Q290 68 290 92 Z';
  const win = suv ? 'M60 46 L206 46 Q228 48 238 62 L60 62 Z' : 'M94 48 Q106 40 132 40 L186 40 Q206 42 216 56 L84 58 Z';
  return `<svg viewBox="0 0 304 130" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="#0b1220" stop-opacity=".85"/></linearGradient></defs>
  <ellipse cx="152" cy="116" rx="130" ry="7" fill="#000" opacity=".4"/><path d="${body}" fill="url(#${id})"/><path d="${win}" fill="#cfefff" opacity=".85"/><path d="M150 40V60" stroke="${col}" stroke-width="3"/>
  ${[76, 232].map(x => `<circle cx="${x}" cy="96" r="20" fill="#0b1220"/><circle cx="${x}" cy="96" r="9" fill="#9fb3cc"/><circle cx="${x}" cy="96" r="3" fill="#0b1220"/>`).join('')}
  <rect x="280" y="72" width="10" height="6" rx="2" fill="#fde68a"/>${c.cat === 'Electric' ? '<text x="140" y="84" font-size="16" text-anchor="middle">⚡</text>' : ''}</svg>`;
}

// عدّاد أرقام متحرك
function countUp() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const end = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now();
      const f = n => { const p = Math.min((n - t0) / 1400, 1); el.textContent = (end * p).toFixed(dec) + (el.dataset.suf || ''); if (p < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }); io.observe(el);
  });
}

/* --- أدوات الخرائط (Leaflet + خرائط CARTO الداكنة + مسارات حقيقية من OSRM) --- */
const pin = e => L.divIcon({ className: 'pin', html: `<span>${e}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] });
function makeMap(id, center, zoom) {
  const m = L.map(id, { zoomControl: false }).setView(center, zoom);
  L.control.zoom({ position: 'bottomleft' }).addTo(m);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }).addTo(m);
  return m;
}
// مسار طرق حقيقي؛ إذا فشل الاتصال نرجع لخط مستقيم
async function roadRoute(a, b) {
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`);
    return (await r.json()).routes[0].geometry.coordinates.map(([x, y]) => [y, x]);
  } catch { return [a, b]; }
}
// تحريك نقطة على طول المسار خلال مدة معينة (loop للتكرار)
function animateAlong(path, ms, onTick, loop) {
  const seg = [0]; for (let i = 1; i < path.length; i++) seg[i] = seg[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  const tot = seg[seg.length - 1] || 1, t0 = performance.now();
  const step = now => {
    let p = (now - t0) / ms; p = loop ? p % 1 : Math.min(p, 1);
    const d = p * tot; let i = 1; while (i < seg.length - 1 && seg[i] < d) i++;
    const f = (d - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1), a = path[i - 1], b = path[i];
    onTick([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], p, now);
    if (loop || p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* --- الرئيسية المطوّرة --- */
PAGES.home = function () {
  const cars = db.get('cars').filter(c => c.available !== false);
  const cats = [['Sedan', 'سيدان', 'مريحة واقتصادية'], ['SUV', 'دفع رباعي', 'للعائلة والطرق الوعرة'], ['Electric', 'كهربائية', 'هدوء وصفر انبعاثات']];
  const steps = [['اختر سيارتك', 'فلتر حسب الفئة والسعر'], ['حدد الموعد والمكان', 'استلام وتسليم من أي موقع'], ['تتبّع السائق مباشرة', 'شاهد سيارتك تقترب على الخريطة'], ['انطلق', 'عقد رقمي بدون أوراق']];
  const reviews = [['سارة العتيبي', 'وصل السائق قبل الموعد، وتجربة الحجز كانت سلسة جداً.'], ['خالد الحربي', 'أفضل تجربة تأجير، والتتبع المباشر شيء رائع.'], ['نورة القحطاني', 'الأسعار واضحة والعقد رقمي بالكامل بدون تعقيد.']];
  const faq = [['هل يوجد خصم أسبوعي؟', 'نعم، خصم 10% عند حجز 7 أيام فأكثر.'], ['هل أستطيع الإلغاء؟', 'نعم، من صفحة عقودي قبل بدء الرحلة.'], ['كيف أتتبع سيارتي؟', 'من صفحة تتبّع رحلتي ترى موقع السائق ووقت الوصول لحظياً.']];
  app(`<section class="hero-wrap mb-10"><div class="blob" style="background:#2dd4bf;width:300px;height:300px;top:-90px;right:-70px"></div><div class="blob" style="background:#f5b942;width:240px;height:240px;bottom:-90px;left:-50px;animation-delay:2s"></div>
    <div class="relative grid lg:grid-cols-2 gap-8 items-center"><div><span class="badge text-teal-300">🚀 الجيل الجديد من تأجير السيارات</span>
    <h1 class="text-4xl md:text-6xl font-black my-4 leading-tight">استأجر بضغطة، <span class="text-grad">وتتبّع سيارتك لحظة بلحظة</span></h1>
    <p class="text-slate-300 mb-6 max-w-lg">سيارات حديثة بالساعة والأسبوع، توصيل إلى بابك، وخريطة حية تريك السائق وهو في الطريق إليك.</p>
    <form id="quick" class="card p-4 grid sm:grid-cols-3 gap-3"><select id="qCat" class="inp"><option value="">كل الفئات</option><option>Sedan</option><option>SUV</option><option>Electric</option></select><select class="inp">${placeOptions()}</select><button class="btn">ابحث عن سيارة</button></form>
    <div class="flex gap-6 mt-6 text-sm text-slate-300"><span>⭐ 4.9 تقييم</span><span>⚡ توصيل في 15 دقيقة</span><span>🛡️ تأمين شامل</span></div></div>
    <div class="relative"><div class="float">${carArt({ id: 0, cat: 'Sedan', color: '#2dd4bf' })}</div><div class="card p-3 absolute top-2 left-2 text-sm slide-up">📍 السائق يصل خلال <b class="text-teal-300">4 د</b></div><div class="card p-3 absolute bottom-2 right-2 text-sm slide-up" style="animation-delay:.3s">✅ تم تأكيد حجزك</div></div></div></section>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">${[[25000, '+', 'عميل سعيد', 0], [4.9, '', 'متوسط التقييم', 1], [15, ' د', 'متوسط زمن التوصيل', 0], [120, '+', 'سيارة في الأسطول', 0]].map((s, i) => `<div class="card p-5 text-center reveal" style="transition-delay:${i * 80}ms"><b class="text-3xl text-grad" data-count="${s[0]}" data-suf="${s[1]}" data-dec="${s[3]}">0</b><p class="text-sm text-slate-400 mt-1">${s[2]}</p></div>`).join('')}</div>
    <div class="marquee mb-12 text-2xl font-black text-slate-600"><div>${['TOYOTA', 'HYUNDAI', 'HONDA', 'KIA', 'NISSAN', 'TESLA', 'TOYOTA', 'HYUNDAI', 'HONDA', 'KIA', 'NISSAN', 'TESLA'].map(b => `<span>${b}</span>`).join('')}</div></div>
    <h2 class="h1">تصفّح حسب الفئة</h2><div class="grid md:grid-cols-3 gap-5 mb-12">${cats.map((c, i) => `<a href="cars.html?cat=${c[0]}" class="card lift reveal overflow-hidden" style="transition-delay:${i * 90}ms"><div class="car-img">${carArt({ id: 20 + i, cat: c[0] })}</div><div class="p-4 flex justify-between"><div><b>${c[1]}</b><p class="text-sm text-slate-400">${c[2]}</p></div><span class="text-teal-300">←</span></div></a>`).join('')}</div>
    <h2 class="h1">سيارات مميزة</h2><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">${cars.slice(0, 6).map(carCard).join('')}</div>
    <h2 class="h1">كيف تعمل المنصة؟</h2><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">${steps.map((s, i) => `<div class="card p-5 reveal" style="transition-delay:${i * 90}ms"><span class="step">${i + 1}</span><b class="block mt-3">${s[0]}</b><p class="text-sm text-slate-400">${s[1]}</p></div>`).join('')}</div>
    <section class="card overflow-hidden grid md:grid-cols-2 mb-12 reveal"><div class="p-8"><span class="badge text-amber-300">جديد</span><h2 class="text-3xl font-black my-3">تتبّع مباشر <span class="text-grad">بأسلوب أوبر</span></h2><p class="text-slate-300 mb-5">شاهد السائق على خريطة حقيقية، مع وقت الوصول والسرعة ومراحل الرحلة لحظة بلحظة.</p><a href="track.html" class="btn">جرّب التتبع</a></div>
    <svg viewBox="0 0 400 220" class="w-full h-full min-h-[200px]" style="background:#0d1a30"><path d="M0 60H400M0 120H400M0 180H400M80 0V220M200 0V220M320 0V220" stroke="#1b2a47" stroke-width="10"/><path id="rt" d="M30 190 L80 120 L200 120 L200 60 L320 60 L370 30" fill="none" stroke="#2dd4bf" stroke-width="4" stroke-dasharray="8 6"/><circle r="9" fill="#f5b942"><animateMotion dur="7s" repeatCount="indefinite" path="M30 190 L80 120 L200 120 L200 60 L320 60 L370 30"/></circle><circle cx="370" cy="30" r="8" fill="#2dd4bf"/></svg></section>
    <h2 class="h1">آراء العملاء</h2><div class="grid md:grid-cols-3 gap-4 mb-12">${reviews.map((r, i) => `<div class="card p-5 reveal" style="transition-delay:${i * 90}ms"><p class="text-amber-300">★★★★★</p><p class="my-3 text-slate-200">${r[1]}</p><b class="text-sm text-teal-300">${r[0]}</b></div>`).join('')}</div>
    <h2 class="h1">أسئلة شائعة</h2><div class="grid gap-3 mb-12">${faq.map(f => `<details class="card p-4 reveal"><summary class="cursor-pointer font-bold">${f[0]}</summary><p class="text-slate-400 mt-2">${f[1]}</p></details>`).join('')}</div>
    <section class="hero-wrap text-center reveal"><h2 class="text-3xl font-black mb-3">جاهز للانطلاق؟</h2><p class="text-slate-300 mb-5">احجز سيارتك الآن واستلمها خلال دقائق.</p><a class="btn" href="cars.html">ابدأ الحجز</a></section>`);
  $('#quick').onsubmit = e => { e.preventDefault(); location.href = 'cars.html?cat=' + $('#qCat').value; };
  countUp();
};

/* --- تسجيل الدخول المطوّر: بوابات واضحة للأدوار الثلاثة --- */
PAGES.login = function () {
  const R = [['customer', '👤', 'عميل', 'احجز وتتبّع رحلتك'], ['driver', '🧑‍✈️', 'سائق', 'مهام التوصيل والاستلام'], ['admin', '🛡️', 'مدير', 'لوحة التحكم الكاملة']];
  app(`<div class="hero-wrap text-center mb-8"><div class="blob" style="background:#2dd4bf;width:260px;height:260px;top:-80px;right:-60px"></div><h1 class="text-3xl md:text-5xl font-black relative">ادخل إلى <span class="text-grad">DriveGo</span></h1><p class="text-slate-300 mt-2 relative">اختر نوع الحساب للتجربة</p></div>
    <div class="grid sm:grid-cols-3 gap-4 mb-8">${R.map((r, i) => `<button data-r="${r[0]}" class="card lift p-6 text-center reveal" style="transition-delay:${i * 90}ms"><div class="text-4xl mb-2">${r[1]}</div><b>دخول كـ${r[2]}</b><p class="text-sm text-slate-400">${r[3]}</p></button>`).join('')}</div>
    <form id="reg" class="card p-5 grid sm:grid-cols-4 gap-3 items-center slide-up"><b class="sm:col-span-4">أو سجّل كعميل جديد</b><input id="rn" class="inp" placeholder="الاسم" required><input id="re" type="email" class="inp" placeholder="البريد الإلكتروني" required><button class="btn sm:col-span-2">تسجيل ودخول</button></form>
    <button id="reset" class="btn btn-ghost btn-sm mt-4">إعادة ضبط البيانات التجريبية</button>`);
  const enter = u => { localStorage.setItem('dg_me', JSON.stringify(u)); location.href = HOME[u.role]; };
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => enter(db.get('users').find(u => u.role === b.dataset.r)));
  $('#reg').onsubmit = e => { e.preventDefault(); enter(db.push('users', { name: $('#rn').value, email: $('#re').value, role: 'customer' })); };
  $('#reset').onclick = () => { Object.values(KEYS).concat('dg_me').forEach(k => localStorage.removeItem(k)); location.reload(); };
};

/* --- تتبّع رحلتي (العميل): السائق يقترب على خريطة حقيقية --- */
PAGES.track = async function () {
  const c = db.get('contracts').filter(x => x.userId === me().id && ['active', 'upcoming'].includes(x.status)).sort(x => x.status === 'active' ? -1 : 1)[0];
  if (!c) return app('<div class="card p-10 text-center"><div class="text-5xl mb-3">🗺️</div><p class="mb-4">لا توجد رحلة نشطة للتتبع.</p><a class="btn" href="cars.html">احجز الآن</a></div>');
  const to = PLACE_XY[c.pickup] || PLACE_XY['وسط الرياض'], from = [to[0] + .035, to[1] - .045], car = byId('cars', c.carId) || { id: 1, cat: 'Sedan' };
  const steps = ['تم تأكيد الحجز', 'السائق في الطريق', 'وصل السائق — جاهز للاستلام'];
  app(`<h1 class="h1">تتبّع رحلتي</h1><div class="grid lg:grid-cols-3 gap-5"><div class="card lg:col-span-2 overflow-hidden"><div id="map" style="height:65vh;min-height:380px"></div></div>
    <aside class="card p-5 slide-up"><div class="h-24">${carArt(car)}</div><b>${esc(c.carName)}</b> <span class="badge">أ ب ج 1234</span>
    <div class="flex items-center gap-3 my-4"><span class="step">م</span><div><b>ماجد السائق</b><p class="text-xs text-amber-300">★ 4.9 · 1,280 رحلة</p></div></div>
    <p class="text-sm text-slate-400">الوصول المتوقع</p><p class="text-4xl font-black text-grad" id="eta">--</p>
    <div class="bg-slate-800 rounded-full h-2 my-3"><div id="pg" class="bar" style="width:0;height:.5rem"></div></div>
    <div class="grid grid-cols-3 gap-2 text-center text-sm mb-4"><div class="card p-2"><b id="spd">0</b><br><small class="text-slate-400">كم/س</small></div><div class="card p-2"><b id="dst">--</b><br><small class="text-slate-400">كم متبقي</small></div><div class="card p-2"><b>87%</b><br><small class="text-slate-400">الوقود</small></div></div>
    <ul id="st" class="grid gap-2 text-sm">${steps.map((s, i) => `<li data-i="${i}" class="flex gap-2 items-center text-slate-500"><span class="dot"></span>${s}</li>`).join('')}</ul>
    <div class="flex gap-2 mt-4"><button class="btn btn-ghost flex-1" onclick="alert('اتصال تجريبي 📞')">📞 اتصال</button><button class="btn flex-1" onclick="alert('محادثة تجريبية 💬')">💬 رسالة</button><button class="btn btn-ghost" data-rate="${c.id}">⭐</button></div></aside></div>`);
  document.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => rateModal(b.dataset.rate));
  const map = makeMap('map', to, 12), path = await roadRoute(from, to);
  L.marker(to, { icon: pin('📍') }).addTo(map).bindPopup(esc(c.pickup));
  L.polyline(path, { color: '#2dd4bf', weight: 5, opacity: .85 }).addTo(map); map.fitBounds(path, { padding: [50, 50] });
  const mk = L.marker(from, { icon: pin('🚘') }).addTo(map);
  const km = path.reduce((s, pt, i) => i ? s + L.latLng(path[i - 1]).distanceTo(pt) : 0, 0) / 1000;
  animateAlong(path, 60000, (pos, p, now) => {
    if (p >= 1 && !window._arr) { window._arr = 1; notify(c.userId, 'وصل السائق 🎉 سيارتك بانتظارك'); toast('وصل السائق 🎉'); }
    mk.setLatLng(pos); const left = Math.ceil((1 - p) * 12);
    $('#eta').textContent = p >= 1 ? 'وصل 🎉' : `${left} دقيقة`; $('#pg').style.width = p * 100 + '%';
    $('#spd').textContent = p >= 1 ? 0 : Math.round(45 + 15 * Math.sin(now / 2500)); $('#dst').textContent = ((1 - p) * km).toFixed(1);
    document.querySelectorAll('#st li').forEach((li, i) => li.className = 'flex gap-2 items-center ' + ([true, p > .02, p >= 1][i] ? 'text-teal-300 font-bold' : 'text-slate-500'));
  });
};

/* --- الأسطول المباشر (المدير): كل السيارات تتحرك على الخريطة --- */
PAGES.fleet = async function () {
  const cars = db.get('cars').slice(0, 6), P = { A: [24.9576, 46.6988], B: [24.7112, 46.6741], C: [24.7593, 46.6293], D: [24.7345, 46.575], E: [24.7726, 46.6086], F: [24.6937, 46.6853], G: [24.7297, 46.7365] };
  const pairs = [[P.B, P.A], [P.C, P.D], [P.E, P.B], [P.F, P.G], [P.D, P.B], [P.A, P.C]], st = ['في رحلة', 'توصيل', 'في رحلة', 'استلام', 'توصيل', 'في رحلة'];
  app(`<h1 class="h1">الأسطول المباشر <span class="badge text-emerald-300">● مباشر</span></h1><div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">${stat('على الطريق', cars.length)}${stat('متاحة بالفرع', Math.max(db.get('cars').length - cars.length, 0), 1)}${stat('في الصيانة', 1, 2)}${stat('مهام اليوم', db.get('tasks').length, 3)}</div>
    <div class="grid lg:grid-cols-4 gap-4"><div class="card lg:col-span-3 overflow-hidden"><div id="map" style="height:65vh;min-height:380px"></div></div><div id="fl" class="card p-3 grid gap-2 content-start overflow-auto" style="max-height:65vh"></div></div>`);
  const map = makeMap('map', [24.75, 46.66], 11), paths = await Promise.all(pairs.map(([a, b]) => roadRoute(a, b)));
  cars.forEach((c, i) => {
    const path = paths[i].concat([...paths[i]].reverse()), m = L.marker(path[0], { icon: pin('🚘') }).addTo(map).bindPopup(`<b>${esc(c.name)}</b><br>${st[i]}`);
    const row = document.createElement('button'); row.className = 'card lift p-3 text-right text-sm';
    row.innerHTML = `<b>${esc(c.name)}</b><br><span class="text-slate-400">${st[i]} · </span><span class="text-teal-300"><b class="s">0</b> كم/س</span>`;
    row.onclick = () => { map.flyTo(m.getLatLng(), 14); m.openPopup(); }; $('#fl').append(row);
    let last; animateAlong(path, 70000 + i * 15000, (pos, p, now) => { m.setLatLng(pos); const s = Math.round(50 + 25 * Math.sin(now / 3000 + i)); if (s !== last) { last = s; row.querySelector('.s').textContent = s; } }, true);
  });
};

/* ---------- 9) المحفظة، الدفع، الإشعارات، التقييم، الصور الحقيقية، وضع الزائر ---------- */
const today = () => new Date().toISOString().slice(0, 10);
// رصيد المحفظة = مجموع عمليات المحفظة (الدفع بالبطاقة لا يمس الرصيد)
const balance = uid => db.get('txs').filter(t => t.userId === uid && t.via === 'wallet').reduce((s, t) => s + t.amount, 0);

function notify(userId, text) { db.push('notifs', { userId, text, read: false, time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) }); }
function toast(msg, type) {
  const t = document.createElement('div'); t.className = 'toast ' + (type === 'err' ? 'err' : ''); t.textContent = msg;
  document.body.append(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
}
function modal(html) {
  const m = document.createElement('div'); m.className = 'modal-bg'; m.innerHTML = `<div class="card p-6 w-full max-w-sm slide-up">${html}</div>`;
  m.onclick = e => { if (e.target === m) m.remove(); }; document.body.append(m); return m;
}

// وضع الزائر: لا يلزم تسجيل دخول، يُنشأ حساب ضيف تلقائياً مع رصيد ترحيبي
function makeGuest() {
  const g = db.push('users', { name: 'زائر', email: 'guest@drivego.demo', role: 'customer', guest: true });
  db.push('txs', { userId: g.id, via: 'wallet', amount: 1000, note: 'رصيد ترحيبي 🎁', date: today() });
  notify(g.id, 'أهلاً بك! أضفنا 1000 ر.س رصيداً ترحيبياً لمحفظتك 🎁');
  localStorage.setItem('dg_me', JSON.stringify(g)); return g;
}

// جرس الإشعارات في الشريط العلوي
function setupBell(u) {
  const list = () => db.get('notifs').filter(n => n.userId === u.id).sort((a, b) => b.id - a.id);
  const badge = () => { const n = list().filter(x => !x.read).length; $('#bn').textContent = n || ''; };
  badge();
  $('#bell').onclick = () => {
    const np = $('#np'); np.classList.toggle('hidden');
    np.innerHTML = list().slice(0, 12).map(n => `<div class="text-sm p-2 rounded-lg ${n.read ? '' : 'bg-slate-800'}">${esc(n.text)}<br><small class="text-slate-500">${n.time}</small></div>`).join('') || '<p class="text-sm text-slate-400">لا توجد إشعارات.</p>';
    db.set('notifs', db.get('notifs').map(n => n.userId === u.id ? { ...n, read: true } : n)); badge();
  };
}

// إلغاء عقد مع استرداد المبلغ للمحفظة
function cancelContract(id) {
  if (!confirm('إلغاء هذا العقد؟')) return;
  const c = byId('contracts', id); db.update('contracts', id, { status: 'cancelled' });
  if (c.paid) db.push('txs', { userId: c.userId, via: 'wallet', amount: c.total, note: `استرداد عقد ${c.carName}`, date: today() });
  notify(c.userId, `تم إلغاء عقد ${c.carName}${c.paid ? ' واسترداد المبلغ لمحفظتك' : ''}`); toast('تم الإلغاء'); PAGES.contracts();
}

// تقييم السائق
const rateBtn = c => c.status === 'cancelled' ? '' : (c.rating ? `<p class="text-amber-300 text-sm mt-2">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</p>` : `<br><button data-rate="${c.id}" class="btn btn-ghost btn-sm mt-2">⭐ قيّم السائق</button>`);
function rateModal(id) {
  const c = byId('contracts', id); let r = 5;
  const m = modal(`<h3 class="font-bold text-lg">قيّم السائق ماجد</h3><p class="text-sm text-slate-400 mb-3">${esc(c.carName)}</p><div id="stars" class="text-4xl text-amber-300 cursor-pointer mb-3">${[1, 2, 3, 4, 5].map(i => `<span data-s="${i}">★</span>`).join('')}</div><textarea id="rv" class="inp mb-3" rows="3" placeholder="اكتب تعليقك (اختياري)"></textarea><button id="rs" class="btn w-full">إرسال التقييم</button>`);
  const paint = () => m.querySelectorAll('#stars span').forEach(s => s.style.opacity = +s.dataset.s <= r ? 1 : .25); paint();
  m.querySelectorAll('#stars span').forEach(s => s.onclick = () => { r = +s.dataset.s; paint(); });
  m.querySelector('#rs').onclick = () => {
    db.update('contracts', id, { rating: r, review: m.querySelector('#rv').value }); notify(3, `تقييم جديد ${r}★ من ${c.userName}`);
    toast('شكراً لتقييمك ⭐'); m.remove(); if (document.body.dataset.page === 'contracts') PAGES.contracts();
  };
}
function driverRatingCard() {
  const r = db.get('contracts').filter(c => c.rating), avg = r.length ? (r.reduce((s, c) => s + c.rating, 0) / r.length).toFixed(1) : '—';
  return `<div class="grid sm:grid-cols-3 gap-4 mb-6">${stat('متوسط التقييم', '★ ' + avg)}${stat('عدد التقييمات', r.length, 1)}${stat('مهام منجزة', db.get('tasks').filter(t => t.done).length, 2)}</div>`;
}

// صور حقيقية للسيارات من ويكيبيديا (تُحمَّل عند التشغيل وتُخزَّن؛ وإن فشلت يبقى رسم SVG)
async function hydratePhotos() {
  const cache = JSON.parse(localStorage.getItem('dg_photos') || '{}');
  await Promise.all([...document.querySelectorAll('.car-img[data-name]:not([data-done])')].map(async el => {
    el.dataset.done = 1; const n = el.dataset.name;
    if (cache[n] === undefined) {
      try { const j = await (await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(n.replace(/ /g, '_')))).json(); cache[n] = (j.thumbnail?.source || '').replace(/\/\d+px-/, '/500px-'); } catch { cache[n] = ''; }
      localStorage.setItem('dg_photos', JSON.stringify(cache));
    }
    if (cache[n]) { const img = new Image(); img.alt = n; img.onload = () => { el.innerHTML = ''; el.append(img); el.classList.add('has-photo'); }; img.src = cache[n]; }
  }));
}

// صفحة المحفظة
PAGES.wallet = function () {
  const u = me(), add = a => { db.push('txs', { userId: u.id, via: 'wallet', amount: a, note: 'شحن رصيد', date: today() }); notify(u.id, `تم شحن ${money(a)} في محفظتك 💰`); toast('تم الشحن بنجاح ✅'); draw(); };
  const draw = () => {
    const txs = db.get('txs').filter(t => t.userId === u.id).sort((a, b) => b.id - a.id);
    app(`<h1 class="h1">محفظتي</h1><div class="grid lg:grid-cols-3 gap-5"><div class="wallet-card slide-up"><p class="opacity-80">الرصيد الحالي</p><p class="text-4xl font-black my-3">${money(balance(u.id))}</p><p class="tracking-widest opacity-80">•••• •••• •••• 4242</p><p class="text-sm mt-3">${esc(u.name)}</p></div>
      <div class="card p-5 lg:col-span-2 slide-up"><h2 class="font-bold mb-3">شحن الرصيد (تجريبي)</h2><div class="flex flex-wrap gap-2 mb-3">${[100, 500, 1000, 2000].map(a => `<button data-a="${a}" class="btn btn-ghost btn-sm">+${a}</button>`).join('')}</div>
      <form id="tp" class="flex gap-2"><input id="amt" type="number" min="10" class="inp" placeholder="مبلغ آخر" required><button class="btn">شحن</button></form></div></div>
      <h2 class="font-bold my-4">سجل العمليات</h2>${table(['العملية', 'الطريقة', 'التاريخ', 'المبلغ'], txs.map(t => `<tr><td>${esc(t.note)}</td><td>${t.via === 'card' ? 'بطاقة' : 'المحفظة'}</td><td>${t.date}</td><td class="${t.amount > 0 ? 'text-emerald-300' : 'text-rose-300'}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</td></tr>`))}`);
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => add(+b.dataset.a));
    $('#tp').onsubmit = e => { e.preventDefault(); add(+$('#amt').value); };
  };
  draw();
};

/* ---------- 7) التشغيل ---------- */
try {
  guardAndBuildNav();
  const key = document.body.dataset.page;
  (PAGES[key] || PAGES.home)();
} catch (e) { if (e.message !== 'redirect') throw e; }
