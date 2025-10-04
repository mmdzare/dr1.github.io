import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });
  }

  try {
    // 1) GET اولیه برای گرفتن کوکی و ViewState (اگر نیاز باشد)
    const getResp = await axios.get("https://membersearch.irimc.org/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      // برای دریافت کوکی‌ها
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const setCookie = getResp.headers["set-cookie"] || [];
    const cookieHeader = setCookie.join("; ");

    // 2) POST به صفحه‌ی searchresult با همان کوکی و هدرهای واقعی
    const postHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded",
      "Origin": "https://membersearch.irimc.org",
      "Referer": "https://membersearch.irimc.org/",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
    };

    const response = await axios.post(
      "https://membersearch.irimc.org/searchresult",
      new URLSearchParams({ MedicalSystemNo: code }),
      {
        headers: postHeaders,
        maxRedirects: 5,
        validateStatus: () => true,
      }
    );

    console.log("STATUS:", response.status);
    console.log("HEADERS:", JSON.stringify(response.headers, null, 2));
    console.log("RAW HTML:", String(response.data).substring(0, 500));

    // اگر باز هم 500 بود، پیام واضح بده
    if (response.status >= 500) {
      return res.status(200).json({ error: "سرور مقصد خطای 500 داد. دوباره تلاش کنید." });
    }

    const $ = cheerio.load(response.data);

    // سلکتور دقیق‌تر برای جدول نتایج (اگر کلاس‌ها وجود داشته باشند)
    // ابتدا هر جدول را بررسی می‌کنیم
    let rows = $("table tbody tr");
    if (rows.length === 0) {
      // تلاش دوم: جدول‌های با کلاس Bootstrap یا Grid
      rows = $(".table tbody tr, .grid tbody tr, tbody tr");
    }

    const results = [];
    rows.each((i, row) => {
      const tds = $(row).find("td");
      // حداقل 8 ستون انتظار داریم
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
