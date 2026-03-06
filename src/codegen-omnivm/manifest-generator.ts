/**
 * ManifestCodeGenerator: generates a dispatch manifest (JSON IR)
 * that OmniVM interprets directly.
 *
 * No language is "on top" — the manifest is a structured sequence of
 * operations that tell OmniVM which runtime to dispatch each code
 * fragment to, how data flows between runtimes via named bindings,
 * and how control flow and async coordination work.
 */
import * as AST from '../ast';
import {
  OmniRuntime,
  RuntimeAffinity,
  AnnotatedProgram,
} from '../runtime-resolver/types';
import { consolidateBlocks, isConsolidatable, isCompiledRuntime, RuntimeBlock } from './runtime-blocks';
import {
  exprToCode,
  nodeToSourceCode,
  paramToCode,
  importSpecsToCode,
  tagToRuntime,
  isExprKind,
  collectFreeIdentifiers,
} from './source-reconstruct';
import {
  DispatchManifest,
  ManifestOp,
  ExecOp,
  EvalOp,
  ExecCompiledOp,
  EvalCompiledOp,
  DeclareOp,
  AssignOp,
  FuncDefOp,
  ReturnOp,
  IfOp,
  LoopOp,
  ParallelOp,
  ConcatOp,
  ImportOp,
  NativeOp,
  ParamDef,
  ManifestValue,
  ConditionExpr,
  CaptureMap,
  ConcatSegment,
} from './manifest-types';

export class ManifestCodeGenerator {
  private affinityMap: Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity> = new Map();
  private defaultRuntime: OmniRuntime = OmniRuntime.JavaScript;
  private source?: string;
  /** Tracks variable bindings and their defining runtime for captures analysis. */
  private bindingTable: Map<string, OmniRuntime> = new Map();
  /** Nesting depth inside func_def bodies. When > 0, captures include all external refs. */
  private funcDepth: number = 0;

  /**
   * Generate a dispatch manifest from an annotated program.
   * Returns a DispatchManifest object (JSON-serializable).
   */
  generate(annotated: AnnotatedProgram): DispatchManifest {
    this.affinityMap = annotated.affinityMap;
    this.defaultRuntime = annotated.defaultRuntime;
    this.source = annotated.source;
    this.bindingTable = new Map();

    const blocks = consolidateBlocks(annotated.program.body, this.affinityMap);
    const ops: ManifestOp[] = [];

    for (const block of blocks) {
      ops.push(...this.emitBlock(block));
    }

    return {
      version: 1,
      defaultRuntime: this.defaultRuntime,
      ops,
    };
  }

  /**
   * Generate and return pretty-printed JSON.
   */
  generateJSON(annotated: AnnotatedProgram): string {
    return JSON.stringify(this.generate(annotated), null, 2);
  }

  // ─── Captures Analysis ──────────────────────────────────────────

  /**
   * Compute captures for an expression being emitted in a target runtime.
   * Returns a CaptureMap if any referenced identifiers were bound in
   * a different runtime, or undefined if no cross-runtime refs exist.
   */
  private computeCaptures(
    node: AST.Expr | AST.Stmt | AST.Decl,
    targetRuntime: OmniRuntime,
  ): CaptureMap | undefined {
    const ids = collectFreeIdentifiers(node);
    const captures: CaptureMap = {};
    for (const name of ids) {
      const boundIn = this.bindingTable.get(name);
      if (!boundIn) continue;
      // Inside func_def body: capture ALL external bindings (params + top-level scope).
      // OmniVM executes function bodies in an isolated scope — all external values
      // must be explicitly injected via captures.
      if (this.funcDepth > 0) {
        captures[name] = name;
      } else if (boundIn !== targetRuntime) {
        // Top-level: only capture cross-runtime references.
        captures[name] = name;
      }
    }
    return Object.keys(captures).length > 0 ? captures : undefined;
  }

  /**
   * Record a variable binding with its runtime.
   */
  private recordBinding(name: string, runtime: OmniRuntime): void {
    this.bindingTable.set(name, runtime);
  }

  // ─── Literal Detection ──────────────────────────────────────────

  /**
   * Check if an expression is a simple literal that can be represented
   * as a manifest-scope value (no runtime eval needed).
   */
  private isSimpleLiteral(expr: AST.Expr): boolean {
    switch (expr.kind) {
      case "NumericLiteral":
      case "BooleanLiteral":
      case "NullLiteral":
        return true;
      case "StringLiteral":
        // Only plain strings (no interpolation)
        return expr.parts.length === 1 && expr.parts[0].kind === "Text";
      default:
        return false;
    }
  }

