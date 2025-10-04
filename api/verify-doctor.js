import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });
  }

  try {
    // 📌 درخواست مستقیم به صفحه‌ی نتایج
    const response = await axios.get(
      `https://membersearch.irimc.org/searchresult?MedicalSystemNo=${code}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );

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
      return res.status(200).json({ error: "هیچ نتیجه‌ای پیدا نشد" });
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    return res.status(200).json({ error: "خطا در اسکرپینگ: " + err.message });
  }
}
