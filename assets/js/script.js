// اتصال به Supabase
const SUPABASE_URL = 'https://lzfonyofgwfiwzsloqjp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// آواتار پیش‌فرض پزشکی (ثابت و سبک)
function getDefaultDoctorAvatar() {
  return 'https://cdn-icons-png.flaticon.com/512/387/387561.png';
}

// تنظیمات صفحه‌بندی نظرات
const COMMENTS_PAGE_SIZE = 5;
// وضعیت صفحه جاری برای هر پزشک: Map<doctor_name, pageNumber>
const commentsPageState = new Map();

// لود پزشک‌ها
async function loadDoctors() {
  const container = document.getElementById('doctors');
  if (!container) return;

  container.textContent = 'در حال دریافت...';

  try {
    const { data, error } = await client
      .from('doctors')
      .select('id, name, specialty, city, image_url');

    if (error) throw error;

    if (!data || data.length === 0) {
      container.textContent = 'هیچ پزشکی یافت نشد.';
      return;
    }

    container.innerHTML = '';

    data.forEach((doc) => {
      const card = document.createElement('div');
      card.className = 'doctor-card';

      const imgSrc =
        doc.image_url && doc.image_url.trim() ? doc.image_url : getDefaultDoctorAvatar();

      // کارت پزشک + باکس نظر + کنترل‌های صفحه‌بندی
      card.innerHTML = `
        <img src="${imgSrc}" alt="${doc.name || ''}" loading="lazy">
        <div class="doctor-info">
          <h2>${doc.name || 'بدون نام'}</h2>
          <p>${doc.specialty || ''} - ${doc.city || ''}</p>
        </div>
        <div class="comment-box">
          <input type="text" placeholder="نام شما">
          <textarea placeholder="نظر خود را بنویسید..."></textarea>
          <button class="btn" onclick="addComment(this)">ارسال نظر</button>
          <div class="comments-list"></div>
          <div class="comments-controls">
            <button class="pager-btn prev" disabled>قبلی</button>
            <span class="pager-info">صفحه 1</span>
            <button class="pager-btn next" disabled>بعدی</button>
          </div>
        </div>
      `;

      container.appendChild(card);

      // صفحه اولیه برای این پزشک را 1 تنظیم کن و نظرات را لود کن
      const doctorName = card.querySelector('h2')?.textContent.trim();
      commentsPageState.set(doctorName, 1);
    });

    // بعد از ساخت همه کارت‌ها، نظرات صفحه 1 را لود کن
    await loadCommentsForAllCards();
  } catch (err) {
    console.error('Supabase error (doctors):', err);
    container.textContent = 'خطا در دریافت پزشکان';
  }
}

// لود نظرات برای همه کارت‌ها، با توجه به صفحه جاری هر پزشک
async function loadCommentsForAllCards() {
  const cards = document.querySelectorAll('.doctor-card');
  for (const card of cards) {
    const doctorName = card.querySelector('h2')?.textContent.trim();
    await loadCommentsPage(card, doctorName, commentsPageState.get(doctorName) || 1);
    // اتصال هندلرهای قبلی/بعدی
    attachPagerHandlers(card, doctorName);
  }
}

// اتصال رویدادهای دکمه‌های قبلی/بعدی
function attachPagerHandlers(card, doctorName) {
  const prevBtn = card.querySelector('.comments-controls .prev');
  const nextBtn = card.querySelector('.comments-controls .next');

  prevBtn.onclick = async () => {
    const current = commentsPageState.get(doctorName) || 1;
    if (current > 1) {
      commentsPageState.set(doctorName, current - 1);
      await loadCommentsPage(card, doctorName, current - 1);
    }
  };

  nextBtn.onclick = async () => {
    const current = commentsPageState.get(doctorName) || 1;
    commentsPageState.set(doctorName, current + 1);
    const hasData = await loadCommentsPage(card, doctorName, current + 1);
    // اگر صفحه جدید داده نداشت، برگرد به قبلی
    if (!hasData) {
      commentsPageState.set(doctorName, current);
      await loadCommentsPage(card, doctorName, current);
    }
  };
}

// لود یک صفحه نظرات برای یک کارت پزشک
async function loadCommentsPage(card, doctorName, page) {
  const list = card.querySelector('.comments-list');
  const prevBtn = card.querySelector('.comments-controls .prev');
  const nextBtn = card.querySelector('.comments-controls .next');
  const info = card.querySelector('.comments-controls .pager-info');

  list.innerHTML = '<div class="loading">در حال دریافت نظرات...</div>';

  const from = (page - 1) * COMMENTS_PAGE_SIZE;
  const to = from + COMMENTS_PAGE_SIZE - 1;

  try {
    // گرفتن نظرات تاییدشده با ترتیب زمانی نزولی و صفحه‌بندی
    const { data, error } = await client
      .from('comments')
      .select('user_name, comment, created_at', { count: 'exact' })
      .eq('doctor_name', doctorName)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    list.innerHTML = '';
    const rows = data || [];

    // رندر ۵ آیتم حداکثر
    rows.forEach((row) => {
      const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
      renderComment(list, { name: row.user_name, text: row.comment, ts });
    });

    // آپدیت وضعیت دکمه‌ها و صفحه
    info.textContent = `صفحه ${page}`;

    // اگر صفحه اولیم، prev غیرفعال
    prevBtn.disabled = page <= 1;

    // اگر دادهٔ کمتر از PAGE_SIZE برگشت، یعنی صفحه آخر
    nextBtn.disabled = rows.length < COMMENTS_PAGE_SIZE;

    // اگر هیچ نظری نبود و صفحه 1 بود، پیام خالی
    if (rows.length === 0 && page === 1) {
      list.innerHTML = '<div class="empty">هنوز نظری ثبت نشده است.</div>';
    }

    // برگشت می‌گوید آیا داده‌ای بود یا نه
    return rows.length > 0;
  } catch (err) {
    console.error('Supabase error (comments page):', err);
    list.innerHTML = '<div class="error">خطا در دریافت نظرات</div>';
    // خطا را مثل بدون داده در نظر نگیریم
    return true;
  }
}

// ارسال نظر
async function addComment(button) {
  const card = button.closest('.doctor-card');
  const doctorName = card.querySelector('h2')?.textContent.trim();
  const box = button.closest('.comment-box');
  const nameInput = box.querySelector('input');
  const textarea = box.querySelector('textarea');
  const list = box.querySelector('.comments-list');

  const user_name = (nameInput.value || 'کاربر').trim();
  const comment = (textarea.value || '').trim();

  if (!comment) return;

  try {
    const { error } = await client.from('comments').insert([
      { user_name, doctor_name: doctorName, comment, approved: null },
    ]);

    if (error) throw error;

    nameInput.value = '';
    textarea.value = '';
    alert('نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.');

    // بعد از ثبت، صفحه را به 1 برگردان و دوباره لود کن
    commentsPageState.set(doctorName, 1);
    await loadCommentsPage(card, doctorName, 1);
  } catch (err) {
    console.error('Supabase error (insert comment):', err);
    alert('خطا در ثبت نظر');
  }
}

// نمایش یک آیتم نظر
function renderComment(list, item) {
  const p = document.createElement('div');
  p.className = 'comment-item';
  const date = new Date(item.ts);
  const meta = `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString(
    'fa-IR',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
  p.innerHTML = `<strong>${item.name}:</strong> ${item.text} <span class="comment-meta">${meta}</span>`;
  list.appendChild(p);
}

// اجرای اولیه
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
});