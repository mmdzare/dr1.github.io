// 📌 اتصال به Supabase با اطلاعات پروژه‌ی واقعی
const supabaseUrl = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const tableBody = document.querySelector("#doctors-table tbody");
let currentDoctorId = null;

// 📌 نمایش لودینگ
function showLoading() {
  tableBody.innerHTML = `
    <tr><td colspan="7">⏳ در حال بارگذاری...</td></tr>
  `;
}

// 📌 بارگذاری لیست پزشکان (بهینه‌شده)
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
    .eq("id", id); // ⚠️ اگر کلید اصلی‌ات doctor_id یا uuid هست، اینجا تغییر بده

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

// 📌  اعتبارسنجی
async function verifyDoctor(id, name, code, specialty) {
  currentDoctorId = id;

  let result = `
    <h4>اطلاعات واردشده توسط پزشک</h4>
    <p>نام: ${name}<br>
    کد: ${code}<br>
    تخصص: ${specialty}</p>
  `;

  try {
    // 📌 درخواست به API داخلی که اسکرپینگ انجام می‌دهد
    const response = await fetch(`/api/verify-doctor?code=${code}`);
    const official = await response.json();

    if (official.error) {
      result += `<p>❌ ${official.error}</p>`;
    } else {
      result += `
        <h4>اطلاعات رسمی از نظام پزشکی</h4>
        <p>نام: ${official.name}<br>
        کد: ${official.medicalCode}<br>
        تخصص: ${official.specialty}<br>
        استان: ${official.province}<br>
        شهر: ${official.city}<br>
        وضعیت: ${official.status}</p>
      `;

      // 📌 بررسی مغایرت‌ها
      if (name !== official.name) result += `<p class="diff">⚠️ نام متفاوت است</p>`;
      if (specialty !== official.specialty) result += `<p class="diff">⚠️ تخصص متفاوت است</p>`;
    }
  } catch (err) {
    result += `<p>❌ خطا در ارتباط با سرویس اعتبارسنجی</p>`;
    console.error("❌ verifyDoctor error:", err);
  }

  document.getElementById("verifyResult").innerHTML = result;
  document.getElementById("verifyModal").style.display = "flex";
}

// 📌 بستن مودال
function closeModal() {
  document.getElementById("verifyModal").style.display = "none";
  currentDoctorId = null;
}

// 📌 تصمیم نهایی در مودال
async function finalDecision(approve) {
  if (!currentDoctorId) return;
  await updateDoctor(currentDoctorId, approve);
  closeModal();
}

// 📌 بارگذاری اولیه
document.addEventListener("DOMContentLoaded", () => {
  loadDoctors();
});

// 📌 دسترسی سراسری برای دکمه‌ها
window.updateDoctor = updateDoctor;
window.deleteDoctor = deleteDoctor;
window.editDoctor = editDoctor;
window.verifyDoctor = verifyDoctor;
window.finalDecision = finalDecision;
window.closeModal = closeModal;