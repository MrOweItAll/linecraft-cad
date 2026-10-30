# Development association and discard references

LC-REL-02 remains partially implemented. This checkpoint adds 43 passing
source/fake-host checks (42 named cases and inventory), without a product fix.
The qualified host contracts are already satisfied within this bounded scope.
No new drawing-loss defect or ordinary-input corruption finding is established.

## Independent contracts and execution

The fixture compiles the actual main source and uses the actual native-open queue
and core validation. Electron is fake. Each case owns distinct native A/B files,
a profile checkpoint and an unrelated sentinel. Literal A is a LINE from (1,2)
to (11,2); B is a CIRCLE at (20,40), radius8; C is a LINE from (100,200) to
(130,240). Expected bytes/associations are independent of production output.

Development startup is awaited through its actual callback Promise. The fake
userData mapping accepts only the owned profile; no-watch is explicit. Watcher,
scripting and import modules are denied. The instance-local process facade has
no environment or external control endpoint. There is no application binary,
normal profile, real window, OS single-instance lock, converter or file association.

The cases distinguish intentional contracts:

- Ordinary Save As writes C to B and adopts B/clean even when its auxiliary
  checkpoint fails at mkdir/open/partial-write/sync/close/rename/cleanup. Original
  A and previous checkpoint A survive. Ordinary Open likewise adopts a validated
  B despite qualified checkpoint failures; it never writes either source file.
- Strict queued adoption requires its checkpoint first. Seven corresponding
  failures preserve the whole host association, title, authorization, native bytes
  and checkpoint A. The same prepared request remains pending; clearing the fault
  permits same-ID retry without preparation, proving both busy guards release.
- Discard authorization binds the full host association. Identical trusted state
  preserves it; changed text/name/dirty invalidates it, and changing back does not
  resurrect it. Invalid/untrusted notifications are ignored. Save/Cancel/unknown/
  rejected confirmations grant no authorization. A late injected notification can
  leave the literal Discard response while preventing dirty queued adoption.
- Clean queued adoption needs no discard grant; successful adoption consumes it.
  Cancellation with two owned requests removes the first and retains the second.
- During strict persistence, an injected later state is retained when adoption
  rejects. Successful compensation restores checkpoint A. If compensation also
  fails, live A/newer state is retained while checkpoint B remains. Both immediate
  states are recorded before fresh confirmation and same-ID retry succeeds.
- Restore is association-only: valid native or imported-name/null-path records,
  absent/malformed/wrong-format records and relative/missing/directory/malformed
  targets have independent expectations. All native/checkpoint bytes are captured
  before startup and compared afterward; absent remains absent. Packaged mode
  skips development restore/persistence. Accepted Save before canceled Open keeps
  its newly accepted native/checkpoint baseline.

The initial independently reviewed pack passed42/42. Review added a clean queued
control, complete restore byte comparisons, two-request cancellation, compensation
retry checks, finite per-case timeouts and immediate observation receipts. The
final suite passes43/43. The expanded fast profile passes49/49 stages,1,288
portable checks and221 bound inputs. Beta10 runtime, cumulative manifest,
package/lock version, dependencies and CI pins are unchanged.

## Remaining questions and scope

Best-effort persistence is not a rollback contract and is not proven harmless.
A failed checkpoint can leave on-disk association A while live content/name belongs to B;
a failed compensating write can leave candidate B on disk. This pack characterizes
those host states only. The renderer separately persists/rebuilds content and
saved fingerprints, with intentionally fresh recovery history. Their two-session
coherence and subsequent Save routing are not executed here. Next reproduce or
refute that paired recovery hypothesis using exact source functions before any
repair. Do not infer ordinary drawing loss from injected source boundaries.

Full renderer/preload/runAction/input gating, renderer storage/history recovery,
real OS watching/single-instance behavior, parser/converter, clipboard/paper/3D,
sharing/crash/power loss, application/PDF/build/unpacked/native/installed/upgrade
and daily-use acceptance remain unqualified. Development persistence/recovery
warnings still interpolate backend messages; warning privacy is not fixed or
qualified by these state-preservation checks. The private synthetic canaries and
observations remain private. Beta7 startup cause stays unknown; no retry occurred.
Historical beta6 built/native evidence retains its scope. LC-REL-01's bounded
repair budget remains exhausted; LC-REL-02 still has only its earlier diagnostic
repair approach used.

Rollback is a focused revert of this test/helper/profile/documentation checkpoint.
Runtime and existing manifests remain byte-identical; preserve all earlier fixtures,
failures and receipts. No installed rollback is implied.
