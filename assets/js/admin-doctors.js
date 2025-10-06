// 📌 اتصال به Supabase
const supabase = window.supabase.createClient(
  "https://lzfonyofgwfiwzsloqjp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY"
);

const tableBody = document.querySelector("#doctors-table tbody");
const verifyModal = document.getElementById("verifyModal");
const verifyResult = document.getElementById("verifyResult");
let currentDoctorId = null;

// 📌 نمایش پیام بارگذاری
function showLoading() {
  tableBody.innerHTML = `<tr><td colspan="7">⏳ در حال بارگذاری...</td></tr>`;
}

// 📌 دریافت لیست پزشکان
async function loadDoctors(page = 0, limit = 20) {
  showLoading();
  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, medical_code, specialty, province, city, status")
    .range(page * limit, page * limit + limit - 1);

  if (error) {
    console.error("❌ خطا در دریافت داده‌ها:", error.message);
    tableBody.innerHTML = `<tr><td colspan="7">❌ خطا در بارگذاری</td></tr>`;
    return;
  }

  if (!data?.length) {
    tableBody.innerHTML = `<tr><td colspan="7">هیچ رکوردی یافت نشد</td></tr>`;
    return;
  }

  // 📌 مرتب‌سازی بر اساس وضعیت
  const order = { pending: 1, approved: 2, rejected: 3 };
  data.sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));

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
          <button class="verify" onclick='verifyDoctor(${JSON.stringify(doc.id)}, ${JSON.stringify(doc.name)}, ${JSON.stringify(doc.medical_code)}, ${JSON.stringify(doc.specialty)})'>🔍</button>
        ` : ""}
        <button class="edit" onclick='editDoctor(${JSON.stringify(doc.id)}, ${JSON.stringify(doc.name)})'>✏️</button>
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
    console.error(error);
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
    console.error(error);
  } else {
    loadDoctors();
  }
}

// 📌 ویرایش پزشک
async function editDoctor(id, oldName) {
  const newName = prompt("نام جدید:", oldName);
  const newCode = prompt("کد نظام پزشکی جدید:");
  const newSpecialty = prompt("تخصص جدید:");
  const newProvince = prompt("استان جدید:");
  const newCity = prompt("شهر جدید:");

  if (![newName, newCode, newSpecialty, newProvince, newCity].some(Boolean)) return;

  const updates = {};
  if (newName) updates.name = newName;
  if (newCode) updates.medical_code = newCode;
  if (newSpecialty) updates.specialty = newSpecialty;
  if (newProvince) updates.province = newProvince;
  if (newCity) updates.city = newCity;

  const { error } = await supabase.from("doctors").update(updates).eq("id", id);
  if (error) {
    alert("❌ خطا: " + error.message);
    console.error(error);
  } else {
    loadDoctors();
  }
}

// 📌 بررسی اعتبار پزشک از API (Render)
async function verifyDoctor(id, name, code, specialty) {
  currentDoctorId = id;

  // ✅ اگر کد نظام پزشکی وارد نشده بود
  if (!code || code.trim() === "") {
    verifyResult.innerHTML = `
      <h4>اطلاعات واردشده توسط پزشک</h4>
      <p>نام: ${name || "-"}<br>کد: -<br>تخصص: ${specialty || "-"}</p>
      <p style="color:#dc2626; font-weight:bold;">❌ پزشک/فرد کد نظام پزشکی وارد نکرده است</p>
    `;
    verifyModal.style.display = "flex";
    return;
  }

  let result = `
    <h4>اطلاعات واردشده توسط پزشک</h4>
    <p>نام: ${name || "-"}<br>کد: ${code || "-"}<br>تخصص: ${specialty || "-"}</p>
  `;

  try {
    const API_BASE = "https://dr1-api.onrender.com";
    const response = await fetch(`${API_BASE}/api/verify-doctor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    const official = await response.json();

    if (official.error || official.message) {
      result += `<p>❌ ${official.error || official.message}</p>`;
    } else if (official.rows && official.rows.length > 0) {
      // ✅ جدول نتایج رسمی
      result += `
        <h4>اطلاعات رسمی از نظام پزشکی</h4>
        <table class="verify-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>کد نظام</th>
              <th>رشته</th>
              <th>شهر</th>
              <th>نوع عضویت</th>
              <th>پروفایل</th>
              <th>مغایرت</th>
            </tr>
          </thead>
          <tbody>
      `;

      official.rows.forEach((row) => {
        const mapped = {
          name: `${row["نام"] || ""} ${row["نام خانوادگی"] || ""}`.trim(),
          medical_code: row["شماره نظام پزشکی"] || code,
          specialty: row["رشته تحصیلی"] || "-",
          city: row["شهر"] || "-",
          membership: row["نوع عضویت"] || row["نوع پروانه"] || "-",
          profile: row["پروفایل"] || null
        };

        // بررسی مغایرت‌ها
        let diffs = "";
        if (name && mapped.name && name.trim() !== mapped.name.trim()) {
          diffs += `⚠️ نام متفاوت (انتظار: ${mapped.name})<br>`;
        }
        if (specialty && mapped.specialty && specialty.trim() !== mapped.specialty.trim()) {
          diffs += `⚠️ تخصص متفاوت (انتظار: ${mapped.specialty})`;
        }

        result += `
          <tr>
            <td>${mapped.name}</td>
            <td>${mapped.medical_code}</td>
            <td>${mapped.specialty}</td>
            <td>${mapped.city}</td>
            <td>${mapped.membership}</td>
            <td>${mapped.profile ? `<a href="${mapped.profile}" target="_blank">👁</a>` : "-"}</td>
            <td class="diff-cell">${diffs || "-"}</td>
          </tr>
        `;
      });

      result += `</tbody></table>`;
    }
  } catch (err) {
    result += `<p>❌ خطا در ارتباط با سرویس اعتبارسنجی</p>`;
    console.error("verifyDoctor error:", err);
  }

  verifyResult.innerHTML = result;
  verifyModal.style.display = "flex";
}

// 📌 بستن modal
function closeModal() {
  verifyModal.style.display = "none";
  currentDoctorId = null;
}

// 📌 تصمیم نهایی تأیید یا رد
async function finalDecision(approve) {
  if (!currentDoctorId) return;
  await updateDoctor(currentDoctorId, approve);
  closeModal();
}

// 📌 بارگذاری اولیه
document.addEventListener("DOMContentLoaded", () => {
  loadDoctors();
});

// 📌 اتصال توابع به window
window.updateDoctor = updateDoctor;
window.deleteDoctor = deleteDoctor;
window.editDoctor = editDoctor;
window.verifyDoctor = verifyDoctor;
window.finalDecision = finalDecision;
window.closeModal = closeModal;