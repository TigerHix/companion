import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const webRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(webRoot, "src");
const packageJsonPath = path.join(webRoot, "package.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const declared = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
  ...Object.keys(packageJson.peerDependencies || {}),
  ...Object.keys(packageJson.optionalDependencies || {}),
]);

const sourceFiles = [];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);
const cssImportRegex = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/g;

function shouldIgnoreFile(filePath) {
  const base = path.basename(filePath);
  return base.endsWith(".d.ts")
    || base.includes(".test.")
    || base.includes(".spec.");
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    if (shouldIgnoreFile(fullPath)) continue;
    sourceFiles.push(fullPath);
  }
}

function isBareImport(specifier) {
  return !specifier.startsWith(".")
    && !specifier.startsWith("/")
    && !specifier.startsWith("@/")
    && !specifier.startsWith("virtual:")
    && !specifier.startsWith("node:");
}

function getPackageName(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

function scriptKindForFile(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function collectScriptSpecifiers(filePath, contents) {
  const specifiers = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(filePath),
  );

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length > 0
      && ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

walk(srcRoot);

const missing = new Map();

for (const filePath of sourceFiles) {
  const relativePath = path.relative(webRoot, filePath);
  const contents = fs.readFileSync(filePath, "utf8");

  if (filePath.endsWith(".css")) {
    cssImportRegex.lastIndex = 0;
    let match;
    while ((match = cssImportRegex.exec(contents))) {
      const specifier = match[1];
      if (!isBareImport(specifier)) continue;
      const packageName = getPackageName(specifier);
      if (declared.has(packageName) || packageName === "bun") continue;
      if (!missing.has(packageName)) missing.set(packageName, new Set());
      missing.get(packageName).add(relativePath);
    }
    continue;
  }

  for (const specifier of collectScriptSpecifiers(filePath, contents)) {
    if (!isBareImport(specifier)) continue;
    const packageName = getPackageName(specifier);
    if (declared.has(packageName) || packageName === "bun") continue;
    if (!missing.has(packageName)) missing.set(packageName, new Set());
    missing.get(packageName).add(relativePath);
  }
}

if (missing.size > 0) {
  console.error("Undeclared direct imports found in web/src:");
  for (const [packageName, files] of [...missing.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.error(`- ${packageName}`);
    for (const filePath of [...files].sort()) {
      console.error(`  ${filePath}`);
    }
  }
  process.exit(1);
}

console.log("Declared import audit passed.");