  /**
   * Extract the runtime value from a simple literal expression.
   */
  private literalValue(expr: AST.Expr): unknown {
    switch (expr.kind) {
      case "NumericLiteral":
        return Number(expr.raw);
      case "BooleanLiteral":
        return expr.value;
      case "NullLiteral":
        return null;
      case "StringLiteral":
        return expr.parts[0].value as string;
      default:
        return null;
    }
  }

  // ─── Block Emission ───────────────────────────────────────────

  private emitBlock(block: RuntimeBlock): ManifestOp[] {
    if (isCompiledRuntime(block.runtime)) {
      return this.emitCompiledBlock(block);
    }

    // Always process node-by-node for explicit bind/captures on every op.
    const ops: ManifestOp[] = [];
    for (const node of block.nodes) {
      ops.push(...this.emitNode(node, block.runtime));
    }
    return ops;
  }

  private emitConsolidatedBlock(block: RuntimeBlock): ExecOp {
    const codeSegments: string[] = [];
    const allCaptures: CaptureMap = {};
    for (const node of block.nodes) {
      codeSegments.push(nodeToSourceCode(node, this.source));
      const caps = this.computeCaptures(node, block.runtime);
      if (caps) Object.assign(allCaptures, caps);
    }
    return {
      op: "exec",
      runtime: block.runtime,
      code: codeSegments.join("\n"),
      ...(Object.keys(allCaptures).length > 0 ? { captures: allCaptures } : {}),
    };
  }

  private emitCompiledBlock(block: RuntimeBlock): ManifestOp[] {
    const lang = block.runtime === OmniRuntime.Rust ? "rust" : "c";
    return block.nodes.map(node => ({
      op: "exec_compiled" as const,
      lang,
      code: nodeToSourceCode(node, this.source),
    }));
  }

  // ─── Node Emission ────────────────────────────────────────────

  private emitNode(node: AST.Decl | AST.Stmt | AST.Expr, blockRuntime: OmniRuntime): ManifestOp[] {
    switch (node.kind) {
      case "FuncDecl":
        return this.emitFuncDecl(node);

      case "ExprStmt":
        return [this.emitExprStmt(node, blockRuntime)];

      case "VarDecl":
        return this.emitVarDecl(node);

      case "ConstDecl":
        return this.emitConstDecl(node);

      case "Return":
        return [this.emitReturn(node)];

      case "If":
        return [this.emitIf(node)];

      case "Loop":
        return [this.emitLoop(node)];

      case "ExportDecl":
        if (node.declaration) return this.emitNode(node.declaration, blockRuntime);
        return [];

      case "Import":
      case "ImportDecl":
        return [this.emitImport(node)];

      case "ShortDecl":
        return this.emitShortDecl(node);

      case "Go":
        return [{ op: "native", runtime: OmniRuntime.Go, code: "/* ERROR: goroutines not supported in OmniVM Go runtime. Use pre-registered functions. */" }];

      case "Defer":
        return [{ op: "native", runtime: OmniRuntime.Go, code: "/* ERROR: defer not supported in OmniVM Go runtime. */" }];

      case "Select":
        return [{ op: "native", runtime: OmniRuntime.Go, code: "/* ERROR: select not supported in OmniVM Go runtime. */" }];

      default: {
        const aff = this.affinityMap.get(node);
        const runtime = aff?.runtime || this.defaultRuntime;
        if (isExprKind(node.kind)) {
          return [this.emitExprAsOp(node as AST.Expr, runtime)];
        }
        return [{
          op: "native",
          runtime,
          code: nodeToSourceCode(node, this.source),
        }];
      }
    }
  }

  // ─── Expression Emission ──────────────────────────────────────

  private emitExprStmt(node: AST.ExprStmt, blockRuntime: OmniRuntime): ManifestOp {
    return this.emitExprAsOp(node.expr, blockRuntime);
  }

