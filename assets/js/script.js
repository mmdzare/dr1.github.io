// اتصال به Supabase
const SUPABASE_URL = 'https://lzfonyofgwfiwzsloqjp.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// لینک آواتار پیش‌فرض پزشکی (ثابت و سبک)
function getDefaultAvatar() {
  return 'https://cdn-icons-png.flaticon.com/512/387/387561.png';
}

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
        doc.image_url && doc.image_url.trim()
          ? doc.image_url
          : getDefaultAvatar();

      card.innerHTML = `
        <img src="${imgSrc}" alt="${doc.name || ''}">
        <div class="doctor-info">
          <h2>${doc.name || 'بدون نام'}</h2>
          <p>${doc.specialty || ''} - ${doc.city || ''}</p>
        </div>
        <div class="comment-box">
          <input type="text" placeholder="نام شما">
          <textarea placeholder="نظر خود را بنویسید..."></textarea>
          <button onclick="addComment(this)">ارسال نظر</button>
          <div class="comments-list"></div>
        </div>
      `;

      container.appendChild(card);
    });

    loadApprovedComments();
  } catch (err) {
    console.error('Supabase error (doctors):', err);
    container.textContent = 'خطا در دریافت پزشکان';
  }
}

// لود نظرات تأییدشده
async function loadApprovedComments() {
  const cards = document.querySelectorAll('.doctor-card');
  for (const card of cards) {
    const doctor_name = card.querySelector('h2')?.textContent.trim();
    const list = card.querySelector('.comments-list');
    list.innerHTML = '';

    try {
      const { data, error } = await client
        .from('comments')
        .select('user_name, comment, created_at')
        .eq('doctor_name', doctor_name)
        .eq('approved', true);

      if (error) throw error;

      (data || []).forEach((row) => {
        const ts = row.created_at
          ? new Date(row.created_at).getTime()
          : Date.now();
        renderComment(list, { name: row.user_name, text: row.comment, ts });
      });
    } catch (err) {
      console.error('Supabase error (comments):', err);
    }
  }
}

// ارسال نظر
async function addComment(button) {
  const card = button.closest('.doctor-card');
  const doctor_name = card.querySelector('h2')?.textContent.trim();
  const box = button.closest('.comment-box');
  const nameInput = box.querySelector('input');
  const textarea = box.querySelector('textarea');
  const list = box.querySelector('.comments-list');

  const user_name = (nameInput.value || 'کاربر').trim();
  const comment = (textarea.value || '').trim();

  if (!comment) return;

  try {
    const { error } = await client.from('comments').insert([
      { user_name, doctor_name, comment, approved: null },
    ]);

    if (error) throw error;

    renderComment(list, { name: user_name, text: comment, ts: Date.now() });
    nameInput.value = '';
    textarea.value = '';
    alert('نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.');
  } catch (err) {
    console.error('Supabase error (insert comment):', err);
    alert('خطا در ثبت نظر');
  }
}

// نمایش نظر
function renderComment(list, item) {
  const p = document.createElement('div');
  p.className = 'comment-item';
  const date = new Date(item.ts);
  const meta = `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString(
    'fa-IR',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
  p.innerHTML = `<strong>${item.name}:</strong> ${item.text} <span>${meta}</span>`;
  list.appendChild(p);
}

// اجرای اولیه
document.addEventListener('DOMContentLoaded', () => {
  loadDoctors();
});