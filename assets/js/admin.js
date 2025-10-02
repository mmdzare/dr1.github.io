// ---------------- Supabase Client ----------------
const SUPABASE_URL = "https://lzfonyofgwfiwzsloqjp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6Zm9ueW9mZ3dmaXd6c2xvcWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxODkyODYsImV4cCI6MjA3NDc2NTI4Nn0.DFnvcx5VuhQOSgb4Lab4LB-U-opdiCwBa3_kKD9dPiY";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------- Auth ----------------
function login() {
  const pass = document.getElementById("pass").value.trim();
  const err = document.getElementById("err");
  if (!pass) { err.textContent = "رمز را وارد کنید."; return; }
  if (pass === "dradmin123") {
    localStorage.setItem("admin", "ok");
    showPanel();
  } else {
    err.textContent = "رمز اشتباه است!";
  }
}
function logout() {
  localStorage.removeItem("admin");
  location.reload();
}
function showPanel() {
  document.getElementById("login-box").classList.add("hidden");
  document.getElementById("panel").classList.remove("hidden");
  loadComments();
  loadReplies();
}
if (localStorage.getItem("admin") === "ok") showPanel();

// ---------------- Toast ----------------
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  t.style.opacity = "1";
  setTimeout(() => { t.style.opacity = "0"; t.style.display = "none"; }, 2500);
}

