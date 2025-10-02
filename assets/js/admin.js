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
  const panel = document.getElementById("panel");
  panel.classList.remove("hidden");
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
  return `
    <tr>
      <td><input type="checkbox" class="checkbox" data-id="${row.id}" data-section="${section}"></td>
      <td>${safe(row.user_name) || "-"}</td>
      <td>${safe(row.doctor_name) || "-"}</td>
      <td class="comment">${safe(row.comment) || "-"}</td>
      <td>${dateStr}</td>
      <td>
        <button class="approve" onclick="approveComment('${row.id}')">✅ تأیید</button>
        <button class="reject"  onclick="rejectComment('${row.id}')">❌ رد</button>
        <button class="delete"  onclick="deleteComment('${row.id}')">🗑️ حذف</button>
      </td>
    </tr>`;
}

async function fetchPending(){ return client.from("comments").select("*").is("approved", null).order("created_at",{ascending:false}); }
async function fetchApproved(){ return client.from("comments").select("*").eq("approved", true).order("created_at",{ascending:false}); }
async function fetchRejected(){ return client.from("comments").select("*").eq("approved", false).order("created_at",{ascending:false}); }

async function fillSection(res, tbodyId, countId, sectionName){
  const tbody = document.getElementById(tbodyId);
  const countEl = document.getElementById(countId);
  const { data, error } = res;
  if(error){ tbody.innerHTML = `<tr><td colspan="6">خطا: ${error.message}</td></tr>`; countEl.textContent="0"; return; }
  if(!data || data.length===0){ tbody.innerHTML = `<tr><td colspan="6">موردی نیست</td></tr>`; countEl.textContent="0"; return; }
  tbody.innerHTML = data.map(r=>rowHtml(r,sectionName)).join("");
  countEl.textContent = data.length;
}

let chart;
async function loadComments(){
  document.getElementById("pending-body").innerHTML = `<tr><td colspan="6">در حال بارگذاری…</td></tr>`;
  document.getElementById("approved-body").innerHTML = `<tr><td colspan="6">در حال بارگذاری…</td></tr>`;
  document.getElementById("rejected-body").innerHTML = `<tr><td colspan="6">در حال بارگذاری…</td></tr>`;

  const [pd, ad, rd] = await Promise.all([fetchPending(), fetchApproved(), fetchRejected()]);
  await Promise.all([
    fillSection(pd,"pending-body","count-pending","pending"),
    fillSection(ad,"approved-body","count-approved","approved"),
    fillSection(rd,"rejected-body","count-rejected","rejected")
  ]);

  const pendingCount=pd.data?.length||0, approvedCount=ad.data?.length||0, rejectedCount=rd.data?.length||0;
  document.getElementById("total-badge").textContent = `مجموع نظرات: ${pendingCount+approvedCount+rejectedCount}`;
  renderChart(pendingCount,approvedCount,rejectedCount);
  wireSelectAll();
}

function renderChart(p,a,r){
  const ctx=document.getElementById("statusChart");
  const data={labels:["در انتظار","تأیید شده","رد شده"],datasets:[{data:[p,a,r],backgroundColor:["#93c5fd","#10b981","#f59e0b"]}]};
  if(chart){ chart.data=data; chart.update(); } else { chart=new Chart(ctx,{type:"pie",data}); }
}

// ---------------- Single actions ----------------
async function approveComment(id){ const {error}=await client.from("comments").update({approved:true}).eq("id",id); if(error) return alert(error.message); showToast("✅ نظر تأیید شد"); loadComments(); }
async function rejectComment(id){ const {error}=await client.from("comments").update({approved:false}).eq("id",id); if(error) return alert(error.message); showToast("❌ نظر رد شد"); loadComments(); }
async function deleteComment(id){ if(!confirm("حذف این نظر؟")) return; const {error}=await client.from("comments").delete().eq("id",id); if(error) return alert(error.message); showToast("🗑️ نظر حذف شد"); loadComments(); }

// ---------------- Bulk actions ----------------
function getSelectedIds(section){
  return Array.from(document.querySelectorAll(`input[type="checkbox"][data-section="${section}"]:checked`)).map(el=>el.getAttribute("data-id"));
}
async function bulkApprove(section){ const ids=getSelectedIds(section); if(ids.length===0) return showToast("هیچ موردی انتخاب نشده"); const {error}=await client.from("comments").update({approved:true}).in("id",ids); if(error) return alert(error.message); showToast(`✅ ${ids.length} مورد تأیید شد`); loadComments(); }
async function bulkReject(section){ const ids=getSelectedIds(section); if(ids.length===0) return showToast("هیچ موردی انتخاب نشده"); const {error}=await client.from("comments").update({approved:false}).in("id",ids); if(error) return alert(error.message); showToast(`❌ ${ids.length} مورد رد شد`); loadComments(); }
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

