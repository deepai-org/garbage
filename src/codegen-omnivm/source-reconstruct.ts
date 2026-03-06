/**
 * Shared source code reconstruction helpers.
 *
 * Used by both the legacy JS code generator and the new manifest generator
 * to convert AST nodes back to source code strings.
 *
 * When `source` is provided, span-based extraction is used as a fallback
 * for node kinds that don't have explicit reconstruction logic, ensuring
 * all parseable nodes produce valid source code.
 */
import * as AST from '../ast';
import { OmniRuntime } from '../runtime-resolver/types';

/**
 * Extract source text from a node's span. Returns undefined if source
 * or span information is unavailable.
 */
function spanExtract(node: { span?: AST.Span }, source?: string): string | undefined {
  if (source && node.span && node.span.end > node.span.start) {
    return source.slice(node.span.start, node.span.end);
  }
  return undefined;
}

export function exprToCode(expr: AST.Expr, source?: string): string {
  switch (expr.kind) {
    case "Identifier":
      return expr.name;
    case "NumericLiteral":
      return expr.raw;
    case "StringLiteral":
      return stringLiteralToCode(expr);
    case "BooleanLiteral":
      return String(expr.value);
    case "NullLiteral":
      return "null";
    case "Member":
      return `${exprToCode(expr.object, source)}.${expr.property.name}`;
    case "Call":
      const args = expr.args.map(a => exprToCode(a, source)).join(", ");
      return `${exprToCode(expr.callee, source)}(${args})`;
    case "Binary":
      return `(${exprToCode(expr.left, source)} ${expr.op} ${exprToCode(expr.right, source)})`;
    case "Unary": {
      if (expr.prefix) {
        // Word operators (await, typeof, delete, void, throw) need a space
        const space = /^[a-z]+$/i.test(expr.op) ? " " : "";
        return `${expr.op}${space}${exprToCode(expr.argument, source)}`;
      }
      return `${exprToCode(expr.argument, source)}${expr.op}`;
    }
    case "Index":
      return `${exprToCode(expr.object, source)}[${exprToCode(expr.index, source)}]`;
    case "Assign":
      return `${exprToCode(expr.left, source)} ${expr.op} ${exprToCode(expr.right, source)}`;
    case "Ternary":
      return `(${exprToCode(expr.test, source)} ? ${exprToCode(expr.consequent, source)} : ${exprToCode(expr.alternate, source)})`;
    case "ArrayLiteral":
      return `[${expr.elements.map(e => exprToCode(e, source)).join(", ")}]`;
    case "ObjectLiteral":
      const props = expr.properties.map(p => {
        const key = p.key.kind === "Identifier" ? p.key.name : exprToCode(p.key as AST.Expr, source);
        return `${key}: ${exprToCode(p.value, source)}`;
      }).join(", ");
      return `{${props}}`;
    case "Lambda": {
      const lParams = expr.params.map(p => paramToCode(p, source)).join(", ");
      return lambdaToCode(expr, lParams, source);
    }
    case "Spread":
      return `...${exprToCode(expr.argument, source)}`;
    case "ListComprehension":
      const targets = expr.targets.map(t => t.name).join(", ");
      const filter = expr.filter ? ` if ${exprToCode(expr.filter, source)}` : "";
      return `[${exprToCode(expr.expression, source)} for ${targets} in ${exprToCode(expr.iterable, source)}${filter}]`;
    case "RuntimeTag":
      return exprToCode(expr.expr, source);
    case "JSXElement":
      return jsxToCreateElement(expr, source);
    case "JSXFragment":
      return jsxFragmentToCreateElement(expr, source);
    case "Match":
      return matchToTernary(expr, source);
    default:
      return spanExtract(expr, source) || "/* expr */";
  }
}

export function stringLiteralToCode(node: AST.StringLiteral): string {
  if (node.parts.length === 1 && node.parts[0].kind === "Text") {
    return JSON.stringify(node.parts[0].value as string);
  }
  let result = "`";
  for (const part of node.parts) {
    if (part.kind === "Text") {
      result += part.value as string;
    } else {
      const val = typeof part.value === "string" ? part.value : exprToCode(part.value as AST.Expr);
      result += "${" + val + "}";
    }
  }
  result += "`";
  return result;
}

