const firebaseConfig = {
  apiKey: "AIzaSyAWHOjEiQ3_BOALQokf9KSWkzariT0WARs",
  authDomain: "my-room-match.firebaseapp.com",
  projectId: "my-room-match",
  storageBucket: "my-room-match.firebasestorage.app",
  messagingSenderId: "29511216593",
  appId: "1:29511216593:web:56d143598fb32aab8944f0",
  measurementId: "G-PV616XMSRT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user; // Store current user globally
    const userRef = db.collection("users").doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    const surveyDoc = await db.collection("surveyAnswers").doc(user.uid).get();
    const surveyData = surveyDoc.exists ? surveyDoc.data() : null;
    
    if (surveyData) {
      fetchAIMatch(user.uid, surveyData);
    }

    const userCity = userData.city ? userData.city.toLowerCase() : null;

    // Set user display info
    if (userDoc.exists) {
      document.getElementById("userName").textContent = userData.name || "User";
      document.getElementById("userPhoto").src = userData.photoURL || "./assets/default-user.png";
    } else {
      document.getElementById("userName").textContent = user.displayName || "User";
      document.getElementById("userPhoto").src = user.photoURL || "./assets/default-user.png";
    }

    // Load room data
    if (userCity) {
      loadCityBasedRooms(userCity);
    }
  }
});