// ---------------- Replies ----------------
async function loadReplies(){
  const {data, error} = await client
    .from("replies")
    .select(`
      id,
      name,
      text,
      approved,
      ts,
      comments:comment_id ( comment )
    `)
    .order("ts", {ascending:false});

  const tbody = document.getElementById("replies-body");
  const count = document.getElementById("count-replies");

  if(error){
    tbody.innerHTML = `<tr><td colspan="7">خطا: ${error.message}</td></tr>`;
    count.textContent = "0";
    return;
  }
  if(!data || data.length === 0){
    tbody.innerHTML = `<tr><td colspan="7">موردی نیست</td></tr>`;
    count.textContent = "0";
    return;
  }

  tbody.innerHTML = "";
  let pending = 0;

  data.forEach(r=>{
    const date = r.ts ? new Date(r.ts).toLocaleString("fa-IR") : "-";

    // ✅ شرط ساده و مقاوم
    let status;
    if (r.approved === true || r.approved === "true" || r.approved === 1) {
      status = "✅ تأیید شده";
    } else if (r.approved === false || r.approved === "false" || r.approved === 0) {
      status = "❌ رد شده";
    } else {
      status = "⏳ در انتظار";
      pending++;
    }

    const tr = document.createElement("tr");

    // ستون‌ها
    tr.innerHTML = `
      <td><input type="checkbox" class="checkbox" data-id="${r.id}" data-section="replies"></td>
      <td>${r.name || "-"}</td>
      <td>${r.text || "-"}</td>
      <td>${r.comments ? r.comments.comment : "-"}</td>
      <td>${date}</td>
      <td>${status}</td>
    `;

    // ستون عملیات
    const tdActions = document.createElement("td");

    const approveBtn = document.createElement("button");
    approveBtn.textContent = "✅ تأیید";
    approveBtn.className = "approve";
    approveBtn.addEventListener("click", () => approveReply(r.id));

    const rejectBtn = document.createElement("button");
    rejectBtn.textContent = "❌ رد";
    rejectBtn.className = "reject";
    rejectBtn.addEventListener("click", () => rejectReply(r.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️ حذف";
    deleteBtn.className = "delete";
    deleteBtn.addEventListener("click", () => deleteReply(r.id));

    tdActions.appendChild(approveBtn);
    tdActions.appendChild(rejectBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });

  count.textContent = pending;
}

// ---------------- عملیات تکی روی پاسخ‌ها ----------------
async function approveReply(id){
  console.log("Approving reply id:", id);
  const { error } = await client
    .from("replies")
    .update({ approved: true })
    .eq("id", id);

  if(error){
    alert("خطا در تأیید: " + error.message);
    return;
  }
  showToast("✅ پاسخ تأیید شد");
  loadReplies();
}

async function rejectReply(id){
  console.log("Rejecting reply id:", id);
  const { error } = await client
    .from("replies")
    .update({ approved: false })
    .eq("id", id);

  if(error){
    alert("خطا در رد: " + error.message);
    return;
  }
  showToast("❌ پاسخ رد شد");
  loadReplies();
}

async function deleteReply(id){
  if(!confirm("حذف این پاسخ؟")) return;

  const { error } = await client
    .from("replies")
    .delete()
    .eq("id", id);

  if(error){
    alert("خطا در حذف: " + error.message);
    return;
  }
  showToast("🗑️ پاسخ حذف شد");
  loadReplies();
}

// ---------------- عملیات دسته‌ای ----------------
function getSelectedReplyIds(){
  return Array.from(
    document.querySelectorAll(`input[type="checkbox"][data-section="replies"]:checked`)
  ).map(el => el.getAttribute("data-id"));
}

async function bulkUpdateReplies(value){
  const ids = getSelectedReplyIds();
  if(ids.length === 0){
    showToast("هیچ پاسخ انتخاب نشده");
    return;
  }

  const { error } = await client
    .from("replies")
    .update({ approved: value })
    .in("id", ids);

  if(error){
    alert("خطا در بروزرسانی: " + error.message);
    return;
  }

  showToast(value === true
    ? `✅ ${ids.length} پاسخ تأیید شد`
    : `❌ ${ids.length} پاسخ رد شد`
  );

  loadReplies();
}

function bulkApproveReplies(){ bulkUpdateReplies(true); }
function bulkRejectReplies(){ bulkUpdateReplies(false); }