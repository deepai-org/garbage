import * as AST from '../ast';
import {
  OmniRuntime,
  RuntimeAffinity,
  AffinityEvidence,
  BridgeDescriptor,
  MarshalKind,
  AnnotatedNode,
} from './types';
import { SymbolTable } from './symbol-table';
import { lookupMethodAffinity } from './method-tables';
import { computeBridgeCost } from './cost-model';

/**
 * Pass 2: Bottom-up affinity propagation.
 *
 * Propagates runtime affinities through expression chains,
 * handles method name lookups, async infection, and inserts
 * bridge descriptors at runtime boundaries.
 */
export class Pass2Propagation {
  private affinityMap: Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity>;
  private symbolTable: SymbolTable;
  private bridges: BridgeDescriptor[] = [];
  private defaultRuntime: OmniRuntime;
  private scopeRuntimeStack: OmniRuntime[] = [];

  constructor(
    affinityMap: Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity>,
    symbolTable: SymbolTable,
    defaultRuntime: OmniRuntime = OmniRuntime.JavaScript,
  ) {
    this.affinityMap = affinityMap;
    this.symbolTable = symbolTable;
    this.defaultRuntime = defaultRuntime;
  }

  /**
   * Run Pass 2. Returns the bridge descriptors inserted.
   */
  run(program: AST.Program): BridgeDescriptor[] {
    for (const node of program.body) {
      this.propagateNode(node);
    }
    return this.bridges;
  }

  /**
   * Get the updated affinity map.
   */
  getAffinityMap(): Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity> {
    return this.affinityMap;
  }

  private propagateNode(node: AST.Decl | AST.Stmt | AST.Expr): RuntimeAffinity {
    switch (node.kind) {
      case "ExprStmt": {
        const exprAff = this.propagateExpr(node.expr);
        // Inherit the expression's affinity for the statement wrapper
        if (exprAff && exprAff.confidence !== "fallback") {
          this.affinityMap.set(node, { ...exprAff });
        }
        return this.getOrDefault(node);
      }

      case "FuncDecl":
        return this.propagateFuncDecl(node);

      case "If":
        for (const arm of node.arms) {
          this.propagateExpr(arm.test);
          this.propagateBlock(arm.body);
        }
        if (node.elseBody) this.propagateBlock(node.elseBody);
        return this.getOrDefault(node);

      case "Loop": {
        if (node.test) this.propagateExpr(node.test);
        let loopIterAff: RuntimeAffinity | undefined;
        if (node.iterable) loopIterAff = this.propagateExpr(node.iterable);
        const loopBodyAff = this.propagateBlock(node.body);
        // Inherit from iterable or body if loop only has scope fallback
        const loopExisting = this.affinityMap.get(node);
        const bestLoopAff = (loopIterAff && loopIterAff.confidence !== "fallback") ? loopIterAff :
                            (loopBodyAff && loopBodyAff.confidence !== "fallback") ? loopBodyAff : undefined;
        if (bestLoopAff && (!loopExisting || loopExisting.confidence === "fallback" ||
            (loopExisting.confidence === "inferred" && loopExisting.evidence[0]?.type === "scope"))) {
          this.affinityMap.set(node, { ...bestLoopAff });
        }
        return this.getOrDefault(node);
      }

      case "Switch":
        this.propagateExpr(node.discriminant);
        for (const c of node.cases) {
          for (const p of c.patterns) this.propagateExpr(p);
          if (c.guard) this.propagateExpr(c.guard);
          this.propagateBlock(c.body);
        }
        if (node.defaultCase) this.propagateBlock(node.defaultCase);
        return this.getOrDefault(node);

      case "Match":
        return this.propagateMatch(node);

      case "Return":
        for (const v of node.values) this.propagateExpr(v);
        return this.getOrDefault(node);

      case "Throw":
        this.propagateExpr(node.value);
        return this.getOrDefault(node);

      case "Try":
        this.propagateBlock(node.body);
        for (const c of node.catches) this.propagateBlock(c.body);
        if (node.finallyBody) this.propagateBlock(node.finallyBody);
        return this.getOrDefault(node);

      case "Block":
        return this.propagateBlock(node);

      case "VarDecl": {
        let valAff: RuntimeAffinity | undefined;
        if (node.values) {
          for (const v of node.values) valAff = this.propagateExpr(v);
        }
        // Inherit value's runtime if declaration only has scope fallback
        const varExisting = this.affinityMap.get(node);
        if (valAff && valAff.confidence !== "fallback" &&
            (!varExisting || varExisting.confidence === "fallback" ||
            (varExisting.confidence === "inferred" && varExisting.evidence[0]?.type === "scope"))) {
          this.affinityMap.set(node, { ...valAff });
        }
        return this.getOrDefault(node);
      }

      case "ConstDecl": {
        let constValAff: RuntimeAffinity | undefined;
        for (const v of node.values) constValAff = this.propagateExpr(v);
        // Inherit value's runtime if declaration only has scope fallback
        const constExisting = this.affinityMap.get(node);
        if (constValAff && constValAff.confidence !== "fallback" &&
            (!constExisting || constExisting.confidence === "fallback" ||
            (constExisting.confidence === "inferred" && constExisting.evidence[0]?.type === "scope"))) {
          this.affinityMap.set(node, { ...constValAff });
        }
        return this.getOrDefault(node);
      }

      case "ExportDecl":
        if (node.declaration) return this.propagateNode(node.declaration);
        return this.getOrDefault(node);

      case "ClassDecl":
        for (const member of node.members) {
          if (member.body) this.propagateBlock(member.body);
        }
        return this.getOrDefault(node);

      case "ImplDecl":
        for (const member of node.members) {
          if (member.body) this.propagateBlock(member.body);
        }
        return this.getOrDefault(node);

      default:
        // Expression nodes
        if (this.isExpr(node)) {
          return this.propagateExpr(node as AST.Expr);
        }
        return this.getOrDefault(node);
    }
  }

