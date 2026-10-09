window.addEventListener("firebaseReady", function () {
  const params = new URLSearchParams(window.location.search);
  const offerId = params.get("offerId");
  const role = params.get("role"); // "admin" or "player"

  const chatOutput = document.getElementById("chatOutput");
  const chatSubtitle = document.getElementById("chatSubtitle");

  if (!offerId || !role) {
    chatOutput.innerText = "❌ Missing chat information. Please return to your dashboard.";
    document.getElementById("chatForm").style.display = "none";
    return;
  }

  chatSubtitle.innerText = role === "admin"
    ? "Chatting with your hired player"
    : "Chatting with the team admin";

  const messagesDiv = document.getElementById("chatMessages");
  const messagesRef = window.firestoreCollection(
    window.firestoreDB, "chats", offerId, "messages"
  );
  const q = window.firestoreQuery(messagesRef, window.firestoreOrderBy("createdAt", "asc"));

  window.firestoreOnSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (msg.sender === role ? "chat-mine" : "chat-theirs");
      bubble.innerText = msg.text;
      messagesDiv.appendChild(bubble);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });

  document.getElementById("chatForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    try {
      await window.firestoreAddDoc(messagesRef, {
        text,
        sender: role,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      chatOutput.innerText = "❌ Error sending message: " + error.message;
    }
  });
});