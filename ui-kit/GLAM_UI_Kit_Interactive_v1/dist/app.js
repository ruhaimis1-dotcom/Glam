const viewButtons = [...document.querySelectorAll('[data-view]')];
const panels = [...document.querySelectorAll('[data-view-panel]')];
const deviceButtons = [...document.querySelectorAll('[data-device]')];
const customerApp = document.querySelector('#customer-app');
const localeButton = document.querySelector('.locale-toggle');
const toast = document.querySelector('.toast');

function setView(name) {
  viewButtons.forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => {
    const active = panel.dataset.viewPanel === name;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
}

viewButtons.forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

const customerScreenPanels = [...document.querySelectorAll('[data-customer-screen-panel]')];
const customerScreenButtons = [...document.querySelectorAll('[data-customer-screen]')];
const customerEyebrow = document.querySelector('.customer-eyebrow');
const customerTitle = document.querySelector('.customer-title');
const screenMeta = {
  home: { ar: ['Customer App · C-01', 'الرئيسية والاكتشاف'], en: ['Customer App · C-01', 'Home & discovery'] },
  discovery: { ar: ['Customer App · C-02', 'اكتشاف الصالونات والخدمات'], en: ['Customer App · C-02', 'Salon & service discovery'] },
  salon: { ar: ['Customer App · C-03', 'صفحة الصالون والخدمات'], en: ['Customer App · C-03', 'Salon profile & services'] },
  booking: { ar: ['Customer App · C-04', 'اختيار اليوم والوقت'], en: ['Customer App · C-04', 'Choose date & time'] },
};

function setCustomerScreen(name) {
  const meta = screenMeta[name] || screenMeta.home;
  customerScreenPanels.forEach((panel) => {
    const active = panel.dataset.customerScreenPanel === name;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  customerScreenButtons.forEach((button) => {
    const active = button.dataset.customerScreen === name;
    if (button.classList.contains('customer-screen-tab')) {
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    }
    if (button.closest('.mobile-nav')) button.classList.toggle('active', active);
  });
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  if (customerEyebrow && customerTitle) {
    customerEyebrow.dataset.ar = screenMeta[name].ar[0];
    customerEyebrow.dataset.en = screenMeta[name].en[0];
    customerTitle.dataset.ar = screenMeta[name].ar[1];
    customerTitle.dataset.en = screenMeta[name].en[1];
    customerEyebrow.textContent = meta[locale][0];
    customerTitle.textContent = meta[locale][1];
  }
  customerApp.scrollTo({ top: 0, behavior: 'smooth' });
}

customerScreenButtons.forEach((button) => button.addEventListener('click', (event) => {
  if (button.tagName === 'A') event.preventDefault();
  setCustomerScreen(button.dataset.customerScreen);
}));

const salonStepButtons = [...document.querySelectorAll('[data-salon-step]')];
const salonStepPanels = [...document.querySelectorAll('[data-salon-step-panel]')];
let activeSalonStep = 'owner';

function setSalonStep(name) {
  const target = salonStepPanels.some((panel) => panel.dataset.salonStepPanel === name) ? name : 'owner';
  activeSalonStep = target;
  salonStepButtons.forEach((button) => {
    const active = button.dataset.salonStep === target;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  salonStepPanels.forEach((panel) => {
    const active = panel.dataset.salonStepPanel === target;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}

salonStepButtons.forEach((button) => button.addEventListener('click', () => {
  if (!button.disabled) setSalonStep(button.dataset.salonStep);
}));

document.querySelectorAll('[data-salon-next]').forEach((button) => button.addEventListener('click', () => {
  setSalonStep(button.dataset.salonNext);
  showToast(button.dataset.salonNext === 'review' ? 'تم حفظ البيانات للمراجعة' : 'تم فتح بيانات المنشأة', button.dataset.salonNext === 'review' ? 'Details saved for review' : 'Business details opened');
}));

document.querySelectorAll('[data-salon-submit]').forEach((button) => button.addEventListener('click', () => {
  button.disabled = true;
  button.classList.add('is-complete');
  button.textContent = document.documentElement.lang === 'ar' ? 'تم الإرسال' : 'Submitted';
  showToast('تم إرسال المنشأة للمراجعة', 'Business submitted for review');
}));

document.querySelectorAll('.salon-upload-trigger').forEach((button) => button.addEventListener('click', () => {
  showToast('الإرفاق متاح بعد حفظ المسودة', 'Attachment opens after saving the draft');
}));

const completeFrame = document.querySelector('#complete-frame');
const completeIdentityCss = `
:root{--plum:#5A1835!important;--coral:#B98676!important;--cream:#F7F1EA!important;--blush:#E8CCD1!important;--ink:#21181C!important;--line:#E6DAD4!important;--muted:#6F6268!important;--brand-primary:#5A1835;--brand-dark:#3D0F26;--brand-soft:#8C2E55;--rose-gold:#B98676;--surface:#FFFCF8;--surface-subtle:#F1E8E3;--border:#E6DAD4;--text:#21181C}
*{font-family:"Readex Pro",system-ui,sans-serif!important;box-sizing:border-box}body{background:var(--cream)!important;color:var(--text)!important;line-height:1.6!important}header{background:rgba(255,252,248,.96)!important;border-color:var(--border)!important}main:not(.page-home){color:var(--text)!important}h1,h2,h3,h4{font-weight:600!important;letter-spacing:normal!important}.muted,.meta,small{color:var(--muted)!important}.panel,.summary,.service,.professional-teaser,.business-row,.notification,dialog,.bottom-nav,footer,.pro-booking{background:var(--surface)!important;border-color:var(--border)!important;box-shadow:0 4px 18px rgba(61,15,38,.06)!important}.primary,.header-actions .chip:first-child,.results-tools .chip,.salon-monogram{background:var(--brand-primary)!important;color:var(--surface)!important;border-color:var(--brand-primary)!important}.primary:hover:not(:disabled){background:var(--brand-dark)!important}.chip{border-color:var(--border)!important;color:var(--brand-primary)!important;background:var(--surface)!important}.chip.active,.category-nav button.active>span,.page-detail .service:has(input:checked),.pro-services .service:has(input:checked){background:var(--blush)!important;color:var(--brand-primary)!important;border-color:rgba(90,24,53,.2)!important}.category-nav button.active,.pro-tabs button.active,.live-booking>a:first-child,.live-booking>a{color:var(--brand-primary)!important}.page-home .home-portrait,.occasion-editorial{background:var(--brand-primary)!important}.occasion-copy h2{color:var(--surface)!important}.occasion-copy h2 em{color:var(--blush)!important}.occasion-copy .primary{background:var(--surface)!important;color:var(--brand-primary)!important}.occasion-copy p{color:rgba(255,252,248,.82)!important}.style-invitation-icon{background:var(--blush)!important;color:var(--brand-primary)!important}.photo-cover>span,.favorite-toggle,.distance{background:rgba(255,252,248,.94)!important;color:var(--brand-primary)!important}.booking-progress,.page-detail .booking-progress{background:var(--surface-subtle)!important;border-color:var(--border)!important}.booking-progress .chip.active,.active .step-number{color:var(--surface)!important;background:var(--brand-primary)!important;border-color:var(--brand-primary)!important}.step-number{border-color:var(--border)!important}.page-bookings .panel,.page-notifications .panel{border-inline-start-color:var(--rose-gold)!important}.calendar-grid th{background:var(--surface-subtle)!important;color:var(--brand-primary)!important}.calendar-booking{background:var(--blush)!important;border-color:var(--border)!important;color:var(--text)!important}.calendar-booking.is-selected{outline-color:var(--rose-gold)!important}.live-booking>[role=alert]{background:var(--surface-subtle)!important;border-color:var(--border)!important}.live-booking>[role=status]{background:var(--blush)!important}.salon-cover{background:linear-gradient(120deg,var(--surface),var(--blush))!important}.salon-service{background:var(--surface)!important;border-color:var(--border)!important}.wait-offered{border-color:var(--brand-primary)!important;background:var(--blush)!important}.search input,.form-grid input,.form-grid select,.form-grid textarea{background:var(--surface)!important;border-color:var(--border)!important;color:var(--text)!important}.search:focus-within,.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:var(--brand-primary)!important;box-shadow:0 0 0 3px rgba(90,24,53,.08)!important}.notice{background:var(--surface-subtle)!important;border-color:var(--border)!important}.primary,.chip,.panel,.summary,.service,.pro-booking,.business-row{border-radius:16px!important}
.glam-wordmark{display:block!important;width:142px!important;height:auto!important;aspect-ratio:201/62!important;object-fit:contain!important;object-position:center!important;mix-blend-mode:normal!important;background:transparent url("assets/glam-wordmark-berry.png") center/contain no-repeat!important;color:transparent!important}
.glam-wordmark *{opacity:0!important}
`;

const completeAvailabilityCss = `
.glam-smart-dates{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;margin:12px 0 16px;scrollbar-width:thin}
.glam-smart-date{flex:0 0 112px;min-height:78px;display:grid;align-content:center;gap:3px;padding:9px;border:1px solid var(--border)!important;border-radius:14px!important;background:var(--surface)!important;color:var(--text)!important;text-align:center;cursor:pointer}
.glam-smart-date span{font-size:11px;color:var(--muted)!important}.glam-smart-date strong{font-size:13px;color:var(--brand-dark)!important;font-weight:600}.glam-smart-date small{font-size:10px;color:var(--brand-primary)!important}.glam-smart-date.is-active{background:var(--brand-primary)!important;border-color:var(--brand-primary)!important;color:var(--surface)!important}.glam-smart-date.is-active span,.glam-smart-date.is-active strong,.glam-smart-date.is-active small{color:var(--surface)!important}
.glam-date-source{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.glam-availability-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface-subtle);color:var(--text);margin-top:16px}.glam-availability-summary strong{font-size:13px;color:var(--brand-dark)}.glam-availability-summary span{font-size:11px;color:var(--muted)}
.slot-picker .slot-grid{max-height:none!important;overflow:visible!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important}.slot-picker .slot-grid .time{min-height:50px;padding:10px!important;border-radius:13px!important}.slot-picker .slot-grid .time:disabled,.slot-picker .slot-grid .time.glam-time-extra{display:none!important}.slot-picker.glam-times-expanded .slot-grid .time.glam-time-extra{display:block!important}.glam-time-more{margin-top:10px;border:0;background:transparent;color:var(--brand-primary);font-size:13px;font-weight:600;cursor:pointer}.glam-time-more[hidden]{display:none!important}
@media(max-width:600px){.glam-smart-date{flex-basis:92px}.glam-availability-summary{align-items:flex-start;flex-direction:column}.slot-picker .slot-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
`;

function enhanceCompleteAvailability(doc) {
  const frameWindow = doc.defaultView;
  if (!frameWindow || doc.body?.dataset.glamAvailabilityObserver === 'ready') return;
  const syncDateRail = (select, rail) => {
    rail.querySelectorAll('.glam-smart-date').forEach((button) => {
      const active = button.dataset.value === select.value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  };
  const enhanceDate = (slotPicker) => {
    const panel = slotPicker.closest('.panel') || slotPicker.parentElement;
    const select = [...(panel?.querySelectorAll('select') || [])].find((item) => {
      const label = item.closest('label');
      return label && /اليوم|التاريخ|زيارة/.test(label.textContent || '') && item.options.length >= 3;
    });
    if (!select || select.dataset.glamDateEnhanced === 'true') return;
    const options = [...select.options].filter((option) => option.value).slice(0, 7);
    if (options.length < 3) return;
    const rail = doc.createElement('div');
    rail.className = 'glam-smart-dates';
    rail.setAttribute('role', 'tablist');
    options.forEach((option, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'glam-smart-date';
      button.dataset.value = option.value;
      button.setAttribute('role', 'tab');
      const label = (option.textContent || '').replace(/\s*·\s*مغلق/g, '');
      button.innerHTML = `<span>${index === 0 ? 'اليوم' : index === 1 ? 'غدًا' : 'موعد قريب'}</span><strong>${label}</strong><small>اختاري اليوم</small>`;
      button.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        syncDateRail(select, rail);
      });
      rail.appendChild(button);
    });
    select.classList.add('glam-date-source');
    select.dataset.glamDateEnhanced = 'true';
    select.insertAdjacentElement('afterend', rail);
    select.addEventListener('change', () => syncDateRail(select, rail));
    syncDateRail(select, rail);
  };
  const enhanceTimes = (slotPicker) => {
    const grid = slotPicker.querySelector('.slot-grid');
    if (!grid) return;
    const times = [...grid.querySelectorAll('.time')];
    if (!times.length) return;
    let summary = slotPicker.querySelector('.glam-availability-summary');
    if (!summary) {
      summary = doc.createElement('div');
      summary.className = 'glam-availability-summary';
      summary.innerHTML = '<strong>الأوقات المقترحة أولًا</strong><span>نعرض أقرب 3 مواعيد، ويمكنك فتح البقية عند الحاجة.</span>';
      grid.insertAdjacentElement('beforebegin', summary);
    }
    let more = slotPicker.querySelector('.glam-time-more');
    if (!more) {
      more = doc.createElement('button');
      more.type = 'button';
      more.className = 'glam-time-more';
      more.addEventListener('click', () => {
        const expanded = slotPicker.classList.toggle('glam-times-expanded');
        slotPicker.dataset.glamTimesExpanded = String(expanded);
        more.textContent = expanded ? 'إخفاء الأوقات الإضافية' : 'عرض كل الأوقات';
      });
      grid.insertAdjacentElement('afterend', more);
    }
    const available = times.filter((button) => !button.disabled);
    times.forEach((button) => button.classList.toggle('glam-time-extra', !button.disabled && available.indexOf(button) >= 3));
    const expanded = slotPicker.dataset.glamTimesExpanded === 'true';
    slotPicker.classList.toggle('glam-times-expanded', expanded);
    more.hidden = available.length <= 3;
    more.textContent = expanded ? 'إخفاء الأوقات الإضافية' : `عرض كل الأوقات (${available.length})`;
    summary.querySelector('strong').textContent = available.length ? 'الأوقات المقترحة أولًا' : 'لا توجد أوقات متاحة الآن';
    summary.querySelector('span').textContent = available.length ? `أقرب ${Math.min(3, available.length)} مواعيد ظاهرة، والبقية عند الحاجة.` : 'جرّبي يومًا أو خبيرة أخرى.';
  };
  const sync = () => doc.querySelectorAll('.slot-picker').forEach((slotPicker) => { enhanceDate(slotPicker); enhanceTimes(slotPicker); });
  doc.body.dataset.glamAvailabilityObserver = 'ready';
  sync();
  const observer = new frameWindow.MutationObserver(() => frameWindow.setTimeout(sync, 30));
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class', 'value'] });
}

function lockCompleteIdentity() {
  if (!completeFrame || !completeFrame.contentDocument) return;
  const doc = completeFrame.contentDocument;
  if (doc.getElementById('glam-identity-lock-runtime')) return;
  const fontLink = doc.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap';
  doc.head.appendChild(fontLink);
  const style = doc.createElement('style');
  style.id = 'glam-identity-lock-runtime';
  style.textContent = completeIdentityCss;
  doc.head.appendChild(style);
  doc.querySelectorAll('img.glam-wordmark').forEach((logo) => {
    logo.src = 'assets/glam-wordmark-berry.png';
    logo.removeAttribute('srcset');
    logo.alt = 'Glam';
  });
  const availabilityStyle = doc.createElement('style');
  availabilityStyle.id = 'glam-availability-runtime';
  availabilityStyle.textContent = completeAvailabilityCss;
  doc.head.appendChild(availabilityStyle);
  enhanceCompleteAvailability(doc);
  completeFrame.style.visibility = 'visible';
}

if (completeFrame) {
  completeFrame.addEventListener('load', lockCompleteIdentity);
  if (completeFrame.contentDocument?.readyState === 'complete') lockCompleteIdentity();
}

document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.result-card[data-tags]').forEach((card) => {
    const visible = filter === 'all' || card.dataset.tags.split(',').includes(filter);
    card.hidden = !visible;
  });
}));

document.querySelectorAll('.result-card[data-open-salon]').forEach((card) => card.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  setCustomerScreen('salon');
}));

