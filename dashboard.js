window.addEventListener("firebaseReady", function () {
  const playerDocId = localStorage.getItem("playerDocId");
  const output = document.getElementById("dashboardOutput");
  const offersList = document.getElementById("offersList");

  if (!playerDocId) {
    output.innerText = "❌ Please sign up first to see requests.";
    return;
  }

  const q = window.firestoreQuery(
    window.firestoreCollection(window.firestoreDB, "matchOffers"),
    window.firestoreWhere("playerId", "==", playerDocId),
    window.firestoreWhere("status", "==", "pending")
  );

  window.firestoreOnSnapshot(q, (snapshot) => {
    offersList.innerHTML = "";

    if (snapshot.empty) {
      output.innerText = "No pending requests right now.";
      return;
    }

    output.innerText = "";

    snapshot.forEach((docSnap) => {
      const offer = docSnap.data();
      const offerId = docSnap.id;

      const card = document.createElement("div");
      card.className = "offer-card";
      card.innerHTML = `
        <p><strong>${offer.game}</strong> — ${offer.role}</p>
        <p>₹${offer.price} · ${offer.matchDate} at ${offer.idpTime}</p>
        <p>Language: ${offer.language}</p>
        <button class="accept-btn" data-id="${offerId}">Accept</button>
        <button class="decline-btn" data-id="${offerId}">Decline</button>
      `;
      offersList.appendChild(card);
    });

      document.querySelectorAll(".accept-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        await window.firestoreUpdateDoc(
          window.firestoreDoc(window.firestoreDB, "matchOffers", btn.dataset.id),
          { status: "accepted" }
        );
        window.location.href = `chat.html?offerId=${btn.dataset.id}&role=player`;
      });
    });

    document.querySelectorAll(".decline-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        await window.firestoreUpdateDoc(
          window.firestoreDoc(window.firestoreDB, "matchOffers", btn.dataset.id),
          { status: "declined" }
        );
      });
    });
  });
});