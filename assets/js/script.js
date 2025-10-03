// ===============================
// 🔑 اتصال به Supabase
// ===============================
// 📌 آواتار پیش‌فرض با نام dr
const DEFAULT_AVATAR = "assets/img/dr.png"; SUPABASE_URL = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ===============================
// 📌 تولید و ذخیره شناسه یکتا برای هر کاربر (Client Token)
// ===============================
function getClientToken() {
  let token = localStorage.getItem("client_token");

  if (!token) {
    // 📌 اگر مرورگر از crypto.randomUUID پشتیبانی کند
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      token = crypto.randomUUID();
    } else {
      // 📌 fallback برای مرورگرهای قدیمی
      token =
        Math.random().toString(36).substring(2, 10) + "-" + Date.now().toString(36);
    }

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
    const filled = i <= Math.floor(avg); // ستاره‌های پر
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

// 📌 لیسنر کلیک روی ستاره‌ها (فقط یک بار در ابتدای صفحه)
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("star") && e.target.dataset.value) {
    const doctorId = e.target.dataset.doctor;
    const value = parseInt(e.target.dataset.value, 10);
    if (doctorId && value) {
      rateDoctor(doctorId, value);
    }
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
    const { data: doctors, error } = await client
      .from("doctors")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ خطا در دریافت پزشکان:", error);
      return;
    }

    const list = document.getElementById("doctors-list");
    if (!list) {
      console.warn("⚠️ المان #doctors-list پیدا نشد.");
      return;
    }
    list.innerHTML = "";

    // 📌 گرفتن همه‌ی امتیازها به صورت موازی
    const ratings = await Promise.all(doctors.map(d => getDoctorRating(d.id)));

    doctors.forEach((doc, index) => {
      const avgRating = ratings[index];

      // 📌 انتخاب تصویر با fallback
      const imgSrc =
        doc.image_url && doc.image_url.trim() !== ""
          ? doc.image_url
          : DEFAULT_AVATAR;

      // 📌 اصلاح لینک صفحه (اینستاگرام/وب‌سایت)
      let pageUrl = doc.page_url;
      let displayUrl = "";
      if (pageUrl && typeof pageUrl === "string") {
        pageUrl = pageUrl.trim();

        if (!/^https?:\/\//i.test(pageUrl)) {
          if (!pageUrl.includes("instagram.com")) {
            pageUrl = "https://instagram.com/" + pageUrl.replace(/^@/, "");
          } else {
            pageUrl = "https://" + pageUrl.replace(/^\/+/, "");
          }
        }

        displayUrl = pageUrl.replace(/^https?:\/\//i, "");
      }

      const card = document.createElement("div");
      card.className = "doctor-card";
      card.setAttribute("data-doctor-id", doc.id);
      card.setAttribute("data-doctor-name", doc.name);

      card.innerHTML = `
        <img src="${imgSrc}" 
             class="doctor-avatar" 
             alt="avatar"
             onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}'">

        <div class="doctor-info">
          <h3 class="doctor-name"><i class="fa-solid fa-user-doctor"></i> ${doc.name}</h3>
          <p><i class="fa-solid fa-briefcase-medical"></i> ${doc.specialty || ""}</p>
          ${doc.city ? `<p><i class="fa-solid fa-location-dot"></i> ${doc.city}</p>` : ""}
          ${doc.phone ? `<p><i class="fa-solid fa-phone"></i> ${doc.phone}</p>` : ""}
          ${pageUrl ? `<p><i class="fa-brands fa-instagram"></i> 
            <a href="${pageUrl}" target="_blank" rel="noopener noreferrer">${displayUrl}</a></p>` : ""}
          ${doc.address ? `<p><i class="fa-solid fa-house"></i> ${doc.address}</p>` : ""}
          ${doc.work_hours ? `<p><i class="fa-solid fa-clock"></i> ${doc.work_hours}</p>` : ""}
          <div class="doctor-rating" data-doctor-id="${doc.id}">
            ${renderStars(avgRating, true, doc.id)}
          </div>
          ${doc.extra_info ? `<p><i class="fa-solid fa-circle-info"></i> ${doc.extra_info}</p>` : ""}
        </div>

        <!-- 📌 نوار متحرک نظرات -->
        <div class="comments-ticker" data-doctor-name="${doc.name}">
          <div class="ticker-track"></div>
        </div>

        <button class="btn-more-comments" 
                data-doctor-id="${doc.id}" 
                data-doctor-name="${doc.name}">
          نظرات بیشتر
        </button>
      `;

      list.appendChild(card);

      // 📌 راه‌اندازی تیکر نظرات
      initCommentsTicker(card, doc.name);
    });

    wireMoreCommentsButtons();

  } catch (err) {
    console.error("❌ خطای غیرمنتظره در loadDoctors:", err);
  }
}

