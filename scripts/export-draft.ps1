param(
  [Parameter(Mandatory=$true)][string]$InputHtml,
  [Parameter(Mandatory=$true)][string]$OutputBase,
  [Parameter(Mandatory=$false)][string]$Formats = "docx,pdf"
)

$ErrorActionPreference = "Stop"
$word = $null
$doc = $null

function Apply-ApaParagraph {
  param($Paragraph)

  $Paragraph.Range.Font.Name = "Arial"
  $Paragraph.Range.Font.Size = 11
  $Paragraph.Format.SpaceBefore = 0
  $Paragraph.Format.SpaceAfter = 0
  $Paragraph.Format.WidowControl = -1

  $outline = [int]$Paragraph.OutlineLevel
  if ($outline -ge 1 -and $outline -le 9) {
    $Paragraph.Format.KeepWithNext = -1
    $Paragraph.Format.KeepTogether = -1
    $Paragraph.Format.FirstLineIndent = 0
    $Paragraph.Format.LeftIndent = 0
    $Paragraph.Format.LineSpacingRule = 2
    $Paragraph.Range.Font.Bold = -1

    if ($outline -eq 1) {
      $Paragraph.Alignment = 1
      $Paragraph.Format.PageBreakBefore = -1
      $Paragraph.Range.Font.Italic = 0
    }
    elseif ($outline -eq 2) {
      $Paragraph.Alignment = 0
      $Paragraph.Range.Font.Italic = 0
    }
    elseif ($outline -eq 3) {
      $Paragraph.Alignment = 0
      $Paragraph.Range.Font.Italic = -1
    }
    elseif ($outline -eq 4) {
      $Paragraph.Alignment = 0
      $Paragraph.Format.LeftIndent = 36
      $Paragraph.Range.Font.Italic = 0
    }
    elseif ($outline -eq 5) {
      $Paragraph.Alignment = 0
      $Paragraph.Format.LeftIndent = 36
      $Paragraph.Range.Font.Italic = -1
    }
    else {
      # Niveles 6-9 conservan la jerarquía/numeración y usan el estilo profundo.
      $Paragraph.Alignment = 0
      $Paragraph.Format.LeftIndent = 36
      $Paragraph.Range.Font.Italic = -1
    }
    return
  }

  $text = ([string]$Paragraph.Range.Text).Trim()
  $Paragraph.Format.LineSpacingRule = 2
  $Paragraph.Format.FirstLineIndent = 36
  $Paragraph.Alignment = 0

  if ($text -match '^(Tabla|Figura)\s+\d+') {
    $Paragraph.Format.FirstLineIndent = 0
    $Paragraph.Format.LineSpacingRule = 0
    $Paragraph.Format.KeepWithNext = -1
    $Paragraph.Format.KeepTogether = -1
    $Paragraph.Range.Font.Bold = -1
  }
}

function Apply-ApaReferences {
  param($Document)
  $inReferences = $false
  foreach ($p in @($Document.Paragraphs)) {
    $text = ([string]$p.Range.Text).Trim()
    $outline = [int]$p.OutlineLevel
    if ($outline -eq 1 -and $text -match '(?i)referencias') {
      $inReferences = $true
      continue
    }
    if ($inReferences -and $outline -eq 1 -and $text -notmatch '(?i)referencias') {
      $inReferences = $false
    }
    if ($inReferences -and $outline -gt 5 -and $text) {
      $p.Format.LeftIndent = 36
      $p.Format.FirstLineIndent = -36
      $p.Format.LineSpacingRule = 2
      $p.Format.SpaceAfter = 0
      $p.Format.WidowControl = -1
    }
  }
}

