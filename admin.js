import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* ====== CHANGE THIS: the Google account(s) allowed to open this page ====== */
const ADMIN_EMAILS = ["anujrawat2431@gmail.com"];
/* ========================================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyB4HrPn0JJhjX9eT0JgIc7JZ_rc2yU0uh0",
  authDomain: "esport-hire.firebaseapp.com",
  projectId: "esport-hire",
  storageBucket: "esport-hire.firebasestorage.app",
  messagingSenderId: "851326993856",
  appId: "1:851326993856:web:f5677945ef06e7e58d3425"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s, r = document) => r.querySelector(s);
let rows = [];

/* escape text before putting it in HTML (players type this data!) */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeImg = s => (typeof s === "string" && s.startsWith("data:image/")) ? s : "";
const gameClass = g => g === "Valorant" ? "v" : g === "Free Fire Max" ? "f" : "";
const fmtDate = r => {
  const d = r.createdAt?.toDate ? r.createdAt.toDate() : null;
  return d ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
};

/* ---------- Login ---------- */
$("#signInBtn").addEventListener("click", () => {
  $("#loginMsg").textContent = "";
  signInWithPopup(auth, new GoogleAuthProvider()).catch(e => $("#loginMsg").textContent = e.message);
});
$("#signOutBtn").addEventListener("click", () => signOut(auth));
$("#refreshBtn").addEventListener("click", load);

onAuthStateChanged(auth, user => {
  const ok = user && ADMIN_EMAILS.map(e => e.toLowerCase()).includes((user.email || "").toLowerCase());
  $("#login").hidden = !!ok;
  $("#app").hidden = !ok;
  if (user && !ok) {
    $("#loginMsg").textContent = "This account (" + user.email + ") is not an admin.";
    signOut(auth);
  }
  if (ok) { $("#who").textContent = user.email; load(); }
});

