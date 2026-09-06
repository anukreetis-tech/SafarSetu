from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore


# Get the folder where this file is located
BASE_DIR = Path(__file__).resolve().parent

# Path to Firebase service account key
KEY_PATH = BASE_DIR / "serviceAccountKey.json"


# Initialize Firebase only if it has not already been initialized
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(str(KEY_PATH))
    firebase_admin.initialize_app(cred)


# Firestore database connection
db = firestore.client()