  private emitExprAsOp(expr: AST.Expr, contextRuntime: OmniRuntime): ManifestOp {
    const aff = this.affinityMap.get(expr);
    const runtime = aff?.runtime || contextRuntime;

    // Compound assignment (+=, -=, *=, /=) with Identifier LHS → assign op
    if (expr.kind === "Assign" && expr.op !== "=" && expr.left.kind === "Identifier") {
      const target = (expr.left as AST.Identifier).name;
      if (this.isSimpleLiteral(expr.right)) {
        return {
          op: "assign",
          target,
          operator: expr.op,
          value: { kind: "literal", value: this.literalValue(expr.right) },
        };
      }
      const captures = this.computeCaptures(expr.right, runtime);
      return {
        op: "assign",
        target,
        operator: expr.op,
        from: {
          op: "eval",
          runtime,
          code: exprToCode(expr.right, this.source),
          bind: "__rhs",
          ...(captures ? { captures } : {}),
        },
      };
    }

    // Simple assignment (=) with Identifier LHS → decompose into eval+bind
    // Must come before Go interception so Go assignments are handled properly
    if (expr.kind === "Assign" && expr.op === "=" && expr.left.kind === "Identifier") {
      const bindName = (expr.left as AST.Identifier).name;

      if (this.isSimpleLiteral(expr.right)) {
        // Manifest-scope literal → assign with value
        this.recordBinding(bindName, runtime);
        return {
          op: "assign",
          target: bindName,
          operator: "=",
          value: { kind: "literal", value: this.literalValue(expr.right) },
        };
      }

      // Go + Call RHS → func/args
      if (runtime === OmniRuntime.Go && expr.right.kind === "Call") {
        const funcName = exprToCode((expr.right as AST.Call).callee, this.source);
        const args = (expr.right as AST.Call).args.map(a => exprToCode(a, this.source));
        this.recordBinding(bindName, runtime);
        return {
          op: "eval",
          runtime: OmniRuntime.Go,
          func: funcName,
          args,
          bind: bindName,
        };
      }

      // Runtime eval → bare eval with bind
      const captures = this.computeCaptures(expr.right, runtime);
      this.recordBinding(bindName, runtime);
      return {
        op: "eval",
        runtime,
        code: exprToCode(expr.right, this.source),
        bind: bindName,
        ...(captures ? { captures } : {}),
      };
    }

    // Go runtime — restrict to pre-registered function calls
    if (runtime === OmniRuntime.Go) {
      return this.emitGoOp(expr);
    }

    // RuntimeTag — explicit runtime override
    if (expr.kind === "RuntimeTag") {
      const tagRt = tagToRuntime(expr.runtime);
      if (tagRt === OmniRuntime.Go) {
        return this.emitGoOp(expr.expr);
      }
      const captures = this.computeCaptures(expr.expr, tagRt);
      return {
        op: "exec",
        runtime: tagRt,
        code: exprToCode(expr.expr, this.source),
        ...(captures ? { captures } : {}),
      };
    }

    // String literal with interpolation → ConcatOp
    if (expr.kind === "StringLiteral" && expr.parts.some(p => p.kind === "Interpolation")) {
      return this.emitStringInterpolation(expr, runtime);
    }

    const captures = this.computeCaptures(expr, runtime);
    return {
      op: "exec",
      runtime,
      code: exprToCode(expr, this.source),
      ...(captures ? { captures } : {}),
    };
  }

  // ─── Go Runtime (pre-registered functions only) ──────────────

  private emitGoOp(expr: AST.Expr): ManifestOp {
    if (expr.kind === "Call") {
      const funcName = exprToCode(expr.callee, this.source);
      const args = expr.args.map(a => exprToCode(a, this.source));
      return {
        op: "exec",
        runtime: OmniRuntime.Go,
        func: funcName,
        args,
      };
    }
    return {
      op: "native",
      runtime: OmniRuntime.Go,
      code: `/* ERROR: Go runtime only supports pre-registered function calls. Unsupported: ${expr.kind} */`,
    };
  }

  // ─── Register Ops (pre-existing external functions) ──────────

  // ─── Declarations ─────────────────────────────────────────────

  private emitVarDecl(node: AST.VarDecl): ManifestOp[] {
    const ops: ManifestOp[] = [];
    for (let i = 0; i < node.names.length; i++) {
      const name = node.names[i].name;

      if (node.values && node.values[i]) {
        const valExpr = node.values[i];
        const aff = this.affinityMap.get(valExpr);
        const runtime = aff?.runtime || this.defaultRuntime;

        if (this.isSimpleLiteral(valExpr)) {
          // Manifest-scope literal → declare
          ops.push({
            op: "declare",
            bind: name,
            mutable: true,
            value: { kind: "literal", value: this.literalValue(valExpr) },
          });
        } else {
          // Runtime eval → bare eval with bind
          const captures = this.computeCaptures(valExpr, runtime);
          ops.push({
            op: "eval",
            runtime,
            code: exprToCode(valExpr, this.source),
            bind: name,
            ...(captures ? { captures } : {}),
          });
        }
        this.recordBinding(name, runtime);
      } else {
        // Forward declaration (no value)
        ops.push({
          op: "declare",
          bind: name,
          mutable: true,
        });
        this.recordBinding(name, this.defaultRuntime);
      }
    }
    return ops;
  }

