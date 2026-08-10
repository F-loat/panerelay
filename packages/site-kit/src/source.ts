import { createRequire } from 'node:module';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PANERELAY_FETCH_ADAPTER_PROTOCOL,
  isFetchAdapterManifest,
  type FetchAdapterCommand,
  type FetchAdapterManifest,
} from '@panerelay/protocol';
import ts from 'typescript';
import type { SiteDefinition } from './definitions.js';

const MAX_SOURCE_FILES = 256;
const MAX_SOURCE_FILE_BYTES = 1024 * 1024;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_SOURCE_DEPTH = 32;
const SITE_FILE = 'panerelay.site.ts';
const COMMANDS_DIRECTORY = 'commands';
const ALLOWED_PACKAGE_IMPORT = '@panerelay/site-kit';

export interface InspectedCommand {
  filePath: string;
  relativePath: string;
  metadata: FetchAdapterCommand;
}

export interface InspectedSite {
  sourceDirectory: string;
  site: SiteDefinition;
  commands: InspectedCommand[];
  sourceFiles: string[];
  manifest: FetchAdapterManifest;
}

export interface InspectSiteSourceInput {
  sourceDirectory: string;
  label?: string;
}

function sourceError(sourceDirectory: string, filePath: string, message: string): Error {
  const shown = relative(sourceDirectory, filePath) || '.';
  return new Error(`${shown}: ${message}`);
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function readBoundedSource(root: string, path: string): Promise<string> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink()) throw sourceError(root, path, 'symbolic links are not supported');
  if (!metadata.isFile()) throw sourceError(root, path, 'expected a regular TypeScript file');
  if (metadata.size > MAX_SOURCE_FILE_BYTES) {
    throw sourceError(root, path, `source file exceeds ${MAX_SOURCE_FILE_BYTES} bytes`);
  }
  return readFile(path, 'utf8');
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node: ts.PropertyName, root: string, path: string): string {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  throw sourceError(root, path, 'metadata property names must be literal');
}

function literalValue(node: ts.Expression, root: string, path: string, field: string): unknown {
  const expression = unwrapExpression(node);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element, index) => {
      if (ts.isSpreadElement(element)) {
        throw sourceError(root, path, `${field}[${index}] cannot use a spread`);
      }
      return literalValue(element, root, path, `${field}[${index}]`);
    });
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const result: Record<string, unknown> = {};
    for (const member of expression.properties) {
      if (!ts.isPropertyAssignment(member)) {
        throw sourceError(root, path, `${field} must contain literal property assignments`);
      }
      const name = propertyName(member.name, root, path);
      if (Object.hasOwn(result, name)) {
        throw sourceError(root, path, `${field}.${name} is declared more than once`);
      }
      result[name] = literalValue(member.initializer, root, path, `${field}.${name}`);
    }
    return result;
  }
  throw sourceError(root, path, `${field} must be statically evaluable literal metadata`);
}

function definitionObject(
  source: ts.SourceFile,
  root: string,
  path: string,
  helper: 'defineSite' | 'defineCommand',
): ts.ObjectLiteralExpression {
  const exports = source.statements.filter(ts.isExportAssignment);
  if (exports.length !== 1 || exports[0]?.isExportEquals) {
    throw sourceError(root, path, `must have exactly one default ${helper}(...) export`);
  }
  const expression = unwrapExpression(exports[0]!.expression);
  if (!ts.isCallExpression(expression) || expression.arguments.length !== 1) {
    throw sourceError(root, path, `default export must call ${helper}(...) once`);
  }
  const callee = unwrapExpression(expression.expression);
  if (!ts.isIdentifier(callee) || callee.text !== helper) {
    throw sourceError(root, path, `default export must call ${helper}(...)`);
  }
  const argument = unwrapExpression(expression.arguments[0]!);
  if (!ts.isObjectLiteralExpression(argument)) {
    throw sourceError(root, path, `${helper}(...) requires an object literal`);
  }
  return argument;
}

function extractMetadata(
  source: ts.SourceFile,
  root: string,
  path: string,
  helper: 'defineSite' | 'defineCommand',
): Record<string, unknown> {
  const object = definitionObject(source, root, path, helper);
  const metadata: Record<string, unknown> = {};
  let handlers = 0;
  for (const member of object.properties) {
    if (ts.isMethodDeclaration(member)) {
      const name = propertyName(member.name, root, path);
      if (helper !== 'defineCommand' || name !== 'run') {
        throw sourceError(root, path, `${name} must be literal metadata`);
      }
      handlers += 1;
      continue;
    }
    if (!ts.isPropertyAssignment(member)) {
      throw sourceError(root, path, 'definition cannot use spreads or shorthand properties');
    }
    const name = propertyName(member.name, root, path);
    if (name === 'run') {
      const value = unwrapExpression(member.initializer);
      if (!ts.isArrowFunction(value) && !ts.isFunctionExpression(value)) {
        throw sourceError(root, path, 'run must be an inline function');
      }
      handlers += 1;
      continue;
    }
    if (Object.hasOwn(metadata, name)) {
      throw sourceError(root, path, `${name} is declared more than once`);
    }
    metadata[name] = literalValue(member.initializer, root, path, name);
  }
  if (helper === 'defineCommand' && handlers !== 1) {
    throw sourceError(root, path, 'command must declare exactly one run handler');
  }
  return metadata;
}

