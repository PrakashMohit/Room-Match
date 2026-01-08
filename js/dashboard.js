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
    currentUser = user;
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

    const sectionContainer = document.createElement('div');
    sectionContainer.classList.add('sharing-section');

    const sectionHeader = document.createElement('h2');
    sectionHeader.innerHTML = `${capitalize(type)} Sharing Available: ${rooms.length}`;
    sectionHeader.style.marginBottom = '12px';
    sectionContainer.appendChild(sectionHeader);

    const row = document.createElement('div');
    row.classList.add('room-grid');

    rooms.forEach(room => {
      const card = document.createElement('div');
      card.className = 'room-card standard-room-card'; // Added consistent class

      card.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="radio" name="selectedRoom" value="${room.id}" data-price="${room.price}">
        </div>
        <img src="${room.photo || './assets/default-room.jpg'}" alt="Room Image">
        <div class="room-details">
          <label><strong>Room ID:</strong> ${room.id}</label>
          <label><strong>Location:</strong> ${room.location}</label>
          <label><strong>Floor:</strong> ${room.floor}</label>
          <label><strong>Price:</strong> ₹${room.price}</label>
          <label><strong>Type:</strong> ${room.type}</label>
        </div>
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
});

function updateRoommateSelection() {
  // Update visual feedback for selected roommates
  document.querySelectorAll(".match-card").forEach(card => {
    const checkbox = card.querySelector(".match-checkbox");
    if (checkbox && selectedRoommates.has(checkbox.value)) {
      card.classList.add("selected-match");
    } else {
      card.classList.remove("selected-match");
    }
  });
  
  // Update selection counter
  updateSelectionCounter();
}

function updateSelectionCounter() {
  let counterDiv = document.getElementById("selectionCounter");
  
  if (!counterDiv) {
    counterDiv = document.createElement("div");
    counterDiv.id = "selectionCounter";
    counterDiv.className = "selection-counter";
    
    const bestMatchSection = document.querySelector(".section-card h1");
    if (bestMatchSection && bestMatchSection.textContent.includes("Best Match")) {
      bestMatchSection.parentNode.insertBefore(counterDiv, bestMatchSection.nextSibling);
    }
  }
  
  if (maxRoommates > 0) {
    counterDiv.innerHTML = `
      <div class="counter-info">
        <span class="counter-text">Selected Roommates: ${selectedRoommates.size}/${maxRoommates}</span>
        ${selectedRoommates.size > 0 ? 
          `<button type="button" class="clear-selection-btn" onclick="clearRoommateSelection()">Clear All</button>` : 
          ''
        }
      </div>
    `;
    counterDiv.style.display = 'block';
  } else {
    counterDiv.style.display = 'none';
  }
}

function clearRoommateSelection() {
  selectedRoommates.clear();
  
  document.querySelectorAll(".match-checkbox").forEach(checkbox => {
    checkbox.checked = false;
  });
  
  updateRoommateSelection();
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
    displayMatches(null, [], null, surveyData?.roomType || 'single');
  }
}

