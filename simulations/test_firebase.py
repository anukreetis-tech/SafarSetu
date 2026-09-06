from firebase_db import db


doc = db.collection("buses").document("BUS101").get()


if doc.exists:
    print("Firebase connection successful!")
    print("BUS101 data:")
    print(doc.to_dict())
else:
    print("BUS101 does not exist in Firestore.")