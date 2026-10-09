window.addEventListener("firebaseReady", function () {
  const auth = window.firebaseAuth;

  document.getElementById("googleSignInBtn").addEventListener("click", function () {
    const provider = new window.GoogleAuthProvider();
    window.signInWithPopup(auth, provider)
      .then((result) => {
        currentUser = result.user;
        document.getElementById("output").innerText =
          "✅ Signed in as " + result.user.email;
        document.getElementById("signupForm").style.display = "block";
      })
      .catch((error) => {
        document.getElementById("output").innerText = "❌ " + error.message;
      });
  });
});

let currentUser = null;

document.getElementById("signupForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const game = document.getElementById("game").value;
  const age = document.getElementById("age").value;
  const experience = document.getElementById("experience").value;
  const uid = document.getElementById("uid").value;
  const language = document.getElementById("language").value;

    const preferredRole = document.getElementById("preferredRole").value;

  const userData = {
    email: currentUser ? currentUser.email : null,
    game,
    age,
    experience,
    uid,
    language,
    preferredRole,
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await window.firestoreAddDoc(
      window.firestoreCollection(window.firestoreDB, "players"),
      userData
    );
    localStorage.setItem("playerDocId", docRef.id);
    console.log("Saved to Firestore:", userData);

    // Hide the form and show the success animation
    document.querySelector(".container").style.display = "none";
    document.getElementById("successOverlay").style.display = "flex";
  } catch (error) {
    document.getElementById("output").innerText = "❌ Error saving: " + error.message;
  }
});
document.getElementById("goToHireBtn").addEventListener("click", function () {
  window.location.href = "hire.html";
});

document.getElementById("stayAsPlayerBtn").addEventListener("click", function () {
  document.getElementById("successOverlay").style.display = "none";
  document.getElementById("availabilityScreen").style.display = "block";
});

// Populate price dropdown ₹20–100 in steps of ₹5
const minPriceSelect = document.getElementById("minHireAmount");
for (let p = 20; p <= 100; p += 5) {
  const option = document.createElement("option");
  option.value = p;
  option.textContent = "₹" + p;
  minPriceSelect.appendChild(option);
}

// Track which clip slots have a valid (≥15s) video
const validClips = { clip1: false, clip2: false, clip3: false };

function checkClipDuration(inputId, statusId) {
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  input.addEventListener("change", function () {
    const file = input.files[0];
    if (!file) {
      validClips[inputId] = false;
      status.innerText = "";
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = function () {
      window.URL.revokeObjectURL(video.src);
      if (video.duration >= 15) {
        validClips[inputId] = true;
        status.innerText = "✅ Valid (" + Math.round(video.duration) + "s)";
        status.className = "clip-status clip-valid";
      } else {
        validClips[inputId] = false;
        status.innerText = "❌ Too short (" + Math.round(video.duration) + "s) — needs 15s+";
        status.className = "clip-status clip-invalid";
      }
    };
    video.src = URL.createObjectURL(file);
  });
}

checkClipDuration("clip1", "clip1Status");
checkClipDuration("clip2", "clip2Status");
checkClipDuration("clip3", "clip3Status");

document.getElementById("submitAvailabilityBtn").addEventListener("click", async function () {
  const minAmount = document.getElementById("minHireAmount").value;
  const output = document.getElementById("availabilityOutput");

  if (!minAmount) {
    output.innerText = "❌ Please select your minimum hiring amount.";
    return;
  }

  const hasValidClip = validClips.clip1 || validClips.clip2 || validClips.clip3;
  if (!hasValidClip) {
    output.innerText = "❌ Please upload at least 1 clip of at least 15 seconds.";
    return;
  }

  const playerDocId = localStorage.getItem("playerDocId");
  if (!playerDocId) {
    output.innerText = "❌ Could not find your profile. Please sign up again.";
    return;
  }

  try {
    await window.firestoreUpdateDoc(
      window.firestoreDoc(window.firestoreDB, "players", playerDocId),
      { minHireAmount: Number(minAmount), availableForHire: true }
    );
    output.innerText = "✅ You're now listed and ready to get hired!";
    document.getElementById("viewRequestsLink").style.display = "block";
  } catch (error) {
    output.innerText = "❌ Error saving: " + error.message;
  }
});