/* ---------- Load data ---------- */
async function load() {
  $("#count").textContent = "Loading...";
  try {
    const snap = await getDocs(query(collection(db, "lanRegistrations"), orderBy("createdAt", "desc")));
    rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (e) {
    console.error(e);
    $("#count").textContent = "❌ " + (e.code === "permission-denied"
      ? "Permission denied. Update your Firestore rules (add your admin email) and try again."
      : e.message);
  }
}

/* ---------- Draw ---------- */
function filtered() {
  const q = $("#search").value.trim().toLowerCase();
  const g = $("#fGame").value, s = $("#fStatus").value;
  return rows.filter(r =>
    (!g || (r.games || []).includes(g)) &&
    (!s || (r.paymentStatus || "pending") === s) &&
    (!q || [r.teamName, r.leaderName, r.phone, r.email, r.regId].join(" ").toLowerCase().includes(q)));
}

function drawStats() {
  const count = g => rows.filter(r => (r.games || []).includes(g)).length;
  const sum = list => list.reduce((t, r) => t + (r.totalAmount || 0), 0);
  const ver = rows.filter(r => r.paymentStatus === "verified");
  const pend = rows.filter(r => (r.paymentStatus || "pending") === "pending");
  $("#stats").innerHTML = [
    ["Total teams", rows.length, "hl"], ["BGMI teams", count("BGMI")], ["Free Fire Max teams", count("Free Fire Max")], ["Valorant teams", count("Valorant")],
    ["Payments pending", pend.length], ["Payments verified", ver.length, "ok"],
    ["Total claimed", "₹" + sum(rows)], ["Verified amount", "₹" + sum(ver), "ok"]
  ].map(([l, v, c]) => `<div class="stat ${c || ""}"><span>${l}</span><b>${v}</b></div>`).join("");
}

function render() {
  drawStats();
  const list = filtered();
  $("#count").textContent = `Showing ${list.length} of ${rows.length} registrations`;
  $("#empty").hidden = list.length > 0;
  $("#rows").innerHTML = list.map((r, i) => {
    const st = r.paymentStatus || "pending";
    const logo = safeImg(r.teamLogo);
    return `<tr>
      <td>${i + 1}</td>
      <td>${logo ? `<img class="logo-thumb" src="${logo}" alt="" data-view="${r.id}">` : '<div class="nologo">none</div>'}</td>
      <td><span class="team">${esc(r.teamName)}</span><span class="sub">${esc(r.regId)}</span></td>
      <td>${esc(r.leaderName)}</td>
      <td>${esc(r.phone)}<span class="sub">${esc(r.email)}</span></td>
      <td><div class="chips">${(r.games || []).map(g => `<span class="chip ${gameClass(g)}">${esc(g)}</span>`).join("")}</div></td>
      <td class="amt">₹${esc(r.totalAmount)}</td>
      <td class="utr">${(r.payments || []).map(p => `${esc(p.game)}: ${esc(p.utr)}`).join("<br>")}</td>
      <td><select class="st ${st}" data-id="${r.id}">
        ${["pending", "verified", "rejected"].map(o => `<option value="${o}" ${o === st ? "selected" : ""}>${o[0].toUpperCase() + o.slice(1)}</option>`).join("")}
      </select></td>
      <td>${esc(fmtDate(r))}</td>
      <td><button class="btn sm ghost view" data-view="${r.id}" type="button">View</button></td>
    </tr>`;
  }).join("");
}
["input", "change"].forEach(ev => ["#search", "#fGame", "#fStatus"].forEach(s => $(s).addEventListener(ev, render)));

/* ---------- Change payment status ---------- */
$("#rows").addEventListener("change", async e => {
  const sel = e.target.closest("select.st"); if (!sel) return;
  const r = rows.find(x => x.id === sel.dataset.id), old = r.paymentStatus || "pending";
  sel.disabled = true;
  try {
    await updateDoc(doc(db, "lanRegistrations", r.id), { paymentStatus: sel.value });
    r.paymentStatus = sel.value; render();
  } catch (err) {
    alert("Could not update: " + err.message); sel.value = old; sel.disabled = false;
  }
});

/* ---------- Details popup ---------- */
$("#rows").addEventListener("click", e => {
  const b = e.target.closest("[data-view]"); if (b) openDetails(b.dataset.view);
});
function openDetails(id) {
  const r = rows.find(x => x.id === id); if (!r) return;
  const logo = safeImg(r.teamLogo);
  $("#modalCard").innerHTML = `
    <button class="x" type="button" aria-label="Close">✕</button>
    <div class="m-head">${logo ? `<img src="${logo}" alt="">` : ""}<div><h2>${esc(r.teamName)}</h2><span class="sub">${esc(r.regId)}</span></div></div>
    <div class="kv">
      <span>Team leader</span><b>${esc(r.leaderName)}</b>
      <span>Phone</span><b>${esc(r.phone)}</b>
      <span>Email</span><b>${esc(r.email)}</b>
      <span>Game(s)</span><b>${esc((r.games || []).join(", "))}</b>
      <span>Amount</span><b>₹${esc(r.totalAmount)}</b>
      <span>Payment</span><b>${esc(r.paymentStatus || "pending")}</b>
      <span>Registered</span><b>${esc(fmtDate(r))}</b>
    </div>
    <div class="m-title">Payments</div>
    ${(r.payments || []).map(p => `<div class="mem"><b>${esc(p.game)}</b><span>₹${esc(p.amount)}</span><span>${esc(p.utr)}</span></div>`).join("")}
    <div class="m-title">Players</div>
    ${(r.members || []).map(m => `<div class="mem"><b>Player ${esc(m.player)}</b><span><small>IGN / UID</small><br>${esc(m.ign)}</span><span><small>College ID</small><br>${esc(m.collegeId)}</span></div>`).join("")}
    <div class="m-actions">${logo ? `<button class="btn sm" id="dlLogo" type="button">⬇ Download logo</button>` : ""}</div>`;
  $("#modal").hidden = false;
  $("#dlLogo")?.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = logo; a.download = (r.teamName || "team").replace(/[^\w-]+/g, "_") + (logo.startsWith("data:image/png") ? ".png" : ".jpg");
    a.click();
  });
}
const closeModal = () => $("#modal").hidden = true;
$("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest(".x")) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ---------- Export to CSV (opens in Excel / Google Sheets) ---------- */
$("#csvBtn").addEventListener("click", () => {
  const head = ["Reg ID", "Team", "Leader", "Phone", "Email", "Games", "Total Amount", "UTRs", "Payment Status", "Registered"];
  for (let i = 1; i <= 5; i++) head.push(`P${i} IGN/UID`, `P${i} College ID`);
  const cell = v => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const lines = [head.map(cell).join(",")];
  filtered().forEach(r => {
    const row = [r.regId, r.teamName, r.leaderName, r.phone, r.email, (r.games || []).join(" + "), r.totalAmount,
      (r.payments || []).map(p => `${p.game}: ${p.utr}`).join(" | "), r.paymentStatus || "pending", fmtDate(r)];
    for (let i = 0; i < 5; i++) { const m = (r.members || [])[i]; row.push(m?.ign || "", m?.collegeId || ""); }
    lines.push(row.map(cell).join(","));
  });
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "MHTxGNIOT-LAN-registrations.csv"; a.click();
});
