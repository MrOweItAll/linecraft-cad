# GNU LibreDWG converter

Linecraft invokes the unmodified GNU LibreDWG0.13.4 Windows x64 `dwgread.exe` as a separate local process. This is third-party GPL3-or-later software, attributed independently from Linecraft's original application code. The runtime uses unmodified GNU libiconv1.18 (LGPL2.1-or-later). No Autodesk application code or assets are included.

Complete matching released source archives and license texts accompany these binaries in this directory and in the installer resources. GNU LibreDWG's Windows build scripts and configure/cmake instructions are in the included source archive. GNU libiconv's source archive contains its configure/build instructions. `manifest.json` records the official release URLs and SHA256 identities. The reader is beta software; successful DWG decoding is distinct from complete support for every proprietary object type. Original input drawings remain read-only; only owned temporary copies are converted.

Upstream: https://www.gnu.org/software/libredwg/ and https://github.com/LibreDWG/libredwg/releases/tag/0.13.4 . GNU libiconv: https://www.gnu.org/software/libiconv/ . GNU LibreDWG's GPL license is COPYING; libiconv's library license is libiconv-COPYING.LIB, with program GPL text in libiconv-COPYING.
