# Explicit offline reference. This never executes the publisher or uses real assets.
[CmdletBinding()]
param(
  [string]$Workflow = (Join-Path $PSScriptRoot '../.github/workflows/windows-beta.yml'),
  [string]$Fixture = (Join-Path $PSScriptRoot 'fixtures/publisher-checksum-reference.json')
)
$ErrorActionPreference = 'Stop'
function Digest([byte[]]$Bytes) {
  [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant()
}
$fixtureBytes = [IO.File]::ReadAllBytes($Fixture)
$reference = [Text.Encoding]::UTF8.GetString($fixtureBytes) | ConvertFrom-Json -AsHashtable
if ($reference.format -cne 'LinecraftPublisherChecksumReference/1') { throw 'REFERENCE_FAULT: fixture format' }
$workflowBytes = [IO.File]::ReadAllBytes($Workflow)
if ((Digest $workflowBytes) -cne $reference.workflowSHA256) { throw 'REFERENCE_FAULT: workflow identity changed' }
$lf = [string][char]10; $cr = [string][char]13
$text = [Text.Encoding]::UTF8.GetString($workflowBytes).Replace($cr + $lf, $lf).Replace($cr, $lf)
$begin = '          $expected = @('
$end = '          $remoteCommit = gh api '
$startIndex = $text.IndexOf($begin, [StringComparison]::Ordinal)
$endIndex = $text.IndexOf($end, [StringComparison]::Ordinal)
if ($startIndex -lt 0 -or $endIndex -le $startIndex -or $text.LastIndexOf($begin, [StringComparison]::Ordinal) -ne $startIndex -or $text.LastIndexOf($end, [StringComparison]::Ordinal) -ne $endIndex) { throw 'REFERENCE_FAULT: extraction anchors' }
$blockText = [regex]::Replace($text.Substring($startIndex, $endIndex - $startIndex), '(?m)^ {10}', '')
if ((Digest ([Text.Encoding]::UTF8.GetBytes($blockText))) -cne $reference.blockSHA256) { throw 'REFERENCE_FAULT: executed block identity' }
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($blockText, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'REFERENCE_FAULT: block parse' }
$commands = @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.CommandAst] }, $true))
if ($commands.Count -ne 2) { throw 'REFERENCE_FAULT: command count' }
foreach ($command in $commands) {
  if ($command.GetCommandName() -cnotin @('Get-Content', 'Get-FileHash') -or $command.InvocationOperator.ToString() -cne 'Unknown' -or $command.Redirections.Count -ne 0) { throw 'REFERENCE_FAULT: command shape' }
}
$methods = @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.InvokeMemberExpressionAst] }, $true))
if ($methods.Count -ne 1 -or $methods[0].Static -or $methods[0].Member.Value -cne 'ToLowerInvariant' -or $methods[0].Arguments.Count -ne 0) { throw 'REFERENCE_FAULT: member invocation' }
if (@($ast.FindAll({ param($n) $n -is [Management.Automation.Language.TypeExpressionAst] }, $true)).Count -ne 0) { throw 'REFERENCE_FAULT: type expression' }
foreach ($payload in $reference.payloads) {
  if ((Digest ([Text.Encoding]::UTF8.GetBytes($payload.text))) -cne $payload.sha256) { throw 'REFERENCE_FAULT: literal payload hash' }
}
$block = [scriptblock]::Create($blockText)
$results = @()
foreach ($sampleCase in $reference.cases) {
  $observed = & {
    param($block, $sampleCase, $reference)
    $state = @{ checksumReads = 0; hashAttempts = 0; faults = @() }
    function Get-Content {
      [CmdletBinding()]param([Parameter(Mandatory)][string]$LiteralPath)
      $state.checksumReads++
      if ($LiteralPath -cne 'SHA256SUMS.txt') { $state.faults += 'content path'; throw 'REFERENCE_FAULT: content path' }
      $sampleCase.lines
    }
    function Get-FileHash {
      [CmdletBinding()]param([Parameter(Mandatory)][string]$LiteralPath, [Parameter(Mandatory)][string]$Algorithm)
      $state.hashAttempts++
      if ($Algorithm -cne 'SHA256') { $state.faults += 'algorithm'; throw 'REFERENCE_FAULT: algorithm' }
      $matchesByName = @($reference.payloads | Where-Object { $_.name -ieq $LiteralPath })
      if ($matchesByName.Count -ne 1) { $state.faults += 'hash path'; throw 'REFERENCE_FAULT: hash path' }
      if ($sampleCase.missingPayload -ieq $LiteralPath) { throw 'REFERENCE_MISSING_ASSET' }
      $bytes = [Text.Encoding]::UTF8.GetBytes($matchesByName[0].text)
      if ($sampleCase.changedPayload -ieq $LiteralPath) { $bytes = [Text.Encoding]::UTF8.GetBytes('Changed synthetic checksum payload.') }
      [pscustomobject]@{ Hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) }
    }
    $status = 'accepted'; $message = ''
    try { & $block } catch { $status = 'rejected'; $message = $_.Exception.Message }
    [pscustomobject]@{ status = $status; message = $message; checksumReads = $state.checksumReads; hashAttempts = $state.hashAttempts; faults = @($state.faults) }
  } $block $sampleCase $reference
  $expected = $sampleCase.expected
  $pass = $observed.faults.Count -eq 0 -and $observed.status -ceq $expected.status -and $observed.message -ceq $expected.message -and $observed.checksumReads -eq $expected.checksumReads -and $observed.hashAttempts -eq $expected.hashAttempts
  $results += [pscustomobject]@{ name = $sampleCase.id; status = $(if ($pass) { 'passed' } else { 'failed' }); expected = $expected; observed = $observed }
}
$failed = @($results | Where-Object status -eq 'failed').Count
[pscustomobject]@{
  format = 'LinecraftPublisherChecksumReferenceResults/1'
  scope = 'Offline pinned checksum block with synthetic adapters; not publisher, real assets, filesystem custody or CI'
  powershell = $PSVersionTable.PSVersion.ToString()
  workflowSHA256 = Digest $workflowBytes
  blockSHA256 = Digest ([Text.Encoding]::UTF8.GetBytes($blockText))
  fixtureSHA256 = Digest $fixtureBytes
  total = $results.Count; passed = $results.Count - $failed; failed = $failed
  status = $(if ($failed -eq 0) { 'passed' } else { 'failed' })
  tests = $results
} | ConvertTo-Json -Depth 12
if ($failed -ne 0) { exit 1 }