deviceButtons.forEach((button) => button.addEventListener('click', () => {
  const mobile = button.dataset.device === 'mobile';
  customerApp.classList.toggle('is-mobile', mobile);
  deviceButtons.forEach((item) => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
}));

function showToast(ar, en) {
  toast.textContent = document.documentElement.lang === 'ar' ? ar : en;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelectorAll('.favorite-trigger').forEach((button) => button.addEventListener('click', () => {
  const active = button.classList.toggle('active');
  button.textContent = active ? '♥' : '♡';
  showToast(active ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', active ? 'Added to saved' : 'Removed from saved');
}));

document.querySelectorAll('.slots button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.slots button').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  showToast('تم اختيار الموعد مؤقتًا', 'Time held temporarily');
}));

document.querySelectorAll('.booking-confirm').forEach((button) => button.addEventListener('click', () => {
  if (button.closest('[data-customer-screen-panel="salon"]')) {
    setCustomerScreen('booking');
    showToast('اختاري اليوم، وسأعرض لك أقرب الأوقات', 'Choose a day and we’ll show the closest times');
    return;
  }
  showToast('تفاصيل الحجز جاهزة للمراجعة', 'Booking details are ready');
}));

const bookingDateCards = [...document.querySelectorAll('[data-booking-date]')];
const bookingTimeCards = [...document.querySelectorAll('[data-booking-time]')];
const bookingPeriods = [...document.querySelectorAll('[data-booking-period]')];
const bookingDateLabels = [...document.querySelectorAll('.booking-selected-date')];
const bookingSummaryDates = [...document.querySelectorAll('.booking-summary-date')];
const bookingSummaryTimes = [...document.querySelectorAll('.booking-summary-time')];
const bookingMoreTimes = document.querySelector('.booking-more-times');
const bookingTimeGrid = document.querySelector('.booking-time-grid');
const bookingAvailableCount = document.querySelector('.booking-available-count');

