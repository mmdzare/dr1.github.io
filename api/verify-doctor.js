import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });

  try {
    const response = await axios.post(
      "https://membersearch.irimc.org/",
      new URLSearchParams({ MedicalSystemCode: code }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const $ = cheerio.load(response.data);
    const row = $("table tbody tr").first();

    if (!row.length) return res.status(200).json({ error: "هیچ نتیجه‌ای پیدا نشد" });

    const tds = row.find("td");
    const payload = {
      name: tds.eq(0).text().trim(),
      medicalCode: tds.eq(1).text().trim(),
      specialty: tds.eq(2).text().trim(),
      province: tds.eq(3).text().trim(),
      city: tds.eq(4).text().trim(),
      status: tds.eq(5).text().trim(),
    };

    res.status(200).json(payload);
  } catch (err) {
    res.status(200).json({ error: "خطا در اسکرپینگ: " + err.message });
  }
}
