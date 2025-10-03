// ===============================
// 🔑 اتصال به Supabase
// ===============================
// 📌 آواتار پیش‌فرض با نام dr
const DEFAULT_AVATAR = "assets/img/dr.png"; SUPABASE_URL = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===============================
// 📌 شناسه یکتا برای هر کاربر (برای رأی و امتیاز)
// ===============================
function getClientToken() {
  let token = localStorage.getItem("client_token");
  if (!token) {
    token = Math.random().toString(36).substring(2) + Date.now();
    localStorage.setItem("client_token", token);
  }
  return token;
}

// ===============================
// 📌 گرفتن میانگین امتیاز پزشک
// ===============================
async function getDoctorRating(doctorId) {
  const { data, error } = await client.from("ratings").select("value").eq("doctor_id", doctorId);
  if (error || !data?.length) return 0;
  const sum = data.reduce((acc, r) => acc + (r.value || 0), 0);
  return (sum / data.length).toFixed(1);
}

// ===============================
// 📌 رندر ستاره‌ها (اصلاح‌شده)
// ===============================
function renderStars(avg, clickable = false, doctorId = null) {
  avg = parseFloat(avg) || 0;
  let html = "";

  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.floor(avg); // دقیق‌تر از round
    html += `<span 
               class="star ${filled ? "filled" : ""}" 
               ${clickable ? `data-doctor="${doctorId}" data-value="${i}"` : ""}>
               ★
             </span>`;
  }

  // نمایش میانگین امتیاز
  html += `<span class="avg-rating">میانگین: ${avg.toFixed(1)}</span>`;
  return html;
}

// 📌 اگر ستاره‌ها قابل کلیک باشن → این لیسنر رو یک بار در ابتدای صفحه فعال کن
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("star") && e.target.dataset.value) {
    const doctorId = e.target.dataset.doctor;
    const value = parseInt(e.target.dataset.value, 10);
    rateDoctor(doctorId, value);
  }
});

// ===============================
// 📌 ثبت امتیاز پزشک (اصلاح‌شده)
// ===============================
async function rateDoctor(doctorId, value) {
  try {
    const clientId = getClientToken();

    // بررسی وجود امتیاز قبلی
    const { data: existing, error: selectError } = await client
      .from("ratings")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (selectError) {
      console.error("❌ خطا در بررسی امتیاز قبلی:", selectError.message);
      return;
    }

    // اگر قبلاً امتیاز داده بود → آپدیت
    if (existing) {
      const { error: updateError } = await client
        .from("ratings")
        .update({ value })
        .eq("id", existing.id);

      if (updateError) {
        console.error("❌ خطا در بروزرسانی امتیاز:", updateError.message);
        return;
      }
    } 
    // اگر اولین بار امتیاز می‌ده → درج
    else {
      const { error: insertError } = await client
        .from("ratings")
        .insert([{ doctor_id: doctorId, value, client_id: clientId }]);

      if (insertError) {
        console.error("❌ خطا در ثبت امتیاز:", insertError.message);
        return;
      }
    }

    // محاسبه میانگین جدید
    const avg = await getDoctorRating(doctorId);

    // بروزرسانی همه‌ی بخش‌های نمایش امتیاز
    document.querySelectorAll(`[data-doctor-id="${doctorId}"] .doctor-rating`)
      .forEach(el => {
        el.innerHTML = renderStars(avg, true, doctorId);
      });

    console.log(`✅ امتیاز ${value} برای پزشک ${doctorId} ثبت شد. میانگین جدید: ${avg}`);

  } catch (err) {
    console.error("❌ خطای غیرمنتظره در ثبت امتیاز:", err);
  }
}