  private emitConstDecl(node: AST.ConstDecl): ManifestOp[] {
    const ops: ManifestOp[] = [];
    for (let i = 0; i < node.names.length; i++) {
      const name = node.names[i].name;
      const valExpr = node.values[i];
      const aff = this.affinityMap.get(valExpr);
      const runtime = aff?.runtime || this.defaultRuntime;

      if (this.isSimpleLiteral(valExpr)) {
        // Manifest-scope literal → declare
        ops.push({
          op: "declare",
          bind: name,
          mutable: false,
          value: { kind: "literal", value: this.literalValue(valExpr) },
        });
      } else {
        // Runtime eval → bare eval with bind
        const captures = this.computeCaptures(valExpr, runtime);
        ops.push({
          op: "eval",
          runtime,
          code: exprToCode(valExpr, this.source),
          bind: name,
          ...(captures ? { captures } : {}),
        });
      }
      this.recordBinding(name, runtime);
    }
    return ops;
  }

  // ─── Short Declarations (:=) ────────────────────────────────────

  private emitShortDecl(node: AST.ShortDecl): ManifestOp[] {
    const aff = this.affinityMap.get(node);
    const runtime = aff?.runtime || OmniRuntime.Go;
    const ops: ManifestOp[] = [];

    if (node.pairs) {
      for (const pair of node.pairs) {
        const name = pair.name.name;
        ops.push(this.emitBindingEval(name, pair.expr, runtime));
        this.recordBinding(name, runtime);
      }
    }

    if (node.targets && node.value) {
      // Destructuring: x, y := expr
      const names = node.targets
        .filter(t => t.kind === "Identifier")
        .map(t => (t as AST.Identifier).name);
      const bindName = names[0] || "_";
      ops.push(this.emitBindingEval(bindName, node.value, runtime));
      for (const name of names) {
        this.recordBinding(name, runtime);
      }
    }

    return ops;
  }

  /**
   * Emit an eval op that binds a value. For Go + Call, uses func/args format.
   */
  private emitBindingEval(bindName: string, valExpr: AST.Expr, runtime: OmniRuntime): ManifestOp {
    if (runtime === OmniRuntime.Go && valExpr.kind === "Call") {
      return {
        op: "eval",
        runtime: OmniRuntime.Go,
        func: exprToCode(valExpr.callee, this.source),
        args: valExpr.args.map(a => exprToCode(a, this.source)),
        bind: bindName,
      };
    }

    const captures = this.computeCaptures(valExpr, runtime);
    return {
      op: "eval",
      runtime,
      code: exprToCode(valExpr, this.source),
      bind: bindName,
      ...(captures ? { captures } : {}),
    };
  }

  // ─── Functions ────────────────────────────────────────────────

