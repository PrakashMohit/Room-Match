const firebaseConfig = {
  apiKey: "AIzaSyAWHOjEiQ3_BOALQokf9KSWkzariT0WARs",
  authDomain: "my-room-match.firebaseapp.com",
  projectId: "my-room-match",
  storageBucket: "my-room-match.firebasestorage.app",
  messagingSenderId: "29511216593",
  appId: "1:29511216593:web:56d143598fb32aab8944f0",
  measurementId: "G-PV616XMSRT"}

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    const doc = await db.collection("users").doc(user.uid).get();
    const userData = doc.data();
    const profession = userData.profession || "other";

    const custom = document.getElementById("customQuestions");

  }
});

// Submit handler
document.getElementById("surveyForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const form = new FormData(this);
  const answers = {};

  for (let [key, value] of form.entries()) {
    if (value.trim()) answers[key] = value.trim();
  }

  const user = auth.currentUser;
  await db.collection("surveyAnswers").doc(user.uid).set(answers);

  alert("Survey submitted!");
  window.location.href = "dashboard.html";
});
