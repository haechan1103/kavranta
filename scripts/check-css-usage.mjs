import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const entryPath = path.join(sourceRoot, "styles/global.css");
const maxOwnedStylesheetLines = 600;

function walk(directory, predicate) {
  const matches = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...walk(entryPath, predicate));
    else if (predicate(entryPath)) matches.push(entryPath);
  }
  return matches;
}

const cssFiles = walk(sourceRoot, (file) => file.endsWith(".css"));
const sourceFiles = [
  ...walk(sourceRoot, (file) =>
    (file.endsWith(".ts") || file.endsWith(".tsx"))
    && !file.includes(`${path.sep}test${path.sep}`)
    && !file.includes(".test."),
  ),
  path.join(root, "index.html"),
];
const sourceText = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const entryText = fs.readFileSync(entryPath, "utf8");
const errors = [];

const nonImportLines = entryText
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "" && !line.trim().startsWith("@import "));
if (nonImportLines.length > 0) {
  errors.push("src/styles/global.css may contain imports only");
}

const importedFiles = new Set();
const globalImports = new Set();
const importersByFile = new Map();
for (const match of entryText.matchAll(/@import\s+["']([^"']+)["'];/g)) {
  const importedPath = path.resolve(path.dirname(entryPath), match[1]);
  if (!fs.existsSync(importedPath)) {
    errors.push(`missing imported stylesheet: ${path.relative(root, importedPath)}`);
  }
  if (globalImports.has(importedPath)) {
    errors.push(`duplicate stylesheet import: ${path.relative(root, importedPath)}`);
  }
  if (path.dirname(importedPath) !== path.dirname(entryPath)) {
    errors.push(`global.css may import shared styles only: ${path.relative(root, importedPath)}`);
  }
  globalImports.add(importedPath);
  importedFiles.add(importedPath);
}

for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8");
  const localImports = new Set();
  for (const match of source.matchAll(/import\s+["']([^"']+\.css)["'];/g)) {
    const importedPath = path.resolve(path.dirname(sourceFile), match[1]);
    if (!fs.existsSync(importedPath)) {
      errors.push(`missing imported stylesheet: ${path.relative(root, importedPath)}`);
    }
    if (localImports.has(importedPath)) {
      errors.push(`duplicate stylesheet import in ${path.relative(root, sourceFile)}: ${path.relative(root, importedPath)}`);
    }
    localImports.add(importedPath);
    importedFiles.add(importedPath);
    const importers = importersByFile.get(importedPath) ?? [];
    importers.push(sourceFile);
    importersByFile.set(importedPath, importers);
  }
}

if (!importedFiles.has(entryPath)) {
  errors.push("src/styles/global.css must be imported by the application entry point");
}

for (const cssFile of cssFiles) {
  if (cssFile === entryPath) continue;
  const relativePath = path.relative(root, cssFile);
  const css = fs.readFileSync(cssFile, "utf8");
  const lineCount = css.split(/\r?\n/).length - 1;
  if (lineCount > maxOwnedStylesheetLines) {
    errors.push(`${relativePath} has ${lineCount} lines; split it by component ownership`);
  }
  if (!importedFiles.has(cssFile)) {
    errors.push(`stylesheet is not imported: ${relativePath}`);
  }
  if (path.dirname(cssFile) !== path.join(sourceRoot, "styles")) {
    const hasOwningImporter = (importersByFile.get(cssFile) ?? []).some(
      (importer) => path.dirname(importer) === path.dirname(cssFile),
    );
    if (!hasOwningImporter) {
      errors.push(`feature stylesheet lacks a colocated owner import: ${relativePath}`);
    }
  }

  const selectors = css.matchAll(/(?:^|\n)\s*(\.[^{}]+)\{/g);
  const classNames = new Set();
  for (const selectorMatch of selectors) {
    for (const classMatch of selectorMatch[1].matchAll(/\.([_a-zA-Z]+[\w-]*)/g)) {
      classNames.add(classMatch[1]);
    }
  }
  for (const className of classNames) {
    if (!sourceText.includes(className)) {
      errors.push(`unused CSS class candidate: ${relativePath} .${className}`);
    }
  }
}

for (const importedFile of importedFiles) {
  if (importedFile !== entryPath && !cssFiles.includes(importedFile)) {
    errors.push(`import is outside the managed CSS tree: ${path.relative(root, importedFile)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`CSS ownership is clean across ${cssFiles.length - 1} stylesheets.`);
}
