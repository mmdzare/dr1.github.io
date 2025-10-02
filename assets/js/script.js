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
      .select('id, user_name, comment, created_at', { count: 'exact' })
      .eq('doctor_name', doctorName)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    list.innerHTML = '';
    const rows = data || [];

    for (const row of rows) {
      const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
      await renderComment(list, {
        id: row.id,
        name: row.user_name,
        text: row.comment,
        ts,
      });
    }

    info.textContent = `صفحه ${page}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = rows.length < COMMENTS_PAGE_SIZE;

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

// 📌 نمایش یک آیتم نظر + پاسخ‌های تأییدشده
async function renderComment(list, item) {
  const p = document.createElement('div');
  p.className = 'comment-item';
  p.dataset.id = item.id;

  const date = new Date(item.ts);
  const meta = `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString(
    'fa-IR',
    { hour: '2-digit', minute: '2-digit' }
  )}`;

  const words = item.text.trim().split(/\s+/);
  const name = item.name || 'کاربر';

  const previewHTML = words.length > 15
    ? `
      <div class="comment-preview">${words.slice(0, 15).join(' ')}...</div>
      <button class="expand-btn" onclick="toggleComment(this)">ادامه نظر</button>
      <div class="comment-full hidden">${item.text}</div>
    `
    : item.text;

  p.innerHTML = `
    <strong>${name}:</strong>
    ${previewHTML}

    <div class="comment-actions">
      <button class="like-btn"><i class="fa-solid fa-thumbs-up"></i> <span>0</span></button>
      <button class="dislike-btn"><i class="fa-solid fa-thumbs-down"></i> <span>0</span></button>
      <button class="reply-btn"><i class="fa-solid fa-reply"></i> پاسخ</button>
    </div>

    <span class="comment-meta">${meta}</span>
  `;

  list.appendChild(p);

  // 📌 نمایش پاسخ‌های تأییدشده
  const repliesContainer = document.createElement('div');
  repliesContainer.className = 'replies-list';
  p.appendChild(repliesContainer);

  try {
    const { data: replies, error } = await client
      .from('replies')
      .select('*')
      .eq('parent_id', item.id)
      .eq('approved', true)
      .order('ts', { ascending: true });

    if (!error && replies.length > 0) {
      replies.forEach((reply) => renderReply(repliesContainer, reply));
    }
  } catch (err) {
    console.error('خطا در دریافت پاسخ‌ها:', err);
  }
}

// 📌 نمایش یک پاسخ تأییدشده
function renderReply(container, reply) {
  const div = document.createElement('div');
  div.className = 'reply-item';

  const date = new Date(reply.ts);
  const meta = `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  div.innerHTML = `
    <div class="reply-content">
      <strong>${reply.name}:</strong> ${reply.text}
      <span class="reply-meta">${meta}</span>
    </div>
  `;

  container.appendChild(div);
}

// 📌 اجرای اولیه
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
});

// 📌 تابع باز و بسته کردن نظر طولانی
function toggleComment(btn) {
  const full = btn.nextElementSibling;
  full.classList.toggle('visible');
  btn.textContent = full.classList.contains('visible') ? 'بستن نظر' : 'ادامه نظر';
}

function toggleComment(btn) {
  const full = btn.nextElementSibling;
  full.classList.toggle('visible');
  btn.textContent = full.classList.contains('visible') ? 'بستن نظر' : 'ادامه نظر';
}

