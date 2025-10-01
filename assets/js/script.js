// 🔑 Supabase keys
const SUPABASE_URL = 'https://lzfonyofgwfiwzsloqjp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 📌 آواتار پیش‌فرض پزشک
function getDefaultDoctorAvatar() {
  return 'https://cdn-icons-png.flaticon.com/512/387/387561.png';
}

// 📌 تنظیمات صفحه‌بندی نظرات
const COMMENTS_PAGE_SIZE = 5;
const commentsPageState = new Map();

// 📌 لود پزشک‌ها
async function loadDoctors() {
  const container = document.getElementById('doctors');
  if (!container) return;

  container.textContent = 'در حال دریافت...';

  try {
    const { data, error } = await client
      .from('doctors')
      .select('id, name, specialty, city, image_url, phone, page_url, address, work_hours, extra_info');

    if (error) throw error;
    if (!data || data.length === 0) {
      container.textContent = 'هیچ پزشکی یافت نشد.';
      return;
    }

    container.innerHTML = '';

    for (const doc of data) {
  const card = document.createElement('div');
  card.className = 'doctor-card';
  const imgSrc = (doc.image_url && doc.image_url.trim()) ? doc.image_url : getDefaultDoctorAvatar();

  card.innerHTML = `
    <img src="${imgSrc}" alt="${doc.name || ''}" loading="lazy">
    <div class="doctor-info">
      <h2>${doc.name || 'بدون نام'}</h2>
      <p><i class="fa-solid fa-user-doctor"></i> ${doc.specialty || ''} - ${doc.city || ''}</p>
      ${doc.phone ? `<p><i class="fa-solid fa-phone"></i> ${doc.phone}</p>` : ''}
      ${doc.page_url ? `<p><i class="fa-brands fa-instagram"></i> <a href="https://instagram.com/${doc.page_url}" target="_blank">@${doc.page_url}</a></p>` : ''}
      ${doc.address ? `<p><i class="fa-solid fa-location-dot"></i> ${doc.address}</p>` : ''}
      ${doc.work_hours ? `<p><i class="fa-regular fa-clock"></i> ${doc.work_hours}</p>` : ''}
      ${doc.extra_info ? `<div class="extra-box"><i class="fa-solid fa-circle-info"></i> ${doc.extra_info}</div>` : ''}

      <div class="rating" data-doctor="${doc.id}">
        <span data-value="5">★</span>
        <span data-value="4">★</span>
        <span data-value="3">★</span>
        <span data-value="2">★</span>
        <span data-value="1">★</span>
      </div>
      <p class="rating-info">میانگین امتیاز: در حال بارگذاری...</p>
    </div>

    <div class="comment-box">
      <input type="text" placeholder="نام شما">
      <textarea placeholder="نظر خود را بنویسید..."></textarea>
      <button class="comment-submit" onclick="addComment(this)">ارسال نظر</button>
      <div class="comments-list"></div>
      <div class="comments-controls">
        <button class="pager-btn prev">قبلی</button>
        <span class="pager-info">صفحه 1</span>
        <button class="pager-btn next">بعدی</button>
      </div>
    </div>
  `;

  container.appendChild(card);

  const doctorName = card.querySelector('h2')?.textContent.trim();
  commentsPageState.set(doctorName, 1);

  await loadAverageRating(doc.id, card);
}

    await loadCommentsForAllCards();
    initRatings();
  } catch (err) {
    console.error('Supabase error (doctors):', err);
    container.textContent = 'خطا در دریافت پزشکان';
  }
}

// 📌 لود میانگین امتیاز
async function loadAverageRating(doctorId, card) {
  const info = card.querySelector('.rating-info');
  try {
    const { data, error } = await client
      .from('ratings')
      .select('value', { count: 'exact' })
      .eq('doctor_id', doctorId);

    if (error) throw error;

    if (!data || data.length === 0) {
      info.textContent = 'میانگین امتیاز: ثبت نشده';
      return;
    }

    const avg = data.reduce((sum, r) => sum + r.value, 0) / data.length;
    info.textContent = `میانگین امتیاز: ${avg.toFixed(1)}`;
  } catch (e) {
    console.error('خطا در دریافت میانگین:', e);
    info.textContent = 'خطا در دریافت امتیاز';
  }
}