function currentLocaleValue(button, fallback) {
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  return button?.dataset[`${locale}Label`] || button?.dataset.dateLabel || fallback;
}

function setBookingDate(card) {
  bookingDateCards.forEach((item) => item.classList.toggle('active', item === card));
  const label = currentLocaleValue(card, card?.dataset.dateLabel || 'اليوم · 18 سبتمبر');
  bookingDateLabels.forEach((node) => {
    node.textContent = label;
    node.dataset.ar = card?.dataset.arLabel || card?.dataset.dateLabel || '';
    node.dataset.en = card?.dataset.enLabel || card?.dataset.dateLabel || '';
  });
  bookingSummaryDates.forEach((node) => { node.textContent = label; });
  const count = card?.querySelector('em')?.textContent || '6 أوقات';
  if (bookingAvailableCount) {
    bookingAvailableCount.textContent = document.documentElement.lang === 'ar' ? `${count.replace('أوقات', 'مواعيد')} متاحة` : `${count.replace('أوقات', 'slots')} available`;
  }
  if (bookingTimeGrid) {
    bookingTimeGrid.classList.remove('is-expanded');
    bookingTimeGrid.dataset.period = 'recommended';
  }
  if (bookingMoreTimes) {
    bookingMoreTimes.classList.remove('is-expanded');
    bookingMoreTimes.textContent = document.documentElement.lang === 'ar' ? 'عرض كل الأوقات (6)' : 'Show all times (6)';
  }
  applyBookingTimeFilter('recommended', false);
  showToast('تم تحديث الأوقات حسب اليوم', 'Times updated for this day');
}