  private propagateExpr(expr: AST.Expr): RuntimeAffinity {
    switch (expr.kind) {
      case "Call":
        return this.propagateCall(expr);

      case "Member":
        return this.propagateMember(expr);

      case "Binary":
        return this.propagateBinary(expr);

      case "Unary":
        return this.propagateUnary(expr);

      case "Assign":
        this.propagateExpr(expr.left);
        const rightAff = this.propagateExpr(expr.right);
        this.ensureAffinity(expr, rightAff);
        return rightAff;

      case "Ternary":
        this.propagateExpr(expr.test);
        const consAff = this.propagateExpr(expr.consequent);
        this.propagateExpr(expr.alternate);
        this.ensureAffinity(expr, consAff);
        return this.getOrDefault(expr);

      case "Lambda":
        return this.propagateLambda(expr);

      case "ArrayLiteral":
        for (const el of expr.elements) this.propagateExpr(el);
        return this.getOrDefault(expr);

      case "ObjectLiteral":
        for (const prop of expr.properties) this.propagateExpr(prop.value);
        return this.getOrDefault(expr);

      case "Spread":
        return this.propagateExpr(expr.argument);

      case "Yield":
        if (expr.value) this.propagateExpr(expr.value);
        return this.getOrDefault(expr);

      case "TypeAssertion":
        return this.propagateExpr(expr.expr);

      case "Index":
        this.propagateExpr(expr.object);
        this.propagateExpr(expr.index);
        return this.getOrDefault(expr);

      case "ListComprehension":
        this.propagateExpr(expr.expression);
        this.propagateExpr(expr.iterable);
        if (expr.filter) this.propagateExpr(expr.filter);
        return this.getOrDefault(expr);

      case "Match":
        return this.propagateMatch(expr);

      case "RuntimeTag":
        this.propagateExpr(expr.expr);
        return this.getOrDefault(expr);

      case "Identifier":
        return this.getOrDefault(expr);

      case "StringLiteral":
        return this.propagateStringLiteral(expr);

      default:
        return this.getOrDefault(expr);
    }
  }

