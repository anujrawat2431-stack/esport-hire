import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

/* Same Firebase project as the rest of your site */
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

/* ---------- GAME SETTINGS (change fees / images here) ---------- */
const GAMES = [
  { key: "BGMI",          short: "BGMI", fee: 125, players: 4, logo: "lan-assets/bgmi.png",      qr: "lan-assets/qr-bgmi.jpg" },
  { key: "Free Fire Max", short: "FF",   fee: 100, players: 4, logo: "lan-assets/freefire.png",  qr: "lan-assets/qr-freefire.jpg" },
  { key: "Valorant",      short: "VAL",  fee: 150, players: 5, logo: "lan-assets/valorant.jpg",  qr: "lan-assets/qr-valorant.jpg" }
];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = { logo: "", utr: {}, uid: null };
let step = 1;

/* image with text fallback (used if a logo file is missing) */
function logoHTML(g) {
  return `<img src="${g.logo}" alt="${g.key} logo" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'fallback',textContent:'${g.short}'}))">`;
}
const selectedGames = () => $$("#gameTiles input:checked").map(i => GAMES.find(g => g.key === i.value));
const hasValorant = () => selectedGames().some(g => g.key === "Valorant");

/* ---------- Step 1: game tiles ---------- */
$("#gameTiles").innerHTML = GAMES.map(g => `
  <label class="tile">
    <input type="checkbox" value="${g.key}">
    <div class="box">${logoHTML(g)}<strong>${g.key}</strong><span class="fee">₹${g.fee} / squad</span></div>
    <span class="tick">✓</span>
  </label>`).join("");
$("#gameTiles").addEventListener("change", () => { togglePlayer5(); clearErr("games"); });

/* ---------- Step 2: members ---------- */
$("#members").innerHTML = [1, 2, 3, 4, 5].map(n => `
  <div class="member ${n === 5 ? "p5" : ""}" id="member${n}" ${n === 5 ? "hidden" : ""}>
    <h3>Player ${n} ${n === 5 ? '<span class="badge">VALORANT</span>' : ""}</h3>
    <div class="field" data-f="ign${n}">
      <label for="ign${n}">Player ${n} IGN / UID (in-game name)</label>
      <input id="ign${n}" type="text" placeholder="In-game name or UID">
      <small class="err"></small>
    </div>
    <div class="field" data-f="cid${n}">
      <label for="cid${n}">Player ${n} College ID</label>
      <input id="cid${n}" type="text" placeholder="College ID number">
      <small class="err"></small>
    </div>
  </div>`).join("");

function togglePlayer5() {
  $("#member5").hidden = !hasValorant();
  $("#squadNote").textContent = hasValorant()
    ? "Valorant needs 5 players, BGMI / Free Fire Max need 4. Fill all players shown below."
    : "Fill the IGN / UID and college ID of all 4 players.";
}
togglePlayer5();

/* ---------- Team logo ---------- */
const fileInput = $("#teamLogo");
fileInput.addEventListener("change", () => handleLogo(fileInput.files[0]));
["dragover", "dragenter"].forEach(e => $("#logoDrop").addEventListener(e, ev => { ev.preventDefault(); $("#logoDrop").classList.add("over"); }));
["dragleave", "drop"].forEach(e => $("#logoDrop").addEventListener(e, () => $("#logoDrop").classList.remove("over")));
$("#logoDrop").addEventListener("drop", ev => { ev.preventDefault(); handleLogo(ev.dataTransfer.files[0]); });

function handleLogo(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return setErr("logo", "Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) return setErr("logo", "Image is too big. Max 5 MB.");
  const img = new Image();
  img.onload = () => {
    const max = 300, scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    state.logo = file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
    $("#logoPreview").src = state.logo; $("#logoPreview").hidden = false;
    $("#logoText").innerHTML = "<strong>Logo added ✓</strong><br><small>Tap to change</small>";
    clearErr("logo");
  };
  img.onerror = () => setErr("logo", "Could not read this image. Try another one.");
  img.src = URL.createObjectURL(file);
}

/* only digits in phone */
$("#phone").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, ""));

/* ---------- Validation helpers ---------- */
function setErr(f, msg) {
  const box = $(`[data-f="${f}"]`); if (!box) return;
  box.classList.add("bad"); $(".err", box).textContent = msg;
}
function clearErr(f) {
  const box = $(`[data-f="${f}"]`); if (!box) return;
  box.classList.remove("bad"); $(".err", box).textContent = "";
}
document.addEventListener("input", e => { const f = e.target.closest?.(".field"); if (f) clearErr(f.dataset.f); });