document.addEventListener('click', async function(e) {
  const btn = e.target.closest('button');
  if (!btn) return;

  // 📌 لایک
  if (btn.classList.contains('like-btn')) {
    const span = btn.querySelector('span');
    span.textContent = parseInt(span.textContent) + 1;
  }

  // 📌 دیس‌لایک
  if (btn.classList.contains('dislike-btn')) {
    const span = btn.querySelector('span');
    span.textContent = parseInt(span.textContent) + 1;
  }

  // 📌 نمایش فرم پاسخ
  if (btn.classList.contains('reply-btn')) {
    const parent = btn.closest('.comment-item');
    if (!parent.querySelector('.reply-form')) {
      const form = document.createElement('div');
      form.className = 'reply-form';
      form.innerHTML = `
        <input type="text" placeholder="نام شما" class="reply-name">
        <textarea placeholder="پاسخ خود را بنویسید..." class="reply-text"></textarea>
        <button class="reply-send">ارسال پاسخ</button>
      `;
      parent.appendChild(form);
    }
  }

  // 📌 ثبت پاسخ در Supabase با approved: null
  if (btn.classList.contains('reply-send')) {
    const form = btn.closest('.reply-form');
    const name = form.querySelector('.reply-name').value.trim();
    const text = form.querySelector('.reply-text').value.trim();
    const parentId = form.closest('.comment-item').dataset.id;

    if (!name || !text) {
      alert('لطفاً نام و متن پاسخ را وارد کنید.');
      return;
    }

    const { error } = await client.from('replies').insert([
      {
        name,
        text,
        parent_id: parentId,
        ts: new Date().toISOString(),
        approved: null
      }
    ]);

    if (error) {
      alert('❌ خطا در ثبت پاسخ');
      console.error(error);
    } else {
      alert('✅ پاسخ شما ثبت شد و پس از بررسی مدیر نمایش داده خواهد شد.');
      form.remove();
    }
  }
});

async function loadReplies() {
  const { data, error } = await client
    .from('replies')
    .select('*')
    .order('ts', { ascending: false });

  const tbody = document.getElementById('replies-body');
  const countSpan = document.getElementById('count-replies');
  tbody.innerHTML = '';
  let count = 0;

  if (error) {
    tbody.innerHTML = '<tr><td colspan="6">❌ خطا در دریافت پاسخ‌ها</td></tr>';
    console.error(error);
    return;
  }

  data.forEach(reply => {
    const date = new Date(reply.ts).toLocaleDateString('fa-IR') + ' ' +
                 new Date(reply.ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const status = reply.approved === 'accepted' ? '✅ تأیید شده' :
                   reply.approved === 'rejected' ? '❌ رد شده' : '⏳ در انتظار';

    const checkbox = `<input type="checkbox" class="reply-check" data-id="${reply.id}">`;

    const actions = `
      <button class="approve" onclick="approveReply('${reply.id}')">تأیید</button>
      <button class="reject" onclick="rejectReply('${reply.id}')">رد</button>
      <button class="delete" onclick="deleteReply('${reply.id}')">حذف</button>
    `;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${checkbox}</td>
      <td>${reply.name}</td>
      <td class="comment">${reply.text}</td>
      <td>${date}</td>
      <td>${status}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
    if (reply.approved === null) count++;
  });

  countSpan.textContent = count;
}

async function approveReply(id) {
  await client.from('replies').update({ approved: 'accepted' }).eq('id', id);
  showToast('✅ پاسخ تأیید شد');
  loadReplies();
}

async function rejectReply(id) {
  await client.from('replies').update({ approved: 'rejected' }).eq('id', id);
  showToast('❌ پاسخ رد شد');
  loadReplies();
}

async function deleteReply(id) {
  if (!confirm('حذف این پاسخ؟')) return;
  await client.from('replies').delete().eq('id', id);
  showToast('🗑️ پاسخ حذف شد');
  loadReplies();
}

function bulkApproveReplies() {
  const selected = document.querySelectorAll('.reply-check:checked');
  const ids = Array.from(selected).map(el => el.dataset.id);
  if (ids.length === 0) return showToast('هیچ پاسخی انتخاب نشده');
  client.from('replies').update({ approved: 'accepted' }).in('id', ids).then(() => {
    showToast(`✅ ${ids.length} پاسخ تأیید شد`);
    loadReplies();
  });
}

function bulkRejectReplies() {
  const selected = document.querySelectorAll('.reply-check:checked');
  const ids = Array.from(selected).map(el => el.dataset.id);
  if (ids.length === 0) return showToast('هیچ پاسخی انتخاب نشده');
  client.from('replies').update({ approved: 'rejected' }).in('id', ids).then(() => {
    showToast(`❌ ${ids.length} پاسخ رد شد`);
    loadReplies();
  });
}