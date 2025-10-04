import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });
  }

  try {
    // 1) GET اولیه برای گرفتن کوکی و hidden fieldها
    const getResp = await axios.get("https://membersearch.irimc.org/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(getResp.data);
    const viewState = $("input[name='__VIEWSTATE']").val();
    const eventValidation = $("input[name='__EVENTVALIDATION']").val();

    const cookieHeader = (getResp.headers["set-cookie"] || []).join("; ");

    // 2) POST به searchresult با hidden fieldها + MedicalSystemNo
    const postResp = await axios.post(
      "https://membersearch.irimc.org/searchresult",
      new URLSearchParams({
        MedicalSystemNo: code,
        __VIEWSTATE: viewState,
        __EVENTVALIDATION: eventValidation,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Cookie: cookieHeader,
          Referer: "https://membersearch.irimc.org/",
        },
      }
    );

    const $$ = cheerio.load(postResp.data);
    const rows = $$("table tbody tr");
    const results = [];

    rows.each((i, row) => {
      const tds = $$(row).find("td");
      if (tds.length >= 8) {
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