function validate(n) {
  let bad = [];
  const need = (id, msg) => { if (!$("#" + id).value.trim()) { setErr(id, msg); bad.push(id); return false; } return true; };

  if (n === 1) {
    need("leaderName", "Enter the team leader's name.");
    if (!selectedGames().length) { setErr("games", "Select at least one game."); bad.push("games"); }
    need("teamName", "Enter your team name.");
    if (!state.logo) { setErr("logo", "Please upload your team logo."); bad.push("logo"); }
    if (need("phone", "Enter the mobile number.") && !/^[6-9]\d{9}$/.test($("#phone").value)) { setErr("phone", "Enter a valid 10-digit mobile number."); bad.push("phone"); }
    if (need("email", "Enter the email address.") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("#email").value.trim())) { setErr("email", "Enter a valid email address."); bad.push("email"); }
  }
  if (n === 2) {
    const count = hasValorant() ? 5 : 4;
    for (let i = 1; i <= count; i++) { need("ign" + i, "Enter IGN / UID."); need("cid" + i, "Enter college ID."); }
    if (count) bad = $$("#members .field.bad").map(f => f.dataset.f);
  }
  if (n === 3) {
    selectedGames().forEach(g => {
      const v = (state.utr[g.key] || "").trim();
      if (!/^[A-Za-z0-9]{8,24}$/.test(v)) { setErr("utr-" + g.key, "Enter the UTR / Transaction ID (8–24 letters or digits)."); bad.push(g.key); }
    });
  }
  if (bad.length) { const first = $(".field.bad"); first?.scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
  return true;
}

/* ---------- Step 3: payment cards ---------- */
function renderPayments() {
  const games = selectedGames();
  $("#payCards").innerHTML = games.map(g => `
    <div class="pay">
      <div class="pay-head">${logoHTML(g)}<h3>${g.key}</h3><span class="amt">₹${g.fee}</span></div>
      <div class="qr"><img src="${g.qr}" alt="Payment QR for ${g.key} - ₹${g.fee}"></div>
      <a class="dl" href="${g.qr}" download="MHT-${g.short}-${g.fee}-QR.jpg">⬇ Download QR (to pay from the same phone)</a>
      <div class="field" data-f="utr-${g.key}">
        <label for="utr-${g.key}">UTR / Transaction ID for ${g.key}</label>
        <input id="utr-${g.key}" type="text" placeholder="e.g. 412345678901" value="${state.utr[g.key] || ""}" data-utr="${g.key}">
        <small class="err"></small>
      </div>
    </div>`).join("");
  $$("[data-utr]").forEach(i => i.addEventListener("input", () => state.utr[i.dataset.utr] = i.value));
  $("#totalAmt").textContent = "₹" + games.reduce((s, g) => s + g.fee, 0);
}

/* ---------- Navigation ---------- */
function show(n) {
  step = n;
  $$(".step").forEach(s => s.classList.toggle("active", +s.dataset.step === n));
  $$("#stepper li").forEach((li, i) => {
    li.classList.toggle("active", i + 1 === n);
    li.classList.toggle("done", i + 1 < n);
  });
  if (n === 3) renderPayments();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-next]").forEach(b => b.addEventListener("click", () => { if (validate(step)) show(step + 1); }));
$$("[data-back]").forEach(b => b.addEventListener("click", () => show(step - 1)));

/* ---------- Submit ---------- */
$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!validate(3)) return;
  const btn = $("#submitBtn"), err = $("#submitErr");
  btn.disabled = true; btn.textContent = "Submitting..."; err.textContent = "";

  const games = selectedGames();
  const count = hasValorant() ? 5 : 4;
  const members = [];
  for (let i = 1; i <= count; i++) members.push({ player: i, ign: $("#ign" + i).value.trim(), collegeId: $("#cid" + i).value.trim() });
  const total = games.reduce((s, g) => s + g.fee, 0);
  const regId = "MHTGN-" + Math.random().toString(36).slice(2, 8).toUpperCase();

  try {
    await addDoc(collection(db, "lanRegistrations"), {
      regId,
      leaderName: $("#leaderName").value.trim(),
      teamName: $("#teamName").value.trim(),
      teamLogo: state.logo,
      phone: $("#phone").value,
      email: $("#email").value.trim(),
      games: games.map(g => g.key),
      members,
      payments: games.map(g => ({ game: g.key, amount: g.fee, utr: state.utr[g.key].trim() })),
      totalAmount: total,
      paymentStatus: "pending",
      userUid: state.uid,
      createdAt: serverTimestamp()
    });
    $("#regForm").hidden = true; $("#stepper").hidden = true; $(".hero").hidden = true;
    $("#sId").textContent = regId;
    $("#sTeam").textContent = $("#teamName").value.trim();
    $("#sGames").textContent = games.map(g => g.key).join(", ");
    $("#sAmt").textContent = "₹" + total;
    $("#success").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    err.textContent = "❌ Could not save your registration: " + error.message;
    btn.disabled = false; btn.textContent = "Complete Registration";
  }
});

/* prefill email if the player is already signed in with Google */
onAuthStateChanged(auth, user => {
  if (!user) return;
  state.uid = user.uid;
  if (user.email && !$("#email").value) $("#email").value = user.email;
  if (user.displayName && !$("#leaderName").value) $("#leaderName").value = user.displayName;
});
