window.addEventListener("firebaseReady", async function () {
  const params = new URLSearchParams(window.location.search);
  const hireRequestId = params.get("hireRequestId");

  const listDiv = document.getElementById("playerList");
  const output = document.getElementById("chatListOutput");

  if (!hireRequestId) {
    output.innerText = "❌ Missing request information.";
    return;
  }

  try {
    const q = window.firestoreQuery(
      window.firestoreCollection(window.firestoreDB, "matchOffers"),
      window.firestoreWhere("hireRequestId", "==", hireRequestId),
      window.firestoreWhere("status", "==", "accepted")
    );
    const snapshot = await window.firestoreGetDocs(q);

    if (snapshot.empty) {
      output.innerText = "No confirmed players found for this request.";
      return;
    }

    output.innerText = "";
    let playerNumber = 1;

    for (const offerDoc of snapshot.docs) {
      const offer = offerDoc.data();
      const offerId = offerDoc.id;

      // Look up the player's in-game UID as their display name
      let displayName = "Unknown Player";
      try {
        const playerSnap = await window.firestoreGetDoc(
          window.firestoreDoc(window.firestoreDB, "players", offer.playerId)
        );
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
          displayName = playerData.uid || "Unknown Player";
        }
      } catch (err) {
        console.error("Error fetching player:", err);
      }

      const card = document.createElement("a");
      card.href = `chat.html?offerId=${offerId}&role=admin`;
      card.className = "offer-card player-chat-link";
      card.innerHTML = `
        <p><strong>${displayName}</strong> (PLAYER ${playerNumber})</p>
        <p>${offer.game} — ${offer.role}</p>
      `;
      listDiv.appendChild(card);
      playerNumber++;
    }
  } catch (error) {
    output.innerText = "❌ Error loading players: " + error.message;
  }
});