async function loadCityBasedRooms(userCity) {
  const roomStatusDiv = document.getElementById('roomStatus');
  roomStatusDiv.innerHTML = '';

  const allRoomsSnapshot = await db.collection('availableRooms').get();

  const roomGroups = {
    single: [],
    twin: [],
    triple: []
  };

  allRoomsSnapshot.forEach(doc => {
    const room = doc.data();
    const location = (room.location || '').toLowerCase();
    const type = (room.type || '').toLowerCase();
    const status = (room.status || '').toLowerCase();

    if (
      status === "available" &&
      location.includes(userCity) &&
      roomGroups[type]
    ) {
      roomGroups[type].push({ id: doc.id, ...room });
    }
  });

  for (const type of ['single', 'twin', 'triple']) {
    const rooms = roomGroups[type];
    if (rooms.length === 0) continue;

    // Create section container
    const sectionContainer = document.createElement('div');
    sectionContainer.classList.add('sharing-section');

    // Heading with count
    const sectionHeader = document.createElement('h2');
    sectionHeader.innerHTML = `${capitalize(type)} Sharing Available: ${rooms.length}`;
    sectionHeader.style.marginBottom = '12px';
    sectionContainer.appendChild(sectionHeader);

    // Cards row
    const row = document.createElement('div');
    row.classList.add('room-grid');

    rooms.forEach(room => {
      const card = document.createElement('div');
      card.className = 'room-card';

      card.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="radio" name="selectedRoom" value="${room.id}" data-price="${room.price}">
        </div>
        <img src="${room.photo || './assets/default-room.jpg'}" alt="Room Image">
        <label><strong>Room ID:</strong> ${room.id}</label>
        <label><strong>Location:</strong> ${room.location}</label>
        <label><strong>Floor:</strong> ${room.floor}</label>
        <label><strong>Price:</strong> ₹${room.price}</label>
        <label><strong>Type:</strong> ${room.type}</label>
      `;

      row.appendChild(card);
    });

    sectionContainer.appendChild(row);
    roomStatusDiv.appendChild(sectionContainer);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Global variables for selection tracking
let selectedRoommates = new Set();
let maxRoommates = 0;

function updateTotalFromSelections() {
  const selectedRadio = document.querySelector('input[name="selectedRoom"]:checked');
  
  if (!selectedRadio) {
    // No room selected — reset all
    document.getElementById("basePrice").innerText = 0;
    document.getElementById("gstAmount").innerText = 0;
    document.getElementById("platformFee").innerText = 0;
    document.getElementById("totalPrice").innerText = 0;
    return;
  }

  const price = parseInt(selectedRadio.dataset.price || "0");
  const gst = Math.round(price * 0.18);
  const platformFee = price > 0 ? 100 : 0;
  const total = price + gst + platformFee;

  document.getElementById("basePrice").innerText = price;
  document.getElementById("gstAmount").innerText = gst;
  document.getElementById("platformFee").innerText = platformFee;
  document.getElementById("totalPrice").innerText = total;

  // Highlight the selected room card
  document.querySelectorAll(".room-card").forEach(card => {
    card.classList.remove("selected-room");
  });

  const selectedCard = selectedRadio.closest(".room-card");
  if (selectedCard) {
    selectedCard.classList.add("selected-room");
  }
}

// Event listeners for room selection
document.addEventListener("change", function(event) {
  if (event.target.name === "selectedRoom") {
    updateTotalFromSelections();
  }
  
  // Handle roommate selection
  if (event.target.classList.contains("match-checkbox")) {
    const roommateId = event.target.value;
    
    if (event.target.checked) {
      if (selectedRoommates.size < maxRoommates) {
        selectedRoommates.add(roommateId);
      } else {
        event.target.checked = false;
        alert(`You can only select up to ${maxRoommates} roommate(s) for this room type.`);
      }
    } else {
      selectedRoommates.delete(roommateId);
    }
    
    // Update visual feedback
    updateRoommateSelection();
  }
});

function updateRoommateSelection() {
  document.querySelectorAll(".match-card").forEach(card => {
    const checkbox = card.querySelector(".match-checkbox");
    if (checkbox && selectedRoommates.has(checkbox.value)) {
      card.classList.add("selected-match");
    } else {
      card.classList.remove("selected-match");
    }
  });
}

async function fetchAIMatch(uid, surveyData) {
  try {
    console.log("🔹 Fetching AI match for:", uid);
    
    const response = await fetch("https://advanced-grub-square.ngrok-free.app/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({
        uid: uid,
        survey: surveyData
      })
    });

    if (!response.ok) {
      throw new Error(`AI Match Failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("🔸 AI Match Result:", result);

    displayMatches(result.bestMatch, result.otherMatches, result.recommendedRoom, surveyData.roomType);
  } catch (err) {
    console.error("AI Matching Error:", err);
    // Show fallback content
    displayMatches(null, [], null, surveyData?.roomType || 'single');
  }
}

async function displayMatches(bestMatch, otherMatches = [], recommendedRoom, roomType) {
  const bestMatchDiv = document.getElementById("bestMatchContainer");
  const otherMatchDiv = document.getElementById("otherMatchesContainer");
  const recommendedRoomDiv = document.getElementById("recommendedRoomContainer");

  // Set max roommates based on room type
  if (roomType === "twin") {
    maxRoommates = 1;
  } else if (roomType === "triple") {
    maxRoommates = 2;
  } else {
    maxRoommates = 0; // single room
  }

  // Handle best match
  if (!bestMatch || bestMatch.uid === "none") {
    bestMatch = {
      uid: "none",
      name: "No Match Found",
      profession: "N/A",
      reason: "We couldn't find a close match for your preferences.",
      score: 0
    };
  }

  // Fetch name & photoURL from Firestore if available
  let displayName = bestMatch.name || "Unknown";
  let photoURL = "./assets/default-user.png";

  if (bestMatch.uid && bestMatch.uid !== "none") {
    try {
      const bestDoc = await db.collection("users").doc(bestMatch.uid).get();
      if (bestDoc.exists) {
        const bestData = bestDoc.data();
        displayName = bestData.name || displayName;
        photoURL = bestData.photoURL || photoURL;
      }
    } catch (e) {
      console.error("⚠️ Error fetching best match user data:", e);
    }
  }

  bestMatchDiv.innerHTML = `
    <div class="match-card">
      <img src="${photoURL}" alt="User Photo" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Profession:</strong> ${bestMatch.profession || "N/A"}</p>
      <p><strong>Reason:</strong> ${bestMatch.reason || "No specific reason"}</p>
      <p><strong>Score:</strong> ${bestMatch.score || 0}%</p>
      ${bestMatch.uid !== "none" && maxRoommates > 0 ? 
        `<input type="checkbox" class="match-checkbox" value="${bestMatch.uid}">` : 
        ""
      }
    </div>
  `;

  // Render Other Matches
  if (otherMatches && otherMatches.length > 0) {
    otherMatchDiv.innerHTML = await Promise.all(
      otherMatches.map(async (match) => {
        let matchName = match.name || "Unknown";
        let matchPhoto = "./assets/default-user.png";
        
        if (match.uid) {
          try {
            const matchDoc = await db.collection("users").doc(match.uid).get();
            if (matchDoc.exists) {
              const matchData = matchDoc.data();
              matchName = matchData.name || matchName;
              matchPhoto = matchData.photoURL || matchPhoto;
            }
          } catch (e) {
            console.error("⚠️ Error fetching match user data:", e);
          }
        }

        return `
          <div class="match-card">
            <img src="${matchPhoto}" alt="User Photo" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;" />
            <p><strong>Name:</strong> ${matchName}</p>
            <p><strong>Profession:</strong> ${match.profession || "N/A"}</p>
            <p><strong>Reason:</strong> ${match.reason || "No specific reason"}</p>
            <p><strong>Score:</strong> ${match.score || 0}%</p>
            ${match.uid && maxRoommates > 0 ? 
              `<input type="checkbox" class="match-checkbox" value="${match.uid}">` : 
              ""
            }
          </div>
        `;
      })
    ).then(results => results.join(""));
  } else {
    otherMatchDiv.innerHTML = '<p>No other matches found.</p>';
  }

  // Render Recommended Room
  if (recommendedRoom && recommendedRoomDiv) {
    recommendedRoomDiv.innerHTML = `
      <div class="room-card recommended-room">
        <img src="${recommendedRoom.photo || './assets/default-room.jpg'}" alt="Room Image">
        <label><strong>Room ID:</strong> ${recommendedRoom.roomId || recommendedRoom.id}</label>
        <label><strong>Location:</strong> ${recommendedRoom.location}</label>
        <label><strong>Floor:</strong> ${recommendedRoom.floor || "N/A"}</label>
        <label><strong>Price:</strong> ₹${recommendedRoom.price}</label>
        <label><strong>Type:</strong> ${recommendedRoom.type}</label>
        <div class="checkbox-wrapper">
          <input type="radio" name="selectedRoom" value="${recommendedRoom.roomId || recommendedRoom.id}" data-price="${recommendedRoom.price}">
        </div>
      </div>
    `;
  }
}

// Form submission handler
document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("roomSelectionForm");
  if (form) {
    form.addEventListener("submit", function(event) {
      event.preventDefault();
      
      const selectedRoom = document.querySelector('input[name="selectedRoom"]:checked');
      
      if (!selectedRoom) {
        alert("Please select a room first!");
        return;
      }
      
      // For twin/triple rooms, check if roommates are selected
      if (maxRoommates > 0 && selectedRoommates.size === 0) {
        const confirmWithoutRoommates = confirm(
          `You haven't selected any roommates for this ${maxRoommates === 1 ? 'twin' : 'triple'} room. Do you want to continue anyway?`
        );
        if (!confirmWithoutRoommates) {
          return;
        }
      }
      
      // Store selection data for confirmation page
      const selectionData = {
        roomId: selectedRoom.value,
        roomPrice: selectedRoom.dataset.price,
        roommates: Array.from(selectedRoommates),
        totalPrice: document.getElementById("totalPrice").innerText,
        basePrice: document.getElementById("basePrice").innerText,
        gstAmount: document.getElementById("gstAmount").innerText,
        platformFee: document.getElementById("platformFee").innerText
      };
      
      // Store in session storage (temporary storage for this session)
      sessionStorage.setItem("roomSelection", JSON.stringify(selectionData));
      
      // Redirect to confirmation page
      window.location.href = "confirmation.html";
    });
  }
});