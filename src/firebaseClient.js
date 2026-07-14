const FIREBASE_SDK_VERSION = "11.10.0";
let firebasePromise = null;

function getConfig() {
  const config = window.__FIREBASE_CONFIG__ || {};
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  if (required.some((key) => !String(config[key] || "").trim())) {
    return null;
  }
  return config;
}

export function isFirebaseConfigured() {
  return Boolean(getConfig());
}

export async function getFirebaseServices() {
  const config = getConfig();
  if (!config) return null;

  if (!firebasePromise) {
    firebasePromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-storage.js`)
    ]).then(([appModule, authModule, firestoreModule, storageModule]) => {
      const app = appModule.initializeApp(config);
      return {
        auth: authModule.getAuth(app),
        db: firestoreModule.getFirestore(app),
        storage: storageModule.getStorage(app),
        authModule,
        firestoreModule,
        storageModule
      };
    });
  }

  return firebasePromise;
}