// ===============================
// 📌 لود پزشکان و ساخت کارت‌ها (از Supabase)
// ===============================
async function loadDoctors() {
  try {
    // گرفتن لیست پزشکان از Supabase
    const { data: doctors, error } = await client
      .from("doctors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ خطا در دریافت پزشکان:", error);
      return;
    }

    const list = document.getElementById("doctors-list");
    list.innerHTML = "";

    // ساخت کارت برای هر پزشک
    for (let doc of doctors) {
      const avgRating = await getDoctorRating(doc.id);

      // 📌 انتخاب تصویر با fallback
      const imgSrc =
        doc.image_url && doc.image_url.trim() !== ""
          ? doc.image_url
          : DEFAULT_AVATAR;

      const card = document.createElement("div");
      card.className = "doctor-card";

      card.innerHTML = `
        <img src="${imgSrc}" 
             class="doctor-avatar" 
             alt="avatar"
             onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}'">

        <h3 class="doctor-name">${doc.name}</h3>
        <p class="doctor-specialty">${doc.specialty || ""}</p>

        <div class="doctor-rating" data-doctor-id="${doc.id}">
          ${renderStars(avgRating, true, doc.id)}
        </div>

        <div class="comments-ticker" data-doctor-name="${doc.name}">
          <div class="ticker-track"></div>
        </div>

        <button class="btn-more-comments" 
                data-doctor-id="${doc.id}" 
                data-doctor-name="${doc.name}">
          نظرات بیشتر
        </button>
      `;

      // اضافه کردن کارت به لیست
      list.appendChild(card);

      // 📌 راه‌اندازی تیکر نظرات برای هر پزشک
      initCommentsTicker(card, doc.name);
    }

    // 📌 بعد از ساخت همه کارت‌ها، دکمه‌ها رو وصل می‌کنیم
    wireMoreCommentsButtons();

  } catch (err) {
    console.error("❌ خطای غیرمنتظره در loadDoctors:", err);
  }
}
// ===============================
// 📌 اتصال دکمه‌های «نظرات بیشتر» به مودال
// ===============================
function wireMoreCommentsButtons() {
  // همه دکمه‌هایی که کلاس btn-more-comments دارن رو انتخاب می‌کنیم
  const buttons = document.querySelectorAll(".btn-more-comments");

  if (!buttons.length) {
    console.warn("⚠️ هیچ دکمه‌ای برای نظرات بیشتر پیدا نشد.");
    return;
  }

  buttons.forEach(btn => {
    const doctorId = btn.getAttribute("data-doctor-id");
    const doctorName = btn.getAttribute("data-doctor-name");

    // 📌 اتصال کلیک به باز کردن مودال
    btn.addEventListener("click", () => {
      openCommentsModal(doctorName, doctorId);
    });
  });
}
// ===============================
// 📌 نوار ۵ نظر آخر (نمایش ثابت + تعویض هر ۵ ثانیه)
// ===============================
async function initCommentsTicker(card, doctorName) {
  const track = card.querySelector(".ticker-track");

  // دریافت ۵ نظر آخر
  const { data: comments, error } = await client
    .from("comments")
    .select("user_name, comment")
    .eq("doctor_name", doctorName)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ خطا در دریافت نظرات:", error.message);
    track.textContent = "خطا در بارگذاری نظرات";
    track.classList.add("active");
    return;
  }

  // اگر نظری وجود نداشت → پیام دعوت به ثبت نظر
  if (!comments || comments.length === 0) {
    track.textContent = "نظر خود را ثبت کنید ✍️";
    track.classList.add("active");
    return;
  }

  let index = 0;

  function showNext() {
    const c = comments[index];

    // محو کردن متن قبلی
    track.classList.remove("active");

    setTimeout(() => {
      // تغییر متن
      track.textContent = `${c.user_name}: ${c.comment}`;
      // نمایش با انیمیشن
      track.classList.add("active");
    }, 600); // زمان محو شدن

    // رفتن به نظر بعدی
    index = (index + 1) % comments.length;
  }

  // نمایش اولین نظر
  showNext();

  // هر ۵ ثانیه نظر بعدی
  setInterval(showNext, 5000);
}
// ===============================
// 📌 باز کردن مودال و نمایش نظرات کامل
// ===============================
async function openCommentsModal(doctorName, doctorId) {
  const modal = document.getElementById("comments-modal");
  if (!modal) {
    console.error("❌ مودال پیدا نشد!");
    return;
  }
  modal.classList.remove("hidden");

  try {
    // 📌 گرفتن اطلاعات پزشک
    const { data: doctor, error } = await client
      .from("doctors")
      .select("name, specialty, image_url")
      .eq("id", doctorId)
      .maybeSingle();

    if (error) {
      console.error("❌ خطا در دریافت پزشک:", error.message);
    }

    // 📌 پر کردن اطلاعات پزشک در مودال
    const avatarEl = modal.querySelector(".modal-doctor-avatar");
    const imgSrc =
      doctor?.image_url && doctor.image_url.trim() !== ""
        ? doctor.image_url
        : DEFAULT_AVATAR;

    avatarEl.src = imgSrc;

    // 📌 fallback اگر تصویر خراب بود
    avatarEl.onerror = () => {
      avatarEl.onerror = null;
      avatarEl.src = DEFAULT_AVATAR;
    };

    modal.querySelector(".modal-doctor-name").textContent =
      doctor?.name || doctorName;

    modal.querySelector(".modal-doctor-specialty").textContent =
      doctor?.specialty || "";

    // 📌 نمایش نظرات
    await renderFullComments(doctorName, doctorId);

    // 📌 فرم ارسال نظر
    const form = document.getElementById("modal-comment-form");
    const showFormBtn = modal.querySelector(".btn-show-form");

    if (showFormBtn) {
      showFormBtn.onclick = () => form.classList.toggle("hidden");
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const user_name = document.getElementById("modal_user_name").value.trim();
        const comment_text = document.getElementById("modal_comment_text").value.trim();

        if (!user_name || !comment_text) return;

        const { error: insertError } = await client.from("comments").insert([
          {
            doctor_name: doctorName,
            user_name,
            comment: comment_text,
            user_token: getClientToken(),
            approved: null,
          },
        ]);

        if (insertError) {
          console.error("❌ خطا در ثبت نظر:", insertError.message);
          return;
        }

        form.reset();
        form.classList.add("hidden");

        // 📌 بروزرسانی لیست نظرات
        await renderFullComments(doctorName, doctorId);

        // 📌 بروزرسانی تیکر
        document
          .querySelectorAll(`.comments-ticker[data-doctor-name="${doctorName}"]`)
          .forEach((t) =>
            initCommentsTicker(t.closest(".doctor-card"), doctorName)
          );
      };
    }

    // 📌 بستن مودال (با data-close)
    modal.querySelectorAll("[data-close]").forEach(el => {
      el.onclick = () => modal.classList.add("hidden");
    });

  } catch (err) {
    console.error("❌ خطای غیرمنتظره در openCommentsModal:", err);
  }
}
// ===============================
// 📌 نمایش کامل نظرات + پاسخ‌ها + لایک/دیس‌لایک
// ===============================
async function renderFullComments(doctorName, doctorId) {
  const wrap = document.querySelector("#comments-modal .comments-list");
  if (!wrap) return;
  wrap.innerHTML = "در حال بارگذاری...";

  const safeText = (txt) =>
    txt ? txt.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";

  try {
    // 📌 گرفتن نظرات
    const { data: comments, error } = await client
      .from("comments")
      .select("id, user_name, comment, created_at, approved")
      .eq("doctor_name", doctorName)
      .order("created_at", { ascending: false });

    if (error) {
      wrap.innerHTML = "❌ خطا در دریافت نظرات";
      console.error(error);
      return;
    }

    if (!comments || comments.length === 0) {
      wrap.innerHTML = "<p>هنوز نظری ثبت نشده است.</p>";
      return;
    }

    // 📌 گرفتن پاسخ‌ها و رأی‌ها
    const ids = comments.map((c) => c.id);
    const { data: replies } = ids.length
      ? await client.from("replies")
          .select("id, name, text, comment_id, ts")
          .in("comment_id", ids)
      : { data: [] };

    const { data: votes } = ids.length
      ? await client.from("votes")
          .select("comment_id, type, client_id")
          .in("comment_id", ids)
      : { data: [] };

    wrap.innerHTML = "";

    // 📌 نمایش امتیاز کلی
    const ratingBox = document.createElement("div");
    ratingBox.className = "rating-box";
    ratingBox.innerHTML = renderStars(await getDoctorRating(doctorId), true, doctorId);
    wrap.appendChild(ratingBox);

    // 📌 نمایش هر نظر
    comments.forEach((c) => {
      const likeCount = votes.filter((v) => v.comment_id === c.id && v.type === "like").length;
      const dislikeCount = votes.filter((v) => v.comment_id === c.id && v.type === "dislike").length;

      const item = document.createElement("div");
      item.className = "comment-item";

      // وضعیت تأیید
      let status = "⏳ در انتظار بررسی";
      if (c.approved === true) status = "✅ تأیید شده";
      if (c.approved === false) status = "❌ رد شده";

      item.innerHTML = `
        <div class="comment-meta">
          ${safeText(c.user_name)} • ${new Date(c.created_at).toLocaleDateString("fa-IR")} • ${status}
        </div>
        <div class="comment-text">${safeText(c.comment)}</div>
        <div class="comment-actions">
          <button class="btn-like">👍 ${likeCount}</button>
          <button class="btn-dislike">👎 ${dislikeCount}</button>
          <button class="btn-reply">↩️ پاسخ</button>
        </div>
        <div id="reply-form-${c.id}" class="reply-form hidden">
          <input type="text" id="reply_name_${c.id}" placeholder="نام شما">
          <textarea id="reply_text_${c.id}" placeholder="پاسخ شما"></textarea>
          <button class="btn-send-reply">ارسال پاسخ</button>
        </div>
      `;

      // 📌 نمایش پاسخ‌ها
      const rlist = document.createElement("div");
      rlist.className = "reply-list";
      const relatedReplies = (replies || []).filter((r) => r.comment_id === c.id);

      relatedReplies.forEach((r) => {
        const ri = document.createElement("div");
        ri.className = "reply-item";
        ri.innerHTML = `
          <div class="reply-content">${safeText(r.text)}</div>
          <div class="reply-meta">${safeText(r.name)} • ${new Date(r.ts).toLocaleDateString("fa-IR")}</div>
        `;
        rlist.appendChild(ri);
      });

      item.appendChild(rlist);

      // 📌 اتصال رویدادها
      item.querySelector(".btn-like").addEventListener("click", () =>
        voteComment(c.id, "like", doctorName, doctorId)
      );
      item.querySelector(".btn-dislike").addEventListener("click", () =>
        voteComment(c.id, "dislike", doctorName, doctorId)
      );
      item.querySelector(".btn-reply").addEventListener("click", () =>
        toggleReplyForm(c.id)
      );
      item.querySelector(".btn-send-reply").addEventListener("click", () =>
        sendReply(c.id, doctorName, doctorId)
      );

      wrap.appendChild(item);
    });
  } catch (err) {
    wrap.innerHTML = "❌ خطای غیرمنتظره در بارگذاری نظرات";
    console.error(err);
  }
}

