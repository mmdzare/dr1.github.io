// 📌 لیست تخصص‌ها برای کشویی فرم پزشک
window.specialties = [
  "عمومی",
  "قلب و عروق",
  "پوست و مو",
  "چشم پزشکی",
  "ارتوپدی",
  "گوارش",
  "زنان و زایمان",
  "اطفال",
  "روان‌پزشکی",
  "جراحی عمومی",
  "دندانپزشکی",
  "بیهوشی",
  "عفونی",
  "اورولوژی",
  "غدد",
  "ریه",
  "طب اورژانس",
  "طب کار",
  "طب فیزیکی و توانبخشی",
  "نورولوژی (مغز و اعصاب)"
];

// 📌 تابع پر کردن کشویی تخصص‌ها
function populateSpecialties(selectId = "specialty") {
  const select = document.getElementById(selectId);

  if (!select) {
    console.error("❌ المان select پیدا نشد:", selectId);
    return;
  }
  if (!Array.isArray(window.specialties)) {
    console.error("❌ specialties تعریف نشده یا معتبر نیست");
    return;
  }

  // ریست و غیرفعال کردن کشو
  select.innerHTML = `<option value="" disabled selected>انتخاب تخصص</option>`;
  select.disabled = true;

  if (window.specialties.length > 0) {
    window.specialties.sort().forEach(s => {
      if (s && typeof s === "string") {
        select.add(new Option(s, s));
      }
    });
    select.disabled = false;
  } else {
    select.add(new Option("تخصصی موجود نیست", ""));
  }
}

// 📌 اجرا بعد از لود شدن صفحه
document.addEventListener("DOMContentLoaded", () => populateSpecialties());