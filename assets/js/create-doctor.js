// 📌 اتصال به Supabase با URL و anon key کامل
const client = supabase.createClient(
  "https://lzfonyofgwfiwzsloqjp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY"
);

// 📌 آواتار پیش‌فرض
const DEFAULT_AVATAR = "assets/img/dr.png";

// 📌 مقداردهی Supabase Client
const SUPABASE_URL = "https://xxxx.supabase.co"; // 🔑 آدرس پروژه
const SUPABASE_ANON_KEY = "your-anon-key";      // 🔑 کلید عمومی
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 📌 گرفتن فرم و بخش وضعیت
const form = document.getElementById("doctor-form");
const status = document.getElementById("status");

// 📌 رویداد ثبت فرم
form.addEventListener("submit", async e => {
  e.preventDefault();

  // گرفتن داده‌ها
  const name = document.getElementById("name").value.trim();
  const medical_code = document.getElementById("medical_code").value.trim();
  const specialty = document.getElementById("specialty").value;
  const province = document.getElementById("province").value;
  const city = document.getElementById("city").value;
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();
  const work_hours = document.getElementById("work_hours").value.trim();
  const rating = parseFloat(document.getElementById("rating").value) || null;
  const extra_info = document.getElementById("extra_info").value.trim();
  const image_url = DEFAULT_AVATAR;

  // 📌 اعتبارسنجی ساده
  if (!name || !medical_code || !specialty || !province || !city) {
    status.textContent = "⚠️ لطفاً همه فیلدهای ضروری را پر کنید";
    status.style.color = "#ff9800";
    return;
  }

  // 📌 اعتبارسنجی شماره تماس
  if (phone && !/^\d{11}$/.test(phone)) {
    status.textContent = "⚠️ شماره تماس باید ۱۱ رقمی باشد";
    status.style.color = "#ff9800";
    return;
  }

  // 📌 نمایش وضعیت در حال ثبت
  status.textContent = "⏳ در حال ثبت پزشک...";
  status.style.color = "#2196f3";

  // 📌 ذخیره در جدول doctors
  const { data, error } = await client.from("doctors").insert([
    {
      name,
      medical_code,
      specialty,
      province,
      city,
      phone,
      address,
      work_hours,
      rating,
      extra_info,
      image_url,
      approved: false,       // در انتظار تأیید
      status: "pending",     // وضعیت اولیه
      submitted_by: "doctor" // ثبت توسط پزشک
    }
  ]).select();

  // 📌 نمایش نتیجه
  if (error) {
    console.error("Supabase Error:", error);
    status.textContent = "❌ خطا در ثبت پزشک. لطفاً دوباره تلاش کنید.";
    status.style.color = "#f44336";
  } else {
    status.innerHTML = "✅ پزشک با موفقیت ثبت شد.<br>در انتظار تأیید مدیر.";
    status.style.color = "#4caf50";
    form.reset();
  }
});