// ===============================
// 📌 ثبت رأی لایک/دیس‌لایک
// ===============================
async function voteComment(commentId, type, doctorName, doctorId) {
  const clientId = getClientToken();
  try {
    const { data: existing } = await client
      .from("votes")
      .select("id, type")
      .eq("comment_id", commentId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      if (existing.type === type) {
        // اگر دوباره روی همون رأی کلیک شد → حذف رأی
        await client.from("votes").delete().eq("id", existing.id);
      } else {
        // تغییر نوع رأی
        await client.from("votes").update({ type }).eq("id", existing.id);
      }
    } else {
      // رأی جدید
      await client.from("votes").insert([
        { comment_id: commentId, client_id: clientId, type }
      ]);
    }

    // 📌 رفرش لیست نظرات بعد از رأی
    await renderFullComments(doctorName, doctorId);
  } catch (err) {
    console.error("❌ خطا در ثبت رأی:", err);
  }
}

// ===============================
// 📌 نمایش/مخفی‌سازی فرم پاسخ
// ===============================
function toggleReplyForm(commentId) {
  // بستن همه‌ی فرم‌های دیگر
  document.querySelectorAll(".reply-form").forEach(f => {
    if (f.id !== `reply-form-${commentId}`) f.classList.add("hidden");
  });

  // باز/بستن فرم انتخابی
  const form = document.getElementById(`reply-form-${commentId}`);
  if (form) form.classList.toggle("hidden");
}

