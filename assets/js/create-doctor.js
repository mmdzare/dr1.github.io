// 📌 اتصال به Supabase با URL و anon key واقعی
const SUPABASE_URL = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 📌 آواتار پیش‌فرض
const DEFAULT_AVATAR = "assets/img/dr.png";

// 📌 گرفتن فرم و بخش وضعیت
const form = document.getElementById("doctor-form");
const status = document.getElementById("status");

// 📌 رویداد ثبت فرم
if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();

    // گرفتن داده‌ها از فرم
    const nameInput = document.getElementById("name").value.trim();
    const medical_code = document.getElementById("medicalcode").value.trim();
    const specialtyInput = document.getElementById("specialty").value;
    const province = document.getElementById("province").value;
    const city = document.getElementById("city").value;
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const work_hours = document.getElementById("workhours").value.trim();
    const rating = parseFloat(document.getElementById("rating").value) || null;
    const extra_info = document.getElementById("extrainfo").value.trim();
    const image_url = DEFAULT_AVATAR;

    // 📌 اعتبارسنجی اولیه
    if (!nameInput || !medical_code || !specialtyInput || !province || !city) {
      status.textContent = "⚠️ لطفاً همه فیلدهای ضروری را پر کنید";
      status.style.color = "#ff9800";
      return;
    }

    if (!/^\d+$/.test(medical_code)) {
      status.textContent = "⚠️ کد نظام پزشکی باید فقط عدد باشد";
      status.style.color = "#ff9800";
      return;
    }

    if (phone && !/^\d{11}$/.test(phone)) {
      status.textContent = "⚠️ شماره تماس باید دقیقاً ۱۱ رقم باشد";
      status.style.color = "#ff9800";
      return;
    }

    // 📌 بررسی اعتبار کد نظام پزشکی
    status.textContent = "⏳ در حال بررسی کد نظام پزشکی...";
    status.style.color = "#2196f3";

    let mappedDoctor = null;

    try {
      const verifyRes = await fetch("https://dr1-api.onrender.com/api/verify-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: medical_code })
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.rows || verifyData.rows.length === 0) {
        status.textContent = "❌ کد نظام پزشکی معتبر نیست";
        status.style.color = "#f44336";
        return;
      }

      // 📌 مپ کردن داده‌های رسمی
      const official = verifyData.rows[0];
      mappedDoctor = {
        name: `${official["نام"] || ""} ${official["نام خانوادگی"] || ""}`.trim() || nameInput,
        specialty: official["رشته"] || official["رشته تحصیلی"] || specialtyInput,
        membership: official["نوع عضویت"] || "",
        profile: official["پروفایل"] || null
      };

      status.innerHTML = `✅ کد تأیید شد (${mappedDoctor.name} - ${mappedDoctor.specialty})<br>در حال ثبت پزشک...`;
      status.style.color = "#4caf50";

    } catch (err) {
      console.error("API Error:", err);
      status.textContent = "❌ خطا در ارتباط با سرور تأیید";
      status.style.color = "#f44336";
      return;
    }

    // 📌 نمایش وضعیت در حال ثبت
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ در حال ارسال...";
    }

    try {
      const { data, error } = await client.from("doctors").insert([{
        name: mappedDoctor?.name || nameInput,
        medical_code,
        specialty: mappedDoctor?.specialty || specialtyInput,
        province,
        city,
        phone,
        address,
        work_hours,
        rating,
        extra_info,
        image_url,
        approved: false,
        status: "pending",
        submitted_by: "doctor"
      }]).select();

      if (error) {
        console.error("Supabase Error:", error);
        status.textContent = "❌ خطا در ثبت پزشک: " + (error.message || "لطفاً دوباره تلاش کنید.");
        status.style.color = "#f44336";
      } else {
        status.innerHTML = "✅ پزشک با موفقیت ثبت شد.<br>در انتظار تأیید مدیر.";
        status.style.color = "#4caf50";
        form.reset();
      }
    } catch (err) {
      console.error("Unexpected Error:", err);
      status.textContent = "❌ خطای غیرمنتظره رخ داد.";
      status.style.color = "#f44336";
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "✅ ثبت پزشک";
      }
    }
  });
} else {
  console.error("❌ فرم doctor-form پیدا نشد");
}