"""Independent fixed registered-font reference for synthetic architectural text.

Reads existing registered faces in place. It returns numeric/name diagnostics
and a sourceFile binding for PRIVATE audit receipts, never font bytes, outlines
or registry values. Public summaries must omit sourceFile. No Linecraft code or
metric parser is imported. A caller must bind the production inventory.
"""
import hashlib
import math
import os
import re
import struct
from pathlib import Path

import fitz

SPECS = {
    'ARCHITXT': ('ARchitxt (TrueType)', 'ARCHITXT.TTF'),
    'Technic': ('Technic (TrueType)', 'technic_.ttf'),
}
FONT_FAMILIES = tuple(SPECS)
MAX_FONT_BYTES = 16 * 1024 * 1024


def normalized_face(value):
    assert isinstance(value, str) and value
    return re.sub(r'[^a-z0-9]', '', re.sub(r'^[A-Z]{6}\+', '', value).lower())


def resolve_registered_font(family):
    """Resolve only the two fixed names inside supported installed-font roots."""
    assert os.name == 'nt', 'Required registered Windows font reference not run'
    import winreg
    registered_name, basename = SPECS[family]
    value = None
    for hive in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
        try:
            with winreg.OpenKey(hive, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts', 0, winreg.KEY_READ) as key:
                found, kind = winreg.QueryValueEx(key, registered_name)
                assert kind == winreg.REG_SZ and isinstance(found, str)
                value = found
        except FileNotFoundError:
            continue
    assert value is not None, ('Required registered font not run: registration absent', family)
    assert 0 < len(value) <= 1024 and not re.search(r'[\x00-\x1f\x7f%]', value)
    root_candidates = [Path(os.environ['SystemRoot']) / 'Fonts',
                       Path.home() / 'AppData' / 'Local' / 'Microsoft' / 'Windows' / 'Fonts']
    if os.environ.get('LOCALAPPDATA'):
        root_candidates.append(Path(os.environ['LOCALAPPDATA']) / 'Microsoft' / 'Windows' / 'Fonts')
    roots = []
    for candidate in root_candidates:
        try:
            real = candidate.resolve(strict=True)
            if real.is_dir() and real not in roots:
                roots.append(real)
        except FileNotFoundError:
            pass
    selected = Path(value)
    if selected.is_absolute():
        candidates = [selected]
    else:
        assert not re.search(r'[\\/:]', value) and value.casefold() == basename.casefold()
        candidates = [root / value for root in roots]
    for candidate in candidates:
        try:
            actual = candidate.resolve(strict=True)
        except FileNotFoundError:
            continue
        if actual.is_file() and any(actual != root and actual.is_relative_to(root) for root in roots):
            assert actual.name.casefold() == basename.casefold()
            assert 12 <= actual.stat().st_size <= MAX_FONT_BYTES
            return actual
    raise AssertionError(('Required registered font not run: unsupported or unavailable location', family))


class SFNT:
    def __init__(self, data):
        self.data = data
        assert 12 <= len(data) <= MAX_FONT_BYTES
        assert self.u32(0) in [0x00010000, 0x74727565, 0x4f54544f]
        count = self.u16(4)
        assert 1 <= count <= 256
        self.bounds(12, 16 * count)
        self.tables = {}
        for index in range(count):
            at = 12 + index * 16
            tag = data[at:at + 4].decode('ascii')
            offset, length = self.u32(at + 8), self.u32(at + 12)
            self.bounds(offset, length)
            assert tag not in self.tables
            self.tables[tag] = (offset, length)

    def bounds(self, at, count):
        assert isinstance(at, int) and isinstance(count, int)
        assert at >= 0 and count >= 0 and at + count <= len(self.data)

    def u16(self, at):
        self.bounds(at, 2)
        return struct.unpack_from('>H', self.data, at)[0]

    def i16(self, at):
        self.bounds(at, 2)
        return struct.unpack_from('>h', self.data, at)[0]

    def u32(self, at):
        self.bounds(at, 4)
        return struct.unpack_from('>I', self.data, at)[0]

    def table(self, tag, minimum):
        at, length = self.tables[tag]
        assert length >= minimum
        return at, length

    def cmap_lookup(self, at, end, codepoint):
        form = self.u16(at)
        if form == 4:
            length = self.u16(at + 2)
            assert at + length <= end and length >= 16
            count = self.u16(at + 6) // 2
            assert self.u16(at + 6) % 2 == 0 and count > 0 and 16 + count * 8 <= length
            ends = at + 14
            starts = ends + count * 2 + 2
            deltas = starts + count * 2
            ranges = deltas + count * 2
            for index in range(count):
                low, high = self.u16(starts + 2 * index), self.u16(ends + 2 * index)
                assert low <= high
                if low <= codepoint <= high:
                    delta, distance = self.i16(deltas + 2 * index), self.u16(ranges + 2 * index)
                    if distance:
                        target = ranges + 2 * index + distance + 2 * (codepoint - low)
                        assert at <= target and target + 2 <= at + length
                        glyph = self.u16(target)
                        return (glyph + delta) & 65535 if glyph else 0
                    return (codepoint + delta) & 65535
            return 0
        if form == 12:
            length, count = self.u32(at + 4), self.u32(at + 12)
            assert length >= 16 and at + length <= end and count <= 100000 and 16 + count * 12 <= length
            for index in range(count):
                low, high, glyph = struct.unpack_from('>III', self.data, at + 16 + index * 12)
                assert low <= high <= 0x10ffff
                if low <= codepoint <= high:
                    return glyph + codepoint - low
            return 0
        return None

    def h_mapping(self):
        at, length = self.table('cmap', 4)
        count = self.u16(at + 2)
        assert count <= 128 and 4 + 8 * count <= length
        records = []
        for index in range(count):
            base = at + 4 + index * 8
            platform, encoding, offset = self.u16(base), self.u16(base + 2), self.u32(base + 4)
            start = at + offset
            assert at <= start and start + 2 <= at + length
            if not (platform == 0 or platform == 3 and encoding in [0, 1, 10]):
                continue
            form = self.u16(start)
            if form not in [4, 12]:
                continue
            records.append({'platform': platform, 'encoding': encoding, 'format': form,
                            'H': self.cmap_lookup(start, at + length, 72),
                            'privateH': self.cmap_lookup(start, at + length, 0xf048)})
        ordinary = {row['H'] for row in records if row['H']}
        if ordinary:
            assert len(ordinary) == 1, 'Conflicting ASCII H cmap mappings'
            glyph = ordinary.pop()
            codepoint, symbol_alias = 72, False
        else:
            aliases = {row['privateH'] for row in records
                       if row['platform'] == 3 and row['encoding'] == 0 and row['privateH']}
            assert len(aliases) == 1, 'ASCII H absent without a verified Windows-symbol alias'
            glyph = aliases.pop()
            assert all(not row['privateH'] or row['privateH'] == glyph for row in records)
            codepoint, symbol_alias = 0xf048, True
        return glyph, codepoint, symbol_alias, records

    def postscript_name(self):
        at, length = self.table('name', 6)
        count, string_offset = self.u16(at + 2), self.u16(at + 4)
        assert 6 + count * 12 <= length
        names = []
        for index in range(count):
            platform, encoding, language, name_id, size, offset = struct.unpack_from('>HHHHHH', self.data, at + 6 + index * 12)
            if name_id != 6 or platform not in [0, 1, 3]:
                continue
            start = at + string_offset + offset
            assert at <= start and start + size <= at + length
            names.append(self.data[start:start + size].decode('mac_roman' if platform == 1 else 'utf-16-be'))
        assert names and len(set(map(normalized_face, names))) == 1
        return names[0]

    def h_metrics(self):
        head, _ = self.table('head', 54)
        hhea, _ = self.table('hhea', 36)
        maxp, _ = self.table('maxp', 6)
        hmtx, hmtx_length = self.table('hmtx', 4)
        glyph, mapped_codepoint, alias, cmaps = self.h_mapping()
        glyph_count, advance_count = self.u16(maxp + 4), self.u16(hhea + 34)
        assert 0 < advance_count <= glyph_count and 0 < glyph < glyph_count
        advance_offset = min(glyph, advance_count - 1) * 4
        assert advance_offset + 4 <= hmtx_length
        advance = self.u16(hmtx + advance_offset)
        units = self.u16(head + 18)
        assert 16 <= units <= 16384 and 0 < advance <= 65535
        os2, os2_length = self.table('OS/2', 2)
        cap = self.i16(os2 + 88) if self.u16(os2) >= 2 and os2_length >= 90 else None
        basis, bounds = 'OS/2 sCapHeight', None
        if cap is None or cap <= 0:
            loca, loca_length = self.table('loca', 2)
            glyf, glyf_length = self.table('glyf', 10)
            long_offsets = self.i16(head + 50)
            assert long_offsets in [0, 1]
            index_size = 4 if long_offsets else 2
            assert (glyph + 2) * index_size <= loca_length
            glyph_offset = self.u32(loca + glyph * 4) if long_offsets else self.u16(loca + glyph * 2) * 2
            next_offset = self.u32(loca + (glyph + 1) * 4) if long_offsets else self.u16(loca + (glyph + 1) * 2) * 2
            assert glyph_offset + 10 <= next_offset <= glyf_length
            bounds = list(struct.unpack_from('>hhhh', self.data, glyf + glyph_offset + 2))
            cap = bounds[3] - bounds[1]
            basis = 'Mapped H glyph header yMax minus yMin'
        assert 0 < cap <= 65535
        return {'unitsPerEm': units, 'capHeight': cap, 'advanceUnits': advance,
                'glyphId': glyph, 'mappedCodepoint': mapped_codepoint, 'windowsSymbolAlias': alias,
                'capBasis': basis, 'HBoundingBoxUnits': bounds, 'cmapRecords': cmaps,
                'OS2Version': self.u16(os2)}


def font_reference(family, inventory):
    file = resolve_registered_font(family)
    before = file.stat()
    data = file.read_bytes()
    after = file.stat()
    assert before.st_size == after.st_size == len(data) and before.st_mtime_ns == after.st_mtime_ns
    digest = hashlib.sha256(data).hexdigest()
    matches = [row for row in inventory if row.get('fontFamily', row.get('family')) == family
               and row.get('bold') is False and row.get('italic') is False]
    assert len(matches) == 1 and matches[0].get('available') is True
    assert matches[0].get('sha256') == digest, ('Production inventory does not bind the exact independent reference', family)
    sfnt = SFNT(data)
    metrics, name = sfnt.h_metrics(), sfnt.postscript_name()
    font = fitz.Font(fontfile=str(file))
    mapped = metrics['mappedCodepoint']
    assert font.has_glyph(mapped) == metrics['glyphId'], 'Independent MuPDF lookup disagrees with SFNT mapping'
    actual_advance = font.glyph_advance(mapped)
    advance_per_em = metrics['advanceUnits'] / metrics['unitsPerEm']
    assert math.isfinite(actual_advance) and abs(actual_advance - advance_per_em) < 1e-6
    return {'family': family, 'sha256': digest, 'sourceFile': str(file), 'unitsPerEm': metrics['unitsPerEm'],
            'capHeight': metrics['capHeight'], 'capRatio': metrics['capHeight'] / metrics['unitsPerEm'],
            'HAdvancePerEm': advance_per_em, 'postscriptName': name, 'faceKey': normalized_face(name),
            'independentParser': 'Bounded stdlib SFNT cmap/hmtx/glyf/name fields with MuPDF mapped-glyph cross-check',
            'mappingDiagnostics': {**metrics, 'nativeRequestedCodepoint': 72,
                                   'MuPDFASCIIHGlyph': font.has_glyph(72),
                                   'MuPDFMappedHAdvancePerEm': actual_advance,
                                   'PDFRequiredTextCodepoint': 72,
                                   'qualifyingScope': 'Mapped H advance only; private-use PDF text is not silently accepted'}}
