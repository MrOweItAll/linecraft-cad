# Optional structural calculation bridge

Linecraft's drawing tools and structural JSON export work without Python. An optional, independently written adapter can exchange source-bound roof inputs/results with a compatible **separately obtained structural calculator**. The external calculator and its dependencies are not bundled into the normal CAD prerequisite set.

To use that calculation path, obtain the compatible calculator, install its documented dependencies and use **Python 3.10 or later** as required by the adapter. Follow the checked adapter/engine version contract; a different engine file set may require an adapter update. Linecraft does not automatically install or update that calculator.

The bounded exchange uses accepted roof geometry and explicit declarations such as tributary areas, load basis and clearance assumptions. Results remain linked to the source revision; changed inputs or mismatched source identities reject stale results. The drawing engine still owns edits, validation and Undo/Redo. Local scripting does not create a cloud relay or automatically approve structural output.

These are **design-assistance calculations**. They do not replace a professional engineer or architect, provide a professional stamp, determine when one is required, establish code compliance, or supply every load case/member/connection/support check. A valid exchange file is not an approved construction design. State unresolved assumptions and review applicability before relying on a result.

For exact fields and supported calculation boundaries, consult the tagged source's structural bridge documentation and the external calculator's own documentation. Use only synthetic/redacted examples in public issues. Do not publish client models, calculator credentials or local control descriptors.
