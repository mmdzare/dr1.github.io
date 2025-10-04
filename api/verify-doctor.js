import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });

  try {
    // 📌 ارسال درخواست به سامانه
    const response = await axios.post(
      "https://membersearch.irimc.org/",
      new URLSearchParams({ MedicalSystemCode: code }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const $ = cheerio.load(response.data);
    const rows = $("table tbody tr");
    const results = [];

    rows.each((i, row) => {
      const tds = $(row).find("td");
      if (tds.length > 0) {
        results.push({
          firstName: tds.eq(0).text().trim(),
          lastName: tds.eq(1).text().trim(),
          medicalCode: tds.eq(2).text().trim(),
          field: tds.eq(3).text().trim(),
          courseType: tds.eq(4).text().trim(),
          grade: tds.eq(5).text().trim(),
          profileUrl: tds.eq(6).find("a").attr("href") || null,
        });
      }
    });

    if (results.length === 0) {
      return res.status(200).json({ error: "هیچ نتیجه‌ای پیدا نشد" });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("❌ Scraping error:", err.message);
    res.status(200).json({ error: "خطا در اسکرپینگ: " + err.message });
  }
}