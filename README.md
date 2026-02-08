<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ApexFlow v2.7.5 🚀

## 🔗 Firebase से कैसे कनेक्ट करें? (Connectivity Guide)

अगर आपको Header में "Offline Mode" दिख रहा है, तो मतलब Firebase कनेक्ट नहीं है। इसे ठीक करने के लिए:

1. **Firebase Console** (console.firebase.google.com) पर जाएं।
2. अपना प्रोजेक्ट चुनें और "Web App" सेटिंग्स से अपनी **API Keys** कॉपी करें।
3. अपने **GitHub** रिपॉजिटरी में जाएं।
4. **Settings > Secrets and variables > Actions** पर क्लिक करें।
5. **New repository secret** बटन दबाएं और नीचे दी गई 6 चीज़ें एक-एक करके भरें:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

6. ये सब भरने के बाद, Google AI Studio में आकर फिर से **Push/Update** करें। आपका ऐप क्लाउड से कनेक्ट हो जाएगा!

## Local Run
1. `npm install`
2. `npm run dev`