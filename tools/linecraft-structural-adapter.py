"""Original optional CLI for an explicitly chosen, separately supplied engine.

This file contains no structural load formula or private engine source. It loads
only reviewed source files whose bytes match the declared interface pin. Source
hashes supplied in a request are declarations; the receiving drawing application
must revalidate them against its actual current document.
"""
from __future__ import annotations

import argparse
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import types

sys.dont_write_bytecode = True
ENGINE_ID = "residential-structural-loads"
ENGINE_VERSION = "0.1.0"
ENGINE_COMMIT = "fb33e81e6c121385eaae2bdbf4dd0e77fefa9305"
ENGINE_PINS = {
    "loads/roof_live.py": "bc47413b7d10be2117e16e6e7513b74df32e8f16f2a07a25d9fce137dc6c2d4f",
    "loads/base.py": "b9bbe142e71fea81a6d6e38fb1d2c272ef22c004c331f33ab26ce99a30a092c6",
    "pyproject.toml": "0da8b298181362730f62f873ef7a5e656b3245073664c15aff53eb5f0085540d",
}
MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_EXCHANGE_BYTES = 2 * 1024 * 1024
MAX_NODES = 250000
MAX_DEPTH = 64
MAX_FACES = 256
MAX_VERTICES = 4096
NUMBER_LIMIT = 1e12
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


class AdapterError(ValueError):
    pass


