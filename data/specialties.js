// 📌 لیست تخصص‌ها برای کشویی فرم پزشک
const specialties = [
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
  if (!select || !Array.isArray(window.specialties)) return;

  // پاک کردن گزینه‌های قبلی
  select.innerHTML = `<option value="" disabled selected>انتخاب تخصص</option>`;

  // افزودن تخصص‌ها
  window.specialties.forEach(s => {
    if (s && typeof s === "string") {
      const opt = new Option(s, s);
      select.add(opt);
    }
  });
}

// 📌 اجرا بعد از لود شدن صفحه
document.addEventListener("DOMContentLoaded", populateSpecialties);