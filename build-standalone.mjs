/** Reproducible, dependency-free offline build of the original Linecraft sources. */
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const read = name => readFile(path.join(directory,name),'utf8');
const [template, css, favicon] = await Promise.all([
  read('index.html'),read('styles.css'),read('favicon.svg'),
]);
const moduleURLs=new Map(),visiting=new Set();
async function embedModule(name){
  if(moduleURLs.has(name))return moduleURLs.get(name);
  if(visiting.has(name))throw new Error(`The offline module graph contains a cycle at ${name}.`);
  if(!/^(?:architecture\/)?[a-z0-9-]+\.mjs$/i.test(name))throw new Error(`Unexpected module path: ${name}.`);
  visiting.add(name);
  let source=await read(name);
  const imports=[...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)(['"])((?:\.\.\/|\.\/)(?:[a-z0-9-]+\/)*[a-z0-9-]+\.mjs)\1/g)];
  for(const dependency of new Set(imports.map(match=>match[2]))){
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),dependency));
    const embedded=await embedModule(resolved);
    source=source.replaceAll(`'${dependency}'`,`'${embedded}'`).replaceAll(`"${dependency}"`,`"${embedded}"`);
  }
  if(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]\.{1,2}\//.test(source))throw new Error(`Unresolved offline dependency in ${name}.`);
  const url=`data:text/javascript;base64,${Buffer.from(source,'utf8').toString('base64')}`;
  moduleURLs.set(name,url);visiting.delete(name);return url;
}
const appURL=await embedModule('app.mjs');
const faviconURL = `data:image/svg+xml;base64,${Buffer.from(favicon,'utf8').toString('base64')}`;
// Each data URL retains its own module scope, including lazy PDF setup dependencies.
const inlineApp=`import '${appURL}';`;
let html = template
  // The desktop policy allows external modules only. This optional embedded build
  // contains an inline module and a data-URL import, so omit that source policy.
  .replace(/\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, '')
  .replace('<link rel="stylesheet" href="styles.css">',`<style>\n${css}\n</style>`)
  .replace('<link rel="icon" type="image/svg+xml" href="favicon.svg">',`<link rel="icon" type="image/svg+xml" href="${faviconURL}">`)
  .replace('<script type="module" src="app.mjs"></script>',`<script type="module">\n${inlineApp}\n</script>`);
if (html === template || html.includes('src="app.mjs"') || html.includes('href="styles.css"')) {
  throw new Error('The HTML template did not match the standalone build markers.');
}
html = html.replace('<!doctype html>','<!doctype html>\n<!-- Linecraft CAD standalone build. Rebuild with node build-standalone.mjs. -->');
const destination = path.join(directory,'standalone.html');
await writeFile(destination,html,'utf8');
process.stdout.write(`Built ${destination}\n${Buffer.byteLength(html,'utf8')} bytes; no external resources.\n`);