  /**
   * Emit a function declaration. Returns an array: hoisted ops (imports +
   * param-independent initialization) followed by the func_def op.
   *
   * Hoisting rule: walk body ops from the start. An op is hoistable if
   * its captures (if any) don't reference any function parameter. Once we
   * hit an op that depends on a param, everything from there stays in the body.
   */
  private emitFuncDecl(node: AST.FuncDecl): ManifestOp[] {
    const aff = this.affinityMap.get(node);
    const funcRuntime = aff?.runtime || this.defaultRuntime;
    this.recordBinding(node.name.name, funcRuntime);

    // Go func_def: emit raw source for OmniVM to compile, not decomposed ops.
    // The source field is a complete Go compilation unit.
    if (funcRuntime === OmniRuntime.Go || node.declKeyword === "func") {
      return this.emitGoFuncDef(node);
    }

    const paramNames = new Set<string>();
    const params: ParamDef[] = node.params.map(p => {
      const def: ParamDef = {
        name: p.name.kind === "Identifier" ? p.name.name : "/* pattern */",
      };
      if (p.spread) def.spread = true;
      if (p.defaultValue) {
        def.defaultValue = { kind: "literal", value: exprToCode(p.defaultValue, this.source) };
      }
      if (p.name.kind === "Identifier") paramNames.add(p.name.name);
      return def;
    });

    // Register function params in the binding table so body ops capture them.
    // Use sentinel runtime — params live in manifest scope, not any runtime's scope.
    for (const name of paramNames) {
      this.recordBinding(name, "__params__" as OmniRuntime);
    }

    // Increment funcDepth so body ops capture ALL external bindings
    // (not just cross-runtime). Function bodies run in isolated scope.
    this.funcDepth++;
    const bodyBlocks = consolidateBlocks(node.body.statements, this.affinityMap);
    const allBodyOps: ManifestOp[] = [];
    for (const block of bodyBlocks) {
      allBodyOps.push(...this.emitBlock(block));
    }
    this.funcDepth--;

    // Hoist imports and param-independent initialization to top level.
    const hoisted: ManifestOp[] = [];
    const bodyOps: ManifestOp[] = [];
    let doneHoisting = false;

    for (const op of allBodyOps) {
      if (doneHoisting) {
        bodyOps.push(op);
        continue;
      }

      if (this.isHoistable(op, paramNames)) {
        hoisted.push(op);
        // Re-register any bindings from hoisted ops at top level (not func scope)
        // so downstream func body ops still capture them correctly.
      } else {
        doneHoisting = true;
        bodyOps.push(op);
      }
    }

    // Only set bodyRuntime if every block belongs to the same single runtime
    const runtimes = new Set(bodyBlocks.map(b => b.runtime));
    const singleRuntime = runtimes.size === 1 ? [...runtimes][0] : undefined;

    const funcDef: FuncDefOp = {
      op: "func_def",
      name: node.name.name,
      params,
      body: bodyOps,
      ...(singleRuntime ? { bodyRuntime: singleRuntime } : {}),
      ...(node.async ? { async: true } : {}),
      ...(node.generator ? { generator: true } : {}),
    };

    return [...hoisted, funcDef];
  }

  /**
   * An op is hoistable out of a func_def body if it doesn't depend on
   * any function parameter (directly via captures).
   */
  private isHoistable(op: ManifestOp, paramNames: Set<string>): boolean {
    // Imports are always hoistable (module-level by nature)
    if (op.op === "import") return true;

    // Eval/exec ops: check if captures reference any param
    if (op.op === "eval" || op.op === "exec") {
      const caps = op.captures;
      if (!caps) return true; // no captures → no param dependency
      for (const key of Object.keys(caps)) {
        if (paramNames.has(key)) return false;
      }
      return true;
    }

    // Declare ops with no runtime eval are hoistable
    if (op.op === "declare") return true;

    // Everything else stays in the body
    return false;
  }

  // ─── Go Function Definitions ────────────────────────────────────

  /**
   * Emit a Go func_def with compilable Go source for OmniVM.
   * Reconstructs valid Go from AST: PascalCase name, typed params/returns,
   * make() fixup, and forward declarations for undefined functions.
   */
  private emitGoFuncDef(node: AST.FuncDecl): ManifestOp[] {
    const name = node.name.name;

    // Go exports use PascalCase (Go visibility rules).
    const goExportName = this.toPascalCase(name);

    const params: ParamDef[] = node.params.map(p => ({
      name: p.name.kind === "Identifier" ? p.name.name : "/* pattern */",
      ...(p.spread ? { spread: true } : {}),
    }));

    // Reconstruct Go function signature with proper types
    const goParams = node.params.map(p => {
      const pName = p.name.kind === "Identifier" ? p.name.name : "_";
      const pType = p.type ? this.typeNodeToGo(p.type) : "interface{}";
      return `${pName} ${pType}`;
    }).join(", ");

    const returnType = node.returnType
      ? this.typeNodeToGo(node.returnType)
      : "interface{}";

    // Reconstruct body from AST with Go-specific fixups
    const paramNames = new Set(node.params
      .map(p => p.name.kind === "Identifier" ? p.name.name : null)
      .filter(Boolean) as string[]);

    const calledFuncs = new Map<string, number>(); // name → arg count
    const definedLocals = new Set<string>();
    const bodyLines = node.body.statements.map(
      s => this.goStmtToCode(s, paramNames, definedLocals, calledFuncs)
    );

    // Detect undefined function calls → external dependencies.
    // These become var function pointers + an Init() that OmniVM calls
    // to inject real implementations (same pattern as SetBridgeCallback).
    const goBuiltins = new Set([
      'make', 'len', 'cap', 'append', 'copy', 'delete', 'new',
      'panic', 'recover', 'close', 'print', 'println',
      'complex', 'real', 'imag',
    ]);
    const requires: string[] = [];
    const varDecls: string[] = [];
    for (const [fname, argc] of calledFuncs) {
      if (paramNames.has(fname) || definedLocals.has(fname) || goBuiltins.has(fname)) continue;
      requires.push(fname);
      const fParamTypes = Array.from({ length: argc }, () => "interface{}").join(", ");
      varDecls.push(`var ${fname} func(${fParamTypes}) interface{}`);
    }

    // Build complete Go compilation unit
    const lines: string[] = ["package polyfunc", ""];
    if (varDecls.length > 0) {
      lines.push(...varDecls, "");
      // Init function: OmniVM calls this at plugin load time to inject
      // real implementations for external dependencies.
      const initParams = requires.map(r => {
        const argc = calledFuncs.get(r) || 0;
        const fParamTypes = Array.from({ length: argc }, () => "interface{}").join(", ");
        return `${r}Fn func(${fParamTypes}) interface{}`;
      });
      lines.push(`func Init(${initParams.join(", ")}) {`);
      for (const r of requires) {
        lines.push(`\t${r} = ${r}Fn`);
      }
      lines.push("}", "");
    }
    lines.push(`func ${goExportName}(${goParams}) ${returnType} {`);
    for (const line of bodyLines) {
      lines.push(`\t${line}`);
    }
    lines.push("}");

    const funcDef: FuncDefOp = {
      op: "func_def",
      name,
      params,
      body: [],
      bodyRuntime: OmniRuntime.Go,
      source: lines.join("\n"),
      exports: [goExportName],
      ...(requires.length > 0 ? { requires } : {}),
    };

    return [funcDef];
  }

