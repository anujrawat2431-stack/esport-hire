// ===== Price dropdown =====
const priceSelect = document.getElementById("price");
for (let p = 20; p <= 100; p += 5) {
  const option = document.createElement("option");
  option.value = p;
  option.textContent = "₹" + p;
  priceSelect.appendChild(option);
}

// ===== Squad size rules per game =====
const squadCounts = {
  "BGMI": 3,
  "Free Fire Max": 3,
  "Valorant": 4
};

let currentMode = "single"; // or "squad"

const playerCountInput = document.getElementById("playerCount");
const gameSelect = document.getElementById("hireGame");
const squadCountHint = document.getElementById("squadCountHint");
const hireTitle = document.getElementById("hireTitle");
const hireTagline = document.getElementById("hireTagline");
const singleModeBtn = document.getElementById("singleModeBtn");
const squadModeBtn = document.getElementById("squadModeBtn");

function updateSquadCount() {
  if (currentMode === "squad" && gameSelect.value) {
    const maxCount = squadCounts[gameSelect.value];
    playerCountInput.readOnly = false;
    playerCountInput.min = 2;
    playerCountInput.max = maxCount;
    playerCountInput.value = maxCount;
    squadCountHint.innerText = `Choose 2 to ${maxCount} players for ${gameSelect.value}`;
  } else if (currentMode === "single") {
    playerCountInput.readOnly = true;
    playerCountInput.value = 1;
  }
}

singleModeBtn.addEventListener("click", function () {
  currentMode = "single";
  singleModeBtn.classList.add("active");
  squadModeBtn.classList.remove("active");
  squadCountHint.style.display = "none";
  hireTitle.innerText = "Need a Player";
  hireTagline.innerText = "Fill in your match details";
  updateSquadCount();
});

squadModeBtn.addEventListener("click", function () {
  currentMode = "squad";
  squadModeBtn.classList.add("active");
  singleModeBtn.classList.remove("active");
  squadCountHint.style.display = "block";
  hireTitle.innerText = "Hire Players";
  hireTagline.innerText = "Choose how many players you need for your squad";
  updateSquadCount();
});

gameSelect.addEventListener("change", updateSquadCount);