def number_text(value):
    """ECMAScript-style finite number spelling for the bounded exchange domain.

    Python and JS use shortest round-trip decimals, but choose different fixed /
    exponent notation. Preserve shortest digits, normalize the notation and -0.
    Protocol numeric fields are bounded to 1e12; booleans are separate values.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise AdapterError("Canonical JSON requires finite numbers.")
    if value == 0:
        return "0"
    if isinstance(value, int):
        if abs(value) > 9007199254740991:
            raise AdapterError("Canonical integers must be exactly representable JS integers.")
        return str(value)
    spelling = repr(value).lower()
    if 1e-6 <= abs(value) < 1e21:
        return format(Decimal(spelling), "f").rstrip("0").rstrip(".") if "." in format(Decimal(spelling), "f") else format(Decimal(spelling), "f")
    mantissa, exponent = spelling.split("e") if "e" in spelling else (spelling, "0")
    mantissa = mantissa.removesuffix(".0")
    exp = int(exponent)
    return mantissa + "e" + ("+" if exp >= 0 else "-") + str(abs(exp))


def canonical_json(value):
    nodes = 0

    def visit(item, depth):
        nonlocal nodes
        nodes += 1
        if nodes > MAX_NODES or depth > MAX_DEPTH:
            raise AdapterError("Exchange exceeds its depth or node budget.")
        if item is None or isinstance(item, (bool, str)):
            if isinstance(item, str) and any(0xD800 <= ord(char) <= 0xDFFF for char in item):
                raise AdapterError("Exchange requires valid Unicode scalar text.")
            return json.dumps(item, ensure_ascii=False, separators=(",", ":"))
        if isinstance(item, (int, float)):
            return number_text(item)
        if isinstance(item, list):
            return "[" + ",".join(visit(x, depth + 1) for x in item) + "]"
        if isinstance(item, dict) and all(isinstance(k, str) for k in item):
            keys = sorted(item, key=lambda k: k.encode("utf-16-be", errors="surrogatepass"))
            return "{" + ",".join(visit(k, depth + 1) + ":" + visit(item[k], depth + 1) for k in keys) + "}"
        raise AdapterError("Exchange must contain JSON data only.")

    return visit(value, 0)


def canonical_hash(value):
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def shape(value, names, label):
    if not isinstance(value, dict) or set(value) != set(names.split()):
        raise AdapterError(f"{label} requires exactly its declared fields.")
    return value


def text(value, label, maximum=160):
    if not isinstance(value, str) or not value.strip() or len(value.encode("utf-16-le")) // 2 > maximum or any(ord(c) < 32 for c in value):
        raise AdapterError(f"{label} requires nonempty bounded text.")
    return value


def numeric(value, label, positive=False, nonnegative=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or abs(value) > NUMBER_LIMIT or positive and value <= 0 or nonnegative and value < 0:
        raise AdapterError(f"{label} requires a finite bounded number with the declared sign.")
    return value


def integer(value, label, minimum=0, maximum=1000000000000):
    numeric(value, label)
    if int(value) != value or not minimum <= value <= maximum:
        raise AdapterError(f"{label} requires a bounded integer.")
    return int(value)


def hashed(value, label):
    if not isinstance(value, str) or not HASH_RE.fullmatch(value):
        raise AdapterError(f"{label} requires a lowercase SHA-256.")
    return value


def point(value, label):
    shape(value, "x y z", label)
    for axis in "xyz":
        numeric(value[axis], label + "." + axis)


def near(a, b, label):
    if abs(a - b) > 1e-8 * max(1, abs(a), abs(b)):
        raise AdapterError(f"{label} disagrees with the supplied geometry or identity.")


def polygon_measures(points):
    origin = points[0]
    normal = [0.0, 0.0, 0.0]
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        a = [p[k] - origin[k] for k in "xyz"]
        b = [q[k] - origin[k] for k in "xyz"]
        normal[0] += a[1] * b[2] - a[2] * b[1]
        normal[1] += a[2] * b[0] - a[0] * b[2]
        normal[2] += a[0] * b[1] - a[1] * b[0]
    return abs(normal[2]) / 2, math.hypot(*normal) / 2, normal


def validate_request_v1(record):
    encoded = canonical_json(record).encode("utf-8")
    if len(encoded) > MAX_EXCHANGE_BYTES:
        raise AdapterError("Canonical exchange exceeds 2 MiB.")
    shape(record, "version kind status source selection regionId region member assumptions warnings exportHash", "Export")
    if record["version"] != 1 or isinstance(record["version"], bool) or record["kind"] != "linecraft-structural-roof-region" or record["status"] != "calculation-only":
        raise AdapterError("Unsupported structural roof export protocol.")
    hashed(record["exportHash"], "Export hash")
    payload = {k: v for k, v in record.items() if k != "exportHash"}
    if canonical_hash(payload) != record["exportHash"]:
        raise AdapterError("Export integrity hash does not match its canonical payload.")
    source = shape(record["source"], "hashAlgorithm documentHash architectureHash architectureRevision architectureSchemaVersion modelUnits", "Source")
    if source["hashAlgorithm"] != "SHA-256/canonical-json-v1" or source["modelUnits"] not in ["in", "ft", "mm", "cm", "m"]:
        raise AdapterError("Export requires the declared hash algorithm and physical model units.")
    for field in ["documentHash", "architectureHash"]:
        hashed(source[field], field)
    integer(source["architectureRevision"], "Architecture revision")
    integer(source["architectureSchemaVersion"], "Architecture schema", 1)
    selection = shape(record["selection"], "roofGroupId componentId faceIds", "Selection")
    text(selection["roofGroupId"], "Roof owner")
    if selection["componentId"] is not None:
        text(selection["componentId"], "Component owner")
    selected_ids = selection["faceIds"]
    if not isinstance(selected_ids, list) or not 1 <= len(selected_ids) <= MAX_FACES or selected_ids != sorted(set(selected_ids)):
        raise AdapterError("Selected faces must be a sorted unique bounded list.")
    for identity in selected_ids:
        text(identity, "Face ID")
    region = shape(record["region"], "id name scope roofGroupId componentId faceIds faces pitches projectedAreaSF surfaceAreaSF minElevationFt maxElevationFt elevations status reviewRequired", "Region")
    text(region["name"], "Region name")
    if region["id"] != record["regionId"] or region["roofGroupId"] != selection["roofGroupId"] or region["componentId"] != selection["componentId"] or region["faceIds"] != selected_ids:
        raise AdapterError("Region and selection identities disagree.")
    expected_id = "roof-region-" + canonical_hash(selection)[:24]
    if record["regionId"] != expected_id:
        raise AdapterError("Region ID disagrees with its selected source faces.")
    if region["status"] not in ["ok", "needs-review"] or not isinstance(region["reviewRequired"], bool) or region["reviewRequired"] != (region["status"] == "needs-review"):
        raise AdapterError("Region geometry/review qualification is invalid.")
    expected_scope = "face" if len(selected_ids) == 1 else "component" if selection["componentId"] is not None else "group"
    if region["scope"] != expected_scope or not isinstance(region["faces"], list) or len(region["faces"]) != len(selected_ids):
        raise AdapterError("Region scope or face count disagrees with selection.")
    seen = set()
    for face in region["faces"]:
        shape(face, "id roofGroupId componentId sourceEdgeKey riseTwice risePer12 projectedAreaSF surfaceAreaSF minElevationFt maxElevationFt bearingElevationFt heelOffsetFt eaveElevationFt verticesBuildingLocalFt verticesWorldFt", "Face")
        if face["id"] not in selected_ids or face["id"] in seen or face["roofGroupId"] != selection["roofGroupId"] or selection["componentId"] is not None and face["componentId"] != selection["componentId"]:
            raise AdapterError("Missing, duplicate or foreign source face.")
        seen.add(face["id"])
        if face["componentId"] is not None:
            text(face["componentId"], "Face component")
        text(face["sourceEdgeKey"], "Source edge key")
        rise = integer(face["riseTwice"], "Source half-rise", 1, 24)
        if numeric(face["risePer12"], "Source pitch", positive=True) != rise / 2:
            raise AdapterError("Source pitch does not match its half-rise.")
        for key in ["projectedAreaSF", "surfaceAreaSF"]:
            numeric(face[key], key, positive=True)
        for key in ["minElevationFt", "maxElevationFt", "bearingElevationFt", "heelOffsetFt", "eaveElevationFt"]:
            numeric(face[key], key)
        local, world = face["verticesBuildingLocalFt"], face["verticesWorldFt"]
        if not isinstance(local, list) or not 3 <= len(local) <= MAX_VERTICES or not isinstance(world, list) or len(world) != len(local):
            raise AdapterError("Face requires bounded corresponding local/world vertices.")
        for p in local + world:
            point(p, "Face vertex")
        projected, surface, normal = polygon_measures(local)
        if projected <= 0 or surface <= 0 or abs(normal[2]) < 1e-18:
            raise AdapterError("Roof face has no positive projected area.")
        near(projected, face["projectedAreaSF"], "Projected area")
        near(surface, face["surfaceAreaSF"], "Surface area")
        near(12 * math.hypot(normal[0], normal[1]) / abs(normal[2]), face["risePer12"], "Geometric pitch")
        near(min(p["z"] for p in local), face["minElevationFt"], "Minimum elevation")
        near(max(p["z"] for p in local), face["maxElevationFt"], "Maximum elevation")
        for p in local:
            distance = sum(normal[i] * (p[k] - local[0][k]) for i, k in enumerate("xyz")) / math.hypot(*normal)
            near(distance, 0, "Roof plane")
        near(polygon_measures(world)[0], projected, "World projected area")
        near(polygon_measures(world)[1], surface, "World surface area")
    expected_pitches = [{"riseTwice": rise, "risePer12": rise / 2} for rise in sorted({f["riseTwice"] for f in region["faces"]})]
    if not isinstance(region["pitches"], list):
        raise AdapterError("Region pitches must be declared data.")
    for row in region["pitches"]:
        shape(row, "riseTwice risePer12", "Region pitch")
        integer(row["riseTwice"], "Region half-rise", 1, 24)
        numeric(row["risePer12"], "Region pitch", positive=True)
    if region["pitches"] != expected_pitches:
        raise AdapterError("Region pitch list substituted or averaged source slopes.")
    for key in ["projectedAreaSF", "surfaceAreaSF"]:
        near(numeric(region[key], key, positive=True), sum(f[key] for f in region["faces"]), key)
    near(numeric(region["minElevationFt"], "Minimum region elevation"), min(f["minElevationFt"] for f in region["faces"]), "Minimum region elevation")
    near(numeric(region["maxElevationFt"], "Maximum region elevation"), max(f["maxElevationFt"] for f in region["faces"]), "Maximum region elevation")
    elevations = shape(region["elevations"], "datum association levels rooms bearingFaces", "Elevations")
    if elevations["datum"] != "building-local":
        raise AdapterError("Elevations require the declared building-local datum.")
    text(elevations["association"], "Elevation association", 500)
    for key, fields in [("levels", "id floorElevationFt defaultBearingElevationFt defaultCeilingElevationFt"), ("rooms", "id levelId floorElevationFt ceilingElevationFt targetCeilingElevationFt")]:
        if not isinstance(elevations[key], list) or len(elevations[key]) > MAX_NODES:
            raise AdapterError("Invalid source elevation list.")
        for row in elevations[key]:
            shape(row, fields, "Source elevations")
            for field in fields.split():
                text(row[field], field) if field in ["id", "levelId"] else numeric(row[field], field)
    expected_bearing = [{"faceId": f["id"], **{k: f[k] for k in ["bearingElevationFt", "heelOffsetFt", "eaveElevationFt"]}} for f in region["faces"]]
    if not isinstance(elevations["bearingFaces"], list):
        raise AdapterError("Bearing faces must be declared data.")
    for row in elevations["bearingFaces"]:
        shape(row, "faceId bearingElevationFt heelOffsetFt eaveElevationFt", "Bearing face")
        text(row["faceId"], "Bearing face ID")
        for key in ["bearingElevationFt", "heelOffsetFt", "eaveElevationFt"]:
            numeric(row[key], "Bearing face " + key)
    if elevations["bearingFaces"] != expected_bearing:
        raise AdapterError("Bearing/eave source declarations disagree with faces.")
    member = shape(record["member"], "label tributaryAreaSF application", "Member")
    text(member["label"], "Member label")
    numeric(member["tributaryAreaSF"], "Explicit member tributary area", positive=True)
    if member["application"] != "same-member-per-face-comparison":
        raise AdapterError("Only explicit same-member per-face comparison is supported.")
    assumptions = shape(record["assumptions"], "structuralVerification supplierVerification geometry assemblyNormalThicknessFt declaredReservations prefabricatedTrussDesignSurcharge manufacturingComplexitySurcharge", "Assumptions")
    for key in ["prefabricatedTrussDesignSurcharge", "manufacturingComplexitySurcharge"]:
        numeric(assumptions[key], key, nonnegative=True)
    if assumptions["structuralVerification"] != "unverified" or assumptions["supplierVerification"] != "unverified" or assumptions["geometry"] != "mathematical-roof-surfaces" or assumptions["prefabricatedTrussDesignSurcharge"] != 0 or assumptions["manufacturingComplexitySurcharge"] != 0:
        raise AdapterError("Unverified geometry and zero surcharge declarations must be retained.")
    numeric(assumptions["assemblyNormalThicknessFt"], "Declared assembly thickness", nonnegative=True)
    if not isinstance(assumptions["declaredReservations"], list):
        raise AdapterError("Reservations must be declared data.")
    for row in assumptions["declaredReservations"]:
        shape(row, "id kind minBuildingLocalFt maxBuildingLocalFt description", "Reservation")
        text(row["id"], "Reservation ID"); text(row["kind"], "Reservation kind")
        if not isinstance(row["description"], str) or len(row["description"]) > 500:
            raise AdapterError("Reservation description exceeds its bound.")
        point(row["minBuildingLocalFt"], "Reservation min"); point(row["maxBuildingLocalFt"], "Reservation max")
        if any(row["minBuildingLocalFt"][k] > row["maxBuildingLocalFt"][k] for k in "xyz"):
            raise AdapterError("Reservation bounds are reversed.")
    if not isinstance(record["warnings"], list) or len(record["warnings"]) > 64:
        raise AdapterError("Request warning count exceeds its bounded protocol capacity.")
    for warning in record["warnings"]:
        text(warning, "Warning", 500)
    return record


def validate_request_v2(record):
    """Validate explicit independent face assignments without inventing a load path."""
    if len(canonical_json(record).encode("utf-8")) > MAX_EXCHANGE_BYTES:
        raise AdapterError("Canonical exchange exceeds 2 MiB.")
    shape(record, "version kind status source selection regionId region assignments assumptions warnings exportHash", "Assignment export")
    if isinstance(record["version"], bool) or record["version"] != 2 or record["kind"] != "linecraft-structural-roof-assignments" or record["status"] != "calculation-only":
        raise AdapterError("Unsupported structural assignment export protocol.")
    hashed(record["exportHash"], "Export hash")
    if canonical_hash({k: v for k, v in record.items() if k != "exportHash"}) != record["exportHash"]:
        raise AdapterError("Export integrity hash does not match its canonical payload.")
    # Reuse the retained v1 geometry contract only. This neutral comparison is
    # never exported or calculated; the actual areas are each explicit v2 row.
    geometry = {k: v for k, v in record.items() if k not in ["assignments", "exportHash"]}
    geometry.update(version=1, kind="linecraft-structural-roof-region", member={"label": "Geometry validation only", "tributaryAreaSF": 1, "application": "same-member-per-face-comparison"})
    geometry["exportHash"] = canonical_hash(geometry)
    validate_request_v1(geometry)
    assignments = record["assignments"]
    if not isinstance(assignments, list) or not 1 <= len(assignments) <= 128:
        raise AdapterError("Assignments require 1 through 128 independent rows.")
    faces = {face["id"]: face for face in record["region"]["faces"]}
    seen = set()
    used_faces = set()
    for row in assignments:
        shape(row, "id memberLabel faceId projectedTributaryAreaSF deadLoadItems deadLoad", "Assignment")
        identity = text(row["id"], "Assignment ID", 80)
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]*", identity) or identity in seen:
            raise AdapterError("Assignment IDs must be unique bounded identifiers.")
        seen.add(identity)
        text(row["memberLabel"], "Member label")
        face = faces.get(row["faceId"]) if isinstance(row["faceId"], str) else None
        if face is None:
            raise AdapterError("Assignment face must belong to the selected source region.")
        used_faces.add(face["id"])
        area = numeric(row["projectedTributaryAreaSF"], "Projected assignment tributary SF", positive=True)
        if area > 1e9 or area > face["projectedAreaSF"] + max(1e-8, face["projectedAreaSF"] * 1e-10):
            raise AdapterError("Projected assignment tributary SF exceeds its selected face or budget.")
        items = row["deadLoadItems"]
        if not isinstance(items, list) or not 1 <= len(items) <= 32:
            raise AdapterError("Each assignment requires 1 through 32 declared dead-load items, including explicit zero.")
        factor = math.hypot(1, face["risePer12"] / 12)
        expected_items = []
        projected_psf = 0
        for item in items:
            shape(item, "label psf basis", "Declared dead-load item")
            text(item["label"], "Dead-load item label")
            psf = numeric(item["psf"], "Declared dead-load PSF", nonnegative=True)
            if psf > 1e6 or item["basis"] not in ["projected-horizontal", "sloping-surface"]:
                raise AdapterError("Declared dead load requires bounded PSF and an explicit supported area basis.")
            conversion = factor if item["basis"] == "sloping-surface" else 1
            converted = psf * conversion
            projected_psf += converted
            expected_items.append({**item, "projectionFactor": conversion, "projectedPSF": converted})
        if not math.isfinite(projected_psf) or projected_psf > 1e9 or not math.isfinite(projected_psf * area) or projected_psf * area > NUMBER_LIMIT:
            raise AdapterError("Declared dead-load arithmetic exceeds its PSF or force budget.")
        dead = shape(row["deadLoad"], "surfaceToProjectedFactor projectedPSF pounds items", "Derived declared dead load")
        for key, expected in [("surfaceToProjectedFactor", factor), ("projectedPSF", projected_psf), ("pounds", projected_psf * area)]:
            near(numeric(dead[key], "Derived dead load " + key, nonnegative=True), expected, "Derived dead load " + key)
        if not isinstance(dead["items"], list) or len(dead["items"]) != len(expected_items):
            raise AdapterError("Derived dead-load items must retain every explicit declaration.")
        for actual, expected in zip(dead["items"], expected_items):
            shape(actual, "label psf basis projectionFactor projectedPSF", "Derived dead-load item")
            if any(actual[k] != expected[k] for k in ["label", "psf", "basis"]):
                raise AdapterError("Derived dead-load item substituted an explicit declaration.")
            for key in ["projectionFactor", "projectedPSF"]:
                near(numeric(actual[key], "Derived item " + key, nonnegative=True), expected[key], "Derived item " + key)
    if used_faces != set(record["selection"]["faceIds"]):
        raise AdapterError("Selected source faces must exactly match assignment face ownership.")
    return record


def boundary_tolerance(*polygons):
    points = [point for polygon in polygons for point in polygon]
    extent = max(1, max(p[0] for p in points) - min(p[0] for p in points), max(p[1] for p in points) - min(p[1] for p in points))
    maximum = max(1, *(abs(v) for point in points for v in point))
    length = max(1e-10, extent * 1e-12, maximum * sys.float_info.epsilon * 8)
    return length, length * extent * 8


def boundary_area(polygon):
    ox, oy = polygon[0]
    return sum((p[0] - ox) * (q[1] - oy) - (q[0] - ox) * (p[1] - oy) for p, q in zip(polygon, polygon[1:] + polygon[:1])) / 2


def boundary_cross(a, b, p):
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def boundary_on_segment(point, a, b, length):
    return abs(boundary_cross(a, b, point)) <= length * max(1, math.dist(a, b)) and all(min(a[i], b[i]) - length <= point[i] <= max(a[i], b[i]) + length for i in [0, 1])


def boundary_segments_touch(a, b, c, d, length):
    if any(boundary_on_segment(p, x, y, length) for p, x, y in [(a, c, d), (b, c, d), (c, a, b), (d, a, b)]):
        return True
    ac, ad, ca, cb = boundary_cross(a,b,c), boundary_cross(a,b,d), boundary_cross(c,d,a), boundary_cross(c,d,b)
    eab, ecd = length * max(1,math.dist(a,b)), length * max(1,math.dist(c,d))
    return (ac > eab and ad < -eab or ad > eab and ac < -eab) and (ca > ecd and cb < -ecd or cb > ecd and ca < -ecd)


def boundary_spend(budget):
    budget[0] += 1
    if budget[0] > 2000000:
        raise AdapterError("Boundary geometry exceeds the independent two-million operation budget.")


def validate_boundary_ring(polygon, label, budget, tolerance=None):
    length, area_eps = tolerance or boundary_tolerance(polygon)
    if abs(boundary_area(polygon)) <= area_eps:
        raise AdapterError(label + " requires positive unambiguous projected area.")
    for i, a in enumerate(polygon):
        b = polygon[(i + 1) % len(polygon)]
        if math.dist(a, b) <= length:
            raise AdapterError(label + " has duplicate or numerically indistinguishable vertices.")
        previous = polygon[(i - 1) % len(polygon)]
        if abs(boundary_cross(previous, a, b)) <= length * max(1,math.dist(previous,b)) and (a[0] - previous[0]) * (b[0] - a[0]) + (a[1] - previous[1]) * (b[1] - a[1]) < -length * length:
            raise AdapterError(label + " has a backtracking or self-touching edge.")
        for j in range(i + 1, len(polygon)):
            boundary_spend(budget)
            if j == i + 1 or i == 0 and j == len(polygon) - 1:
                continue
            if boundary_segments_touch(a, b, polygon[j], polygon[(j + 1) % len(polygon)], length):
                raise AdapterError(label + " has a crossing, repeated vertex or self-touch.")
    return length, area_eps


def boundary_inside(point, polygon, length):
    if any(boundary_on_segment(point, a, b, length) for a, b in zip(polygon, polygon[1:] + polygon[:1])):
        return True
    inside = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > point[1]) != (b[1] > point[1]) and point[0] < a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1]):
            inside = not inside
    return inside


def boundary_triangles(polygon, budget, tolerance=None):
    length, area_eps = validate_boundary_ring(polygon, "Projected polygon", budget, tolerance)
    ring = list(polygon if boundary_area(polygon) > 0 else reversed(polygon))
    # Persistence retains original vertices/order. Only this internal index ring
    # discards collinear vertices for a stable, independent ear triangulation.
    changed = True
    while changed and len(ring) > 3:
        changed = False
        for i in range(len(ring)):
            if abs(boundary_cross(ring[i - 1], ring[i], ring[(i + 1) % len(ring)])) <= length * max(1,math.dist(ring[i-1],ring[(i+1)%len(ring)])):
                ring.pop(i); changed = True; break
    triangles = []
    while len(ring) > 3:
        found = False
        for i in range(len(ring)):
            a, b, d = ring[i - 1], ring[i], ring[(i + 1) % len(ring)]
            if boundary_cross(a, b, d) <= length * max(1,math.dist(a,d)):
                continue
            blocked = False
            for j, point in enumerate(ring):
                boundary_spend(budget)
                if j in {(i - 1) % len(ring), i, (i + 1) % len(ring)}:
                    continue
                if all(boundary_cross(x, y, point) >= -length * max(1,math.dist(x,y)) for x, y in [(a, b), (b, d), (d, a)]):
                    blocked = True; break
            if not blocked:
                triangles.append([a, b, d]);ring.pop(i);found = True;break
        if not found:
            raise AdapterError("Boundary triangulation is numerically ambiguous or unsupported.")
    triangles.append(ring)
    if abs(sum(abs(boundary_area(t)) for t in triangles) - abs(boundary_area(polygon))) > area_eps:
        raise AdapterError("Boundary triangulation failed its independent area check.")
    return triangles


def boundary_intersection_area(first, second, budget):
    length, area_eps = boundary_tolerance(first, second)
    if any(min(max(p[i] for p in first), max(p[i] for p in second)) - max(min(p[i] for p in first), min(p[i] for p in second)) <= 0 for i in [0, 1]):
        return 0
    ox, oy = first[0]
    a = [(x - ox, y - oy) for x, y in first]
    b = [(x - ox, y - oy) for x, y in second]
    total = 0
    triangles_a,triangles_b=boundary_triangles(a,budget,(length,area_eps)),boundary_triangles(b,budget,(length,area_eps))
    for triangle_a in triangles_a:
        for triangle_b in triangles_b:
            boundary_spend(budget)
            output = triangle_a[:]
            for start, end in zip(triangle_b, triangle_b[1:] + triangle_b[:1]):
                incoming, output = output, []
                if not incoming:
                    break
                previous = incoming[-1]
                previous_side = boundary_cross(start, end, previous)
                for current in incoming:
                    side = boundary_cross(start, end, current)
                    previous_inside, current_inside = previous_side >= 0, side >= 0
                    if previous_inside != current_inside:
                        fraction = previous_side / (previous_side - side)
                        output.append((previous[0] + fraction * (current[0] - previous[0]), previous[1] + fraction * (current[1] - previous[1])))
                    if current_inside:
                        output.append(current)
                    previous, previous_side = current, side
            if len(output) >= 3:
                total += abs(boundary_area(output))
    return total


def boundary_contained(boundary, face, budget):
    if len(face) > 256:
        raise AdapterError("Drawn boundary source faces are limited to 256 vertices.")
    length, area_eps = boundary_tolerance(boundary, face)
    if not all(boundary_inside(p, face, length) for p in boundary):
        raise AdapterError("Drawn boundary vertex is outside its source face.")
    for a, b in zip(boundary, boundary[1:] + boundary[:1]):
        parameters = [0, 1]
        ab = (b[0] - a[0], b[1] - a[1])
        denominator_projection = ab[0] ** 2 + ab[1] ** 2
        for c, d in zip(face, face[1:] + face[:1]):
            boundary_spend(budget)
            cd = (d[0] - c[0], d[1] - c[1])
            denominator = ab[0] * cd[1] - ab[1] * cd[0]
            if abs(denominator) > length * max(1, math.hypot(*ab), math.hypot(*cd)):
                ca = (c[0] - a[0], c[1] - a[1])
                t = (ca[0] * cd[1] - ca[1] * cd[0]) / denominator
                u = (ca[0] * ab[1] - ca[1] * ab[0]) / denominator
                if -length <= t <= 1 + length and -length <= u <= 1 + length:
                    parameters.append(max(0, min(1, t)))
            elif abs(boundary_cross(a, b, c)) <= length * max(1, math.hypot(*ab)):
                for p in [c, d]:
                    parameters.append(max(0, min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / denominator_projection)))
        parameters = sorted(set(parameters))
        for t, u in zip(parameters, parameters[1:]):
            if not boundary_inside((a[0] + ab[0] * (t + u) / 2, a[1] + ab[1] * (t + u) / 2), face, length):
                raise AdapterError("Drawn boundary edge leaves its concave source face.")
    if abs(boundary_area(boundary)) - boundary_intersection_area(boundary, face, budget) > area_eps:
        raise AdapterError("Drawn boundary has positive area outside its source face.")


def boundary_v2_surrogate(record):
    surrogate = {k: v for k, v in record.items() if k not in ["assignments", "exportHash"]}
    surrogate.update(version=2, kind="linecraft-structural-roof-assignments", assignments=[{k: v for k, v in row.items() if k != "areaDefinition"} for row in record["assignments"]])
    surrogate["exportHash"] = canonical_hash(surrogate)
    return surrogate


def validate_request_v3(record):
    if len(canonical_json(record).encode("utf-8")) > MAX_EXCHANGE_BYTES:
        raise AdapterError("Canonical exchange exceeds 2 MiB.")
    shape(record, "version kind status source selection regionId region assignments assumptions warnings exportHash", "Boundary export")
    if isinstance(record["version"], bool) or record["version"] != 3 or record["kind"] != "linecraft-structural-roof-boundaries" or record["status"] != "calculation-only":
        raise AdapterError("Unsupported structural boundary export protocol.")
    hashed(record["exportHash"], "Boundary export hash")
    if canonical_hash({k: v for k, v in record.items() if k != "exportHash"}) != record["exportHash"]:
        raise AdapterError("Boundary export integrity hash does not match its canonical payload.")
    if not isinstance(record["assignments"], list) or not 1 <= len(record["assignments"]) <= 128:
        raise AdapterError("Boundary assignments require 1 through 128 independent rows.")
    for row in record["assignments"]:
        shape(row, "id memberLabel faceId projectedTributaryAreaSF deadLoadItems deadLoad areaDefinition", "Boundary assignment")
    validate_request_v2(boundary_v2_surrogate(record))
    faces = {face["id"]: face for face in record["region"]["faces"]}
    budget, drawn = [0], []
    for row in record["assignments"]:
        definition = row["areaDefinition"]
        if not isinstance(definition, dict):
            raise AdapterError("Assignment requires an explicit area definition.")
        if definition.get("kind") == "explicit-area":
            shape(definition, "kind projectedAreaSF", "Explicit area definition")
            if numeric(definition["projectedAreaSF"], "Explicit projected SF", positive=True) != row["projectedTributaryAreaSF"]:
                raise AdapterError("Explicit area definition disagrees with its assignment.")
            continue
        shape(definition, "kind coordinateSystem vertices", "Drawn area definition")
        if definition["kind"] != "drawn-boundary" or definition["coordinateSystem"] != "world-xy-feet" or not isinstance(definition["vertices"], list) or not 3 <= len(definition["vertices"]) <= 64:
            raise AdapterError("Drawn boundary requires an open 3..64 vertex world-XY-feet ring.")
        polygon = []
        for point in definition["vertices"]:
            shape(point, "x y", "Drawn boundary vertex")
            polygon.append((numeric(point["x"], "Boundary X feet"), numeric(point["y"], "Boundary Y feet")))
        _, area_eps = validate_boundary_ring(polygon, "Drawn boundary", budget)
        if abs(abs(boundary_area(polygon)) - row["projectedTributaryAreaSF"]) > area_eps:
            raise AdapterError("Drawn boundary derived area disagrees with its actual vertices.")
        face = [(p["x"], p["y"]) for p in faces[row["faceId"]]["verticesWorldFt"]]
        boundary_contained(polygon, face, budget)
        for previous in drawn:
            _, pair_eps = boundary_tolerance(polygon, previous)
            if boundary_intersection_area(polygon, previous, budget) > pair_eps:
                raise AdapterError("Drawn assignment boundaries have positive projected overlap; no calculation was performed.")
        drawn.append(polygon)
    return record


def validate_request(record):
    if isinstance(record, dict) and record.get("version") == 3:
        return validate_request_v3(record)
    return validate_request_v2(record) if isinstance(record, dict) and record.get("version") == 2 else validate_request_v1(record)


def load_engine(engine_root):
    """Execute only verified bytes, bypassing package __init__ and cached pyc."""
    root = Path(engine_root).resolve(strict=True)
    if not root.is_dir():
        raise AdapterError("Chosen engine root must be a directory.")
    sources = {}
    for relative, expected in ENGINE_PINS.items():
        file = (root / relative).resolve(strict=True)
        if not file.is_relative_to(root) or not file.is_file():
            raise AdapterError("Engine source escapes the chosen root or exceeds its budget.")
        with file.open("rb") as stream:
            data = stream.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise AdapterError("Engine source exceeds its 1 MiB read budget.")
        if hashlib.sha256(data).hexdigest() != expected:
            raise AdapterError(f"Engine source differs from the reviewed pin: {relative}")
        sources[relative] = data
    namespace = "_linecraft_external_roof_engine"
    package = types.ModuleType(namespace); package.__path__ = []
    sys.modules[namespace] = package
    for short in ["base", "roof_live"]:
        name = namespace + "." + short
        module = types.ModuleType(name); module.__package__ = namespace
        module.__file__ = str(root / "loads" / (short + ".py"))
        sys.modules[name] = module
        exec(compile(sources["loads/" + short + ".py"], module.__file__, "exec"), module.__dict__)
    return sys.modules[namespace + ".roof_live"]


def calculate_v1(record, engine_root):
    validate_request_v1(record)
    engine = load_engine(engine_root)
    rows = []
    engine_warnings = []
    for face in record["region"]["faces"]:
        result = engine.compute_roof_live_load(tributary_area_sf=record["member"]["tributaryAreaSF"], F=face["risePer12"])
        values = result.model_dump()
        for key in ["L0_psf", "tributary_area_sf", "F", "R1", "R2", "Lr_psf"]:
            numeric(values[key], "External " + key, nonnegative=True)
        if values["tributary_area_sf"] != record["member"]["tributaryAreaSF"] or values["F"] != face["risePer12"]:
            raise AdapterError("External engine substituted explicit member area or pitch.")
        if values.get("note") is not None:
            note = "External engine: " + text(values["note"], "External engine note", 480)
            if note not in engine_warnings:
                engine_warnings.append(note)
        rows.append({"faceId": face["id"], "pitchRisePer12": face["risePer12"], "memberTributaryAreaSF": values["tributary_area_sf"], "F": values["F"], "R1": values["R1"], "R2": values["R2"], "L0PSF": values["L0_psf"], "LrPSF": values["Lr_psf"]})
    bounds = {"min": numeric(engine.LR_MIN_PSF, "External lower clamp", nonnegative=True), "max": numeric(engine.LR_MAX_PSF, "External upper clamp", positive=True)}
    warnings = list(record["warnings"]) + engine_warnings + ["The external adapter verifies its reviewed engine file pins; source hashes remain declarations until Linecraft checks its actual current document.", "Engine results compare the same explicitly supplied member tributary area for every face; no total load, load allocation or member capacity is calculated.", "No structural, supplier, framing or code approval is provided. Engine version and source pins identify the executed calculation only."]
    if len(warnings) > 64:
        raise AdapterError("Combined request, engine and qualification warnings exceed 64; no warnings were dropped.")
    output = {"version": 1, "kind": "linecraft-structural-roof-result", "status": "calculation-only", "exportHash": record["exportHash"], "source": {k: record["source"][k] for k in ["documentHash", "architectureHash"]}, "regionId": record["regionId"], "engine": {"id": ENGINE_ID, "version": ENGINE_VERSION, "sourceCommit": ENGINE_COMMIT, "roofLiveSHA256": ENGINE_PINS["loads/roof_live.py"]}, "calculationBoundsPSF": bounds, "calculationPrecision": {"factorDecimals": 4, "loadDecimals": 3}, "calculations": rows, "warnings": warnings}
    if len(canonical_json(output).encode("utf-8")) > MAX_EXCHANGE_BYTES:
        raise AdapterError("Result exceeds its bounded exchange size.")
    return output


def rounded_output(value, decimals):
    """Match positive ECMAScript toFixed rounding on the actual binary value."""
    return float(Decimal.from_float(float(value)).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP))


def calculate_v2(record, engine_root):
    validate_request_v2(record)
    engine = load_engine(engine_root)
    faces = {face["id"]: face for face in record["region"]["faces"]}
    rows = []
    engine_warnings = []
    for assignment in record["assignments"]:
        face = faces[assignment["faceId"]]
        area = assignment["projectedTributaryAreaSF"]
        values = engine.compute_roof_live_load(tributary_area_sf=area, F=face["risePer12"]).model_dump()
        for key in ["L0_psf", "tributary_area_sf", "F", "R1", "R2", "Lr_psf"]:
            numeric(values[key], "External " + key, nonnegative=True)
        if values["tributary_area_sf"] != area or values["F"] != face["risePer12"]:
            raise AdapterError("External engine substituted explicit assignment area or source pitch.")
        if values.get("note") is not None:
            note = "External engine: " + text(values["note"], "External engine note", 480)
            if note not in engine_warnings:
                engine_warnings.append(note)
        dead = assignment["deadLoad"]
        rows.append({"assignmentId": assignment["id"], "memberLabel": assignment["memberLabel"], "faceId": face["id"], "pitchRisePer12": face["risePer12"], "projectedTributaryAreaSF": area, "F": values["F"], "R1": values["R1"], "R2": values["R2"], "L0PSF": values["L0_psf"], "LrPSF": values["Lr_psf"], "deadLoadProjectedPSF": rounded_output(dead["projectedPSF"], 3), "deadLoadPounds": rounded_output(dead["pounds"], 3), "roofLivePounds": rounded_output(values["Lr_psf"] * area, 3)})
    bounds = {"min": numeric(engine.LR_MIN_PSF, "External lower clamp", nonnegative=True), "max": numeric(engine.LR_MAX_PSF, "External upper clamp", positive=True)}
    warnings = list(record["warnings"]) + engine_warnings + ["The adapter executes the separately chosen hash-pinned engine for each independent assignment using its explicit projected tributary SF and exact source pitch.", "Declared dead-load components are arithmetic inputs, not verified materials or member load paths. Sloping-surface PSF is converted to horizontal projected PSF before multiplication by projected area.", "Rows are independent assignments, including repeated face or member labels. No member/building aggregation, load combination, capacity, framing, supplier or code approval is provided.", "Source identity remains a declaration until Linecraft validates its actual current document."]
    if len(warnings) > 64:
        raise AdapterError("Combined request, engine and qualification warnings exceed 64; no warnings were dropped.")
    output = {"version": 2, "kind": "linecraft-structural-roof-assignment-result", "status": "calculation-only", "exportHash": record["exportHash"], "source": {k: record["source"][k] for k in ["documentHash", "architectureHash"]}, "regionId": record["regionId"], "engine": {"id": ENGINE_ID, "version": ENGINE_VERSION, "sourceCommit": ENGINE_COMMIT, "roofLiveSHA256": ENGINE_PINS["loads/roof_live.py"]}, "calculationBoundsPSF": bounds, "calculationPrecision": {"factorDecimals": 4, "loadDecimals": 3, "forceDecimals": 3}, "calculations": rows, "warnings": warnings}
    if len(canonical_json(output).encode("utf-8")) > MAX_EXCHANGE_BYTES:
        raise AdapterError("Result exceeds its bounded exchange size.")
    return output


def calculate(record, engine_root):
    if isinstance(record, dict) and record.get("version") == 3:
        validate_request_v3(record)
        output = calculate_v2(boundary_v2_surrogate(record), engine_root)
        output.update(version=3, kind="linecraft-structural-roof-boundary-result", exportHash=record["exportHash"])
        return output
    return calculate_v2(record, engine_root) if isinstance(record, dict) and record.get("version") == 2 else calculate_v1(record, engine_root)


def _pairs(pairs):
    data = {}
    for key, value in pairs:
        if key in data:
            raise AdapterError("Duplicate JSON keys are unsupported.")
        data[key] = value
    return data


def read_request(file):
    path = Path(file)
    if not path.is_file():
        raise AdapterError("Request must be a bounded existing JSON file.")
    try:
        with path.open("rb") as stream:
            data = stream.read(MAX_INPUT_BYTES + 1)
        if len(data) > MAX_INPUT_BYTES:
            raise AdapterError("Request exceeds its 8 MiB read budget.")
        return json.loads(data.decode("utf-8"), object_pairs_hook=_pairs, parse_constant=lambda value: (_ for _ in ()).throw(AdapterError("Nonfinite JSON is unsupported.")))
    except (UnicodeError, json.JSONDecodeError, RecursionError) as error:
        raise AdapterError("Request is not valid bounded UTF-8 JSON.") from error


def main(argv=None):
    parser = argparse.ArgumentParser(description="Optional read-only roof-live comparison using a separately chosen pinned external engine.")
    parser.add_argument("--request", required=True, help="Explicit Linecraft structural roof export JSON")
    parser.add_argument("--output", required=True, help="New result JSON file; existing paths are never overwritten")
    parser.add_argument("--engine-root", required=True, help="Explicit external engine directory; never read from JSON")
    args = parser.parse_args(argv)
    try:
        output = Path(args.output)
        if output.exists() or output.is_symlink():
            raise AdapterError("Output already exists; preserve it before choosing a new path.")
        record = read_request(args.request)
        result = calculate(record, args.engine_root)
        payload = (json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode("utf-8")
        descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
        print(json.dumps({"status": "calculation-only", "assignments" if result["version"] in [2, 3] else "faces": len(result["calculations"]), "engine": result["engine"]}, ensure_ascii=False))
        return 0
    except (AdapterError, OSError, ImportError, TypeError, KeyError, OverflowError, UnicodeError) as error:
        print(json.dumps({"status": "error", "error": str(error)}, ensure_ascii=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
