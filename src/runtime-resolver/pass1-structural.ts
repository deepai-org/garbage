import * as AST from '../ast';
import {
  OmniRuntime,
  RuntimeAffinity,
  AffinityEvidence,
  AnnotatedNode,
  SymbolEntry,
} from './types';
import { SymbolTable } from './symbol-table';
import { analyzeImportPath, analyzeBareImport } from './import-analyzer';
import { lookupBuiltinAffinity } from './method-tables';

/**
 * Pass 1: Top-down structural analysis.
 *
 * Walks the AST and assigns definite or inferred runtime affinities
 * to nodes based on their structure, keywords, and imports.
 * Also populates the symbol table with variable affinities.
 */
export class Pass1Structural {
  private affinityMap: Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity> = new Map();
  private symbolTable: SymbolTable;
  private fileDirective?: OmniRuntime;
  private scopeStack: OmniRuntime[] = [];

  constructor(
    symbolTable: SymbolTable,
    fileDirective?: string,
  ) {
    this.symbolTable = symbolTable;
    if (fileDirective) {
      this.fileDirective = this.parseRuntimeName(fileDirective);
    }
  }

  /**
   * Run Pass 1 on the entire program.
   */
  run(program: AST.Program): Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity> {
    for (const node of program.body) {
      this.visitNode(node);
    }
    return this.affinityMap;
  }