// ===== Main submit handler =====
document.getElementById("hireForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const game = document.getElementById("hireGame").value;
  const playerCount = document.getElementById("playerCount").value;
  const role = document.getElementById("role").value;
  const hireLanguage = document.getElementById("hireLanguage").value;
  const price = document.getElementById("price").value;
  const matchDate = document.getElementById("matchDate").value;
  const idpTime = document.getElementById("idpTime").value;
  const totalPrice = price * playerCount;

  if (currentMode === "squad") {
    const maxCount = squadCounts[game];
    if (playerCount < 2 || playerCount > maxCount) {
      document.getElementById("hireOutput").innerText =
        `❌ Please choose between 2 and ${maxCount} players for ${game}.`;
      return;
    }
  }

  const requestData = {
    game, playerCount: Number(playerCount), role, language: hireLanguage,
    pricePerPlayer: Number(price), totalPrice: Number(totalPrice),
    matchDate, idpTime,
    hireMode: currentMode,
    status: "searching",
    createdAt: new Date().toISOString()
  };

  let hireRequestRef;
  try {
    hireRequestRef = await window.firestoreAddDoc(
      window.firestoreCollection(window.firestoreDB, "hireRequests"),
      requestData
    );
  } catch (error) {
    document.getElementById("hireOutput").innerText = "❌ Error saving: " + error.message;
    return;
  }

  document.querySelector(".container").style.display = "none";
  document.getElementById("matchmakingOverlay").style.display = "flex";
  const subtext = document.getElementById("matchmakingSubtext");
  subtext.innerText = "🔎 Searching for suitable player(s)...";

  // ===== Find matching candidates (up to playerCount) =====
  const q = window.firestoreQuery(
    window.firestoreCollection(window.firestoreDB, "players"),
    window.firestoreWhere("game", "==", game),
    window.firestoreWhere("availableForHire", "==", true)
  );
  const snapshot = await window.firestoreGetDocs(q);

  const roleWanted = role.toLowerCase();
  const languageWanted = hireLanguage.toLowerCase();
  const neededCount = Number(playerCount);
  const matchedPlayers = [];

  snapshot.forEach((docSnap) => {
    if (matchedPlayers.length >= neededCount) return;
    const player = docSnap.data();
    const roleMatches = !roleWanted || (player.preferredRole && player.preferredRole.toLowerCase().includes(roleWanted));
    const languageMatches = !languageWanted || (player.language && player.language.toLowerCase() === languageWanted);
    const priceMatches = player.minHireAmount && Number(price) >= player.minHireAmount;

    if (roleMatches && languageMatches && priceMatches) {
      matchedPlayers.push({ id: docSnap.id });
    }
  });

  // ===== No matches at all =====
  if (matchedPlayers.length === 0) {
    document.getElementById("matchmakingSpinner").style.display = "none";
    document.getElementById("matchmakingTitle").innerText = "❌ Refund Issued";
    subtext.innerText = "No matching player was available. ₹" + totalPrice + " will be refunded to you.";
    await window.firestoreUpdateDoc(
      window.firestoreDoc(window.firestoreDB, "hireRequests", hireRequestRef.id),
      { status: "no_player_found" }
    );
    await window.firestoreAddDoc(
      window.firestoreCollection(window.firestoreDB, "refunds"),
      {
        hireRequestId: hireRequestRef.id,
        amount: Number(totalPrice),
        reason: "no_player_found",
        status: "pending",
        createdAt: new Date().toISOString()
      }
    );
    return;
  }

  // ===== Create one offer per matched player =====
  const offerRefs = [];
  for (const player of matchedPlayers) {
    const ref = await window.firestoreAddDoc(
      window.firestoreCollection(window.firestoreDB, "matchOffers"),
      {
        hireRequestId: hireRequestRef.id,
        playerId: player.id,
        game, role, language: hireLanguage,
        price: Number(price), matchDate, idpTime,
        status: "pending",
        createdAt: new Date().toISOString()
      }
    );
    offerRefs.push(ref);
  }

  const totalSlots = matchedPlayers.length;
  let secondsLeft = currentMode === "squad" ? 150 : 120;

  const offerStatuses = {};
  offerRefs.forEach((ref) => { offerStatuses[ref.id] = "pending"; });

  let finished = false;

  // Live-update as each offer's status changes
  offerRefs.forEach((ref) => {
    window.firestoreOnSnapshot(ref, (docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      offerStatuses[ref.id] = data.status;

      const statuses = Object.values(offerStatuses);
      const stillPending = statuses.filter(s => s === "pending").length;

      if (stillPending === 0 && !finished) {
        finished = true;
        clearInterval(countdown);
        finishMatching();
      }
    });
  });

  async function finishMatching() {
    const acceptedOfferIds = Object.entries(offerStatuses)
      .filter(([id, s]) => s === "accepted")
      .map(([id]) => id);

    const acceptedCount = acceptedOfferIds.length;
    const unfilledCount = totalSlots - acceptedCount;

    document.getElementById("matchmakingSpinner").style.display = "none";

    if (acceptedCount === 0) {
      document.getElementById("matchmakingTitle").innerText = "❌ Refund Issued";
      subtext.innerText = "No players accepted. ₹" + totalPrice + " will be refunded to you.";
      await window.firestoreAddDoc(
        window.firestoreCollection(window.firestoreDB, "refunds"),
        {
          hireRequestId: hireRequestRef.id,
          amount: Number(totalPrice),
          reason: "no_response_in_time",
          status: "pending",
          createdAt: new Date().toISOString()
        }
      );
      await window.firestoreUpdateDoc(
        window.firestoreDoc(window.firestoreDB, "hireRequests", hireRequestRef.id),
        { status: "no_player_found" }
      );
      return;
    }

    if (unfilledCount > 0) {
      const refundAmount = unfilledCount * Number(price);
      await window.firestoreAddDoc(
        window.firestoreCollection(window.firestoreDB, "refunds"),
        {
          hireRequestId: hireRequestRef.id,
          amount: refundAmount,
          reason: "partial_squad_unfilled",
          unfilledSlots: unfilledCount,
          status: "pending",
          createdAt: new Date().toISOString()
        }
      );
      document.getElementById("matchmakingTitle").innerText = "✅ Partial Squad Confirmed";
      subtext.innerText = `${acceptedCount} of ${totalSlots} players confirmed. ₹${refundAmount} refunded for ${unfilledCount} unfilled slot(s). Redirecting to chat...`;
    } else {
      document.getElementById("matchmakingTitle").innerText = "✅ Squad Confirmed!";
      subtext.innerText = "All players confirmed! Redirecting to chat...";
    }

    await window.firestoreUpdateDoc(
      window.firestoreDoc(window.firestoreDB, "hireRequests", hireRequestRef.id),
      { status: "confirmed", acceptedCount, unfilledCount }
    );

    setTimeout(() => {
      window.location.href = `chat-list.html?hireRequestId=${hireRequestRef.id}&role=admin`;
    }, 2000);
  }

  // Countdown ticker
  const countdown = setInterval(async () => {
    secondsLeft--;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;

    const statuses = Object.values(offerStatuses);
    const accepted = statuses.filter(s => s === "accepted").length;
    const declined = statuses.filter(s => s === "declined").length;
    const stillPending = statuses.filter(s => s === "pending").length;

    subtext.innerText = `📲 ${accepted} accepted, ${declined} declined, ${stillPending} waiting... ${mins}:${secs.toString().padStart(2, "0")}`;

    if (secondsLeft <= 0 && !finished) {
      finished = true;
      clearInterval(countdown);

      for (const [offerId, status] of Object.entries(offerStatuses)) {
        if (status === "pending") {
          await window.firestoreUpdateDoc(
            window.firestoreDoc(window.firestoreDB, "matchOffers", offerId),
            { status: "expired" }
          );
          offerStatuses[offerId] = "expired";
        }
      }
      finishMatching();
    }
  }, 1000);
});