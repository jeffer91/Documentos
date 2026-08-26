param(
  [Parameter(Mandatory = $true)]
  [string]$JobPath
)

$ErrorActionPreference = "Stop"

function Find-MarkerRange {
  param($Document, [string]$Marker)
  $range = $Document.Content.Duplicate
  $find = $range.Find
  $find.ClearFormatting()
  $find.Text = $Marker
  $find.Forward = $true
  $find.Wrap = 0
  if ($find.Execute()) { return $range }
  return $null
}

function Insert-Tables {
  param($Document, $Range, $Tables)
  $start = $Range.Start
  $Range.Text = ""
  $cursor = $Document.Range($start, $start)

  foreach ($definition in @($Tables)) {
    if ($definition.title) {
      $cursor.InsertBefore([string]$definition.title + [Environment]::NewLine)
      $cursor.Collapse(0)
    }

    $headers = @($definition.headers)
    $rows = @($definition.rows)

    if ($headers.Count -eq 0) {
      $cursor.InsertAfter("Sin datos registrados.")
      $cursor.Collapse(0)
      continue
    }

    $table = $Document.Tables.Add($cursor, [Math]::Max(1, $rows.Count + 1), $headers.Count)
    try { $table.Style = "Table Grid" } catch {}
    try { $table.AutoFitBehavior(2) } catch {}

    for ($c = 0; $c -lt $headers.Count; $c++) {
      $table.Cell(1, $c + 1).Range.Text = [string]$headers[$c]
      $table.Cell(1, $c + 1).Range.Bold = 1
    }

    for ($r = 0; $r -lt $rows.Count; $r++) {
      $row = @($rows[$r])
      for ($c = 0; $c -lt $headers.Count; $c++) {
        $value = if ($c -lt $row.Count) { [string]$row[$c] } else { "" }
        $table.Cell($r + 2, $c + 1).Range.Text = $value
      }
    }

    $end = $table.Range.End
    $cursor = $Document.Range($end, $end)
    $cursor.InsertParagraphAfter()
    $cursor.Collapse(0)
  }
}

function Insert-Images {
  param($Document, $Range, $Images)
  $start = $Range.Start
  $Range.Text = ""
  $cursor = $Document.Range($start, $start)

  foreach ($image in @($Images)) {
    $imagePath = [string]$image.path
    if (-not (Test-Path -LiteralPath $imagePath)) { continue }

    $shape = $Document.InlineShapes.AddPicture($imagePath, $false, $true, $cursor)
    if ($shape.Width -gt 430) {
      $ratio = 430 / $shape.Width
      $shape.Width = 430
      $shape.Height = $shape.Height * $ratio
    }

    $cursor = $Document.Range($shape.Range.End, $shape.Range.End)
    if ($image.caption) {
      $cursor.InsertAfter([Environment]::NewLine + [string]$image.caption)
    }
    $cursor.InsertParagraphAfter()
    $cursor.Collapse(0)
  }
}

$job = Get-Content -LiteralPath $JobPath -Raw -Encoding UTF8 | ConvertFrom-Json
$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $document = $word.Documents.Open([string]$job.inputDocx, $false, $false)

  foreach ($block in @($job.blocks)) {
    $marker = [string]$block.marker
    $guard = 0

    while ($guard -lt 20) {
      $guard++
      $range = Find-MarkerRange -Document $document -Marker $marker
      if ($null -eq $range) { break }

      if ($block.kind -eq "tables") {
        Insert-Tables -Document $document -Range $range -Tables $block.tables
      }
      elseif ($block.kind -eq "images") {
        Insert-Images -Document $document -Range $range -Images $block.images
      }
      else {
        $range.Text = ""
      }
    }
  }

  $document.SaveAs2([string]$job.outputDocx, 16)
  $document.ExportAsFixedFormat([string]$job.outputPdf, 17)
}
finally {
  if ($document -ne $null) {
    try { $document.Close($false) } catch {}
  }
  if ($word -ne $null) {
    try { $word.Quit() } catch {}
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