function Apply-ApaTables {
  param($Document)
  foreach ($table in @($Document.Tables)) {
    try { $table.AutoFitBehavior(2) } catch {}
    try { $table.Rows.Item(1).HeadingFormat = -1 } catch {}

    $table.Range.Font.Name = "Arial"
    $table.Range.Font.Size = 10
    $table.Range.ParagraphFormat.LineSpacingRule = 0
    $table.Range.ParagraphFormat.SpaceAfter = 0
    $table.Range.ParagraphFormat.FirstLineIndent = 0

    try {
      foreach ($border in @($table.Borders)) {
        $border.LineStyle = 0
      }
      $table.Borders.Item(-1).LineStyle = 1
      $table.Borders.Item(-1).LineWidth = 6
      $table.Borders.Item(-3).LineStyle = 1
      $table.Borders.Item(-3).LineWidth = 6
      $table.Rows.Item(1).Borders.Item(-3).LineStyle = 1
      $table.Rows.Item(1).Borders.Item(-3).LineWidth = 4
      $table.Rows.AllowBreakAcrossPages = 0
    } catch {}
  }
}

function Apply-ObjectKeepRules {
  param($Document)

  $count = $Document.Paragraphs.Count
  for ($i = 1; $i -le $count; $i++) {
    $paragraph = $Document.Paragraphs.Item($i)
    $text = ([string]$paragraph.Range.Text).Trim()

    if ($text -match '^(Tabla|Figura)\s+\d+\s*
  foreach ($shape in @($Document.InlineShapes)) {
    try {
      if ($shape.Width -gt 450) {
        $ratio = 450 / $shape.Width
        $shape.Width = 450
        $shape.Height = $shape.Height * $ratio
      }
      $shape.Range.ParagraphFormat.KeepTogether = -1
      $shape.Range.ParagraphFormat.WidowControl = -1
      $shape.Range.ParagraphFormat.Alignment = 1
    } catch {}
  }
}

function Apply-ApaDocument {
  param($Document)

  $section = $Document.Sections.Item(1)
  foreach ($sec in @($Document.Sections)) {
    $sec.TopMargin = 72
    $sec.BottomMargin = 72
    $sec.LeftMargin = 72
    $sec.RightMargin = 72
  }

  $Document.Content.Font.Name = "Arial"
  $Document.Content.Font.Size = 11

  foreach ($p in @($Document.Paragraphs)) {
    Apply-ApaParagraph -Paragraph $p
  }

  Apply-ApaReferences -Document $Document
  Apply-ApaTables -Document $Document
  Apply-ApaFigures -Document $Document
  Apply-ObjectKeepRules -Document $Document
}

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($InputHtml, $false, $false)

  Apply-ApaDocument -Document $doc

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
) {
      try {
        $paragraph.Format.KeepWithNext = -1
        $paragraph.Format.KeepTogether = -1
      } catch {}

      # El siguiente párrafo no vacío es el título del objeto.
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

function Apply-ApaFigures {
  param($Document)
  foreach ($shape in @($Document.InlineShapes)) {
    try {
      if ($shape.Width -gt 450) {
        $ratio = 450 / $shape.Width
        $shape.Width = 450
        $shape.Height = $shape.Height * $ratio
      }
      $shape.Range.ParagraphFormat.KeepTogether = -1
      $shape.Range.ParagraphFormat.WidowControl = -1
      $shape.Range.ParagraphFormat.Alignment = 1
    } catch {}
  }
}

function Apply-ApaDocument {
  param($Document)

  $section = $Document.Sections.Item(1)
  foreach ($sec in @($Document.Sections)) {
    $sec.TopMargin = 72
    $sec.BottomMargin = 72
    $sec.LeftMargin = 72
    $sec.RightMargin = 72
  }

  $Document.Content.Font.Name = "Arial"
  $Document.Content.Font.Size = 11

  foreach ($p in @($Document.Paragraphs)) {
    Apply-ApaParagraph -Paragraph $p
  }

  Apply-ApaReferences -Document $Document
  Apply-ApaTables -Document $Document
  Apply-ApaFigures -Document $Document
}

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open($InputHtml, $false, $false)

  Apply-ApaDocument -Document $doc

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
