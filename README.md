
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ApexFlow v3.0 - Cloud Integration Guide 🚀

## 🔗 Firebase से कैसे कनेक्ट करें? (GitHub Pages Setup)

GitHub Pages पर "Offline Mode" को "Connected" में बदलने के लिए आपको ये स्टेप्स फॉलो करने होंगे:

### 1. Firebase सेटअप
1. [Firebase Console](https://console.firebase.google.com/) पर जाएं।
2. नया प्रोजेक्ट बनाएं और **Firestore Database** को "Test Mode" में इनेबल करें।
3. Project Settings से अपनी **Web App Config** (API Keys) कॉपी करें।

### 2. GitHub Secrets में Keys डालना
1. अपनी GitHub Repository की **Settings > Secrets and variables > Actions** में जाएं।
2. **New repository secret** पर क्लिक करें और ये 6 चीज़ें भरें:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### 3. GitHub Actions Workflow अपडेट करें (सबसे ज़रूरी!)
सिर्फ Secrets डालने से काम नहीं चलेगा। आपको अपनी `.github/workflows/deploy.yml` फाइल में `Build` स्टेप के अंदर इन Variables को मैप करना होगा:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
```

### 4. फिर से पुश करें
जब आप कोड पुश करेंगे, GitHub इन Secrets को लेकर ऐप को बिल्ड करेगा और आपकी Keys JavaScript फाइल के अंदर सुरक्षित रूप से लिख दी जाएंगी। इसके बाद आपका ऐप क्लाउड से कनेक्ट हो जाएगा!

## लोकल रन (Local Run)
1. `.env` फाइल बनाएं और उसमें ऊपर दी गई Keys डालें।
2. `npm install`
3. `npm run dev`
