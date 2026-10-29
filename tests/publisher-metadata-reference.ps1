# Explicit offline actual-clause regression. No publisher or remote command runs.
[CmdletBinding()]
param(
  [string]$Workflow = (Join-Path $PSScriptRoot '../.github/workflows/windows-beta.yml'),
  [string]$Fixture = (Join-Path $PSScriptRoot 'fixtures/publisher-metadata-reference.json')
)
$ErrorActionPreference = 'Stop'
function Digest([byte[]]$Bytes) { [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes)).ToLowerInvariant() }
$referenceBytes = [IO.File]::ReadAllBytes($Fixture)
$reference = [Text.Encoding]::UTF8.GetString($referenceBytes) | ConvertFrom-Json -AsHashtable
if ($reference.format -cne 'LinecraftPublisherMetadataReference/1') { throw 'REFERENCE_FAULT: fixture format' }
$workflowBytes = [IO.File]::ReadAllBytes($Workflow)
$prefix = '          if ($verification.commit -ne $env:GITHUB_SHA'
$lines = @([Text.Encoding]::UTF8.GetString($workflowBytes).Split([char]10) | Where-Object { $_.StartsWith($prefix, [StringComparison]::Ordinal) })
if ($lines.Count -ne 1) { throw 'REFERENCE_FAULT: admission clause count' }
$clauseText = $lines[0].Trim()
$clauseSHA256 = Digest ([Text.Encoding]::UTF8.GetBytes($clauseText))
if ($clauseSHA256 -cnotin $reference.allowedClauseSHA256) { throw 'REFERENCE_FAULT: unknown admission clause' }
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($clauseText, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'REFERENCE_FAULT: clause parse' }
if (@($ast.FindAll({ param($n) $n -is [Management.Automation.Language.CommandAst] }, $true)).Count -ne 0) { throw 'REFERENCE_FAULT: executable expression' }
foreach ($method in @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.InvokeMemberExpressionAst] }, $true))) {
  if (-not $method.Static -or $method.Expression.TypeName.FullName -cne 'string' -or $method.Member.Value -cne 'Equals' -or $method.Arguments.Count -ne 3) { throw 'REFERENCE_FAULT: method shape' }
  $field = $method.Arguments[0]
  $literal = $method.Arguments[1]
  $comparison = $method.Arguments[2]
  if ($field.Expression.VariablePath.UserPath -cne 'verification' -or $field.Member.Value -cnotin @('format', 'version') -or $literal.Value -cne $(if ($field.Member.Value -ceq 'format') { 'LinecraftPublicBetaVerification/1' } else { '1.36.0' }) -or -not $comparison.Static -or $comparison.Expression.TypeName.FullName -cne 'StringComparison' -or $comparison.Member.Value -cne 'Ordinal') { throw 'REFERENCE_FAULT: method arguments' }
}
foreach ($type in @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.TypeExpressionAst] }, $true))) {
  if ($type.TypeName.FullName -cnotin @('string', 'StringComparison')) { throw 'REFERENCE_FAULT: type expression' }
}
foreach ($variable in @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.VariableExpressionAst] }, $true))) {
  if ($variable.VariablePath.UserPath -cnotin @('verification', 'env:GITHUB_SHA')) { throw 'REFERENCE_FAULT: variable' }
}
$clause = [scriptblock]::Create($clauseText)
$previousSha = [Environment]::GetEnvironmentVariable('GITHUB_SHA', 'Process')
$results = @()
try {
  [Environment]::SetEnvironmentVariable('GITHUB_SHA', $reference.expectedCommit, 'Process')
  foreach ($sample in $reference.cases) {
    $verification = $sample.verification; $status = 'accepted'; $message = ''
    try { & $clause } catch { $status = 'rejected'; $message = $_.Exception.Message }
    $pass = $status -ceq $sample.expected.status -and $message -ceq $sample.expected.message
    $results += [pscustomobject]@{ name = $sample.id; status = $(if ($pass) { 'passed' } else { 'failed' }); newContract = $sample.newContract; expected = $sample.expected; observed = @{ status = $status; message = $message } }
  }
} finally { [Environment]::SetEnvironmentVariable('GITHUB_SHA', $previousSha, 'Process') }
$failed = @($results | Where-Object status -eq 'failed').Count
[pscustomobject]@{
  format = 'LinecraftPublisherMetadataReferenceResults/1'
  scope = 'Pinned actual admission clause only; no JSON file/asset/remote/publisher qualification'
  powershell = $PSVersionTable.PSVersion.ToString()
  workflowSHA256 = Digest $workflowBytes
  clauseSHA256 = $clauseSHA256
  fixedClause = $clauseSHA256 -ceq $reference.requiredFixedClauseSHA256
  fixtureSHA256 = Digest $referenceBytes
  total = $results.Count; passed = $results.Count - $failed; failed = $failed
  status = $(if ($failed -eq 0) { 'passed' } else { 'failed' })
  tests = $results
} | ConvertTo-Json -Depth 12
if ($failed -ne 0) { exit 1 }