  private propagateCall(node: AST.Call): RuntimeAffinity {
    const calleeAff = this.propagateExpr(node.callee);
    for (const arg of node.args) {
      this.propagateExpr(arg);
    }

    // If callee has a known affinity, the call inherits it
    const existing = this.affinityMap.get(node);
    if (!existing || existing.confidence === "fallback") {
      this.ensureAffinity(node, calleeAff);
    }

    // --- Syntactic Dominance Rule ---
    // If any argument has "syntax" evidence, that language wins the call context.
    // This handles cases like files.map(x => x) where files is Python-bound
    // but the arrow function is syntactically impossible in Python.
    const syntaxVotes = new Map<OmniRuntime, number>();
    for (const arg of node.args) {
      const argAff = this.affinityMap.get(arg);
      if (argAff) {
        const hasSyntaxEvidence = argAff.evidence.some(e => e.type === "syntax");
        if (hasSyntaxEvidence) {
          syntaxVotes.set(argAff.runtime, (syntaxVotes.get(argAff.runtime) || 0) + 1);
        }
      }
    }

    if (syntaxVotes.size === 1) {
      // Exactly one language has syntax evidence — it wins
      const [winnerRuntime] = syntaxVotes.keys();
      this.affinityMap.set(node, {
        runtime: winnerRuntime,
        confidence: "definite",
        evidence: [
          { type: "syntax", detail: "syntactic dominance: argument syntax overrides callee provenance" },
          ...calleeAff.evidence,
        ],
      });
    }
    // If zero syntax votes: callee provenance already set above
    // If multiple syntax votes (collision): callee provenance breaks tie (already set above)

    const nodeAff = this.getOrDefault(node);

    // Check for async: if this is an await expression wrapping a call
    // (handled at the Unary level for 'await' operator)

    // Insert bridge if callee runtime differs from call runtime
    if (calleeAff.runtime !== nodeAff.runtime) {
      this.insertBridge(calleeAff.runtime, nodeAff.runtime, this.inferMarshalKind(node));
    }

    // Check args for bridge crossings
    for (const arg of node.args) {
      const argAff = this.getOrDefault(arg);
      if (argAff.runtime !== nodeAff.runtime) {
        const marshalKind = arg.kind === "Lambda" ? MarshalKind.Callback : this.inferMarshalKind(arg);
        this.insertBridge(argAff.runtime, nodeAff.runtime, marshalKind);
      }
    }

    return nodeAff;
  }

  private propagateMember(node: AST.Member): RuntimeAffinity {
    const objAff = this.propagateExpr(node.object);

    // Look up method name for runtime affinity evidence
    const methodRuntime = lookupMethodAffinity(node.property.name);

    const existing = this.affinityMap.get(node);

    // Key rule: object provenance beats method name tables.
    // If `files` came from `os.listdir()` (Python), then `files.map()` should
    // stay Python — not flip to JS just because `.map` is in the JS method table.
    //
    // The method table only wins when:
    //   1. The object has no opinion (fallback confidence), OR
    //   2. The method's runtime MATCHES the object's runtime (reinforcing, not contradicting)
    const objIsKnown = objAff.confidence !== "fallback";

    if (objIsKnown && (!existing || existing.confidence !== "definite")) {
      // Object has a real runtime — inherit from object
      this.affinityMap.set(node, {
        runtime: objAff.runtime,
        confidence: objAff.confidence,
        evidence: [
          { type: "scope", detail: `inherited from object: ${objAff.runtime}` },
          ...objAff.evidence,
        ],
      });
    } else if (methodRuntime && (!existing || existing.confidence !== "definite") && !objIsKnown) {
      // Object is unknown (fallback) — method name provides the best evidence
      this.affinityMap.set(node, {
        runtime: methodRuntime,
        confidence: "inferred",
        evidence: [
          { type: "method", detail: `.${node.property.name}()` },
          ...objAff.evidence,
        ],
      });
    } else if (!existing) {
      // Inherit from object
      this.ensureAffinity(node, objAff);
    }

    return this.getOrDefault(node);
  }

