// Original independent group-code reader for synthetic DXF round trips.
export function readDXFRecords(text) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/), records = [], header = {};
  let section = null, pendingSection = false, current = null, headerVariable = null;
  const flush = () => {if (current) records.push(current); current = null;};
  for (let index = 0; index + 1 < rows.length; index += 2) {
    const code = Number(rows[index].trim()), raw = rows[index + 1], token = raw.trim();
    if (!Number.isInteger(code)) throw new Error(`Invalid DXF group code at line ${index + 1}.`);
    if (code === 0 && token === 'SECTION') {flush(); pendingSection = true; continue;}
    if (pendingSection && code === 2) {section = token; pendingSection = false; continue;}
    if (code === 0 && token === 'ENDSEC') {flush(); section = null; headerVariable = null; continue;}
    if (code === 0 && token === 'EOF') {flush(); break;}
    if (section === 'HEADER') {
      if (code === 9) {headerVariable = token; header[token] = [];}
      else if (headerVariable) header[headerVariable].push([code, raw]);
      continue;
    }
    if (!section) continue;
    if (code === 0) {flush(); current = {section, type: token, groups: []};}
    else current?.groups.push([code, raw]);
  }
  flush(); return {records, header};
}

