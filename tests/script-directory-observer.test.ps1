# Offline normalization references. Raw descriptors below are never applied to an OS object.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../tools/observe-script-directory.ps1') -LibraryOnly
$sid=[Security.Principal.SecurityIdentifier]::new('S-1-5-21-111-222-333-1001')
$checks=@()
function Check([string]$Name,[bool]$Condition) { if (-not $Condition) { throw ('Reference failed: '+$Name) };$script:checks+=@{id=$Name;passed=$true} }
function Wrap-Ace($Ace) {
    $list=[Security.AccessControl.RawAcl]::new(4,1);$list.InsertAce(0,$Ace)
    return [Security.AccessControl.RawSecurityDescriptor]::new([Security.AccessControl.ControlFlags]::DiscretionaryAclPresent,$sid,$null,$null,$list)
}
$raw=[Security.AccessControl.RawSecurityDescriptor]::new('O:S-1-5-21-111-222-333-1001D:P(A;OICI;FA;;;S-1-5-21-111-222-333-1001)(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)')
$r=ConvertTo-ObservationSecurity $raw $true $sid
Check 'literal-owner-and-protected-populated-dacl' ($r.ownerRole -eq 'current-user' -and $r.protected -and $r.canonical -and $r.daclState -eq 'populated' -and $r.aces.Count -eq 3)
Check 'literal-full-control-mask-and-inheritance-flags' (@($r.aces | Where-Object {$_.mask -ne 2032127 -or $_.flags -ne 3 -or $_.type -ne 'allow' -or $_.callback}).Count -eq 0)
Check 'literal-normalized-well-known-roles' (($r.aces.role -join ',') -eq 'current-user,system,administrators')
foreach ($flags in @([Security.AccessControl.ControlFlags]::None,[Security.AccessControl.ControlFlags]::DiscretionaryAclPresent)) {
    $d=[Security.AccessControl.RawSecurityDescriptor]::new($flags,$sid,$null,$null,$null)
    $n=ConvertTo-ObservationSecurity $d $true $sid
    Check ('absent-or-null-'+[int]$flags) ($n.daclState -eq 'unrestricted-or-absent' -and $n.aces.Count -eq 0)
}
$empty=[Security.AccessControl.RawSecurityDescriptor]::new([Security.AccessControl.ControlFlags]::DiscretionaryAclPresent,$sid,$null,$null,[Security.AccessControl.RawAcl]::new(2,0))
Check 'empty-is-not-null' ((ConvertTo-ObservationSecurity $empty $true $sid).daclState -eq 'empty')
$deny=[Security.AccessControl.RawSecurityDescriptor]::new('O:S-1-5-21-111-222-333-1001D:(D;;FR;;;SY)')
$d=(ConvertTo-ObservationSecurity $deny $true $sid).aces[0]
Check 'literal-deny-read-mask' ($d.type -eq 'deny' -and $d.role -eq 'system' -and $d.mask -eq 1179785 -and $d.flags -eq 0)
$callback=[Security.AccessControl.CommonAce]::new([Security.AccessControl.AceFlags]::None,[Security.AccessControl.AceQualifier]::AccessAllowed,2032127,$sid,$true,[byte[]]@(0,0,0,0))
$c=(ConvertTo-ObservationSecurity (Wrap-Ace $callback) $true $sid).aces[0]
Check 'callback-never-becomes-basic-allow' ($c.callback -and $c.type -eq 'unsupported')
$objectAce=[Security.AccessControl.ObjectAce]::new([Security.AccessControl.AceFlags]::None,[Security.AccessControl.AceQualifier]::AccessAllowed,2032127,$sid,[Security.AccessControl.ObjectAceFlags]::ObjectAceTypePresent,[guid]'00000000-0000-0000-0000-000000000001',[guid]::Empty,$false,$null)
Check 'object-ace-never-becomes-basic-allow' ((ConvertTo-ObservationSecurity (Wrap-Ace $objectAce) $true $sid).aces[0].type -eq 'unsupported')
$inherit=[Security.AccessControl.RawSecurityDescriptor]::new('O:S-1-5-21-111-222-333-1001D:(A;OICIIO;FA;;;S-1-5-21-111-222-333-1001)')
Check 'inherit-only-is-bit-eight' ((ConvertTo-ObservationSecurity $inherit $true $sid).aces[0].flags -eq 11)
$other=[Security.AccessControl.RawSecurityDescriptor]::new('O:S-1-5-21-111-222-333-1002D:(A;;FA;;;S-1-5-21-111-222-333-1002)')
$o=ConvertTo-ObservationSecurity $other $true $sid
Check 'foreign-owner-and-trustee-redacted' ($o.ownerRole -eq 'other' -and $o.aces[0].role -eq 'other')
$text=$r | ConvertTo-Json -Depth 8 -Compress
Check 'normalized-output-omits-sid-and-sddl' ($text -notmatch 'S-1-' -and $text -notmatch 'O:|D:')
foreach ($bad in @('relative','\\synthetic.invalid\share\test','\\.\pipe\test','\\?\C:\test','C:\test:stream','C:\root\..\test','C:\root\NUL.json')) {
    $rejected=$false
    try { $null=Get-OrdinaryObservationPath $bad } catch { if ($_.Exception.Message -eq 'UNSUPPORTED_PATH') {$rejected=$true} }
    Check ('lexical-path-reference-'+$checks.Count) $rejected
}
@{format='LinecraftOfflineObserverReferences/1';checks=$checks;count=$checks.Count;actualAclChanges=$false;actualAccountsCreated=$false} | ConvertTo-Json -Depth 5 -Compress