  private propagateBinary(node: AST.Binary): RuntimeAffinity {
    const leftAff = this.propagateExpr(node.left);
    const rightAff = this.propagateExpr(node.right);

    // If sides disagree, we need a bridge
    if (leftAff.runtime !== rightAff.runtime) {
      // Prefer the more confident side
      const winner = leftAff.confidence === "definite" ? leftAff :
                     rightAff.confidence === "definite" ? rightAff :
                     leftAff; // default to left
      this.ensureAffinity(node, winner);
      this.insertBridge(
        leftAff.runtime === winner.runtime ? rightAff.runtime : leftAff.runtime,
        winner.runtime,
        MarshalKind.Primitive,
      );
    } else {
      this.ensureAffinity(node, leftAff);
    }

    return this.getOrDefault(node);
  }

  private propagateUnary(node: AST.Unary): RuntimeAffinity {
    const argAff = this.propagateExpr(node.argument);

    // Async infection: await propagates async flag
    if (node.op === "await") {
      const aff = this.getOrDefault(node);
      aff.async = true;
      this.affinityMap.set(node, aff);

      // await makes the enclosing context async in JS
      if (!this.affinityMap.has(node)) {
        this.ensureAffinity(node, {
          runtime: OmniRuntime.JavaScript,
          confidence: "inferred",
          evidence: [{ type: "node_type", detail: "await expression" }],
          async: true,
        });
      }
    }

    // Channel receive <-ch inherits Go affinity (set in Pass 1)
    if (!this.affinityMap.has(node)) {
      this.ensureAffinity(node, argAff);
    }

    return this.getOrDefault(node);
  }

  private propagateLambda(node: AST.Lambda): RuntimeAffinity {
    if ('kind' in node.body && (node.body as any).kind === "Block") {
      this.propagateBlock(node.body as AST.Block);
    } else {
      this.propagateExpr(node.body as AST.Expr);
    }

    // Async lambdas are JS
    if (node.async) {
      const aff = this.getOrDefault(node);
      if (aff.confidence === "fallback") {
        this.affinityMap.set(node, {
          runtime: OmniRuntime.JavaScript,
          confidence: "inferred",
          evidence: [{ type: "keyword", detail: "async lambda" }],
          async: true,
        });
      } else {
        aff.async = true;
        this.affinityMap.set(node, aff);
      }
    }

    return this.getOrDefault(node);
  }

  private propagateMatch(node: AST.Match): RuntimeAffinity {
    this.propagateExpr(node.expr);
    for (const arm of node.arms) {
      for (const pattern of arm.patterns) this.propagateExpr(pattern);
      if (arm.guard) this.propagateExpr(arm.guard);
      if ('kind' in arm.body && (arm.body as any).kind === "Block") {
        this.propagateBlock(arm.body as AST.Block);
      } else {
        this.propagateExpr(arm.body as AST.Expr);
      }
    }
    return this.getOrDefault(node);
  }

  private propagateStringLiteral(node: AST.StringLiteral): RuntimeAffinity {
    // Check interpolation parts for runtime tags
    for (const part of node.parts) {
      if (part.kind === "Interpolation" && typeof part.value === "string") {
        // Check for @py(), @js(), etc. in string interpolation
        const runtimeTagMatch = part.value.match(/^@(py|js|go|rb|java)\((.*)\)$/s);
        if (runtimeTagMatch) {
          // Mark this interpolation as needing a specific runtime
          // This info will be used by the code generator
        }
      } else if (part.kind === "Interpolation" && typeof part.value !== "string") {
        this.propagateExpr(part.value as AST.Expr);
      }
    }
    return this.getOrDefault(node);
  }