async function displayMatches(bestMatch, otherMatches = [], recommendedRoom, roomType) {
  const bestMatchDiv = document.getElementById("bestMatchContainer");
  const otherMatchDiv = document.getElementById("otherMatchesContainer");
  const recommendedRoomDiv = document.getElementById("recommendedRoomContainer");

  // DEBUG: Let's see what roomType we're getting
  console.log("🔸 Raw roomType received:", roomType);
  console.log("🔸 roomType type:", typeof roomType);

  // Set max roommates based on room type
  if (roomType === "twin") {
    maxRoommates = 1;
  } else if (roomType === "triple") {
    maxRoommates = 2;
  } else {
    maxRoommates = 0; // single room
  }

  console.log("🔸 Room Type:", roomType, "Max Roommates:", maxRoommates);
  
  // FORCE TESTING: Temporarily set maxRoommates to 2 for testing
  if (maxRoommates === 0) {
    console.log("🔸 WARNING: maxRoommates is 0. For testing, setting to 2");
    maxRoommates = 2; // Force enable checkboxes for testing
  }

  // Clear previous selections when new matches are loaded
  selectedRoommates.clear();

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

  // Create best match card
  bestMatchDiv.innerHTML = '';
  
  // ALWAYS show checkboxes for testing - remove the maxRoommates > 0 condition temporarily
  if (bestMatch.uid !== "none") {
    // Show selectable best match
    const bestMatchCard = document.createElement('div');
    bestMatchCard.className = 'match-card';
    bestMatchCard.setAttribute('data-user-id', bestMatch.uid);
    
    bestMatchCard.innerHTML = `
      <img src="${photoURL}" alt="User Photo" />
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Profession:</strong> ${bestMatch.profession || "N/A"}</p>
      <p><strong>Reason:</strong> ${bestMatch.reason || "No specific reason"}</p>
      <p><strong>Score:</strong> ${bestMatch.score || 0}%</p>
      <div class="selection-controls">
        <input type="checkbox" class="match-checkbox" value="${bestMatch.uid}" id="match-${bestMatch.uid}">
        <label for="match-${bestMatch.uid}"> Select as Roommate</label>
      </div>
      <p><em>Room Type: ${roomType} | Max: ${maxRoommates}</em></p>
    `;
    
    console.log("🔸 Created best match card with checkbox for:", bestMatch.uid);
    bestMatchDiv.appendChild(bestMatchCard);
  } else {
    // Show non-selectable match or no match
    const bestMatchCard = document.createElement('div');
    bestMatchCard.className = 'match-card';
    
    bestMatchCard.innerHTML = `
      <img src="${photoURL}" alt="User Photo" />
      <p><strong>Name:</strong> ${displayName}</p>
      <p><strong>Profession:</strong> ${bestMatch.profession || "N/A"}</p>
      <p><strong>Reason:</strong> ${bestMatch.reason || "No specific reason"}</p>
      <p><strong>Score:</strong> ${bestMatch.score || 0}%</p>
      ${maxRoommates === 0 ? '<p><em>Single room - No roommates needed</em></p>' : '<p><em>No valid match found</em></p>'}
    `;
    
    bestMatchDiv.appendChild(bestMatchCard);
  }

  // Render Other Matches
  otherMatchDiv.innerHTML = '';
  
  if (otherMatches && otherMatches.length > 0) {
    for (const match of otherMatches) {
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

      const matchCard = document.createElement('div');
      matchCard.className = 'match-card';
      matchCard.setAttribute('data-user-id', match.uid);
      
      // ALWAYS show checkboxes for testing - remove the maxRoommates > 0 condition temporarily
      if (match.uid) {
        // Selectable match
        matchCard.innerHTML = `
          <img src="${matchPhoto}" alt="User Photo" />
          <p><strong>Name:</strong> ${matchName}</p>
          <p><strong>Profession:</strong> ${match.profession || "N/A"}</p>
          <p><strong>Reason:</strong> ${match.reason || "No specific reason"}</p>
          <p><strong>Score:</strong> ${match.score || 0}%</p>
          <div class="selection-controls">
            <input type="checkbox" class="match-checkbox" value="${match.uid}" id="match-${match.uid}">
            <label for="match-${match.uid}"> Select as Roommate</label>
          </div>
          <p><em>Room Type: ${roomType} | Max: ${maxRoommates}</em></p>
        `;
        
        console.log("🔸 Created other match card with checkbox for:", match.uid);
      } else {
        // Non-selectable match
        matchCard.innerHTML = `
          <img src="${matchPhoto}" alt="User Photo" />
          <p><strong>Name:</strong> ${matchName}</p>
          <p><strong>Profession:</strong> ${match.profession || "N/A"}</p>
          <p><strong>Reason:</strong> ${match.reason || "No specific reason"}</p>
          <p><strong>Score:</strong> ${match.score || 0}%</p>
          <p><em>Additional match for reference</em></p>
        `;
      }
      
      otherMatchDiv.appendChild(matchCard);
    }
  } else {
    const noMatchesMsg = document.createElement('p');
    noMatchesMsg.className = 'no-matches';
    noMatchesMsg.textContent = 'No other matches found at this time.';
    otherMatchDiv.appendChild(noMatchesMsg);
  }

  // Render Recommended Room
  if (recommendedRoom && recommendedRoomDiv) {
    const recommendedCard = document.createElement('div');
    recommendedCard.className = 'room-card recommended-room standard-room-card'; // Added consistent class
    
    recommendedCard.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="radio" name="selectedRoom" value="${recommendedRoom.roomId || recommendedRoom.id}" data-price="${recommendedRoom.price}">
      </div>
      <img src="${recommendedRoom.photo || './assets/default-room.jpg'}" alt="Room Image">
      <div class="room-details">
        <label><strong>Room ID:</strong> ${recommendedRoom.roomId || recommendedRoom.id}</label>
        <label><strong>Location:</strong> ${recommendedRoom.location}</label>
        <label><strong>Floor:</strong> ${recommendedRoom.floor || "N/A"}</label>
        <label><strong>Price:</strong> ₹${recommendedRoom.price}</label>
        <label><strong>Type:</strong> ${recommendedRoom.type}</label>
      </div>
    `;
    
    recommendedRoomDiv.innerHTML = '';
    recommendedRoomDiv.appendChild(recommendedCard);
  }

  // Update selection counter and attach event listeners
  updateSelectionCounter();
  
  // Attach event listeners immediately after DOM creation
  attachCheckboxListeners();
  
  console.log("🔸 Display Matches Complete - Found checkboxes:", document.querySelectorAll(".match-checkbox").length);
}

function attachCheckboxListeners() {
  const checkboxes = document.querySelectorAll(".match-checkbox");
  console.log("🔸 Attaching listeners to", checkboxes.length, "checkboxes");
  
  checkboxes.forEach((checkbox, index) => {
    console.log(`🔸 Checkbox ${index}: ID=${checkbox.id}, Value=${checkbox.value}`);
    
    // Remove existing listeners to prevent duplicates
    checkbox.removeEventListener("change", handleCheckboxChange);
    
    // Add new listener
    checkbox.addEventListener("change", handleCheckboxChange);
    
    // Also add click listener as backup
    checkbox.addEventListener("click", function(e) {
      console.log("🔸 Checkbox clicked:", e.target.value);
    });
  });
}

function handleCheckboxChange(event) {
  const roommateId = event.target.value;
  
  console.log("🔸 Checkbox changed:", roommateId, "checked:", event.target.checked);
  console.log("🔸 Max roommates:", maxRoommates);
  console.log("🔸 Current selected:", Array.from(selectedRoommates));
  
  if (event.target.checked) {
    if (selectedRoommates.size < maxRoommates) {
      selectedRoommates.add(roommateId);
      console.log(`✅ Added roommate: ${roommateId}`);
    } else {
      event.target.checked = false;
      alert(`You can only select up to ${maxRoommates} roommate(s) for this room type.`);
      return;
    }
  } else {
    selectedRoommates.delete(roommateId);
    console.log(`❌ Removed roommate: ${roommateId}`);
  }
  
  // Update visual feedback
  updateRoommateSelection();
  console.log("Final selected roommates:", Array.from(selectedRoommates));
}

// Debug function
function debugSelections() {
  console.log("=== CURRENT SELECTION STATE ===");
  console.log("Max Roommates:", maxRoommates);
  console.log("Selected Roommates:", Array.from(selectedRoommates));
  console.log("All checkboxes:", document.querySelectorAll(".match-checkbox"));
  console.log("Checked checkboxes:", document.querySelectorAll(".match-checkbox:checked"));
  console.log("Selected room:", document.querySelector('input[name="selectedRoom"]:checked'));
  
  // Test each checkbox
  document.querySelectorAll(".match-checkbox").forEach((cb, i) => {
    console.log(`Checkbox ${i}: ID=${cb.id}, Value=${cb.value}, Checked=${cb.checked}, Visible=${cb.offsetParent !== null}`);
  });
  console.log("===========================");
}

window.debugSelections = debugSelections;

document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("roomSelectionForm");
  if (form) {
    form.addEventListener("submit", function(event) {
      event.preventDefault();
      
      console.log("🔸 Form submitted - starting validation");
      
      const selectedRoom = document.querySelector('input[name="selectedRoom"]:checked');
      
      if (!selectedRoom) {
        alert("Please select a room first!");
        return;
      }
      
      console.log("🔸 Selected room:", selectedRoom.value);
      console.log("🔸 Current maxRoommates:", maxRoommates);
      console.log("🔸 Current selectedRoommates:", Array.from(selectedRoommates));
      
      // For twin/triple rooms, check roommate selection
      if (maxRoommates > 0) {
        if (selectedRoommates.size === 0) {
          const confirmWithoutRoommates = confirm(
            `You haven't selected any roommates for this ${maxRoommates === 1 ? 'twin' : 'triple'} room. You can add roommates later. Do you want to continue?`
          );
          if (!confirmWithoutRoommates) {
            return;
          }
        } else if (selectedRoommates.size < maxRoommates) {
          const confirmPartialSelection = confirm(
            `You've selected ${selectedRoommates.size} out of ${maxRoommates} possible roommates. Do you want to continue or select more roommates?`
          );
          if (!confirmPartialSelection) {
            return;
          }
        }
      }
      
      console.log("🔸 Validation passed - preparing data");
      
      // Store selection data for confirmation page
      const selectionData = {
        roomId: selectedRoom.value,
        roomPrice: selectedRoom.dataset.price,
        roommates: Array.from(selectedRoommates),
        totalPrice: document.getElementById("totalPrice").innerText,
        basePrice: document.getElementById("basePrice").innerText,
        gstAmount: document.getElementById("gstAmount").innerText,
        platformFee: document.getElementById("platformFee").innerText,
        roomType: maxRoommates === 0 ? 'single' : (maxRoommates === 1 ? 'twin' : 'triple')
      };
      
      console.log("🔸 Selection data:", selectionData);
      
      try {
        sessionStorage.setItem("roomSelection", JSON.stringify(selectionData));
        console.log("🔸 Data stored in sessionStorage, redirecting...");
        window.location.href = "dash2.html";
      } catch (error) {
        console.error("🔸 Error storing data or redirecting:", error);
        alert("There was an error processing your selection. Please try again.");
      }
    });
  } else {
    console.error("🔸 Form element not found!");
  }
  
  // Also add direct button click listener as backup
  const confirmBtn = document.getElementById("confirmAndPayBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", function(event) {
      console.log("🔸 Button clicked directly");
      // Trigger form submission
      const form = document.getElementById("roomSelectionForm");
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
      }
    });
  }
});