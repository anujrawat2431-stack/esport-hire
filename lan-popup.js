/* MHTxGNIOT LAN popup: shows after the player finishes sign-up on index.html */
(function () {
  var LAN_URL = "lan.html";

  // load the same clean fonts as the registration page
  var f = document.createElement("link");
  f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Rajdhani:wght@600;700&display=swap";
  document.head.appendChild(f);

  function gameLogo(src, label, short) {
    return '<img src="' + src + '" alt="' + label + '" onerror="this.outerHTML=\'<div class=lan-fb>' + short + '</div>\'">';
  }

  // 1) Build the popup
  var popup = document.createElement("div");
  popup.id = "lanPopup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-modal", "true");
  popup.innerHTML =
    '<div class="lan-card">' +
      '<button type="button" class="lan-close" aria-label="Close">✕</button>' +
      '<div class="lan-logos">' +
        '<img src="lan-assets/maharathi.png" alt="Maharathi Esports"><span>×</span>' +
        '<img src="lan-assets/gniot.png" alt="GNIOT">' +
      '</div>' +
      '<span class="lan-tag">LAN TOURNAMENT</span>' +
      '<h2>MHT<span style="color:#f08a24;text-transform:lowercase">x</span>GNIOT <em>LAN</em></h2>' +
      '<p>Registrations are open! Grab your squad and lock your slot for the biggest LAN battle.</p>' +
      '<div class="lan-games">' +
        '<div>' + gameLogo("lan-assets/bgmi.png", "BGMI", "BGMI") + '<b>BGMI</b><small>₹125</small></div>' +
        '<div>' + gameLogo("lan-assets/freefire.png", "Free Fire Max", "FF") + '<b>Free Fire</b><small>₹100</small></div>' +
        '<div>' + gameLogo("lan-assets/valorant.jpg", "Valorant", "VAL") + '<b>Valorant</b><small>₹150</small></div>' +
      '</div>' +
      '<a class="lan-cta" href="' + LAN_URL + '">Register Now →</a>' +
      '<button type="button" class="lan-later">Maybe later</button>' +
    '</div>';
  document.body.appendChild(popup);

  // 2) Floating button (stays on screen so they can come back)
  var fab = document.createElement("a");
  fab.id = "lanFab";
  fab.href = LAN_URL;
  fab.innerHTML = "🏆 LAN Registration";
  document.body.appendChild(fab);

  function open() { popup.classList.add("open"); }
  function close() { popup.classList.remove("open"); fab.classList.add("show"); }

  popup.querySelector(".lan-close").addEventListener("click", close);
  popup.querySelector(".lan-later").addEventListener("click", close);
  popup.addEventListener("click", function (e) { if (e.target === popup) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  // 3) Wait for the "You're signed up!" screen, then show popup + banner button
  var overlay = document.getElementById("successOverlay");
  if (!overlay) return;
  var done = false;

  function onSignedUp() {
    if (done) return;
    done = true;
    var nav = overlay.querySelector(".nav-choice");
    if (nav) {
      var a = document.createElement("a");
      a.className = "lan-banner";
      a.href = LAN_URL;
      a.innerHTML = "🏆 Register for MHTxGNIOT LAN";
      nav.appendChild(a);
    }
    fab.classList.add("show");
    setTimeout(open, 2200); // let the checkmark animation finish first
  }

  new MutationObserver(function () {
    if (overlay.style.display && overlay.style.display !== "none") onSignedUp();
  }).observe(overlay, { attributes: true, attributeFilter: ["style"] });
})();