export function nodeToSourceCode(node: AST.Decl | AST.Stmt | AST.Expr, source?: string): string {
  switch (node.kind) {
    case "ExprStmt":
      return exprToCode(node.expr, source);
    case "FuncDecl":
      // For non-JS runtimes, prefer span extraction to get the original syntax
      return spanExtract(node, source) || (() => {
        const kw = node.declKeyword || "function";
        const params = node.params.map(p => paramToCode(p, source)).join(", ");
        return `${kw} ${node.name.name}(${params}) { /* body */ }`;
      })();
    case "VarDecl":
      return node.names.map((n, i) =>
        node.values?.[i] ? `let ${n.name} = ${exprToCode(node.values[i], source)}` : `let ${n.name}`
      ).join("; ");
    case "ConstDecl":
      return node.names.map((n, i) =>
        node.values?.[i] ? `const ${n.name} = ${exprToCode(node.values[i], source)}` : `const ${n.name}`
      ).join("; ");
    case "ShortDecl": {
      // Rewrite := to const for JS-valid output
      if (node.pairs) {
        return node.pairs.map((p: any) =>
          `const ${p.name.name} = ${exprToCode(p.expr, source)}`
        ).join("; ");
      }
      if (node.targets && node.value) {
        const names = node.targets
          .filter((t: any) => t.kind === "Identifier")
          .map((t: any) => t.name);
        return `const ${names.join(", ")} = ${exprToCode(node.value, source)}`;
      }
      return spanExtract(node, source) || "/* ShortDecl */";
    }
    case "Return":
      return `return ${node.values.map(v => exprToCode(v, source)).join(", ")}`;
    default:
      if (isExprKind(node.kind)) {
        return exprToCode(node as AST.Expr, source);
      }
      return spanExtract(node, source) || `/* ${node.kind} */`;
  }
}

export function paramToCode(param: AST.Param, source?: string): string {
  const name = param.name.kind === "Identifier" ? param.name.name : (spanExtract(param.name, source) || "/* pattern */");
  const spread = param.spread ? "..." : "";
  const defaultVal = param.defaultValue ? ` = ${exprToCode(param.defaultValue, source)}` : "";
  return `${spread}${name}${defaultVal}`;
}

export function importSpecsToCode(node: AST.ImportDecl): string {
  const parts: string[] = [];
  if (node.defaultImport) parts.push(node.defaultImport.name);
  if (node.namespaceImport) parts.push(`* as ${node.namespaceImport.name}`);
  if (node.specifiers && node.specifiers.length > 0) {
    const specs = node.specifiers.map(s =>
      s.imported === s.local ? s.local : `${s.imported} as ${s.local}`
    ).join(", ");
    parts.push(`{ ${specs} }`);
  }
  return parts.join(", ");
}