function applyBookingTimeFilter(filter = 'recommended', expanded = bookingTimeGrid?.classList.contains('is-expanded')) {
  if (!bookingTimeGrid) return;
  const matching = filter === 'recommended'
    ? bookingTimeCards.filter((card) => card.dataset.timePeriod !== 'morning')
    : bookingTimeCards.filter((card) => card.dataset.timePeriod === filter);
  bookingTimeCards.forEach((card) => {
    const index = matching.indexOf(card);
    const visible = index >= 0 && (expanded || index < 3);
    card.classList.toggle('is-extra', index >= 3);
    card.hidden = !visible;
  });
  bookingTimeGrid.dataset.period = filter;
  if (bookingMoreTimes) {
    bookingMoreTimes.hidden = matching.length <= 3;
    const count = matching.length;
    const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    bookingMoreTimes.textContent = expanded
      ? (locale === 'ar' ? 'إخفاء الأوقات الإضافية' : 'Hide extra times')
      : (locale === 'ar' ? `عرض كل الأوقات (${count})` : `Show all times (${count})`);
  }
  if (bookingAvailableCount) {
    bookingAvailableCount.textContent = document.documentElement.lang === 'ar' ? `${matching.length} مواعيد متاحة` : `${matching.length} slots available`;
  }
}

