import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  try {
    const code = req.query.code;
    if (!code) {
      console.error("❌ کدی ارسال نشده");
      return res.status(400).json({ error: "کد نظام پزشکی وارد نشده" });
    }

    const url = `https://membersearch.irimc.org/searchresult?MedicalSystemNo=${code}`;
    console.log("🔎 Fetching:", url);

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 15000,
    });

    if (!response.data) {
      console.error("❌ پاسخ خالی از سرور");
      return res.status(502).json({ error: "پاسخ خالی از سرور مقصد" });
    }

    const $ = cheerio.load(response.data);
    const rows = $("table tbody tr");
    const results = [];

    rows.each((i, row) => {
      const tds = $(row).find("td");
      if (tds.length >= 7) {
        results.push({
          row: tds.eq(0).text().trim(),
          firstName: tds.eq(1).text().trim(),
          lastName: tds.eq(2).text().trim(),
          medicalCode: tds.eq(3).text().trim(),
          field: tds.eq(4).text().trim(),
          courseType: tds.eq(5).text().trim(),
          grade: tds.eq(6).text().trim(),
          profileUrl: tds.eq(7).find("a").attr("href") || null,
        });
      }
    });

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