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

function Apply-ObjectKeepRules {
  param($Document)

  $count = $Document.Paragraphs.Count
  for ($i = 1; $i -le $count; $i++) {
    $paragraph = $Document.Paragraphs.Item($i)
    $text = ([string]$paragraph.Range.Text).Trim()
    if ($text -match '^(Tabla|Figura)\s+\d+\s*

  foreach ($sec in @($Document.Sections)) {
    $sec.TopMargin = 72
    $sec.BottomMargin = 72
    $sec.LeftMargin = 72
    $sec.RightMargin = 72
  }

  foreach ($p in @($Document.Paragraphs)) {
    try {
      $p.Range.Font.Name = "Arial"
      $p.Range.Font.Size = 11
      $p.Format.SpaceBefore = 0
      $p.Format.SpaceAfter = 0
      $p.Format.WidowControl = -1
      $outline = [int]$p.OutlineLevel

      if ($outline -ge 1 -and $outline -le 9) {
        $p.Format.KeepWithNext = -1
        $p.Format.KeepTogether = -1
        $p.Format.FirstLineIndent = 0
        $p.Format.LineSpacingRule = 2
        $p.Range.Font.Bold = -1
        if ($outline -eq 1) {
          $p.Alignment = 1
          $p.Format.PageBreakBefore = -1
        } elseif ($outline -eq 3 -or $outline -ge 5) {
          $p.Range.Font.Italic = -1
        }
        if ($outline -ge 4) {
          $p.Format.LeftIndent = 36
        }
      } else {
        $text = ([string]$p.Range.Text).Trim()
        $p.Format.LineSpacingRule = 2
        $p.Format.FirstLineIndent = 36
        if ($text -match '^(Tabla|Figura)\s+\d+') {
          $p.Format.FirstLineIndent = 0
          $p.Format.LineSpacingRule = 0
          $p.Format.KeepWithNext = -1
        }
      }
    } catch {}
  }

  foreach ($table in @($Document.Tables)) {
    try {
      $table.Range.Font.Name = "Arial"
      $table.Range.Font.Size = 10
      $table.Range.ParagraphFormat.LineSpacingRule = 0
      $table.Range.ParagraphFormat.FirstLineIndent = 0
      $table.Rows.Item(1).HeadingFormat = -1
      $table.Rows.AllowBreakAcrossPages = 0
    } catch {}
  }

  Apply-ObjectKeepRules -Document $Document
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

  Apply-ApaBody -Document $document

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
) {
      try {
        $paragraph.Format.KeepWithNext = -1
        $paragraph.Format.KeepTogether = -1
      } catch {}
      for ($j = $i + 1; $j -le [Math]::Min($count, $i + 3); $j++) {
        $next = $Document.Paragraphs.Item($j)
        $nextText = ([string]$next.Range.Text).Trim()
        if ($nextText) {
          try {
            $next.Format.KeepWithNext = -1
            $next.Format.KeepTogether = -1
          } catch {}
          break
        }
      }
    }
  }
}

function Apply-ApaBody {
  param($Document)

  foreach ($sec in @($Document.Sections)) {
    $sec.TopMargin = 72
    $sec.BottomMargin = 72
    $sec.LeftMargin = 72
    $sec.RightMargin = 72
  }

  foreach ($p in @($Document.Paragraphs)) {
    try {
      $p.Range.Font.Name = "Arial"
      $p.Range.Font.Size = 11
      $p.Format.SpaceBefore = 0
      $p.Format.SpaceAfter = 0
      $p.Format.WidowControl = -1
      $outline = [int]$p.OutlineLevel

      if ($outline -ge 1 -and $outline -le 9) {
        $p.Format.KeepWithNext = -1
        $p.Format.KeepTogether = -1
        $p.Format.FirstLineIndent = 0
        $p.Format.LineSpacingRule = 2
        $p.Range.Font.Bold = -1
        if ($outline -eq 1) {
          $p.Alignment = 1
          $p.Format.PageBreakBefore = -1
        } elseif ($outline -eq 3 -or $outline -ge 5) {
          $p.Range.Font.Italic = -1
        }
        if ($outline -ge 4) {
          $p.Format.LeftIndent = 36
        }
      } else {
        $text = ([string]$p.Range.Text).Trim()
        $p.Format.LineSpacingRule = 2
        $p.Format.FirstLineIndent = 36
        if ($text -match '^(Tabla|Figura)\s+\d+') {
          $p.Format.FirstLineIndent = 0
          $p.Format.LineSpacingRule = 0
          $p.Format.KeepWithNext = -1
        }
      }
    } catch {}
  }

  foreach ($table in @($Document.Tables)) {
    try {
      $table.Range.Font.Name = "Arial"
      $table.Range.Font.Size = 10
      $table.Range.ParagraphFormat.LineSpacingRule = 0
      $table.Range.ParagraphFormat.FirstLineIndent = 0
      $table.Rows.Item(1).HeadingFormat = -1
      $table.Rows.AllowBreakAcrossPages = 0
    } catch {}
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

  Apply-ApaBody -Document $document

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
