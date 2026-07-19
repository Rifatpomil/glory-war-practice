# Firebase Setup Instructions

This app uses Firebase Firestore to store player scores across all users. Follow these steps to set it up:

## Step 1: Create a Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click "Add project" or create a new project
3. Give your project a name (e.g., "glory-war-practice")
4. Follow the setup wizard (you can disable Google Analytics for this simple app)
5. Click "Create project"

## Step 2: Create a Firestore Database

1. In your Firebase project console, click "Build" → "Firestore Database"
2. Click "Create database"
3. Choose a location (pick one closest to your users)
4. Select "Start in test mode" (this allows read/write access for testing)
5. Click "Enable"

**Important:** After testing, you should update the security rules. For now, test mode is fine.

## Step 3: Get Your Firebase Configuration

1. In Firebase console, click the gear icon (Project Settings)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Give your app a name (e.g., "Glory War Practice")
5. Check "Also set up Firebase Hosting for this app" (optional, not needed)
6. Click "Register app"
7. Copy the `firebaseConfig` object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 4: Update app.js

1. Open `app.js` in your project
2. Replace the placeholder `firebaseConfig` object (lines 2-9) with your actual configuration
3. Save the file

## Step 5: Test the Integration

1. Run your local server or deploy to GitHub Pages
2. Enter a name and complete a practice round
3. Check your Firebase console → Firestore Database → "scores" collection
4. You should see the score data stored there

## Security Rules (Optional but Recommended)

For production, update your Firestore security rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{document=**} {
      allow read: if true;
      allow write: if request.time < timestamp.date(2025, 1, 1);
    }
  }
}
```

This allows anyone to read scores but restricts writes. Adjust the date or add authentication as needed.

## Troubleshooting

**Scores not saving to Firebase?**
- Check browser console for errors (F12 → Console)
- Verify your firebaseConfig is correct
- Make sure Firestore is in test mode or has proper rules

**Scores not loading from Firebase?**
- Check that Firestore database is created
- Verify the collection name is "scores"
- Check browser console for errors

**Still using localStorage?**
- If Firebase isn't configured, the app automatically falls back to localStorage
- Check the console for "Firebase not configured" warning