  private toPascalCase(name: string): string {
    return name.includes('_')
      ? name.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
      : name.charAt(0).toUpperCase() + name.slice(1);
  }

  // ─── Go Source Reconstruction ──────────────────────────────────

  private goStmtToCode(
    node: AST.Stmt | AST.Decl,
    params: Set<string>,
    locals: Set<string>,
    calledFuncs: Map<string, number>,
  ): string {
    switch (node.kind) {
      case "ShortDecl": {
        if (node.pairs) {
          return node.pairs.map(p => {
            locals.add(p.name.name);
            return `${p.name.name} := ${this.goExprToCode(p.expr, params, locals, calledFuncs)}`;
          }).join("; ");
        }
        if (node.targets && node.value) {
          const names = node.targets.filter(t => t.kind === "Identifier").map(t => (t as AST.Identifier).name);
          for (const n of names) locals.add(n);
          return `${names.join(", ")} := ${this.goExprToCode(node.value, params, locals, calledFuncs)}`;
        }
        return this.goSpanFallback(node);
      }
      case "Return":
        if (node.values.length === 0) return "return";
        return `return ${node.values.map(v => this.goExprToCode(v, params, locals, calledFuncs)).join(", ")}`;
      case "ExprStmt":
        return this.goExprToCode(node.expr, params, locals, calledFuncs);
      case "VarDecl":
        return node.names.map((n, i) => {
          locals.add(n.name);
          const t = node.type ? this.typeNodeToGo(node.type) : "interface{}";
          if (node.values?.[i]) {
            return `var ${n.name} ${t} = ${this.goExprToCode(node.values[i], params, locals, calledFuncs)}`;
          }
          return `var ${n.name} ${t}`;
        }).join("; ");
      default:
        return this.goSpanFallback(node);
    }
  }

