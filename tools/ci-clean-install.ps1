# This destructive installation/uninstallation test is limited to a disposable
# GitHub-hosted Windows runner. It must never run on a contributor's desktop.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or !$env:RUNNER_TEMP) { throw 'Disposable GitHub-hosted Windows runner required.' }
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
$installer = Join-Path $project "Windows-Release\Linecraft-CAD-$version-Setup.exe"
if (!(Test-Path -LiteralPath $installer)) { throw 'Tested installer not found.' }
$runnerRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
$owned = [IO.Path]::GetFullPath((Join-Path $runnerRoot ('linecraft-install-' + [guid]::NewGuid().ToString())))
if (!$owned.StartsWith($runnerRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe installation path.' }
New-Item -Path $owned -ItemType Directory | Out-Null
$installDir = Join-Path $owned 'application'
$sentinel = Join-Path $owned 'keep-project-file.txt'
'Synthetic user document outside application directory; must survive uninstall.' | Set-Content -LiteralPath $sentinel -Encoding utf8NoBOM
$sentinelHash = (Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash
$progid = 'Registry::HKEY_CURRENT_USER\Software\Classes\LinecraftCAD.Drawing\shell\open\command'
if (Test-Path -LiteralPath $progid) { throw 'Runner is not a clean Linecraft installation environment.' }
$receipt = [ordered]@{format='LinecraftCleanRunnerInstall/1';startedAt=[DateTime]::UtcNow.ToString('o');runId=$env:GITHUB_RUN_ID;os=[Environment]::OSVersion.VersionString;scope='Fresh GitHub-hosted Windows VM; hidden real installed application. This does not claim visible desktop interaction.';checks=@();version=$version;installerSha256=(Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()}
function Record([string]$name) { $receipt.checks += [ordered]@{name=$name;status='passed'} }
Push-Location $project
try {
 $proc = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -WindowStyle Hidden -Wait -PassThru
 if ($proc.ExitCode -ne 0) { throw "Installer exit $($proc.ExitCode)" }
 $exe = Join-Path $installDir 'Linecraft CAD.exe'
 if (!(Test-Path -LiteralPath $exe) -or (Get-Item -LiteralPath $exe).VersionInfo.FileVersion -ne $version) { throw 'Installed executable/version mismatch.' }
 Record 'Clean per-user NSIS installation and executable version'
 foreach ($name in @('app.asar','third-party\libredwg\runtime\dwgread.exe','third-party\libredwg\runtime\libredwg-0.dll','third-party\libredwg\runtime\libiconv-2.dll')) {
  $source = Join-Path $project (Join-Path 'Windows-Release\win-unpacked\resources' $name)
  $target = Join-Path $installDir (Join-Path 'resources' $name)
  if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $target).Hash) { throw "Installed resource mismatch: $name" }
 }
 Record 'Installed ASAR and GNU converter bytes match tested unpacked application'
 $open = (Get-Item -LiteralPath $progid).GetValue('')
 if ($open -ne ('"' + $exe + '" "%1"')) { throw 'Native drawing open registration mismatch.' }
 Record 'Per-user .linecraft ProgID quotes drawing paths'
 node desktop/dev-tools.cjs test-installed $exe
 if ($LASTEXITCODE -ne 0) { throw 'Actual installed application/PDF acceptance failed.' }
 $drawingReport = Get-Content -LiteralPath (Join-Path $project 'tests\ordinary-grip-public-installed-results.json') -Raw | ConvertFrom-Json
 $nativeFile = $drawingReport.outputs.native
 $pdfFile = $drawingReport.outputs.pdf
 $nativeHash = (Get-FileHash -LiteralPath $nativeFile -Algorithm SHA256).Hash
 $pdfHash = (Get-FileHash -LiteralPath $pdfFile -Algorithm SHA256).Hash
 Record 'Installed renderer: 32 grip/file/history checks and nine independent actual PDF checks'
 $uninstaller = Join-Path $installDir 'Uninstall Linecraft CAD.exe'
 if (!(Test-Path -LiteralPath $uninstaller)) { throw 'Uninstaller missing.' }
 $proc = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -WindowStyle Hidden -Wait -PassThru
 if ($proc.ExitCode -ne 0) { throw "Uninstaller exit $($proc.ExitCode)" }
 $deadline = [DateTime]::UtcNow.AddSeconds(60)
 while ((Test-Path -LiteralPath $exe) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 300 }
 if (Test-Path -LiteralPath $exe) { throw 'Application executable remains after uninstall.' }
 if (Test-Path -LiteralPath $progid) { throw 'Owned drawing ProgID remains after uninstall.' }
 if ((Get-FileHash -LiteralPath $sentinel -Algorithm SHA256).Hash -ne $sentinelHash) { throw 'Uninstall changed the outside project file.' }
 if ((Get-FileHash -LiteralPath $nativeFile -Algorithm SHA256).Hash -ne $nativeHash -or (Get-FileHash -LiteralPath $pdfFile -Algorithm SHA256).Hash -ne $pdfHash) { throw 'Uninstall changed the actual saved native drawing or PDF.' }
 Record 'Uninstall removes application/owned ProgID and preserves actual native drawing, PDF and outside document'
 $receipt.status='passed'
} catch {
 $receipt.status='failed';$receipt.error=$_.Exception.Message;throw
} finally {
 Pop-Location
 $receipt.finishedAt=[DateTime]::UtcNow.ToString('o')
 $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $project 'work\public-clean-install-results.json') -Encoding utf8NoBOM
}