// ---------------- Comments ----------------
function rowHtml(row, section) {
  const dateStr = row.created_at ? new Date(row.created_at).toLocaleString("fa-IR") : "-";
  const safe = s => (s || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let status = "⏳ در انتظار";
  if(row.approved === true) status = "✅ تأیید شده";
  if(row.approved === false) status = "❌ رد شده";

  const tr = document.createElement("tr");
  if(row.approved === null) tr.classList.add("pending-row");

  tr.innerHTML = `
    <td><input type="checkbox" class="checkbox" data-id="${row.id}" data-section="${section}"></td>
    <td>${safe(row.user_name) || "-"}</td>
    <td>${safe(row.doctor_name) || "-"}</td>
    <td class="comment">${safe(row.comment) || "-"}</td>
    <td>${dateStr}</td>
    <td>
      <button class="approve" onclick="approveComment('${row.id}')">✅</button>
      <button class="reject"  onclick="rejectComment('${row.id}')">❌</button>
      <button class="delete"  onclick="deleteComment('${row.id}')">🗑️</button>
    </td>
  `;
  return tr;
}

async function loadComments(){
  const [pd, ad, rd] = await Promise.all([
    client.from("comments").select("*").is("approved", null).order("created_at",{ascending:false}).limit(20),
    client.from("comments").select("*").eq("approved", true).order("created_at",{ascending:false}).limit(20),
    client.from("comments").select("*").eq("approved", false).order("created_at",{ascending:false}).limit(20)
  ]);

  fillCommentSection(pd.data || [], "pending-body", "count-pending", "pending");
  fillCommentSection(ad.data || [], "approved-body", "count-approved", "approved");
  fillCommentSection(rd.data || [], "rejected-body", "count-rejected", "rejected");

  const total = (pd.data?.length || 0) + (ad.data?.length || 0) + (rd.data?.length || 0);
  document.getElementById("total-badge").textContent = `مجموع نظرات: ${total}`;
  renderChart(pd.data?.length || 0, ad.data?.length || 0, rd.data?.length || 0);
  wireSelectAll();
}

function fillCommentSection(data, tbodyId, countId, section){
  const tbody = document.getElementById(tbodyId);
  const count = document.getElementById(countId);
  count.textContent = data.length;
  tbody.innerHTML = "";
  data.forEach(row => tbody.appendChild(rowHtml(row, section)));
}

function renderChart(p,a,r){
  const ctx=document.getElementById("statusChart");
  const data={labels:["در انتظار","تأیید شده","رد شده"],datasets:[{data:[p,a,r],backgroundColor:["#93c5fd","#10b981","#f59e0b"]}]};
  if(chart){ chart.data=data; chart.update(); } else { chart=new Chart(ctx,{type:"pie",data}); }
}

// ---------------- عملیات تکی روی نظرات ----------------
async function approveComment(id){ const {error}=await client.from("comments").update({approved:true}).eq("id",id); if(error){console.error(error);return showToast("❌ خطا در تأیید");} showToast("✅ نظر تأیید شد"); loadComments(); }
async function rejectComment(id){ const {error}=await client.from("comments").update({approved:false}).eq("id",id); if(error){console.error(error);return showToast("❌ خطا در رد");} showToast("❌ نظر رد شد"); loadComments(); }
async function deleteComment(id){ if(!confirm("حذف این نظر؟")) return; const {error}=await client.from("comments").delete().eq("id",id); if(error){console.error(error);return showToast("❌ خطا در حذف");} showToast("🗑️ نظر حذف شد"); loadComments(); }

// ---------------- عملیات دسته‌ای روی نظرات ----------------
function getSelectedIds(section){
  return [...document.querySelectorAll(`input[type="checkbox"][data-section="${section}"]:checked`)].map(el=>el.getAttribute("data-id"));
}
function clearSelection(section){
  document.querySelectorAll(`input[type="checkbox"][data-section="${section}"]`).forEach(el=>el.checked=false);
}
async function bulkApprove(section){ const ids=getSelectedIds(section); if(!ids.length) return showToast("هیچ موردی انتخاب نشده"); const {error}=await client.from("comments").update({approved:true}).in("id",ids); if(error){console.error(error);return showToast("❌ خطا در بروزرسانی");} showToast(`✅ ${ids.length} تأیید شد`); clearSelection(section); loadComments(); }
async function bulkReject(section){ const ids=getSelectedIds(section); if(!ids.length) return showToast("هیچ موردی انتخاب نشده"); const {error}=await client.from("comments").update({approved:false}).in("id",ids); if(error){console.error(error);return showToast("❌ خطا در بروزرسانی");} showToast(`❌ ${ids.length} رد شد`); clearSelection(section); loadComments(); }
function wireSelectAll(){
  [["pending-select-all","pending"],
   ["approved-select-all","approved"],
   ["rejected-select-all","rejected"],
   ["replies-select-all","replies"]].forEach(([chkId,section])=>{
    const chk=document.getElementById(chkId); if(!chk) return;
    chk.onchange=()=>{ 
      document.querySelectorAll(`input[type="checkbox"][data-section="${section}"]`)
        .forEach(el=>el.checked=chk.checked); 
    };
  });
}

// ---------------- پاسخ‌ها ----------------
let groupedReplies = {}; // برای استفاده در showMoreReplies

async function loadReplies(){
  const { data, error } = await client
    .from("replies")
    .select(`
      id,
      name,
      text,
      approved,
      ts,
      comment_id,
      comments (
        comment
      )
    `)
    .order("ts", { ascending: false })
    .limit(50);
    
  const tbody = document.getElementById("replies-body");
  const count = document.getElementById("count-replies");

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7">خطا: ${error.message}</td></tr>`;
    count.textContent = "0";
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="7">موردی نیست</td></tr>`;
    count.textContent = "0";
    return;
  }

  tbody.innerHTML = "";
  let pending = 0;

  const pendingList  = data.filter(r => r.approved === null);
  const approvedList = data.filter(r => r.approved === true);
  const rejectedList = data.filter(r => r.approved === false);

  const all = [...pendingList, ...approvedList, ...rejectedList];

  // مرحله 1: دسته‌بندی پاسخ‌ها بر اساس comment_id
  groupedReplies = {};
  all.forEach(r => {
    const cid = r.comment_id;
    if (!groupedReplies[cid]) groupedReplies[cid] = [];
    groupedReplies[cid].push(r);
  });

  // مرحله 2: نمایش فقط دو پاسخ اول + دکمه ادامه
  Object.entries(groupedReplies).forEach(([cid, group]) => {
    const firstTwo = group.slice(0, 2);
    const remaining = group.length - 2;

    firstTwo.forEach(r => {
      const date = r.ts ? new Date(r.ts).toLocaleString("fa-IR") : "-";
      let status = "⏳ در انتظار";
      if (r.approved === true) status = "✅ تأیید شده";
      else if (r.approved === false) status = "❌ رد شده";
      else pending++;

      const relatedComment = r.comments?.comment || "-";

      const tr = document.createElement("tr");
      if (r.approved === null) tr.classList.add("pending-row");

      tr.innerHTML = `
        <td><input type="checkbox" class="checkbox" data-id="${r.id}" data-section="replies"></td>
        <td>${r.name || "-"}</td>
        <td>${r.text || "-"}</td>
        <td>${relatedComment}</td>
        <td>${date}</td>
        <td>${status}</td>
        <td>
          <button class="approve" onclick="approveReply('${r.id}')">✅</button>
          <button class="reject"  onclick="rejectReply('${r.id}')">❌</button>
          <button class="delete"  onclick="deleteReply('${r.id}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (remaining > 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="7" style="text-align:center;">
          <button class="show-more" onclick="showMoreReplies('${cid}')">
            👁️ ادامه پاسخ‌ها (${remaining})
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  count.textContent = pending;
}

function showMoreReplies(commentId) {
  const more = groupedReplies[commentId].slice(2);
  const tbody = document.getElementById("replies-body");

  more.forEach(r => {
    const date = r.ts ? new Date(r.ts).toLocaleString("fa-IR") : "-";
    let status = "⏳ در انتظار";
    if (r.approved === true) status = "✅ تأیید شده";
    else if (r.approved === false) status = "❌ رد شده";

    const relatedComment = r.comments?.comment || "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox" data-id="${r.id}" data-section="replies"></td>
      <td>${r.name || "-"}</td>
      <td>${r.text || "-"}</td>
      <td>${relatedComment}</td>
      <td>${date}</td>
      <td>${status}</td>
      <td>
        <button class="approve" onclick="approveReply('${r.id}')">✅</button>
        <button class="reject"  onclick="rejectReply('${r.id}')">❌</button>
        <button class="delete"  onclick="deleteReply('${r.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // حذف دکمه ادامه
  const btn = document.querySelector(`button.show-more[onclick*="${commentId}"]`);
  if (btn) btn.parentElement.parentElement.remove();
}


// ---------------- عملیات روی پاسخ‌ها (تکی و دسته‌ای) ----------------

// تأیید پاسخ تکی
async function approveReply(id){
  const { error } = await client.from("replies").update({ approved: true }).eq("id", id);
  if (error) {
    console.error(error);
    return showToast("❌ خطا در تأیید");
  }
  showToast("✅ پاسخ تأیید شد");
  loadReplies();
}

// رد پاسخ تکی
async function rejectReply(id){
  const { error } = await client.from("replies").update({ approved: false }).eq("id", id);
  if (error) {
    console.error(error);
    return showToast("❌ خطا در رد");
  }
  showToast("❌ پاسخ رد شد");
  loadReplies();
}

// حذف پاسخ تکی
async function deleteReply(id){
  if (!confirm("حذف پاسخ؟")) return;
  const { error } = await client.from("replies").delete().eq("id", id);
  if (error) {
    console.error(error);
    return showToast("❌ خطا در حذف");
  }
  showToast("🗑️ پاسخ حذف شد");
  loadReplies();
}

// دریافت ID پاسخ‌های انتخاب‌شده
function getSelectedReplyIds(){
  return [...document.querySelectorAll(`input[type="checkbox"][data-section="replies"]:checked`)]
    .map(el => el.getAttribute("data-id"));
}

// پاک‌کردن انتخاب‌ها
function clearReplySelection(){
  document.querySelectorAll(`input[type="checkbox"][data-section="replies"]`)
    .forEach(el => el.checked = false);
}

// بروزرسانی دسته‌ای پاسخ‌ها
async function bulkUpdateReplies(value){
  const ids = getSelectedReplyIds();
  if (!ids.length) return showToast("هیچ پاسخ انتخاب نشده");

  const { error } = await client.from("replies").update({ approved: value }).in("id", ids);
  if (error) {
    console.error(error);
    return showToast("❌ خطا در بروزرسانی");
  }

  showToast(value ? `✅ ${ids.length} پاسخ تأیید شد` : `❌ ${ids.length} پاسخ رد شد`);
  clearReplySelection();
  loadReplies();
}

// دکمه‌های دسته‌ای
const bulkApproveReplies = () => bulkUpdateReplies(true);
const bulkRejectReplies  = () => bulkUpdateReplies(false);