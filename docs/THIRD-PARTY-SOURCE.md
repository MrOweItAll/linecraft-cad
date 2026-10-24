# Bundled components and third-party source

The [MIT license](../LICENSE) applies to original Linecraft code/assets. Electron, Chromium, GNU LibreDWG, libiconv and other dependencies retain their own licenses/notices. This guide records source/provenance boundaries; it is not a legal certification.

## Desktop runtime

The installed distribution includes the Electron/Chromium license notices, including `LICENSE.electron.txt` and `LICENSES.chromium.html`. Source development obtains the pinned packages through the lockfile. Font availability is read from the local system; proprietary Autodesk font or interface asset binaries are not supplied as Linecraft assets.

## GNU reader and source archives

The bounded read-only DWG converter is GNU LibreDWG **0.13.4**, with libiconv **1.18** and the required runtime files. Its licenses, manifests and matching official GNU source archives are distributed under [`third-party/libredwg`](../third-party/libredwg/NOTICE.md). The qualified resource bytes are preserved; consult their manifests and the release's `SHA256SUMS.txt` for exact file/source bindings.

The original bundled NOTICE mentions Windows/CMake build recipes. That wording overstates the contents of the GNU release tarball: it supplies the Autotools/configure source, but not all of those referenced Windows/CMake files. The public release supplies a pinned **official upstream source supplement** under `third-party-source/` to address this source-layout gap. The supplement's tag/commit and hashes are recorded alongside it. It is separate from the application's bundled runtime resources.

| Source archive | Identity |
| --- | --- |
| Bundled `third-party/libredwg/libredwg-0.13.4.tar.xz` | SHA-256 `7e153ea4dac4cbf3dc9c50b9ef7a5604e09cdd4c5520bcf8017877bbe1422cd5` |
| Bundled `third-party/libredwg/libiconv-1.18.tar.gz` | SHA-256 `3b08f5f4f9b4eb82f151a7040bfd6fe6c6fb922efe4b1659c66ea933276965e8` |
| [Official upstream supplement](../third-party-source/libredwg-0.13.4-upstream.tar.gz) | 21,001,798 bytes; SHA-256 `26a03e30d0f88fedf64be8ceb797193cbfcda7efdabba5eb9694af864e41b4d2` |

The supplement is the official LibreDWG repository's **0.13.4** tag: annotated tag object `278a079918ef9ab0a90d7588d3a4d459816bb0c9`, resolving to commit `e3774bd4020fcfebb68150361db74b8b34d170fe`. Its [pinned upstream download](https://codeload.github.com/LibreDWG/libredwg/tar.gz/e3774bd4020fcfebb68150361db74b8b34d170fe) is distinct from the GNU release tarball. These records correct the original notice's source-layout claim while preserving the qualified bundled resource bytes.

Use the supplied archives/supplement and their pinned identity rather than assuming a moving upstream branch matches the shipped reader. Preserve each component's license and source notices when redistributing it.

Neither the existence of source archives/build recipes nor a matching upstream version demonstrates that the shipped Windows executable/DLLs were rebuilt byte-for-byte from those sources in this release. No binary reproducibility or blanket legal-compliance certification is claimed. The qualification and provenance records distinguish observed file/license/source presence from unperformed rebuilds.