export function escapeTemplate(code: string): string {
  return code.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

export function tagToRuntime(tag: string): OmniRuntime {
  switch (tag) {
    case "py": return OmniRuntime.Python;
    case "js": return OmniRuntime.JavaScript;
    case "go": return OmniRuntime.Go;
    case "rb": return OmniRuntime.Ruby;
    case "java": return OmniRuntime.Java;
    default: return OmniRuntime.JavaScript;
  }
}

// ─── JSX Lowering ──────────────────────────────────────────────────

function jsxElementNameToCode(name: AST.JSXElementName): string {
  switch (name.kind) {
    case "JSXIdentifier":
      return name.name;
    case "JSXMemberExpression":
      return `${jsxElementNameToCode(name.object)}.${name.property.name}`;
    case "JSXNamespacedName":
      return `"${name.namespace.name}:${name.name.name}"`;
    default:
      return "null";
  }
}

function jsxElementNameToArg(name: AST.JSXElementName): string {
  if (name.kind === "JSXIdentifier") {
    // Lowercase → string literal (HTML element), uppercase → identifier (component)
    const n = name.name;
    return /^[a-z]/.test(n) ? `"${n}"` : n;
  }
  if (name.kind === "JSXMemberExpression") {
    return jsxElementNameToCode(name);
  }
  // Namespaced
  return `"${(name as AST.JSXNamespacedName).namespace.name}:${(name as AST.JSXNamespacedName).name.name}"`;
}

function jsxAttrToProps(attributes: AST.JSXAttribute[], source?: string): string {
  if (attributes.length === 0) return "null";

  const hasSpread = attributes.some(a => a.kind === "JSXSpreadAttribute");
  const parts: string[] = [];

  if (hasSpread) {
    // Use Object.assign for spread attributes
    parts.push("Object.assign({}");
    for (const attr of attributes) {
      if (attr.kind === "JSXSpreadAttribute") {
        parts.push(`, ${exprToCode(attr.argument, source)}`);
      } else {
        const key = attr.name.kind === "JSXIdentifier" ? attr.name.name : `"${attr.name.namespace.name}:${attr.name.name.name}"`;
        const val = jsxAttrValue(attr.value, source);
        parts.push(`, {${key}: ${val}}`);
      }
    }
    parts.push(")");
    return parts.join("");
  }

  // Simple object literal
  const propParts: string[] = [];
  for (const attr of attributes) {
    if (attr.kind === "JSXSpreadAttribute") continue;
    const key = attr.name.kind === "JSXIdentifier" ? attr.name.name : `"${attr.name.namespace.name}:${attr.name.name.name}"`;
    const val = jsxAttrValue(attr.value, source);
    propParts.push(`${key}: ${val}`);
  }
  return `{${propParts.join(", ")}}`;
}

function jsxAttrValue(value: AST.JSXAttributeValue | null, source?: string): string {
  if (value === null) return "true"; // boolean attribute: <div disabled />
  if (value.kind === "StringLiteral") return stringLiteralToCode(value);
  if (value.kind === "JSXExpressionContainer") {
    if (value.expression.kind === "JSXEmptyExpression") return "undefined";
    return exprToCode(value.expression as AST.Expr, source);
  }
  if (value.kind === "JSXElement") return jsxToCreateElement(value, source);
  if (value.kind === "JSXFragment") return jsxFragmentToCreateElement(value, source);
  return "null";
}

function jsxChildToArg(child: AST.JSXChild, source?: string): string | null {
  switch (child.kind) {
    case "JSXText": {
      // Collapse whitespace-only text to null
      const text = child.value.replace(/^\s*\n\s*/g, "").replace(/\s*\n\s*$/g, "");
      if (!text.trim()) return null;
      return JSON.stringify(text);
    }
    case "JSXExpressionContainer":
      if (child.expression.kind === "JSXEmptyExpression") return null;
      return exprToCode(child.expression as AST.Expr, source);
    case "JSXSpreadChild":
      return `...${exprToCode(child.expression, source)}`;
    case "JSXElement":
      return jsxToCreateElement(child, source);
    case "JSXFragment":
      return jsxFragmentToCreateElement(child, source);
    default:
      return null;
  }
}

function jsxToCreateElement(node: AST.JSXElement, source?: string): string {
  const type = jsxElementNameToArg(node.openingElement.name);
  const props = jsxAttrToProps(node.openingElement.attributes, source);
  const children = node.children
    .map(c => jsxChildToArg(c, source))
    .filter((c): c is string => c !== null);

  if (children.length === 0) {
    return `React.createElement(${type}, ${props})`;
  }
  return `React.createElement(${type}, ${props}, ${children.join(", ")})`;
}

function jsxFragmentToCreateElement(node: AST.JSXFragment, source?: string): string {
  const children = node.children
    .map(c => jsxChildToArg(c, source))
    .filter((c): c is string => c !== null);

  if (children.length === 0) {
    return `React.createElement(React.Fragment, null)`;
  }
  return `React.createElement(React.Fragment, null, ${children.join(", ")})`;
}

// ─── Match Expression Lowering ─────────────────────────────────────

function matchToTernary(node: AST.Match, source?: string): string {
  const disc = exprToCode(node.expr, source);
  const arms = node.arms;

  // Build nested ternary chain from the end
  let result = "undefined"; // default if no wildcard

  // Process arms in reverse to build nested ternary
  for (let i = arms.length - 1; i >= 0; i--) {
    const arm = arms[i];
    const body = armBodyToCode(arm.body, source);

    // Check for wildcard/default pattern
    const isWildcard = arm.patterns.length === 1 &&
      arm.patterns[0].kind === "Identifier" &&
      (arm.patterns[0] as AST.Identifier).name === "_";

    if (isWildcard && !arm.guard) {
      result = body;
      continue;
    }

    // Build pattern test: (disc === p1 || disc === p2 || ...)
    const patternTests = arm.patterns.map(p => {
      if (p.kind === "Identifier" && (p as AST.Identifier).name === "_") {
        return "true";
      }
      return `(${disc} === ${exprToCode(p, source)})`;
    });
    let test = patternTests.length === 1
      ? patternTests[0]
      : `(${patternTests.join(" || ")})`;

    // Add guard clause
    if (arm.guard) {
      test = `(${test} && ${exprToCode(arm.guard, source)})`;
    }

    result = `(${test} ? ${body} : ${result})`;
  }

  return result;
}

function armBodyToCode(body: AST.Expr | AST.Block, source?: string): string {
  if ('kind' in body && body.kind === "Block") {
    const block = body as AST.Block;
    if (block.statements.length === 1 && block.statements[0].kind === "ExprStmt") {
      return exprToCode((block.statements[0] as AST.ExprStmt).expr, source);
    }
    // Multi-statement block → IIFE
    const stmts = block.statements.map(s => nodeToSourceCode(s, source)).join("; ");
    return `(() => { ${stmts} })()`;
  }
  return exprToCode(body as AST.Expr, source);
}

// ─── Lambda Body Reconstruction ────────────────────────────────────

function lambdaToCode(expr: AST.Lambda, paramsCode: string, source?: string): string {
  const asyncPrefix = expr.async ? "async " : "";

  if ('kind' in expr.body && (expr.body as any).kind === "Block") {
    const block = expr.body as AST.Block;
    const stmts = block.statements.map(s => nodeToSourceCode(s, source));
    return `${asyncPrefix}(${paramsCode}) => { ${stmts.join("; ")} }`;
  }

  // Expression body — exprToCode handles JSX, Match, etc.
  const bodyCode = exprToCode(expr.body as AST.Expr, source);
  return `${asyncPrefix}(${paramsCode}) => ${bodyCode}`;
}

// ─── Identifier Collection (for captures analysis) ────────────────

/**
 * Collect free identifier names from an AST node.
 * Used for captures analysis — identifies variables that may need
 * to be injected from another runtime.
 *
 * Excludes: property names in Member expressions, parameter names
 * in Lambda/FuncDecl (they shadow outer scope).
 */
export function collectFreeIdentifiers(node: AST.Expr | AST.Stmt | AST.Decl): Set<string> {
  const ids = new Set<string>();
  collectIds(node, ids, new Set());
  return ids;
}

function collectIds(
  node: AST.Expr | AST.Stmt | AST.Decl,
  ids: Set<string>,
  locals: Set<string>,
): void {
  if (!node || typeof node !== "object" || !("kind" in node)) return;

  switch (node.kind) {
    case "Identifier":
      if (!locals.has(node.name)) ids.add(node.name);
      break;
    case "Member":
      // Only walk the object, not the property (property is not a free var)
      collectIds(node.object, ids, locals);
      break;
    case "Call":
      collectIds(node.callee, ids, locals);
      for (const arg of node.args) collectIds(arg, ids, locals);
      break;
    case "Binary":
      collectIds(node.left, ids, locals);
      collectIds(node.right, ids, locals);
      break;
    case "Unary":
      collectIds(node.argument, ids, locals);
      break;
    case "Index":
      collectIds(node.object, ids, locals);
      collectIds(node.index, ids, locals);
      break;
    case "Assign":
      collectIds(node.left, ids, locals);
      collectIds(node.right, ids, locals);
      break;
    case "Ternary":
      collectIds(node.test, ids, locals);
      collectIds(node.consequent, ids, locals);
      collectIds(node.alternate, ids, locals);
      break;
    case "ArrayLiteral":
      for (const el of node.elements) collectIds(el, ids, locals);
      break;
    case "ObjectLiteral":
      for (const p of node.properties) collectIds(p.value, ids, locals);
      break;
    case "Spread":
      collectIds(node.argument, ids, locals);
      break;
    case "Lambda": {
      // Lambda params shadow outer scope
      const innerLocals = new Set(locals);
      for (const p of node.params) {
        if (p.name.kind === "Identifier") innerLocals.add(p.name.name);
      }
      if ("kind" in node.body && (node.body as any).kind === "Block") {
        for (const s of (node.body as AST.Block).statements) collectIds(s, ids, innerLocals);
      } else {
        collectIds(node.body as AST.Expr, ids, innerLocals);
      }
      break;
    }
    case "ExprStmt":
      collectIds(node.expr, ids, locals);
      break;
    case "Return":
      for (const v of node.values) collectIds(v, ids, locals);
      break;
    case "ListComprehension":
      collectIds(node.expression, ids, locals);
      collectIds(node.iterable, ids, locals);
      if (node.filter) collectIds(node.filter, ids, locals);
      break;
    case "RuntimeTag":
      collectIds(node.expr, ids, locals);
      break;
    case "StringLiteral":
      for (const part of node.parts) {
        if (part.kind === "Interpolation" && typeof part.value !== "string") {
          collectIds(part.value as AST.Expr, ids, locals);
        }
      }
      break;
    case "JSXElement":
      // Walk JSX attributes and children for identifiers
      for (const attr of node.openingElement.attributes) {
        if (attr.kind === "JSXSpreadAttribute") {
          collectIds(attr.argument, ids, locals);
        } else if (attr.value && attr.value.kind === "JSXExpressionContainer") {
          if (attr.value.expression.kind !== "JSXEmptyExpression") {
            collectIds(attr.value.expression as AST.Expr, ids, locals);
          }
        }
      }
      for (const child of node.children) {
        if (child.kind === "JSXExpressionContainer" && child.expression.kind !== "JSXEmptyExpression") {
          collectIds(child.expression as AST.Expr, ids, locals);
        } else if (child.kind === "JSXElement") {
          collectIds(child, ids, locals);
        } else if (child.kind === "JSXFragment") {
          for (const fc of child.children) {
            if (fc.kind === "JSXExpressionContainer" && fc.expression.kind !== "JSXEmptyExpression") {
              collectIds(fc.expression as AST.Expr, ids, locals);
            }
          }
        } else if (child.kind === "JSXSpreadChild") {
          collectIds(child.expression, ids, locals);
        }
      }
      break;
    case "Match":
      collectIds(node.expr, ids, locals);
      for (const arm of node.arms) {
        if (arm.guard) collectIds(arm.guard, ids, locals);
        if ("kind" in arm.body && (arm.body as any).kind === "Block") {
          for (const s of (arm.body as AST.Block).statements) collectIds(s, ids, locals);
        } else {
          collectIds(arm.body as AST.Expr, ids, locals);
        }
      }
      break;
    // For other node kinds, don't try to walk — they use span extraction anyway
    default:
      break;
  }
}

export function isExprKind(kind: string): boolean {
  return [
    "NumericLiteral", "StringLiteral", "RegexLiteral", "BooleanLiteral",
    "NullLiteral", "Identifier", "Call", "Index", "Member", "Unary",
    "Binary", "Assign", "Lambda", "Ternary", "ArrayLiteral", "SetLiteral",
    "ObjectLiteral", "ListComprehension", "Spread", "Yield", "TypeAssertion",
    "JSXElement", "JSXFragment", "Match", "RuntimeTag",
  ].includes(kind);
}