  private goExprToCode(
    expr: AST.Expr,
    params: Set<string>,
    locals: Set<string>,
    calledFuncs: Map<string, number>,
  ): string {
    switch (expr.kind) {
      case "Identifier":
        return expr.name;
      case "NumericLiteral":
        return expr.raw;
      case "StringLiteral":
        if (expr.parts.length === 1 && expr.parts[0].kind === "Text") {
          return JSON.stringify(expr.parts[0].value as string);
        }
        return this.goSpanFallback(expr);
      case "BooleanLiteral":
        return String(expr.value);
      case "NullLiteral":
        return "nil";
      case "Call": {
        const callee = this.goExprToCode(expr.callee, params, locals, calledFuncs);
        const args = expr.args.map(a => this.goExprToCode(a, params, locals, calledFuncs));

        // make() fixup: make(N) → make(chan interface{}, N)
        if (callee === "make" && args.length === 1 && /^\d+$/.test(args[0])) {
          return `make(chan interface{}, ${args[0]})`;
        }

        // Track called function names for forward declaration
        if (expr.callee.kind === "Identifier") {
          calledFuncs.set(expr.callee.name, Math.max(
            calledFuncs.get(expr.callee.name) ?? 0, expr.args.length
          ));
        }

        return `${callee}(${args.join(", ")})`;
      }
      case "Member":
        return `${this.goExprToCode(expr.object, params, locals, calledFuncs)}.${expr.property.name}`;
      case "Index":
        return `${this.goExprToCode(expr.object, params, locals, calledFuncs)}[${this.goExprToCode(expr.index, params, locals, calledFuncs)}]`;
      case "Binary": {
        const arithmeticOps = new Set(['*', '+', '-', '/', '%', '^', '>>', '<<', '&', '|', '&^']);
        const left = this.goExprToCode(expr.left, params, locals, calledFuncs);
        const right = this.goExprToCode(expr.right, params, locals, calledFuncs);
        // interface{} params used in arithmetic need type assertion
        if (arithmeticOps.has(expr.op)) {
          const lhs = (expr.left.kind === "Identifier" && params.has(expr.left.name)) ? `${left}.(int)` : left;
          const rhs = (expr.right.kind === "Identifier" && params.has(expr.right.name)) ? `${right}.(int)` : right;
          return `${lhs} ${expr.op} ${rhs}`;
        }
        return `${left} ${expr.op} ${right}`;
      }
      case "Unary":
        if (expr.prefix) return `${expr.op}${this.goExprToCode(expr.argument, params, locals, calledFuncs)}`;
        return `${this.goExprToCode(expr.argument, params, locals, calledFuncs)}${expr.op}`;
      case "Assign":
        return `${this.goExprToCode(expr.left, params, locals, calledFuncs)} ${expr.op} ${this.goExprToCode(expr.right, params, locals, calledFuncs)}`;
      default:
        return this.goSpanFallback(expr);
    }
  }

  private goSpanFallback(node: { span?: AST.Span }): string {
    if (this.source && node.span && node.span.end > node.span.start) {
      return this.source.slice(node.span.start, node.span.end);
    }
    return "/* unsupported */";
  }

  /**
   * Convert a TypeNode to a Go type string.
   * Falls back to interface{} for types that don't map cleanly.
   */
  private typeNodeToGo(t: AST.TypeNode): string {
    switch (t.kind) {
      case "SimpleType":
        return t.id.name;
      case "GenericType": {
        // map[K]V, []T, chan T
        const base = t.base.name;
        if (base === "map" && t.args.length === 2) {
          return `map[${this.typeNodeToGo(t.args[0])}]${this.typeNodeToGo(t.args[1])}`;
        }
        if (base === "chan" && t.args.length === 1) {
          return `chan ${this.typeNodeToGo(t.args[0])}`;
        }
        // Slice: []T — parser may represent as GenericType with base "Array" or similar
        return `${base}[${t.args.map(a => this.typeNodeToGo(a)).join(", ")}]`;
      }
      case "NullableType":
        return `*${this.typeNodeToGo(t.inner)}`;
      case "ChanType":
        return this.source && t.span ? this.source.slice(t.span.start, t.span.end) : "chan interface{}";
      default:
        // Use span extraction for complex types
        return this.source && t.span ? this.source.slice(t.span.start, t.span.end) : "interface{}";
    }
  }

  // ─── Control Flow ─────────────────────────────────────────────

  private emitIf(node: AST.If): IfOp {
    const arms = node.arms.map(arm => {
      const aff = this.affinityMap.get(arm.test);
      const testRuntime = aff?.runtime || this.defaultRuntime;

      const test: ConditionExpr = {
        kind: "expr",
        runtime: testRuntime,
        code: exprToCode(arm.test, this.source),
      };

      const bodyBlocks = consolidateBlocks(arm.body.statements, this.affinityMap);
      const bodyOps: ManifestOp[] = [];
      for (const block of bodyBlocks) {
        bodyOps.push(...this.emitBlock(block));
      }

      return { test, body: bodyOps };
    });

    const ifOp: IfOp = { op: "if", arms };

    if (node.elseBody) {
      const elseBlocks = consolidateBlocks(node.elseBody.statements, this.affinityMap);
      const elseOps: ManifestOp[] = [];
      for (const block of elseBlocks) {
        elseOps.push(...this.emitBlock(block));
      }
      ifOp.elseBody = elseOps;
    }

    return ifOp;
  }

