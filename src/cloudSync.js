import { getFirebaseServices, isFirebaseConfigured } from "./firebaseClient.js";

const PROGRESS_DOCUMENT = "users/{uid}/progress/app";
let currentUser = null;
let authSubscription = null;
let syncTimer = null;
let lastQueuedProgress = null;

function progressDocumentPath(userId) {
  return PROGRESS_DOCUMENT.replace("{uid}", userId);
}

export function getCloudAuthState() {
  return {
    configured: isFirebaseConfigured(),
    user: currentUser
  };
}

export async function initializeCloudSync() {
  const services = await getFirebaseServices();
  if (!services) return null;

  if (authSubscription) return currentUser;

  return new Promise((resolve) => {
    let settled = false;
    authSubscription = services.authModule.onAuthStateChanged(services.auth, (user) => {
      currentUser = user || null;
      if (!settled) {
        settled = true;
        resolve(currentUser);
      }
    });
  });
}

export async function signInWithPassword(email, password) {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase 설정이 없습니다. index.html을 먼저 설정하세요.");

  const credential = await services.authModule.signInWithEmailAndPassword(
    services.auth,
    email,
    password
  );
  currentUser = credential.user;
  return currentUser;
}

export async function signUpWithPassword(email, password) {
  const services = await getFirebaseServices();
  if (!services) throw new Error("Firebase 설정이 없습니다. index.html을 먼저 설정하세요.");

  const credential = await services.authModule.createUserWithEmailAndPassword(
    services.auth,
    email,
    password
  );
  currentUser = credential.user;
  return currentUser;
}

export async function signOutFromCloud() {
  const services = await getFirebaseServices();
  if (!services) return;
  await services.authModule.signOut(services.auth);
  currentUser = null;
}

export function queueProgressSync(progress) {
  if (!currentUser || !isFirebaseConfigured()) return;

  lastQueuedProgress = structuredClone(progress);
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncProgress(lastQueuedProgress).catch((error) => {
      console.warn("학습 기록을 Firebase에 저장하지 못했습니다.", error);
    });
  }, 500);
}

export async function syncProgress(progress) {
  const services = await getFirebaseServices();
  if (!services || !currentUser) return null;

  const documentRef = services.firestoreModule.doc(
    services.db,
    progressDocumentPath(currentUser.uid)
  );
  await services.firestoreModule.setDoc(
    documentRef,
    {
      progress,
      updatedAt: services.firestoreModule.serverTimestamp()
    },
    { merge: true }
  );
  return progress;
}

export async function loadCloudProgress() {
  const services = await getFirebaseServices();
  if (!services || !currentUser) return null;

  const documentRef = services.firestoreModule.doc(
    services.db,
    progressDocumentPath(currentUser.uid)
  );
  const snapshot = await services.firestoreModule.getDoc(documentRef);
  if (!snapshot.exists()) return null;

  return snapshot.data();
}

export async function syncProgressAfterLogin(initialProgress) {
  const remote = await loadCloudProgress();
  if (!remote?.progress) {
    await syncProgress(initialProgress);
    return initialProgress;
  }

  return remote.progress;
}
