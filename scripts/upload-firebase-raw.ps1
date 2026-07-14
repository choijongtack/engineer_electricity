param(
  [string]$ProjectId = "elec-study-for-pdf",
  [string]$Bucket = "elec-study-for-pdf.firebasestorage.app"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$examSource = Join-Path $repoRoot "data\raw\cbtbank"
$imageSource = Join-Path $examSource "images"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI is not installed. Install gcloud and retry."
}

if (-not (Test-Path $examSource)) {
  throw "Exam source folder was not found: $examSource"
}

if (-not (Test-Path $imageSource)) {
  throw "Image source folder was not found: $imageSource"
}

$activeAccount = (& gcloud auth list --filter="status:ACTIVE" --format="value(account)").Trim()
if (-not $activeAccount) {
  throw "No active gcloud account. Run 'gcloud auth login' first."
}

$examFiles = @(Get-ChildItem -LiteralPath $examSource -Filter *.json -File)
$imageFiles = @(Get-ChildItem -LiteralPath $imageSource -Recurse -File)

Write-Host "Project: $ProjectId"
Write-Host "Bucket: gs://$Bucket"
Write-Host "Exam JSON files: $($examFiles.Count)"
Write-Host "Image files: $($imageFiles.Count)"
Write-Host "Starting upload..."

& gcloud config set project $ProjectId | Out-Host

# Preserve the nc/exam-date folder structure under the images directory.
& gcloud storage rsync --recursive --project=$ProjectId `
  $imageSource "gs://$Bucket/fire/raw/images" | Out-Host

# Upload the exam JSON files under fire/raw/exams.
& gcloud storage cp --project=$ProjectId `
  (Join-Path $examSource "*.json") "gs://$Bucket/fire/raw/exams/" | Out-Host

Write-Host "Verifying remote object counts..."
$remoteImages = @(& gcloud storage ls "gs://$Bucket/fire/raw/images/**")
$remoteExams = @(& gcloud storage ls "gs://$Bucket/fire/raw/exams/*.json")

Write-Host "Remote exam JSON files: $($remoteExams.Count)"
Write-Host "Remote image objects: $($remoteImages.Count)"

if ($remoteExams.Count -lt $examFiles.Count) {
  throw "Remote exam JSON count is lower than local count. Local=$($examFiles.Count), Remote=$($remoteExams.Count)"
}

if ($remoteImages.Count -lt $imageFiles.Count) {
  throw "Remote image count is lower than local count. Local=$($imageFiles.Count), Remote=$($remoteImages.Count)"
}

Write-Host "Firebase Storage raw upload verification PASS" -ForegroundColor Green