  private emitLoop(node: AST.Loop): LoopOp {
    const bodyBlocks = consolidateBlocks(node.body.statements, this.affinityMap);
    const bodyOps: ManifestOp[] = [];
    for (const block of bodyBlocks) {
      bodyOps.push(...this.emitBlock(block));
    }

    const loopOp: LoopOp = {
      op: "loop",
      mode: node.mode === "while" ? "while" :
            node.mode === "for" ? "for" : "infinite",
      body: bodyOps,
    };

    if (node.test) {
      const aff = this.affinityMap.get(node.test);
      const testRuntime = aff?.runtime || this.defaultRuntime;
      loopOp.test = {
        kind: "expr",
        runtime: testRuntime,
        code: exprToCode(node.test, this.source),
      };
    }

    return loopOp;
  }

  private emitReturn(node: AST.Return): ReturnOp {
    if (node.values.length === 0) {
      return { op: "return" };
    }

    if (node.values.length === 1) {
      const val = node.values[0];

      // Simple literal → return with value (no runtime eval needed)
      if (this.isSimpleLiteral(val)) {
        return {
          op: "return",
          value: { kind: "literal", value: this.literalValue(val) },
        };
      }

      // Simple identifier reference → return with ref
      if (val.kind === "Identifier") {
        return {
          op: "return",
          value: { kind: "ref", name: val.name },
        };
      }

      // Complex expression → return from eval
      const aff = this.affinityMap.get(val);
      const runtime = aff?.runtime || this.defaultRuntime;
      const captures = this.computeCaptures(val, runtime);

      return {
        op: "return",
        from: {
          op: "eval",
          runtime,
          code: exprToCode(val, this.source),
          bind: "__ret",
          ...(captures ? { captures } : {}),
        },
      };
    }

    // Multiple return values
    return {
      op: "return",
      value: {
        kind: "literal",
        value: node.values.map(v => exprToCode(v, this.source)),
      },
    };
  }

  // ─── Imports ──────────────────────────────────────────────────

  private emitImport(node: AST.Import | AST.ImportDecl): ImportOp {
    const aff = this.affinityMap.get(node);
    const runtime = aff?.runtime || this.defaultRuntime;

    if (node.kind === "Import") {
      // Record binding for the imported module — always bind the module name
      // so it enters the manifest's binding table for captures tracking.
      const bindName = node.alias?.name || node.path;
      this.recordBinding(bindName, runtime);
      return {
        op: "import",
        path: node.path,
        runtime,
        bind: bindName,
      };
    }

    // ImportDecl (ES-style)
    const importOp: ImportOp = {
      op: "import",
      path: node.path,
      runtime,
    };

    if (node.defaultImport) {
      importOp.defaultImport = node.defaultImport.name;
      this.recordBinding(node.defaultImport.name, runtime);
    }
    if (node.namespaceImport) {
      importOp.namespaceImport = node.namespaceImport.name;
      this.recordBinding(node.namespaceImport.name, runtime);
    }
    if (node.specifiers && node.specifiers.length > 0) {
      importOp.specifiers = node.specifiers.map(s => {
        this.recordBinding(s.local, runtime);
        return { imported: s.imported, local: s.local };
      });
    }

    return importOp;
  }

  // ─── String Interpolation ─────────────────────────────────────

  private emitStringInterpolation(node: AST.StringLiteral, scopeRuntime: OmniRuntime): ConcatOp {
    const segments: ConcatSegment[] = [];

    for (const part of node.parts) {
      if (part.kind === "Text") {
        const text = part.value as string;
        if (text) {
          segments.push({ kind: "text", value: text });
        }
      } else {
        // Interpolation
        if (typeof part.value === "string") {
          // String-based interpolation — check for @runtime() markers
          const runtimeTagMatch = part.value.match(/^@(py|js|go|rb|java)\((.+)\)$/s);
          if (runtimeTagMatch) {
            const [, tag, innerExpr] = runtimeTagMatch;
            const rt = tagToRuntime(tag);
            segments.push({ kind: "eval", runtime: rt, code: innerExpr });
          } else {
            // No tag — use scope runtime
            segments.push({ kind: "eval", runtime: scopeRuntime, code: part.value });
          }
        } else {
          // AST expression interpolation
          const expr = part.value as AST.Expr;
          if (expr.kind === "RuntimeTag") {
            const rt = tagToRuntime(expr.runtime);
            segments.push({ kind: "eval", runtime: rt, code: exprToCode(expr.expr, this.source) });
          } else {
            const aff = this.affinityMap.get(expr);
            const exprRuntime = aff?.runtime || scopeRuntime;
            segments.push({ kind: "eval", runtime: exprRuntime, code: exprToCode(expr, this.source) });
          }
        }
      }
    }

    return {
      op: "concat",
      bind: "__str",
      segments,
    };
  }
}
