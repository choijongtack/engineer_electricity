# Firebase raw 콘텐츠 업로드

## 최초 준비

Google Cloud CLI를 설치한 뒤 한 번만 인증합니다.

```powershell
gcloud auth login
gcloud config set project elec-study-for-pdf
```

## 업로드 실행

프로젝트 루트에서 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\upload-firebase-raw.ps1
```

스크립트는 다음을 업로드합니다.

- `data/raw/cbtbank/*.json` → `fire/raw/exams/`
- `data/raw/cbtbank/images/**` → `fire/raw/images/`

이미지의 `nc/회차` 하위 폴더 구조를 유지하며, 업로드 전후 파일 개수를 확인합니다. 인증 정보나 서비스 계정 키는 코드에 저장하지 않습니다.
