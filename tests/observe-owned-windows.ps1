[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateRange(1,2147483647)][int]$OwnedProcessId)
$ErrorActionPreference='Stop'
# Read-only, PID-filtered metadata. No titles, input, activation or window changes.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class LinecraftOwnedWindowObservation {
  public delegate bool EnumProc(IntPtr handle, IntPtr value);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr value);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint pid);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  public static bool[] Sample(uint expected) {
    var rows=new List<bool>();
    if(!EnumWindows((handle,value)=>{uint pid;GetWindowThreadProcessId(handle,out pid);if(pid==expected)rows.Add(IsWindowVisible(handle));return true;},IntPtr.Zero))throw new Exception("Window enumeration failed");
    return rows.ToArray();
  }
}
'@
$ownerProcess=Get-Process -Id $OwnedProcessId -ErrorAction Stop
$image=$ownerProcess.MainModule.FileName
$start=$ownerProcess.StartTime.ToUniversalTime().ToString('o')
$values=@([LinecraftOwnedWindowObservation]::Sample([uint32]$OwnedProcessId))
[pscustomobject]@{processId=$OwnedProcessId;image=$image;startedAt=$start;windowCount=$values.Count;visible=$values;scope='Sampled owned top-level HWND flags only; no transient-event or compositor proof'} | ConvertTo-Json -Compress
