
  // Your Firebase config
  const firebaseConfig = {
  apiKey: "AIzaSyAWHOjEiQ3_BOALQokf9KSWkzariT0WARs",
  authDomain: "my-room-match.firebaseapp.com",
  projectId: "my-room-match",
  storageBucket: "my-room-match.firebasestorage.app",
  messagingSenderId: "29511216593",
  appId: "1:29511216593:web:56d143598fb32aab8944f0",
  measurementId: "G-PV616XMSRT"}

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Wait for auth state
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "login.html"; // not logged in
      return;
    }

    // Form submission
    document.querySelector(".form-box").addEventListener("submit", async (e) => {
      e.preventDefault();
      const city = document.getElementById("city").value;

      if (!city) {
        alert("Please select a city.");
        return;
      }

      try {
        await db.collection("users").doc(user.uid).update({ city: city });
        console.log("City saved:", city);
        window.location.href = "survey.html";
      } catch (error) {
        console.error("Error saving city:", error);
        alert("Error saving city. Please try again.");
      }
    });
  });

