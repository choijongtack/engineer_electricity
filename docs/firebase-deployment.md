# Firebase 배포 준비

## 현재 구현 범위

- Firebase 설정이 비어 있으면 기존 localStorage 모드로 동작합니다.
- Firebase 설정이 있으면 설정 화면에서 이메일 회원가입·로그인을 사용할 수 있습니다.
- 로그인한 사용자의 진행도는 Firestore의 `users/{uid}/progress/app` 문서에 저장합니다.
- 앱 시작 시 localStorage와 원격 기록의 `lastAccessAt`을 비교해 최신 기록을 선택합니다.
- 저장 호출은 500ms debounce 후 Firestore에 저장합니다.

## Firebase 설정

1. Firebase Console에서 `elec-study-for-pdf`의 Web App을 등록합니다.
2. Web App SDK 설정의 `apiKey`, `appId`, `messagingSenderId`, `storageBucket` 값을 `index.html`에 입력합니다.
3. Authentication에서 Email/Password provider를 활성화합니다.
4. Firestore Database를 생성합니다.
5. `firestore.rules`를 배포합니다.

웹 SDK의 `apiKey`는 공개 설정이지만, Firebase Admin SDK 키나 service account JSON은 브라우저와 GitHub에 넣지 않습니다.
