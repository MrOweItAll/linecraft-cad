param([string]$LiteralPath='',[string]$DeclaredRoot='',[switch]$LibraryOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Get-ObservationSidRole($Sid,$CurrentSid) {
    if ($null -eq $Sid) { return 'unknown' }
    if ($Sid.Equals($CurrentSid)) { return 'current-user' }
    if ($Sid.Value -eq 'S-1-5-18') { return 'system' }
    if ($Sid.Value -eq 'S-1-5-32-544') { return 'administrators' }
    return 'other'
}
function ConvertTo-ObservationSecurity($Descriptor,[bool]$Canonical,$CurrentSid) {
    $aces=@()
    $state='unrestricted-or-absent'
    if (($Descriptor.ControlFlags -band [System.Security.AccessControl.ControlFlags]::DiscretionaryAclPresent) -and $null -ne $Descriptor.DiscretionaryAcl) {
        $state=if ($Descriptor.DiscretionaryAcl.Count -eq 0) {'empty'} else {'populated'}
        if ($Descriptor.DiscretionaryAcl.Count -gt 128) { throw 'OBSERVATION_LIMIT' }
        foreach ($ace in $Descriptor.DiscretionaryAcl) {
            $type='unsupported';$role='unknown';[uint32]$mask=0;$callback=$false
            if ($ace -is [System.Security.AccessControl.KnownAce]) {
                $role=Get-ObservationSidRole $ace.SecurityIdentifier $CurrentSid
                $mask=[BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$ace.AccessMask),0)
            }
            if ($ace -is [System.Security.AccessControl.QualifiedAce]) { $callback=[bool]$ace.IsCallback }
            if ($ace -is [System.Security.AccessControl.CommonAce] -and -not $callback) {
                if ($ace.AceType -eq [System.Security.AccessControl.AceType]::AccessAllowed) {$type='allow'}
                if ($ace.AceType -eq [System.Security.AccessControl.AceType]::AccessDenied) {$type='deny'}
            }
            $aces+=@{type=$type;role=$role;mask=$mask;flags=[int]$ace.AceFlags;callback=$callback}
        }
    }
    return @{ownerRole=(Get-ObservationSidRole $Descriptor.Owner $CurrentSid);daclState=$state;protected=[bool]($Descriptor.ControlFlags -band [System.Security.AccessControl.ControlFlags]::DiscretionaryAclProtected);canonical=$Canonical;aces=@($aces)}
}
function Get-OrdinaryObservationPath([string]$Value) {
    if ($Value.Length -gt 4096 -or $Value -notmatch '^[A-Za-z]:\\' -or $Value.Substring(2).Contains(':') -or $Value -match '[\x00-\x1f<>"|?*]') { throw 'UNSUPPORTED_PATH' }
    foreach ($part in $Value.Substring(3).Split('\')) {
        if (-not $part -or $part -in @('.','..') -or $part -match '[. ]$' -or $part -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') { throw 'UNSUPPORTED_PATH' }
    }
    return [System.IO.Path]::GetFullPath($Value)
}
function Get-ScriptDirectoryObservation([string]$Target,[string]$Root) {
    $targetPath=Get-OrdinaryObservationPath $Target
    $rootPath=Get-OrdinaryObservationPath $Root
    if (-not $targetPath.Equals($rootPath,[StringComparison]::OrdinalIgnoreCase) -and -not $targetPath.StartsWith($rootPath+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'OUTSIDE_DECLARED_ROOT' }
    $paths=@($rootPath)
    if (-not $targetPath.Equals($rootPath,[StringComparison]::OrdinalIgnoreCase)) {
        $cursor=$rootPath
        foreach ($part in $targetPath.Substring($rootPath.Length+1).Split('\')) { $cursor=[IO.Path]::Combine($cursor,$part);$paths+=,$cursor }
    }
    if ($paths.Count -gt 32) { throw 'OBSERVATION_LIMIT' }
    $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($targetPath))
    $driveType=$drive.DriveType.ToString().ToLowerInvariant()
    if ($driveType -notin @('fixed','removable','network','unknown','cdrom','ram')) {$driveType='unknown'}
    $fileSystem=$drive.DriveFormat.ToUpperInvariant()
    if ($fileSystem -notin @('NTFS','REFS','FAT32','EXFAT')) {$fileSystem='UNKNOWN'}
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        $directories=@();$ordinal=0
        foreach ($candidate in $paths) {
            $item=Get-Item -LiteralPath $candidate -Force -ErrorAction Stop
            if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'UNSUPPORTED_PATH_OBJECT' }
            $acl=Get-Acl -LiteralPath $candidate -ErrorAction Stop
            $raw=[Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(),0)
            $security=ConvertTo-ObservationSecurity $raw $acl.AreAccessRulesCanonical $identity.User
            $directories+=@{ordinal=$ordinal;isDirectory=$true;reparse=$false;security=$security};$ordinal++
        }
    } finally { $identity.Dispose() }
    return @{format='LinecraftDirectoryObservation/1';scope='metadata-only';provenance='managed-roundtrip';boundary=@{kind='declared-root';complete=$true;outsideRootChecked=$false;handleBound=$false};volume=@{driveType=$driveType;fileSystem=$fileSystem};directories=@($directories)}
}

if (-not $LibraryOnly) {
    try { Get-ScriptDirectoryObservation $LiteralPath $DeclaredRoot | ConvertTo-Json -Depth 12 -Compress }
    catch { @{format='LinecraftDirectoryObservationFailure/1';code='OBSERVATION_UNAVAILABLE'} | ConvertTo-Json -Compress;exit 1 }
}
