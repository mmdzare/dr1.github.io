import axios from "axios";
import * as cheerio from "cheerio";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(200).json({ error: "کد نظام پزشکی وارد نشده" });
  }

  try {
    // 1) GET صفحه اصلی برای کوکی + فرم
    const getResp = await axios.get("https://membersearch.irimc.org/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
        "Upgrade-Insecure-Requests": "1",
      },
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const setCookie = getResp.headers["set-cookie"] || [];
    const cookieHeader = setCookie.join("; ");

    // 2) استخراج فرم و همه‌ی ورودی‌ها
    const $ = cheerio.load(getResp.data);
    const form = $("form").first(); // فرم اصلی
    if (!form || form.length === 0) {
      return res.status(200).json({ error: "فرم جستجو پیدا نشد" });
    }

    // action و method واقعی
    let action = form.attr("action") || "/searchresult";
    if (!/^https?:\/\//i.test(action)) {
      // اگر relative بود، مطلقش کن
      action = new URL(action, "https://membersearch.irimc.org/").toString();
    }
    const method = (form.attr("method") || "post").toLowerCase();

    // ساخت پارامترها از همه‌ی inputها
    const params = new URLSearchParams();
    form.find("input").each((_, el) => {
      const name = $(el).attr("name");
      if (!name) return;
      const type = ($(el).attr("type") || "").toLowerCase();
      const value = $(el).val() ?? "";
      // برای submit، معمولاً باید name را با value ثبت کرد تا رویداد کلیک شبیه‌سازی شود
      if (type === "submit") {
        // فقط یکی را اضافه می‌کنیم تا شبیه کلیک کردن همان دکمه باشد
        if (!params.has(name)) params.set(name, value || "Search");
      } else {
        // سایر ورودی‌ها (hidden/text ...)
        if (!params.has(name)) params.set(name, value);
      }
    });

    // 3) مقداردهی فیلد شماره نظام پزشکی
    // تلاش: اگر فیلد از قبل وجود دارد، جایگزین؛ در غیر اینصورت اضافه کن
    const fieldNames = [
      "MedicalSystemNo",
      "ctl00$ContentPlaceHolder1$MedicalSystemNo",
      "ContentPlaceHolder1_MedicalSystemNo"
    ];
    let setCode = false;
    for (const n of fieldNames) {
      if (params.has(n)) {
        params.set(n, String(code));
        setCode = true;
        break;
      }
    }
    if (!setCode) {
      // اگر نام دقیق را نمی‌دانیم، اضافه کن با رایج‌ترین اسم
      params.set("MedicalSystemNo", String(code));
    }

    // اطمینان از فیلدهای ASP.NET
    if (!params.has("__EVENTTARGET")) params.set("__EVENTTARGET", "");
    if (!params.has("__EVENTARGUMENT")) params.set("__EVENTARGUMENT", "");

    // 4) ارسال فرم با کوکی و هدرها (مثل مرورگر)
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

    const resp =
      method === "get"
        ? await axios.get(action + "?" + params.toString(), {
            headers: postHeaders,
            maxRedirects: 5,
            validateStatus: () => true,
          })
        : await axios.post(action, params, {
            headers: postHeaders,
            maxRedirects: 5,
            validateStatus: () => true,
          });

    // اگر سرور خطای 500 داد، یک تلاشfallback با GET ساده به /searchresult
    if (resp.status >= 500) {
      const fallback = await axios.get(
        "https://membersearch.irimc.org/searchresult?MedicalSystemNo=" + encodeURIComponent(code),
        { headers: postHeaders, maxRedirects: 5, validateStatus: () => true }
      );
      if (fallback.status < 500) {
        // ادامه‌ی پردازش با fallback
        const $$ = cheerio.load(fallback.data);
        const rows = $$("table tbody tr, .table tbody tr, tbody tr");
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
      }
      // اگر fallback هم 500 بود:
      return res.status(200).json({ error: "سرور مقصد خطای 500 داد. دوباره تلاش کنید." });
    }

    // 5) پارس پاسخ نهایی
    const $$ = cheerio.load(resp.data);
    let rows = $$("table tbody tr");
    if (rows.length === 0) rows = $$(".table tbody tr, .grid tbody tr, tbody tr");

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
