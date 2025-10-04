// 📌 اتصال به Supabase (فقط برای کلید anon استفاده کن، نه service_role!)
const supabaseUrl = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY"; // ⚠️ اینو از داشبورد Supabase بگیر
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const tableBody = document.querySelector("#doctors-table tbody");
let currentDoctorId = null;

// 📌 نمایش لودینگ
function showLoading() {
  tableBody.innerHTML = `
    <tr><td colspan="7">⏳ در حال بارگذاری...</td></tr>
  `;
}

// 📌 بارگذاری لیست پزشکان
async function loadDoctors(page = 0, limit = 20) {
  showLoading();

  const from = page * limit;
  const to = from + limit - 1;

  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, medical_code, specialty, province, city, status")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("❌ خطا در دریافت داده‌ها:", error.message);
    tableBody.innerHTML = `<tr><td colspan="7">❌ خطا در بارگذاری</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7">هیچ رکوردی یافت نشد</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  data.forEach(doc => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${doc.name || "-"}</td>
      <td>${doc.medical_code || "-"}</td>
      <td>${doc.specialty || "-"}</td>
      <td>${doc.province || "-"}</td>
      <td>${doc.city || "-"}</td>
      <td class="${doc.status}">${doc.status}</td>
      <td>
        ${doc.status === "pending" ? `
          <button class="approve" onclick="updateDoctor('${doc.id}', true)">✅</button>
          <button class="reject" onclick="updateDoctor('${doc.id}', false)">❌</button>
          <button class="verify" onclick="verifyDoctor('${doc.id}', '${doc.name}', '${doc.medical_code}', '${doc.specialty}')">🔍</button>
        ` : ""}
        <button class="edit" onclick="editDoctor('${doc.id}', '${doc.name}')">✏️</button>
        <button class="delete" onclick="deleteDoctor('${doc.id}')">🗑️</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// 📌 تأیید یا رد پزشک
async function updateDoctor(id, approve) {
  const { error } = await supabase
    .from("doctors")
    .update({ approved: approve, status: approve ? "approved" : "rejected" })
    .eq("id", id);

  if (error) {
    alert("❌ خطا: " + error.message);
  } else {
    loadDoctors();
  }
}

// 📌 حذف پزشک
async function deleteDoctor(id) {
  if (!confirm("آیا مطمئن هستید؟")) return;
  const { error } = await supabase.from("doctors").delete().eq("id", id);
  if (error) {
    alert("❌ خطا: " + error.message);
  } else {
    loadDoctors();
  }
}

// 📌 ویرایش اطلاعات پزشک
async function editDoctor(id, oldName) {
  const newName = prompt("نام جدید:", oldName);
  const newCode = prompt("کد نظام پزشکی جدید:");
  const newSpecialty = prompt("تخصص جدید:");
  const newProvince = prompt("استان جدید:");
  const newCity = prompt("شهر جدید:");

  if (!newName && !newCode && !newSpecialty && !newProvince && !newCity) return;

  const { error } = await supabase.from("doctors").update({
    ...(newName && { name: newName }),
    ...(newCode && { medical_code: newCode }),
    ...(newSpecialty && { specialty: newSpecialty }),
    ...(newProvince && { province: newProvince }),
    ...(newCity && { city: newCity })
  }).eq("id", id);

  if (error) {
    alert("❌ خطا: " + error.message);
  } else {
    loadDoctors();
  }
}

// 📌 اعتبارسنجی با API روی Vercel
async function verifyDoctor(id, name, code, specialty) {
  currentDoctorId = id;

  let result = `
    <h4>اطلاعات واردشده توسط پزشک</h4>
    <p>نام: ${name}<br>
    کد: ${code}<br>
    تخصص: ${specialty}</p>
  `;

  try {
    // ✅ تغییر 1: استفاده از دامنه‌ی جدید بک‌اند جداگانه
    const API_BASE = "https://dr1-api.vercel.app"; // ← دامنه‌ی درست بک‌اند

    // ✅ تغییر 2: اضافه کردن timeout دستی برای جلوگیری از چرخش بی‌پایان
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 ثانیه

    const response = await fetch(
      `${API_BASE}/api/verify-doctor?code=${encodeURIComponent(code)}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeout);

    // ✅ تغییر 3: هندل کردن پاسخ‌های غیر JSON یا خالی
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      const text = await response.text();
      console.error("❌ API error:", response.status, text);
      result += `<p>❌ خطا از سمت سرور (${response.status})</p>`;
    } else if (!contentType || !contentType.includes("application/json")) {
      const raw = await response.text();
      console.warn("⚠️ پاسخ غیر JSON:", raw);
      result += `<p>❌ پاسخ نامعتبر از سرور</p>`;
    } else {
      const official = await response.json();

      if (official.error) {
        result += `<p>❌ ${official.error}</p>`;
      } else if (Array.isArray(official)) {
        result += `<h4>اطلاعات رسمی از نظام پزشکی</h4>`;
        official.forEach((doc, index) => {
          result += `
            <div class="official-result">
              <h5>نتیجه ${index + 1}</h5>
              <p>
                نام: ${doc.firstName} ${doc.lastName}<br>
                کد: ${doc.medicalCode}<br>
                رشته: ${doc.field}<br>
                نوع دوره: ${doc.courseType || "-"}<br>
                نمره: ${doc.grade || "-"}<br>
                <a href="${doc.profileUrl}" target="_blank">نمایش پروفایل</a>
              </p>
            </div>
          `;

          // ✅ تغییر 4: بررسی دقیق‌تر مغایرت‌ها
          if (index === 0) {
            const fullName = `${doc.firstName} ${doc.lastName}`.trim();
            if (name && name.trim() !== fullName) {
              result += `<p class="diff">⚠️ نام متفاوت است (انتظار: ${fullName})</p>`;
            }
            if (specialty && specialty.trim() !== doc.field.trim()) {
              result += `<p class="diff">⚠️ تخصص متفاوت است (انتظار: ${doc.field})</p>`;
            }
          }
        });
      } else {
        result += `<p>❌ ساختار داده نامعتبر است</p>`;
      }
    }
  } catch (err) {
    result += `<p>❌ خطا در ارتباط با سرویس اعتبارسنجی</p>`;
    console.error("❌ verifyDoctor error:", err);
  }

  document.getElementById("verifyResult").innerHTML = result;
  document.getElementById("verifyModal").style.display = "flex";
}
