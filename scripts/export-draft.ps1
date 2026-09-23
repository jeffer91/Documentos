param(
  [Parameter(Mandatory=$true)][string]$InputHtml,
  [Parameter(Mandatory=$true)][string]$OutputBase,
  [Parameter(Mandatory=$false)][string]$Formats = "docx,pdf"
)

$ErrorActionPreference = "Stop"
$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($InputHtml, $false, $true)

  $items = $Formats.Split(",") | ForEach-Object { $_.Trim().ToLowerInvariant() }
  if ($items -contains "docx") {
    $doc.SaveAs2("$OutputBase.docx", 16)
  }
  if ($items -contains "pdf") {
    $doc.ExportAsFixedFormat("$OutputBase.pdf", 17)
  }
}
finally {
  if ($doc -ne $null) {
    try { $doc.Close([ref]$false) } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
  }
  if ($word -ne $null) {
    try { $word.Quit() } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