// ===============================
// 📌 اتصال دکمه‌های «نظرات بیشتر» به مودال
// ===============================
function wireMoreCommentsButtons() {
  const buttons = document.querySelectorAll(".btn-more-comments");

  buttons.forEach(btn => {
    // جلوگیری از دوبار بایند شدن
    btn.replaceWith(btn.cloneNode(true));
  });

  document.querySelectorAll(".btn-more-comments").forEach(btn => {
    const doctorId = btn.getAttribute("data-doctor-id");
    const doctorName = btn.getAttribute("data-doctor-name");

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
  if (!track) return;

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
      // تغییر متن با استایل
      track.innerHTML = `<span class="ticker-item">💬 ${c.user_name}: ${c.comment}</span>`;
      track.classList.add("active");
    }, 600);

    index = (index + 1) % comments.length;
  }

  // نمایش اولین نظر
  showNext();

  // جلوگیری از چندین interval
  if (track._intervalId) {
    clearInterval(track._intervalId);
  }
  track._intervalId = setInterval(showNext, 5000);
}
// ===============================
// 📌 باز کردن مودال و نمایش نظرات کامل (بدون ستاره‌ها)
// ===============================
async function openCommentsModal(doctorName, doctorId) {
  const modal = document.getElementById("comments-modal");
  if (!modal) {
    console.error("❌ مودال پیدا نشد!");
    return;
  }
  modal.classList.remove("hidden");

  try {
    // 📌 گرفتن اطلاعات کامل پزشک
    const { data: doctor, error } = await client
      .from("doctors")
      .select("id, name, specialty, image_url, city, phone, address, work_hours, extra_info, page_url")
      .eq("id", doctorId)
      .maybeSingle();

    if (error) {
      console.error("❌ خطا در دریافت پزشک:", error.message);
    }
    if (!doctor) {
      console.warn("⚠️ پزشک پیدا نشد.");
      return;
    }

    // 📌 پر کردن اطلاعات پزشک در مودال
    const avatarEl = modal.querySelector(".modal-doctor-avatar");
    const imgSrc =
      doctor.image_url && doctor.image_url.trim() !== ""
        ? doctor.image_url
        : DEFAULT_AVATAR;

    avatarEl.src = imgSrc;
    avatarEl.onerror = () => {
      avatarEl.onerror = null;
      avatarEl.src = DEFAULT_AVATAR;
    };

    modal.querySelector(".modal-doctor-name").textContent = doctor.name || doctorName;
    modal.querySelector(".modal-doctor-specialty").textContent = doctor.specialty || "";
    modal.querySelector(".modal-doctor-city").textContent = doctor.city || "";
    modal.querySelector(".modal-doctor-phone").textContent = doctor.phone ? "📞 " + doctor.phone : "";
    modal.querySelector(".modal-doctor-address").textContent = doctor.address || "";
    modal.querySelector(".modal-doctor-hours").textContent = doctor.work_hours ? "⏰ " + doctor.work_hours : "";
    modal.querySelector(".modal-doctor-about").textContent = doctor.extra_info || "";
    modal.querySelector(".modal-doctor-page").innerHTML = doctor.page_url 
      ? `<a href="${doctor.page_url}" target="_blank" rel="noopener noreferrer">${doctor.page_url}</a>` 
      : "";

    // 📌 نمایش نظرات
    await renderFullComments(doctor.name, doctor.id);

    // 📌 فرم ارسال نظر
    const form = document.getElementById("modal-comment-form");
    const showFormBtn = modal.querySelector(".btn-show-form");

    if (showFormBtn && form) {
      showFormBtn.onclick = () => form.classList.toggle("hidden");

      // جلوگیری از دوبار بایند شدن
      form.onsubmit = null;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const user_name = document.getElementById("modal_user_name").value.trim();
        const comment_text = document.getElementById("modal_comment_text").value.trim();

        if (!user_name || !comment_text) return;

        const { error: insertError } = await client.from("comments").insert([
          {
            doctor_name: doctor.name,
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
        await renderFullComments(doctor.name, doctor.id);

        // 📌 بروزرسانی تیکر
        document
          .querySelectorAll(`.comments-ticker[data-doctor-name="${doctor.name}"]`)
          .forEach((t) =>
            initCommentsTicker(t.closest(".doctor-card"), doctor.name)
          );
      };
    }

    // 📌 بستن مودال (با data-close یا کلیک روی بک‌دراپ)
    modal.querySelectorAll("[data-close], .modal-backdrop").forEach(el => {
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
          <button class="btn-like">👍 <span>${likeCount}</span></button>
          <button class="btn-dislike">👎 <span>${dislikeCount}</span></button>
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
      const likeBtn = item.querySelector(".btn-like");
      const dislikeBtn = item.querySelector(".btn-dislike");
      const replyBtn = item.querySelector(".btn-reply");
      const sendReplyBtn = item.querySelector(".btn-send-reply");

      likeBtn.addEventListener("click", async () => {
        await voteComment(c.id, "like", doctorName, doctorId);
        likeBtn.querySelector("span").textContent = parseInt(likeBtn.querySelector("span").textContent) + 1;
      });

      dislikeBtn.addEventListener("click", async () => {
        await voteComment(c.id, "dislike", doctorName, doctorId);
        dislikeBtn.querySelector("span").textContent = parseInt(dislikeBtn.querySelector("span").textContent) + 1;
      });

      replyBtn.addEventListener("click", () => {
        // بستن همه‌ی فرم‌های دیگر
        document.querySelectorAll(".reply-form").forEach(f => f.classList.add("hidden"));
        // باز کردن فقط فرم همین نظر
        item.querySelector(".reply-form").classList.toggle("hidden");
      });

      sendReplyBtn.addEventListener("click", () =>
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
// 📌 ثبت رأی لایک/دیس‌لایک (Optimistic UI)
// ===============================
async function voteComment(commentId, type, doctorName, doctorId) {
  const clientId = getClientToken();
  const commentEl = document.querySelector(`.comment-item[data-id="${commentId}"]`);
  const likeBtn = commentEl?.querySelector(".btn-like span");
  const dislikeBtn = commentEl?.querySelector(".btn-dislike span");

  try {
    const { data: existing } = await client
      .from("votes")
      .select("id, type")
      .eq("comment_id", commentId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      if (existing.type === type) {
        // حذف رأی
        await client.from("votes").delete().eq("id", existing.id);
        if (type === "like" && likeBtn) likeBtn.textContent = +likeBtn.textContent - 1;
        if (type === "dislike" && dislikeBtn) dislikeBtn.textContent = +dislikeBtn.textContent - 1;
      } else {
        // تغییر نوع رأی
        await client.from("votes").update({ type }).eq("id", existing.id);
        if (type === "like") {
          if (likeBtn) likeBtn.textContent = +likeBtn.textContent + 1;
          if (dislikeBtn) dislikeBtn.textContent = +dislikeBtn.textContent - 1;
        } else {
          if (dislikeBtn) dislikeBtn.textContent = +dislikeBtn.textContent + 1;
          if (likeBtn) likeBtn.textContent = +likeBtn.textContent - 1;
        }
      }
    } else {
      // رأی جدید
      await client.from("votes").insert([{ comment_id: commentId, client_id: clientId, type }]);
      if (type === "like" && likeBtn) likeBtn.textContent = +likeBtn.textContent + 1;
      if (type === "dislike" && dislikeBtn) dislikeBtn.textContent = +dislikeBtn.textContent + 1;
    }
  } catch (err) {
    console.error("❌ خطا در ثبت رأی:", err);
  }
}

// ===============================
// 📌 نمایش/مخفی‌سازی فرم پاسخ
// ===============================
function toggleReplyForm(commentId) {
  document.querySelectorAll(".reply-form").forEach(f => {
    if (f.id !== `reply-form-${commentId}`) f.classList.add("hidden");
  });

  const form = document.getElementById(`reply-form-${commentId}`);
  if (form) {
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) {
      form.querySelector("input")?.focus();
    }
  }
}

// ===============================
// 📌 ارسال پاسخ (بدون رفرش کل لیست)
// ===============================
async function sendReply(commentId, doctorName, doctorId) {
  const nameEl = document.getElementById(`reply_name_${commentId}`);
  const textEl = document.getElementById(`reply_text_${commentId}`);
  const btn = document.querySelector(`#reply-form-${commentId} .btn-send-reply`);

  const name = nameEl.value.trim();
  const text = textEl.value.trim();
  if (!name || !text) return;

  btn.disabled = true;

  try {
    const { data, error } = await client.from("replies").insert([
      {
        comment_id: commentId,
        name,
        text,
        ts: new Date().toISOString(),
      },
    ]).select().single();

    if (error) {
      console.error("❌ خطا در ثبت پاسخ:", error.message);
      return;
    }

    // 📌 اضافه کردن پاسخ جدید به DOM بدون رفرش کل لیست
    const rlist = document.querySelector(`.comment-item[data-id="${commentId}"] .reply-list`);
    if (rlist && data) {
      const ri = document.createElement("div");
      ri.className = "reply-item";
      ri.innerHTML = `
        <div class="reply-content">${data.text.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
        <div class="reply-meta">${data.name} • ${new Date(data.ts).toLocaleDateString("fa-IR")}</div>
      `;
      rlist.appendChild(ri);
    }

    // پاک کردن و بستن فرم
    nameEl.value = "";
    textEl.value = "";
    document.getElementById(`reply-form-${commentId}`).classList.add("hidden");

  } catch (err) {
    console.error("❌ خطای غیرمنتظره در ثبت پاسخ:", err);
  } finally {
    btn.disabled = false;
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