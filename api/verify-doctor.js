import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // 📌 فعال‌سازی CORS برای همه‌ی درخواست‌ها
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 📌 هندل کردن preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 📌 گرفتن کد از query
    const { code } = req.query;
    if (!code || code === "null" || code === "undefined") {
      console.error("❌ کدی ارسال نشده");
      return res.status(400).json({ error: "کد نظام پزشکی وارد نشده" });
    }

    const url = `https://membersearch.irimc.org/searchresult?MedicalSystemNo=${encodeURIComponent(code)}`;
    console.log("🔎 Fetching:", url);

    // 📌 درخواست به سایت نظام پزشکی
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
    });

    if (!response.data) {
      console.error("❌ پاسخ خالی از سرور");
      return res.status(502).json({ error: "پاسخ خالی از سرور مقصد" });
    }

    // 📌 پردازش HTML با cheerio
    const $ = cheerio.load(response.data);
    const rows = $("table tbody tr");
    const results = [];

    rows.each((i, row) => {
      const tds = $(row).find("td");
      if (tds.length >= 6) {
        results.push({
          firstName: tds.eq(0).text().trim(),
          lastName: tds.eq(1).text().trim(),
          medicalCode: tds.eq(2).text().trim(),
          field: tds.eq(3).text().trim(),
          city: tds.eq(4).text().trim(),
          membershipType: tds.eq(5).text().trim(),
          profileUrl: tds.eq(6).find("a").attr("href") || null,
        });
      }
    });

    // 📌 اگر نتیجه‌ای پیدا نشد
    if (results.length === 0) {
      console.warn("⚠️ هیچ نتیجه‌ای پیدا نشد برای کد:", code);
      return res.status(404).json({ error: "هیچ نتیجه‌ای پیدا نشد" });
    }

    console.log("✅ نتایج:", results.length, "رکورد");
    return res.status(200).json(results);

  } catch (err) {
    console.error("❌ خطا در اسکرپینگ:", err.message);
    return res.status(500).json({
      error: "خطا در اسکرپینگ",
      details: err.message,
    });
  }
}