bookingDateCards.forEach((card) => card.addEventListener('click', () => setBookingDate(card)));
bookingTimeCards.forEach((card) => card.addEventListener('click', () => {
  bookingTimeCards.forEach((item) => item.classList.toggle('active', item === card));
  const time = card.dataset.bookingTime || card.querySelector('strong')?.textContent || '';
  bookingSummaryTimes.forEach((node) => { node.textContent = `${time} مساءً`; });
  showToast(`تم اختيار ${time} مؤقتًا`, `Held ${time} temporarily`);
}));
bookingPeriods.forEach((period) => period.addEventListener('click', () => {
  bookingPeriods.forEach((item) => item.classList.toggle('active', item === period));
  const filter = period.dataset.bookingPeriod;
  applyBookingTimeFilter(filter, false);
  if (filter !== 'recommended') showToast(filter === 'morning' ? 'عرض أوقات الصباح' : 'عرض أوقات المساء', filter === 'morning' ? 'Showing morning times' : 'Showing evening times');
}));
if (bookingMoreTimes && bookingTimeGrid) bookingMoreTimes.addEventListener('click', () => {
  const expanded = bookingTimeGrid.classList.toggle('is-expanded');
  bookingMoreTimes.classList.toggle('is-expanded', expanded);
  applyBookingTimeFilter(bookingTimeGrid.dataset.period || 'recommended', expanded);
});
applyBookingTimeFilter('recommended', false);
document.querySelector('.booking-finalize')?.addEventListener('click', () => showToast('تم تجهيز ملخص الحجز للمراجعة', 'Booking summary is ready to review'));

