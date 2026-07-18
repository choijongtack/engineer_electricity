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
    const useEmulators = new URLSearchParams(window.location.search).get("emulator") === "1";
    const sdkModules = useEmulators
      ? [
          import("/node_modules/firebase/firebase-app.js"),
          import("/node_modules/firebase/firebase-auth.js"),
          import("/node_modules/firebase/firebase-firestore.js"),
          import("/node_modules/firebase/firebase-storage.js")
        ]
      : [
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`),
          import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-storage.js`)
        ];
    firebasePromise = Promise.all([
      ...sdkModules
    ]).then(([appModule, authModule, firestoreModule, storageModule]) => {
      const app = appModule.initializeApp(config);
      const auth = authModule.getAuth(app);
      const db = firestoreModule.getFirestore(app);
      if (useEmulators) {
        authModule.connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
        firestoreModule.connectFirestoreEmulator(db, "127.0.0.1", 8181);
      }
      return {
        auth,
        db,
        storage: storageModule.getStorage(app),
        authModule,
        firestoreModule,
        storageModule
      };
    });
  }

  return firebasePromise;
}
