import firebase_admin
from firebase_admin import credentials, firestore
import torch
import torch.nn as nn
from sklearn.preprocessing import LabelEncoder
from datetime import datetime, timedelta
import difflib

# Firebase Init
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Neural Network
class MatchNet(nn.Module):
    def __init__(self, input_size):
        super(MatchNet, self).__init__()
        self.model = nn.Sequential(
            nn.Linear(input_size * 2, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x1, x2):
        x = torch.cat([x1, x2], dim=1)
        return self.model(x)

# Feature encoding
encoders = {
    'sleepTime': LabelEncoder(),
    'diet': LabelEncoder(),
    'roomPref': LabelEncoder(),
    'floor': LabelEncoder(),
    'profession': LabelEncoder()
}

# Get all users + surveyAnswers
def get_users():
    users = {}
    for user_doc in db.collection("users").stream():
        uid = user_doc.id
        user_data = user_doc.to_dict()
        survey_doc = db.collection("surveyAnswers").document(uid).get()
        if survey_doc.exists:
            user_data.update(survey_doc.to_dict())
            users[uid] = user_data
    return users

# Get omnidim responses and match to uid
def match_omnidiim_to_user(users):
    responses = {}
    for doc in db.collection("omnidim_responses").stream():
        resp = doc.to_dict()
        timestamp = resp.get("timestamp")
        name = resp.get("name", "").lower()

        if not timestamp:
            continue
        ts = timestamp.replace(tzinfo=None)

        for uid, user in users.items():
            if abs(user['createdAt'].replace(tzinfo=None) - ts) <= timedelta(minutes=10):
                if name in user['name'].lower():
                    responses[uid] = resp
                    break
    return responses

# Prepare vectors
def encode_users(users):
    all_features = ['sleepTime', 'diet', 'roomPref', 'floor', 'profession']
    for feat in all_features:
        values = [u.get(feat, '') for u in users.values()]
        encoders[feat].fit(values)

    vectors = {}
    for uid, data in users.items():
        vec = []
        for feat in all_features:
            vec.append(encoders[feat].transform([data.get(feat, '')])[0])
        vectors[uid] = torch.tensor(vec, dtype=torch.float)
    return vectors

# Find best match for each user
def match_users(vectors, model):
    matches = {}
    uids = list(vectors.keys())
    for i, uid in enumerate(uids):
        best_score = 0
        best_match = None
        others = []
        for j, uid2 in enumerate(uids):
            if i == j:
                continue
            score = model(vectors[uid].unsqueeze(0), vectors[uid2].unsqueeze(0)).item()
            others.append({"uid": uid2, "score": round(score * 100)})
            if score > best_score:
                best_score = score
                best_match = uid2
        others.sort(key=lambda x: x["score"], reverse=True)
        matches[uid] = {
            "bestMatch": users[best_match] if best_match else {},
            "otherMatches": others
        }
    return matches

# Find room for match
def assign_rooms(matches):
    room_docs = db.collection("availableRooms").where("status", "==", "available").stream()
    rooms = [r.to_dict() | {"id": r.id} for r in room_docs]

    for uid, result in matches.items():
        pref = users[uid].get("roomPref", "twin").lower()
        compatible = [r for r in rooms if r['type'].lower() == pref]
        if compatible:
            result["assignedRoom"] = compatible[0]
    return matches

# Save results
def save_matches(matches):
    for uid, result in matches.items():
        db.collection("matches").document(uid).set(result)

# Run pipeline
users = get_users()
omnidiim = match_omnidiim_to_user(users)
for uid, odata in omnidiim.items():
    users[uid].update(odata)

vectors = encode_users(users)
model = MatchNet(input_size=5)
matches = match_users(vectors, model)
matches = assign_rooms(matches)
save_matches(matches)

print("✅ Matches calculated and saved.")
