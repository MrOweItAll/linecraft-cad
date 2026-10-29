# Bounded non-inspector renderer probe

Status: implemented diagnostic; live renderer qualification is blocked. No fuse,
production runtime, dependency, manifest or installer is changed by this work.

## Probe and independent guards

non-inspector-probe.cjs directly spawns only the approved Windows x64 source runtime
or preserved beta6 QA-unpacked executable. The immutable target reference binds
exact sizes/hashes and Electron44.9.3; this does not authorize an installed or new
hardened executable. Source/ASAR59-file and12-resource identities and hidden-startup
code are checked before launch. A new owned profile is selected before the app lock;
source mode disables the development watcher. Logs are opened before spawn and
failures enter cleanup. A90-second budget bounds the child session.

Only the child's direct loopback Chromium browser WebSocket is considered. Its
stderr and fresh DevToolsActivePort report must agree, followed by a matching
listening PID. No HTTP discovery, alternate host, fixed-port fallback, Node inspector,
application scripting server or control descriptor is used. The host Node24 built-in
WebSocket performs raw Target/Runtime CDP calls; no Playwright Electron launcher,
default focus override, browser context creation or download directory is involved.
All deliberately created temporary files stay in owned workspace work folders.

Eight portable contract cases cover malformed/foreign endpoints, stale port/path,
PID/listener binding, launch arguments, visible/malformed window observations and
wrong process image/start time. The separate loopback integration case first proves
that its destination observes a direct connection, then verifies that a redirect is
rejected without contacting that destination. These are checker controls, not CAD
acceptance. The first combined attempt passed8/9 because the sandbox denied TCP
access before the redirect control reached its listener. Standard execution review
then allowed the local-only integration check; all9 controls passed. That original
failure remains private evidence. The default fast profile selects only the eight
portable cases; the socket check is explicit.

## Intended five diagnostic observations

1. Child endpoint, fresh profile and listening PID agree; own image/start time and
   sampled native window flags are consistent.
2. Exactly one expected application file page exposes the existing renderer bridge.
3. A literal LINE has endpoints(0,0) and(240,0).
4. Undo, Redo and Undo reproduce full baseline/accepted/baseline bytes; state is clean,
   not busy and has no open editor dialog.
5. The clean renderer close action is followed by normal owned-child exit. CDP
   disconnect alone is not exit proof. Forced cleanup is always failure; unresolved
   child state is recorded and must retain ownership until resolved.

The PowerShell7 -File helper reads only PID-filtered top-level HWND visibility and
process identity. It sends no input, changes no window and collects no titles.
A zero-HWND observation remains explicit. Such samples cannot prove absence of
transient show events or verify the existing main-process compositor guarantees.
No policy override is allowed if that helper cannot execute. PowerShell7 is a QA
prerequisite here, not a new application scripting dependency decision.

## Actual live result and remaining boundary

The first hidden source attempt failed closed at listening-PID verification:0/5
checks completed and no renderer commands ran. Windows netstat did not expose the
expected listener. Separate stable synthetic listeners were also absent from that
view under the reviewed execution context, with other TCP rows available; the cause
is unresolved. The guard was not relaxed and no connection to the app endpoint was
attempted after that failed prerequisite. The owned child received forced SIGTERM,
its close event was observed, and a subsequent exact-profile process audit found no
remaining matches. Failures, profile and logs are preserved privately.

Do not rerun Electron for this unchanged condition. A future bounded read-only TCP
API cross-check must first identify a stable synthetic listener's exact PID/address/
port. [Microsoft's TCP-table API](https://learn.microsoft.com/en-us/windows/win32/api/iphlpapi/nf-iphlpapi-getextendedtcptable)
describes endpoints available to the caller; a different reader does not guarantee a
different network view. No firewall/compartment/permission change is part of the plan.

Native window sampling, actual renderer geometry/history, normal close, unpacked
compatibility and inspector-disabled fuse acceptance remain not run or failed at
prerequisite. No Save/reopen, PDF, native dialogs/input, installed/upgrade/client,
external engine or daily-use acceptance is established. Future approved hardened
candidate identity, complete fuse/ASAR readback and full CAD/PDF qualification remain
required. Existing [fuse compatibility findings](ELECTRON-FUSE-COMPATIBILITY.md) hold.

[CDP documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp)
explains why a renderer transport differs from the existing Electron main-process
channel. This diagnostic does not replace the full application gate. Continue the
existing independent module-extraction assessment while ownership evidence is blocked.
