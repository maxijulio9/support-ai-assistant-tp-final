#!/usr/bin/env node
// Filtra el contrato OpenAPI para el generador: quita /health y /webhook/*, y los
// schemas de components.schemas que solo esos paths usaban. No modifica el original.
// Sin dependencias externas, solo modulos nativos de Node.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = join(root, 'openapi', 'openapi.json');
const outputDir = join(root, '.openapi-gen');
const outputPath = join(outputDir, 'openapi.filtered.json');

const isExcludedPath = (path) => path === '/health' || path.startsWith('/webhook/');

function collectSchemaRefs(node, refs = new Set()) {
  if (node === null || typeof node !== 'object') return refs;
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaRefs(item, refs);
    return refs;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      const match = value.match(/^#\/components\/schemas\/(.+)$/);
      if (match) refs.add(match[1]);
      continue;
    }
    collectSchemaRefs(value, refs);
  }
  return refs;
}

const spec = JSON.parse(readFileSync(inputPath, 'utf-8'));

const allPaths = spec.paths ?? {};
const keptPaths = {};
const removedPaths = {};
for (const [path, item] of Object.entries(allPaths)) {
  if (isExcludedPath(path)) {
    removedPaths[path] = item;
  } else {
    keptPaths[path] = item;
  }
}

const schemas = spec.components?.schemas ?? {};

// Grafo de dependencias: un schema puede referenciar a otros schemas.
const schemaDeps = new Map();
for (const [name, def] of Object.entries(schemas)) {
  schemaDeps.set(name, collectSchemaRefs(def));
}

function closure(startNames) {
  const seen = new Set();
  const stack = [...startNames];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const deps = schemaDeps.get(name);
    if (deps) for (const dep of deps) stack.push(dep);
  }
  return seen;
}

const neededSchemas = closure(collectSchemaRefs(keptPaths));
const removableSchemas = [...closure(collectSchemaRefs(removedPaths))].filter(
  (name) => !neededSchemas.has(name),
);

const filteredSchemas = { ...schemas };
for (const name of removableSchemas) {
  delete filteredSchemas[name];
}

const filteredSpec = {
  ...spec,
  paths: keptPaths,
  components: {
    ...spec.components,
    schemas: filteredSchemas,
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(filteredSpec, null, 2) + '\n', 'utf-8');

console.log(`Paths originales: ${Object.keys(allPaths).length}`);
console.log(
  `Paths excluidos (${Object.keys(removedPaths).length}): ${Object.keys(removedPaths).join(', ')}`,
);
console.log(`Schemas originales: ${Object.keys(schemas).length}`);
console.log(
  `Schemas eliminados (${removableSchemas.length}): ${removableSchemas.join(', ') || '(ninguno)'}`,
);
console.log(`Contrato filtrado escrito en: ${outputPath}`);