// ===============================
// 📌 ارسال پاسخ
// ===============================
async function sendReply(commentId, doctorName, doctorId) {
  const nameEl = document.getElementById(`reply_name_${commentId}`);
  const textEl = document.getElementById(`reply_text_${commentId}`);
  const name = nameEl.value.trim();
  const text = textEl.value.trim();
  if (!name || !text) return;

  try {
    const { error } = await client.from("replies").insert([
      {
        comment_id: commentId,
        name,
        text,
        ts: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ خطا در ثبت پاسخ:", error.message);
      return;
    }

    // پاک کردن و بستن فرم بعد از ارسال
    nameEl.value = "";
    textEl.value = "";
    document.getElementById(`reply-form-${commentId}`).classList.add("hidden");

    // 📌 رفرش لیست نظرات
    await renderFullComments(doctorName, doctorId);
  } catch (err) {
    console.error("❌ خطای غیرمنتظره در ثبت پاسخ:", err);
  }
}
// ===============================
// 📌 افزودن پزشک جدید (با آواتار پیش‌فرض)
// ===============================
async function createDoctor(name, specialty, image_url) {
  // اگر کاربر لینکی برای عکس نداد → آواتار پیش‌فرض
  const avatar = image_url && image_url.trim() !== "" ? image_url : DEFAULT_AVATAR;

  const { error } = await client
    .from("doctors")
    .insert([{ name, specialty, image_url: avatar }]);

  if (error) {
    console.error("❌ خطا در افزودن پزشک:", error.message);
  } else {
    console.log("✅ پزشک جدید با موفقیت اضافه شد");
    loadDoctors();
  }
}

// ===============================
// 📌 پر کردن دیتابیس با پزشکان نمونه (اختیاری)
// ===============================
async function seedDoctors() {
  const sample = [];
  for (let i = 1; i <= 10; i++) {
    sample.push({
      name: `دکتر نمونه ${i}`,
      specialty: "تخصص عمومی",
      image_url: "assets/img/default-avatar.png",
    });
  }
  await client.from("doctors").insert(sample);
  loadDoctors();
}

// ===============================
// 📌 شروع اولیه
// ===============================
document.addEventListener("DOMContentLoaded", loadDoctors);

// ===============================
// 📌 دکمه افزودن پزشک (اختیاری)
// ===============================
function openCreateDoctor() {
  alert("اینجا می‌تونی فرم افزودن پزشک رو نمایش بدی.");
}