  private propagateFuncDecl(node: AST.FuncDecl): RuntimeAffinity {
    // Push the function's declared runtime so body statements inherit it
    const funcAff = this.affinityMap.get(node);
    if (funcAff && funcAff.confidence !== "fallback") {
      this.scopeRuntimeStack.push(funcAff.runtime);
    }
    this.symbolTable.pushScope();
    this.propagateBlock(node.body);
    this.symbolTable.popScope();
    if (funcAff && funcAff.confidence !== "fallback") {
      this.scopeRuntimeStack.pop();
    }

    // Async infection for async functions
    const aff = this.getOrDefault(node);
    if (node.async) {
      aff.async = true;
      this.affinityMap.set(node, aff);
    }

    return aff;
  }

  private propagateBlock(block: AST.Block): RuntimeAffinity {
    let blockAffinity: RuntimeAffinity | undefined;

    for (const stmt of block.statements) {
      const stmtAff = this.propagateNode(stmt);
      if (!blockAffinity) {
        blockAffinity = stmtAff;
      }
    }

    return blockAffinity || this.getOrDefault(block);
  }

  // --- Helpers ---

  private ensureAffinity(node: AST.Decl | AST.Stmt | AST.Expr, affinity: RuntimeAffinity): void {
    if (!this.affinityMap.has(node)) {
      this.affinityMap.set(node, { ...affinity });
    }
  }

  private getOrDefault(node: AST.Decl | AST.Stmt | AST.Expr): RuntimeAffinity {
    const existing = this.affinityMap.get(node);
    if (existing) return existing;

    // Prefer the enclosing function's runtime over symbol-table scope majority
    const scopeRuntime = this.scopeRuntimeStack.length > 0
      ? this.scopeRuntimeStack[this.scopeRuntimeStack.length - 1]
      : undefined;
    const scopeAff = scopeRuntime
      ? { runtime: scopeRuntime, confidence: "inferred" as const, evidence: [{ type: "scope" as const, detail: `enclosing function: ${scopeRuntime}` }] }
      : this.symbolTable.getScopeAffinity();
    const defaultAff: RuntimeAffinity = scopeAff || {
      runtime: this.defaultRuntime,
      confidence: "fallback",
      evidence: [{ type: "fallback", detail: "default runtime" }],
    };

    this.affinityMap.set(node, defaultAff);
    return defaultAff;
  }

  private insertBridge(from: OmniRuntime, to: OmniRuntime, marshalKind: MarshalKind): void {
    if (from === to) return;

    const bridge: BridgeDescriptor = {
      from,
      to,
      marshalKind,
      cost: computeBridgeCost(marshalKind),
    };

    this.bridges.push(bridge);
  }

  private inferMarshalKind(node: AST.Expr): MarshalKind {
    switch (node.kind) {
      case "NumericLiteral":
      case "StringLiteral":
      case "BooleanLiteral":
      case "NullLiteral":
        return MarshalKind.Primitive;
      case "ArrayLiteral":
        return MarshalKind.Array;
      case "ObjectLiteral":
        return MarshalKind.Object;
      case "Lambda":
        return MarshalKind.Callback;
      default:
        return MarshalKind.Unknown;
    }
  }

  private isExpr(node: any): boolean {
    const exprKinds = new Set([
      "NumericLiteral", "StringLiteral", "RegexLiteral", "BooleanLiteral",
      "NullLiteral", "Identifier", "Call", "Index", "Member", "Unary",
      "Binary", "Assign", "Lambda", "Ternary", "ArrayLiteral", "SetLiteral",
      "ObjectLiteral", "ListComprehension", "Spread", "Yield", "TypeAssertion",
      "JSXElement", "JSXFragment", "Match", "RuntimeTag",
    ]);
    return exprKinds.has(node.kind);
  }
}