// 📌 فعال‌سازی کلیک روی ستاره‌ها
function getClientId() {
  let cid = localStorage.getItem('client_id');
  if (!cid) {
    cid = crypto.randomUUID();
    localStorage.setItem('client_id', cid);
  }
  return cid;
}

function initRatings() {
  document.querySelectorAll('.rating').forEach(ratingBox => {
    const stars = ratingBox.querySelectorAll('span');
    stars.forEach(star => {
      star.addEventListener('click', async function () {
        const value = parseInt(this.getAttribute('data-value'));
        const doctorId = ratingBox.getAttribute('data-doctor');
        const clientId = getClientId();

        // هایلایت ستاره‌ها
        stars.forEach(s => {
          s.classList.remove('active');
          if (parseInt(s.getAttribute('data-value')) <= value) {
            s.classList.add('active');
          }
        });

        // ذخیره امتیاز
        const { error } = await client.from('ratings').insert([
          { doctor_id: doctorId, value, client_id: clientId }
        ]);

        if (error) {
          if (error.message.includes('duplicate key')) {
            alert('شما قبلاً به این پزشک امتیاز داده‌اید ✅');
          } else {
            console.error('خطا در ثبت امتیاز:', error.message);
            alert('❌ خطا در ثبت امتیاز');
          }
        } else {
          await loadAverageRating(doctorId, ratingBox.closest('.doctor-card'));
        }
      });
    });
  });
}

// 📌 لود نظرات برای همه کارت‌ها
async function loadCommentsForAllCards() {
  const cards = document.querySelectorAll('.doctor-card');
  for (const card of cards) {
    const doctorName = card.querySelector('h2')?.textContent.trim();
    await loadCommentsPage(card, doctorName, commentsPageState.get(doctorName) || 1);
    attachPagerHandlers(card, doctorName);
  }
}

// 📌 اتصال رویدادهای قبلی/بعدی
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
    if (!hasData) {
      commentsPageState.set(doctorName, current);
      await loadCommentsPage(card, doctorName, current);
    }
  };
}

// 📌 لود یک صفحه نظرات
async function loadCommentsPage(card, doctorName, page) {
  const list = card.querySelector('.comments-list');
  const prevBtn = card.querySelector('.comments-controls .prev');
  const nextBtn = card.querySelector('.comments-controls .next');
  const info = card.querySelector('.comments-controls .pager-info');

  list.innerHTML = '<div class="loading">در حال دریافت نظرات...</div>';

  const from = (page - 1) * COMMENTS_PAGE_SIZE;
  const to = from + COMMENTS_PAGE_SIZE - 1;

  try {
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

    rows.forEach((row) => {
      const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
      renderComment(list, { name: row.user_name, text: row.comment, ts });
    });

    // به‌روزرسانی وضعیت صفحه و دکمه‌ها
    info.textContent = `صفحه ${page}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = rows.length < COMMENTS_PAGE_SIZE;

    // اگر هیچ نظری نبود
    if (rows.length === 0 && page === 1) {
      list.innerHTML = '<div class="empty">هنوز نظری ثبت نشده است.</div>';
    }

    return rows.length > 0;
  } catch (err) {
    console.error('Supabase error (comments page):', err);
    list.innerHTML = '<div class="error">خطا در دریافت نظرات</div>';
    return true;
  }
}
// 📌 ارسال نظر جدید
async function addComment(button) {
  const card = button.closest('.doctor-card');
  const doctorName = card.querySelector('h2')?.textContent.trim();
  const box = button.closest('.comment-box');
  const nameInput = box.querySelector('input');
  const textarea = box.querySelector('textarea');

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

    commentsPageState.set(doctorName, 1);
    await loadCommentsPage(card, doctorName, 1);
  } catch (err) {
    console.error('Supabase error (insert comment):', err);
    alert('خطا در ثبت نظر');
  }
}

// 📌 نمایش یک آیتم نظر
function renderComment(list, item) {
  const p = document.createElement('div');
  p.className = 'comment-item';

  const date = new Date(item.ts);
  const meta = `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString(
    'fa-IR',
    { hour: '2-digit', minute: '2-digit' }
  )}`;

  p.innerHTML = `
    <strong>${item.name}:</strong> ${item.text}
    <span class="comment-meta">${meta}</span>
  `;
  list.appendChild(p);
}

// 📌 اجرای اولیه
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
});