function parseSource(root: string, path: string, text: string): ts.SourceFile {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const diagnostics = (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  const first = diagnostics?.[0];
  if (first) {
    throw sourceError(root, path, ts.flattenDiagnosticMessageText(first.messageText, '\n'));
  }
  return source;
}

function importSpecifiers(source: ts.SourceFile, root: string, path: string): string[] {
  const imports: string[] = [];
  const add = (value: ts.Expression | undefined, label: string): void => {
    if (!value || !ts.isStringLiteralLike(value)) {
      throw sourceError(root, path, `${label} requires a string-literal module specifier`);
    }
    imports.push(value.text);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, 'import');
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier, 'export');
    if (ts.isImportEqualsDeclaration(node)) {
      throw sourceError(root, path, 'TypeScript import-equals declarations are not supported');
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword)
        add(node.arguments[0], 'dynamic import');
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        add(node.arguments[0], 'require');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

async function resolveRelativeImport(
  root: string,
  importer: string,
  specifier: string,
): Promise<string> {
  const base = resolve(dirname(importer), specifier);
  if (!isWithin(root, base))
    throw sourceError(root, importer, `import escapes the source root: ${specifier}`);
  const candidates = new Set<string>([base]);
  const extension = extname(base);
  if (!extension) {
    candidates.add(`${base}.ts`);
    candidates.add(join(base, 'index.ts'));
  } else if (['.js', '.mjs', '.cjs'].includes(extension)) {
    candidates.add(`${base.slice(0, -extension.length)}.ts`);
  }
  for (const candidate of candidates) {
    try {
      const metadata = await lstat(candidate);
      if (metadata.isSymbolicLink()) {
        throw sourceError(root, candidate, 'symbolic links are not supported');
      }
      if (metadata.isFile() && candidate.endsWith('.ts')) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw sourceError(root, importer, `cannot resolve relative import: ${specifier}`);
}

async function collectSourceGraph(
  root: string,
  entries: readonly string[],
): Promise<{
  files: string[];
  parsed: Map<string, ts.SourceFile>;
}> {
  const pending = [...entries];
  const files: string[] = [];
  const parsed = new Map<string, ts.SourceFile>();
  let totalBytes = 0;
  while (pending.length > 0) {
    const path = pending.shift()!;
    if (parsed.has(path)) continue;
    if (!isWithin(root, path)) throw sourceError(root, path, 'source path escapes the source root');
    const pathDepth = relative(root, path).split(sep).length;
    if (pathDepth > MAX_SOURCE_DEPTH) throw sourceError(root, path, 'source path is too deep');
    if (files.length >= MAX_SOURCE_FILES)
      throw new Error(`site source exceeds ${MAX_SOURCE_FILES} files`);
    const text = await readBoundedSource(root, path);
    totalBytes += Buffer.byteLength(text);
    if (totalBytes > MAX_SOURCE_BYTES)
      throw new Error(`site source exceeds ${MAX_SOURCE_BYTES} bytes`);
    const source = parseSource(root, path, text);
    parsed.set(path, source);
    files.push(path);
    for (const specifier of importSpecifiers(source, root, path)) {
      if (specifier === ALLOWED_PACKAGE_IMPORT || specifier.startsWith('node:')) continue;
      if (!specifier.startsWith('.')) {
        throw sourceError(root, path, `unsupported package import: ${specifier}`);
      }
      const imported = await resolveRelativeImport(root, path, specifier);
      if (imported.endsWith('.test.ts')) {
        throw sourceError(root, path, 'production source cannot import a test module');
      }
      pending.push(imported);
    }
  }
  return { files: files.sort(), parsed };
}

function typeRoots(): string[] {
  try {
    const packageJson = createRequire(import.meta.url).resolve('@types/node/package.json');
    return [dirname(dirname(packageJson))];
  } catch {
    return [];
  }
}

interface TypecheckSite {
  input: InspectSiteSourceInput;
  site: InspectedSite;
}

function typecheck(sites: readonly TypecheckSite[]): void {
  const declarations = fileURLToPath(new URL('./adapter-api.d.ts', import.meta.url));
  const options: ts.CompilerOptions = {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noUncheckedIndexedAccess: true,
    paths: { [ALLOWED_PACKAGE_IMPORT]: [declarations] },
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
    types: ['node'],
    typeRoots: typeRoots(),
  };
  const rootNames = [...new Set(sites.flatMap(({ site }) => site.sourceFiles))];
  const program = ts.createProgram({ rootNames, options });
  const ownerOf = (fileName: string): TypecheckSite | undefined =>
    sites.find(({ site }) => isWithin(site.sourceDirectory, fileName));
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .filter(diagnostic => !diagnostic.file || ownerOf(diagnostic.file.fileName))
    .sort((left, right) => {
      const leftOwner = left.file ? ownerOf(left.file.fileName) : undefined;
      const rightOwner = right.file ? ownerOf(right.file.fileName) : undefined;
      const leftIndex = leftOwner ? sites.indexOf(leftOwner) : -1;
      const rightIndex = rightOwner ? sites.indexOf(rightOwner) : -1;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      const fileOrder = (left.file?.fileName ?? '').localeCompare(right.file?.fileName ?? '');
      if (fileOrder !== 0) return fileOrder;
      return (left.start ?? 0) - (right.start ?? 0);
    });
  const first = diagnostics[0];
  if (!first) return;
  const message = ts.flattenDiagnosticMessageText(first.messageText, '\n');
  if (!first.file) throw new Error(`typecheck: ${message}`);
  const owner = ownerOf(first.file.fileName);
  if (!owner) throw new Error(`typecheck: ${message}`);
  const position = first.file.getLineAndCharacterOfPosition(first.start ?? 0);
  const error = sourceError(
    owner.site.sourceDirectory,
    first.file.fileName,
    `${position.line + 1}:${position.character + 1} ${message}`,
  );
  throw owner.input.label ? new Error(`${owner.input.label}: ${error.message}`) : error;
}

async function inspectSiteSourceStructure(sourceDirectory: string): Promise<InspectedSite> {
  const requestedRoot = resolve(sourceDirectory);
  const rootMetadata = await stat(requestedRoot);
  if (!rootMetadata.isDirectory()) throw new Error(`${requestedRoot} is not a directory`);
  const root = await realpath(requestedRoot);
  const sitePath = join(root, SITE_FILE);
  const commandDirectory = join(root, COMMANDS_DIRECTORY);
  const commandEntries = await readdir(commandDirectory, { withFileTypes: true });
  const commandPaths = commandEntries
    .filter(
      entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'),
    )
    .map(entry => join(commandDirectory, entry.name))
    .sort();
  if (commandPaths.length === 0) throw new Error(`${COMMANDS_DIRECTORY}: no command modules found`);

  const graph = await collectSourceGraph(root, [sitePath, ...commandPaths]);
  const siteSource = graph.parsed.get(sitePath)!;
  const site = extractMetadata(
    siteSource,
    root,
    sitePath,
    'defineSite',
  ) as unknown as SiteDefinition;
  const commands = commandPaths.map(path => {
    const metadata = extractMetadata(
      graph.parsed.get(path)!,
      root,
      path,
      'defineCommand',
    ) as unknown as FetchAdapterCommand;
    const expectedName = path.slice(dirname(path).length + 1, -'.ts'.length);
    if (metadata.name !== expectedName) {
      throw sourceError(root, path, `command name must match its file name (${expectedName})`);
    }
    return { filePath: path, relativePath: relative(root, path).split(sep).join('/'), metadata };
  });
  const manifest: FetchAdapterManifest = {
    protocol: PANERELAY_FETCH_ADAPTER_PROTOCOL,
    ...site,
    entry: 'adapter.mjs',
    commands: commands.map(command => command.metadata),
  };
  if (!isFetchAdapterManifest(manifest)) {
    throw new Error(`${SITE_FILE}: site or command metadata does not satisfy the adapter protocol`);
  }
  return { sourceDirectory: root, site, commands, sourceFiles: graph.files, manifest };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function inspectSiteSources(
  inputs: readonly InspectSiteSourceInput[],
): Promise<InspectedSite[]> {
  if (inputs.length === 0) throw new Error('site source selection must not be empty');
  const selected: TypecheckSite[] = [];
  const sourceRoots = new Set<string>();
  for (const input of inputs) {
    let site: InspectedSite;
    try {
      site = await inspectSiteSourceStructure(input.sourceDirectory);
    } catch (error) {
      if (!input.label) throw error;
      throw new Error(`${input.label}: ${errorMessage(error)}`, { cause: error });
    }
    if (sourceRoots.has(site.sourceDirectory)) {
      const message = 'source directory is selected more than once';
      throw new Error(input.label ? `${input.label}: ${message}` : message);
    }
    sourceRoots.add(site.sourceDirectory);
    selected.push({ input, site });
  }
  typecheck(selected);
  return selected.map(({ site }) => site);
}

export async function inspectSiteSource(sourceDirectory: string): Promise<InspectedSite> {
  return (await inspectSiteSources([{ sourceDirectory }]))[0]!;
}