const opsTabButtons = [...document.querySelectorAll('.ops-tab')];
const opsPanels = [...document.querySelectorAll('[data-ops-panel]')];
const opsLinks = [...document.querySelectorAll('[data-ops-tab]')];
function setOpsTab(name) {
  const target = opsPanels.some((panel) => panel.dataset.opsPanel === name) ? name : 'dashboard';
  opsTabButtons.forEach((button) => {
    const active = button.dataset.opsTab === target;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  opsPanels.forEach((panel) => {
    const active = panel.dataset.opsPanel === target;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}
opsLinks.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.opsTab) setOpsTab(button.dataset.opsTab);
}));
document.querySelectorAll('.ops-action').forEach((button) => button.addEventListener('click', () => {
  showToast(button.dataset.ar ? `${button.dataset.ar} — تم حفظ الإجراء` : 'تم حفظ الإجراء للمراجعة', button.dataset.en ? `${button.dataset.en} — action saved` : 'Action saved for review');
}));
document.querySelectorAll('.ops-client-item').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.ops-client-item').forEach((item) => item.classList.toggle('active', item === button));
}));

localeButton.addEventListener('click', () => {
  const next = document.documentElement.lang === 'ar' ? 'en' : 'ar';
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  localeButton.textContent = next === 'ar' ? 'EN' : 'AR';
  document.querySelectorAll('[data-ar][data-en]').forEach((node) => {
    node.textContent = node.dataset[next];
  });
  document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach((node) => {
    node.placeholder = node.dataset[`placeholder${next === 'ar' ? 'Ar' : 'En'}`];
  });
});