  /**
   * Get the symbol table (for use by Pass 2).
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  private visitNode(node: AST.Decl | AST.Stmt | AST.Expr): void {
    switch (node.kind) {
      // --- Definite Python ---
      case "ListComprehension":
        this.assign(node, OmniRuntime.Python, "definite", { type: "syntax", detail: "ListComprehension" });
        this.visitExpr(node.expression);
        this.visitExpr(node.iterable);
        if (node.filter) this.visitExpr(node.filter);
        break;

      case "Pass":
        this.assign(node, OmniRuntime.Python, "definite", { type: "node_type", detail: "Pass" });
        break;

      // --- Definite JavaScript ---
      case "JSXElement":
        this.assign(node, OmniRuntime.JavaScript, "definite", { type: "node_type", detail: "JSXElement" });
        this.visitJSXChildren(node.children);
        break;

      case "JSXFragment":
        this.assign(node, OmniRuntime.JavaScript, "definite", { type: "node_type", detail: "JSXFragment" });
        this.visitJSXChildren(node.children);
        break;

      // --- Definite Go ---
      case "Go":
        this.assign(node, OmniRuntime.Go, "definite", { type: "node_type", detail: "Go" });
        this.visitExpr(node.expr);
        break;

      case "Defer":
        this.assign(node, OmniRuntime.Go, "definite", { type: "node_type", detail: "Defer" });
        if (node.body && 'kind' in node.body && node.body.kind === "Block") {
          this.visitBlock(node.body as AST.Block);
        } else if (node.body) {
          this.visitExpr(node.body as AST.Expr);
        }
        break;

      case "Select":
        this.assign(node, OmniRuntime.Go, "definite", { type: "node_type", detail: "Select" });
        for (const c of node.cases) {
          this.visitBlock(c.body);
        }
        if (node.defaultCase) this.visitBlock(node.defaultCase);
        break;

      case "ShortDecl":
        this.assign(node, OmniRuntime.Go, "definite", { type: "node_type", detail: "ShortDecl (:=)" });
        if (node.value) this.visitExpr(node.value);
        // Register variables in symbol table
        if (node.targets) {
          for (const target of node.targets) {
            if (target.kind === "Identifier") {
              this.symbolTable.define(target.name, {
                name: target.name,
                affinity: this.getAffinity(node)!,
              });
            }
          }
        }
        if (node.pairs) {
          for (const pair of node.pairs) {
            this.symbolTable.define(pair.name.name, {
              name: pair.name.name,
              affinity: this.getAffinity(node)!,
            });
            this.visitExpr(pair.expr);
          }
        }
        break;

      // --- Definite Rust ---
      case "ImplDecl":
        this.assign(node, OmniRuntime.Rust, "definite", { type: "node_type", detail: "ImplDecl" });
        this.scopeStack.push(OmniRuntime.Rust);
        this.symbolTable.pushScope();
        for (const member of node.members) {
          if (member.body) this.visitBlock(member.body);
        }
        this.symbolTable.popScope();
        this.scopeStack.pop();
        break;

      // --- Runtime-tagged expressions ---
      case "RuntimeTag":
        const taggedRuntime = this.parseRuntimeName(node.runtime);
        if (taggedRuntime) {
          this.assign(node, taggedRuntime, "definite", { type: "runtime_tag", detail: `@${node.runtime}()` });
        }
        this.visitExpr(node.expr);
        break;

      // --- Function declarations (inferred from keyword) ---
      case "FuncDecl":
        this.visitFuncDecl(node);
        break;

      // --- Match (style hint) ---
      case "Match":
        this.visitMatch(node);
        break;

      // --- Imports ---
      case "Import":
        this.visitImport(node);
        break;

      case "ImportDecl":
        this.visitImportDecl(node);
        break;

      // --- Calls (builtin detection) ---
      case "Call":
        this.visitCall(node);
        break;

      case "ExprStmt":
        this.visitExpr(node.expr);
        break;

      // --- Variable declarations ---
      case "VarDecl":
        this.visitVarDecl(node);
        break;

      case "ConstDecl":
        this.visitConstDecl(node);
        break;

      // --- Control flow (recurse into bodies) ---
      case "If":
        for (const arm of node.arms) {
          this.visitExpr(arm.test);
          this.visitBlock(arm.body);
        }
        if (node.elseBody) this.visitBlock(node.elseBody);
        break;

      case "Loop":
        if (node.test) this.visitExpr(node.test);
        if (node.iterable) this.visitExpr(node.iterable);
        this.visitBlock(node.body);
        break;

      case "Switch":
        this.visitExpr(node.discriminant);
        for (const c of node.cases) {
          for (const p of c.patterns) this.visitExpr(p);
          if (c.guard) this.visitExpr(c.guard);
          this.visitBlock(c.body);
        }
        if (node.defaultCase) this.visitBlock(node.defaultCase);
        break;

      case "Try":
        this.visitBlock(node.body);
        for (const c of node.catches) this.visitBlock(c.body);
        if (node.finallyBody) this.visitBlock(node.finallyBody);
        break;

      case "Return":
        for (const v of node.values) this.visitExpr(v);
        break;

      case "Throw":
        this.visitExpr(node.value);
        break;

      case "Block":
        this.visitBlock(node);
        break;

      case "ClassDecl":
        this.visitClassDecl(node);
        break;

      case "ExportDecl":
        if (node.declaration) this.visitNode(node.declaration);
        break;

      // --- Expression types (recurse) ---
      default:
        this.visitExprGeneric(node as AST.Expr);
        break;
    }
  }

  private visitFuncDecl(node: AST.FuncDecl): void {
    let runtime: OmniRuntime | undefined;
    let confidence: "definite" | "inferred" = "inferred";
    const evidence: AffinityEvidence = { type: "keyword", detail: `declKeyword: ${node.declKeyword}` };

    switch (node.declKeyword) {
      case "func":
        runtime = OmniRuntime.Go;
        break;
      case "def":
        // Could be Python or Ruby — default to Python, Pass 2 may refine
        runtime = OmniRuntime.Python;
        break;
      case "function":
        runtime = OmniRuntime.JavaScript;
        break;
      case "fn":
        runtime = OmniRuntime.Rust;
        break;
      case "fun":
        // Kotlin-style, map to Java for now
        runtime = OmniRuntime.Java;
        break;
    }

    if (runtime) {
      this.assign(node, runtime, confidence, evidence);
      this.symbolTable.define(node.name.name, {
        name: node.name.name,
        affinity: this.getAffinity(node)!,
        declNode: node,
      });
    }

    // Visit body with scope
    const scopeRuntime = runtime || this.currentScopeRuntime();
    if (scopeRuntime) {
      this.scopeStack.push(scopeRuntime);
    }
    this.symbolTable.pushScope();

    // Register params
    for (const param of node.params) {
      if (param.name.kind === "Identifier") {
        this.symbolTable.define(param.name.name, {
          name: param.name.name,
          affinity: runtime
            ? { runtime, confidence: "inferred", evidence: [{ type: "scope", detail: "param in function" }] }
            : this.defaultAffinity(),
        });
      }
    }

    this.visitBlock(node.body);
    this.symbolTable.popScope();
    if (scopeRuntime) {
      this.scopeStack.pop();
    }
  }

  private visitMatch(node: AST.Match): void {
    if (node.style === "rust") {
      this.assign(node, OmniRuntime.Rust, "inferred", { type: "keyword", detail: "match style: rust" });
    } else if (node.style === "python") {
      this.assign(node, OmniRuntime.Python, "inferred", { type: "keyword", detail: "match style: python" });
    }

    this.visitExpr(node.expr);
    for (const arm of node.arms) {
      for (const pattern of arm.patterns) this.visitExpr(pattern);
      if (arm.guard) this.visitExpr(arm.guard);
      if ('kind' in arm.body && arm.body.kind === "Block") {
        this.visitBlock(arm.body as AST.Block);
      } else {
        this.visitExpr(arm.body as AST.Expr);
      }
    }
  }

  private visitImport(node: AST.Import): void {
    const affinity = node.path.startsWith('"') || node.path.startsWith("'")
      ? analyzeImportPath(node.path.replace(/['"]/g, ""))
      : analyzeBareImport(node.path);

    if (affinity) {
      this.assign(node, affinity.runtime, affinity.confidence, affinity.evidence[0]);
      // Register imported name
      const name = node.alias?.name || node.path.replace(/['"]/g, "").split("/").pop() || node.path;
      this.symbolTable.define(name, {
        name,
        affinity,
      });
    }
  }

  private visitImportDecl(node: AST.ImportDecl): void {
    const affinity = analyzeImportPath(node.path);

    if (affinity) {
      this.assign(node, affinity.runtime, affinity.confidence, affinity.evidence[0]);
      // Register imported names
      if (node.defaultImport) {
        this.symbolTable.define(node.defaultImport.name, {
          name: node.defaultImport.name,
          affinity,
        });
      }
      if (node.namespaceImport) {
        this.symbolTable.define(node.namespaceImport.name, {
          name: node.namespaceImport.name,
          affinity,
        });
      }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          this.symbolTable.define(spec.local, {
            name: spec.local,
            affinity,
          });
        }
      }
    }
  }

  private visitCall(node: AST.Call): void {
    // Check for builtin calls
    if (node.callee.kind === "Identifier") {
      const builtinRuntime = lookupBuiltinAffinity(node.callee.name);
      if (builtinRuntime) {
        this.assign(node, builtinRuntime, "definite", {
          type: "builtin",
          detail: `builtin: ${node.callee.name}`,
        });
      }
    }

    // Check for qualified calls like System.out.println
    if (node.callee.kind === "Member") {
      this.visitExpr(node.callee);
    } else {
      this.visitExpr(node.callee);
    }

    for (const arg of node.args) {
      this.visitExpr(arg);
    }
  }

  private visitVarDecl(node: AST.VarDecl): void {
    let valueAff: RuntimeAffinity | undefined;
    if (node.values) {
      for (const v of node.values) {
        this.visitExpr(v);
        valueAff = this.getAffinity(v);
      }
    }
    const symAff = (valueAff && valueAff.confidence !== "fallback")
      ? valueAff : this.currentScopeAffinity();
    for (const name of node.names) {
      this.symbolTable.define(name.name, {
        name: name.name,
        affinity: symAff,
      });
    }
  }

  private visitConstDecl(node: AST.ConstDecl): void {
    let valueAff: RuntimeAffinity | undefined;
    for (const v of node.values) {
      this.visitExpr(v);
      valueAff = this.getAffinity(v);
    }
    const symAff = (valueAff && valueAff.confidence !== "fallback")
      ? valueAff : this.currentScopeAffinity();
    for (const name of node.names) {
      this.symbolTable.define(name.name, {
        name: name.name,
        affinity: symAff,
      });
    }
  }

  private visitClassDecl(node: AST.ClassDecl): void {
    this.symbolTable.define(node.name.name, {
      name: node.name.name,
      affinity: this.currentScopeAffinity(),
    });
    this.symbolTable.pushScope();
    for (const member of node.members) {
      if (member.body) this.visitBlock(member.body);
    }
    this.symbolTable.popScope();
  }

  private visitBlock(block: AST.Block): void {
    for (const stmt of block.statements) {
      this.visitNode(stmt);
    }
  }

  private visitExpr(expr: AST.Expr): void {
    this.visitNode(expr as any);
  }

  private visitExprGeneric(expr: AST.Expr): void {
    switch (expr.kind) {
      case "Binary":
        if (expr.op === "===" || expr.op === "!==") {
          this.assign(expr, OmniRuntime.JavaScript, "definite", { type: "syntax", detail: `strict equality ${expr.op}` });
        }
        // Channel send: `ch <- value` is Go
        if (expr.op === "<-") {
          this.assign(expr, OmniRuntime.Go, "definite", { type: "syntax", detail: "channel send <-" });
        }
        this.visitExpr(expr.left);
        this.visitExpr(expr.right);
        break;
      case "Unary":
        this.visitExpr(expr.argument);
        // Channel receive <-ch is Go
        if (expr.op === "<-") {
          this.assign(expr, OmniRuntime.Go, "definite", { type: "node_type", detail: "channel receive <-" });
        }
        // Try operator ? is Rust
        if (expr.op === "?" && !expr.prefix) {
          this.assign(expr, OmniRuntime.Rust, "inferred", { type: "node_type", detail: "try operator ?" });
        }
        break;
      case "Assign":
        this.visitExpr(expr.right);
        this.visitExpr(expr.left);
        // Register the assignment target with the right-hand side's affinity
        if (expr.left.kind === "Identifier") {
          const rhsAff = this.getAffinity(expr.right);
          if (rhsAff) {
            this.symbolTable.define(expr.left.name, {
              name: expr.left.name,
              affinity: rhsAff,
            });
          }
        }
        break;
      case "Member":
        this.visitExpr(expr.object);
        break;
      case "Index":
        this.visitExpr(expr.object);
        this.visitExpr(expr.index);
        break;
      case "Ternary":
        this.visitExpr(expr.test);
        this.visitExpr(expr.consequent);
        this.visitExpr(expr.alternate);
        break;
      case "ArrayLiteral":
        for (const el of expr.elements) this.visitExpr(el);
        break;
      case "ObjectLiteral":
        for (const prop of expr.properties) {
          this.visitExpr(prop.value);
        }
        break;
      case "Lambda":
        this.assign(expr, OmniRuntime.JavaScript, "definite", { type: "syntax", detail: "arrow function =>" });
        this.symbolTable.pushScope();
        for (const param of expr.params) {
          if (param.name.kind === "Identifier") {
            this.symbolTable.define(param.name.name, {
              name: param.name.name,
              affinity: this.currentScopeAffinity(),
            });
          }
        }
        if ('kind' in expr.body && expr.body.kind === "Block") {
          this.visitBlock(expr.body as AST.Block);
        } else {
          this.visitExpr(expr.body as AST.Expr);
        }
        this.symbolTable.popScope();
        break;
      case "Spread":
        this.visitExpr(expr.argument);
        break;
      case "Yield":
        if (expr.value) this.visitExpr(expr.value);
        break;
      case "TypeAssertion":
        this.visitExpr(expr.expr);
        break;
      case "Identifier":
        // Check if identifier is a known symbol
        const entry = this.symbolTable.lookup(expr.name);
        if (entry) {
          this.assign(expr, entry.affinity.runtime, entry.affinity.confidence, ...entry.affinity.evidence);
        }
        break;
      case "SetLiteral":
        for (const el of expr.elements) this.visitExpr(el);
        // Sets with {a, b, c} notation — could be Python
        this.assign(expr, OmniRuntime.Python, "inferred", { type: "node_type", detail: "SetLiteral" });
        break;
      case "RegexLiteral":
        this.assign(expr, OmniRuntime.JavaScript, "definite", { type: "syntax", detail: "regex literal /.../" });
        break;
      default:
        // Literals and other leaf nodes — no further traversal needed
        break;
    }
  }

  private visitJSXChildren(children: AST.JSXChild[]): void {
    for (const child of children) {
      if (child.kind === "JSXExpressionContainer" && child.expression.kind !== "JSXEmptyExpression") {
        this.visitExpr(child.expression as AST.Expr);
      } else if (child.kind === "JSXElement") {
        this.visitNode(child);
      } else if (child.kind === "JSXFragment") {
        this.visitNode(child);
      } else if (child.kind === "JSXSpreadChild") {
        this.visitExpr(child.expression);
      }
    }
  }

  // --- Helpers ---

  private assign(
    node: AST.Decl | AST.Stmt | AST.Expr,
    runtime: OmniRuntime,
    confidence: "definite" | "inferred" | "fallback",
    ...evidence: AffinityEvidence[]
  ): void {
    // Don't overwrite definite with inferred
    const existing = this.affinityMap.get(node);
    if (existing && existing.confidence === "definite" && confidence !== "definite") {
      return;
    }
    this.affinityMap.set(node, { runtime, confidence, evidence });
  }

  private getAffinity(node: AST.Decl | AST.Stmt | AST.Expr): RuntimeAffinity | undefined {
    return this.affinityMap.get(node);
  }

  private currentScopeRuntime(): OmniRuntime | undefined {
    return this.scopeStack.length > 0
      ? this.scopeStack[this.scopeStack.length - 1]
      : this.fileDirective;
  }

  private currentScopeAffinity(): RuntimeAffinity {
    const rt = this.currentScopeRuntime();
    if (rt) {
      return {
        runtime: rt,
        confidence: "inferred",
        evidence: [{ type: "scope", detail: `scope: ${rt}` }],
      };
    }
    return this.defaultAffinity();
  }

  private defaultAffinity(): RuntimeAffinity {
    return {
      runtime: this.fileDirective || OmniRuntime.JavaScript,
      confidence: "fallback",
      evidence: [{ type: "fallback", detail: "default runtime" }],
    };
  }

  private parseRuntimeName(name: string): OmniRuntime | undefined {
    const normalized = name.toLowerCase().trim();
    switch (normalized) {
      case "python":
      case "py":
        return OmniRuntime.Python;
      case "javascript":
      case "js":
        return OmniRuntime.JavaScript;
      case "go":
      case "golang":
        return OmniRuntime.Go;
      case "ruby":
      case "rb":
        return OmniRuntime.Ruby;
      case "java":
        return OmniRuntime.Java;
      case "rust":
      case "rs":
        return OmniRuntime.Rust;
      case "c":
        return OmniRuntime.C;
      default:
        return undefined;
    }
  }
}
