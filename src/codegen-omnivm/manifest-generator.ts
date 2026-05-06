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
  ManifestBridgeOp,
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
  TryOp,
  ThrowOp,
  ManifestCatch,
  ParallelOp,
  ConcatOp,
  ImportOp,
  NativeOp,
  ChanOp,
  SelectOp,
  SelectCase,
  SpawnOp,
  YieldOp,
  AwaitOp,
  ParamDef,
  ManifestValue,
  ConditionExpr,
  CaptureMap,
  ConcatSegment,
} from './manifest-types';
import { BoundaryChecker, typeToString } from '../type-system/boundary-checker';
import { lowerType } from '../type-system/lowering';
import * as C from '../type-system/canonical';

export class ManifestCodeGenerator {
  private affinityMap: Map<AST.Decl | AST.Stmt | AST.Expr, RuntimeAffinity> = new Map();
  private defaultRuntime: OmniRuntime = OmniRuntime.JavaScript;
  private source?: string;
  /** Tracks variable bindings and their defining runtime for captures analysis. */
  private bindingTable: Map<string, OmniRuntime> = new Map();
  /** Nesting depth inside func_def bodies. When > 0, captures include all external refs. */
  private funcDepth: number = 0;
  /** Type system boundary checker — validates types at cross-runtime crossings. */
  private typeChecker: BoundaryChecker = new BoundaryChecker();
  /** Registry of named types (class/interface/enum) for resolving type annotations. */
  private typeRegistry: Map<string, C.CanonicalType> = new Map();

  /**
   * Generate a dispatch manifest from an annotated program.
   * Returns a DispatchManifest object (JSON-serializable).
   */
  generate(annotated: AnnotatedProgram): DispatchManifest {
    this.affinityMap = annotated.affinityMap;
    this.defaultRuntime = annotated.defaultRuntime;
    this.source = annotated.source;
    this.bindingTable = new Map();
    this.typeChecker = new BoundaryChecker();
    this.typeRegistry = new Map();

    // Pass 1: Declare all typed bindings in the type checker
    this.declareTypedBindings(annotated.program.body);

    const blocks = consolidateBlocks(annotated.program.body, this.affinityMap);
    const ops: ManifestOp[] = [];

    for (const block of blocks) {
      ops.push(...this.emitBlock(block));
    }

    // Collect bridge ops and type summary from the checker
    const bridgeOps = this.typeChecker.getBridgeOps();
    const summary = this.typeChecker.getSummary();

    const manifest: DispatchManifest = {
      version: 1,
      defaultRuntime: this.defaultRuntime,
      ops,
    };

    // Only attach type info if there are actual crossings
    if (summary.crossings > 0) {
      manifest.bridges = bridgeOps.map(b => this.toBridgeManifestOp(b));
      manifest.typeSummary = summary;
    }

    return manifest;
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
        // Type-check the crossing if it's actually cross-runtime
        if (boundIn !== targetRuntime) {
          this.checkTypeCrossing(name, targetRuntime);
        }
      } else if (boundIn !== targetRuntime) {
        // Top-level: only capture cross-runtime references.
        this.checkTypeCrossing(name, targetRuntime);
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

  // ─── Type System Integration ─────────────────────────────────────

  /**
   * Walk top-level declarations and register typed bindings with the BoundaryChecker.
   */
  private declareTypedBindings(body: (AST.Decl | AST.Stmt | AST.Expr)[]): void {
    // Pass 1: Register all typed declarations
    for (const node of body) {
      const aff = this.affinityMap.get(node);
      const runtime = (aff?.runtime || this.defaultRuntime) as string as
        "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";

      switch (node.kind) {
        case "FuncDecl": {
          const funcType = this.funcDeclToCanonical(node);
          this.typeChecker.declare(node.name.name, funcType, runtime);
          break;
        }
        case "VarDecl": {
          const varType = this.resolveFromRegistry(node.type ? lowerType(node.type, runtime) : C.ANY);
          for (const name of node.names) {
            this.typeChecker.declare(name.name, varType, runtime);
          }
          break;
        }
        case "ConstDecl": {
          const constType = this.resolveFromRegistry(node.type ? lowerType(node.type, runtime) : C.ANY);
          for (const name of node.names) {
            this.typeChecker.declare(name.name, constType, runtime);
          }
          break;
        }
        case "ShortDecl":
          if (node.pairs) {
            for (const pair of node.pairs) {
              this.typeChecker.declare(pair.name.name, C.ANY, runtime);
            }
          }
          break;
        case "ClassDecl": {
          const structType = this.classDeclToCanonical(node, runtime);
          this.typeChecker.declare(node.name.name, structType, runtime);
          // Also register type so variables typed as this class resolve to the struct
          this.typeRegistry.set(node.name.name, structType);
          break;
        }
        case "InterfaceDecl": {
          const ifaceType = this.interfaceDeclToCanonical(node, runtime);
          this.typeChecker.declare(node.name.name, ifaceType, runtime);
          this.typeRegistry.set(node.name.name, ifaceType);
          break;
        }
        case "EnumDecl": {
          const enumType = this.enumDeclToCanonical(node);
          this.typeChecker.declare(node.name.name, enumType, runtime);
          this.typeRegistry.set(node.name.name, enumType);
          break;
        }
      }
    }

    // Pass 2: Check cross-runtime function calls and variable assignments
    this.checkCrossRuntimeCalls(body);
  }

  /**
   * Walk the AST looking for cross-runtime interactions:
   * 1. Function calls where callee is declared in a different runtime
   * 2. Variable declarations that receive the return value of a cross-runtime call
   *
   * Recurses into function bodies to find nested cross-runtime calls.
   */
  private checkCrossRuntimeCalls(body: (AST.Decl | AST.Stmt | AST.Expr)[], callerRuntime?: string): void {
    for (const node of body) {
      const nodeAff = this.affinityMap.get(node);
      const nodeRuntime = (nodeAff?.runtime || callerRuntime || this.defaultRuntime) as string as
        "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";
      // The "caller" runtime is the enclosing function's runtime.
      // For cross-runtime call checking, we care about where the CALL happens,
      // not what runtime the callee expression was assigned to.
      const effectiveCallerRuntime = callerRuntime || nodeRuntime;

      // Recurse into function bodies with the function's own runtime as caller context
      if (node.kind === "FuncDecl" && node.body?.statements) {
        const funcRuntime = (nodeAff?.runtime || callerRuntime || this.defaultRuntime) as string;
        // Register variables declared inside the function body
        this.declareInnerBindings(node.body.statements, funcRuntime);
        this.checkCrossRuntimeCalls(node.body.statements, funcRuntime);
      }

      // Check const/var declarations: const x: TargetType = crossRuntimeCall()
      if ((node.kind === "ConstDecl" || node.kind === "VarDecl") && node.type) {
        const targetType = lowerType(node.type, effectiveCallerRuntime as any);
        const values = node.kind === "ConstDecl" ? node.values : node.values;
        if (values) {
          for (const val of values) {
            this.checkCallReturnType(val, effectiveCallerRuntime, targetType);
          }
        }
      }

      // Check expression statements: standalone calls like calculate(v)
      if (node.kind === "ExprStmt") {
        this.checkCallArgTypes(node.expr, effectiveCallerRuntime);
      }

      // Control-flow narrowing: if (x !== null) { ... }
      if (node.kind === "If") {
        const ifNode = node as AST.If;
        for (const arm of ifNode.arms) {
          const narrowings = this.extractNarrowings(arm.test);
          if (narrowings.size > 0) {
            this.typeChecker.pushNarrow(narrowings);
            if (arm.body?.statements) {
              this.checkCrossRuntimeCalls(arm.body.statements, effectiveCallerRuntime);
            }
            this.typeChecker.popNarrow();
          } else if (arm.body?.statements) {
            this.checkCrossRuntimeCalls(arm.body.statements, effectiveCallerRuntime);
          }
        }
        // Check else branch without narrowing
        if (ifNode.elseBody?.statements) {
          this.checkCrossRuntimeCalls(ifNode.elseBody.statements, effectiveCallerRuntime);
        }
      }
    }
  }

  /**
   * Extract narrowing information from an if-condition.
   * Detects patterns like `x !== null`, `x != null`, `x !== undefined`, `x != nil`.
   */
  private extractNarrowings(test: AST.Expr): Map<string, C.CanonicalType> {
    const narrowings = new Map<string, C.CanonicalType>();
    if (test.kind !== "Binary") return narrowings;
    const bin = test as AST.Binary;
    const op = bin.op;

    // x !== null / x != null / x !== undefined / x != nil
    if (op === "!==" || op === "!=") {
      const [ident, nullish] = this.extractNullCheck(bin);
      if (ident && nullish) {
        const binding = this.typeChecker.getBinding(ident);
        if (binding) {
          const narrowed = BoundaryChecker.narrowType(binding.type, "not-null");
          if (narrowed) narrowings.set(ident, narrowed);
        }
      }
    }

    // && chains: x !== null && y !== undefined
    if (op === "&&") {
      const left = this.extractNarrowings(bin.left);
      const right = this.extractNarrowings(bin.right);
      for (const [k, v] of left) narrowings.set(k, v);
      for (const [k, v] of right) narrowings.set(k, v);
    }

    return narrowings;
  }

  /**
   * From a binary != or !== expression, extract (identName, true) if it's a null check.
   */
  private extractNullCheck(bin: AST.Binary): [string | null, boolean] {
    const isNullLiteral = (e: AST.Expr) =>
      e.kind === "NullLiteral" ||
      (e.kind === "Identifier" && ((e as AST.Identifier).name === "null" || (e as AST.Identifier).name === "nil" || (e as AST.Identifier).name === "undefined" || (e as AST.Identifier).name === "None"));

    if (bin.left.kind === "Identifier" && isNullLiteral(bin.right)) {
      return [(bin.left as AST.Identifier).name, true];
    }
    if (bin.right.kind === "Identifier" && isNullLiteral(bin.left)) {
      return [(bin.right as AST.Identifier).name, true];
    }
    return [null, false];
  }

  /**
   * If expr is a call to a cross-runtime function, check that the return type
   * is compatible with expectedType.
   */
  private checkCallReturnType(expr: AST.Expr, callerRuntime: string, expectedType: C.CanonicalType): void {
    if (expr.kind !== "Call" || expr.callee.kind !== "Identifier") return;
    const funcName = expr.callee.name;
    const binding = this.typeChecker.getBinding(funcName);
    if (!binding || binding.runtime === callerRuntime) return;
    if (binding.type.kind !== "func") return;

    const funcType = binding.type as C.FuncType;

    // Register the return value as a temporary binding in the callee's runtime,
    // then check crossing to the caller's runtime with the expected type.
    const returnBindingName = `${funcName}()`;
    this.typeChecker.declare(returnBindingName, funcType.returns, binding.runtime);
    this.typeChecker.checkCrossing(
      returnBindingName,
      callerRuntime as any,
      expectedType,
    );

    // Also check argument types
    this.checkCallArgTypesForFunc(expr, callerRuntime, funcType, binding.runtime);
  }

  /**
   * If expr is a call to a cross-runtime function, check argument types.
   */
  private checkCallArgTypes(expr: AST.Expr, callerRuntime: string): void {
    if (expr.kind !== "Call" || expr.callee.kind !== "Identifier") return;
    const funcName = expr.callee.name;
    const binding = this.typeChecker.getBinding(funcName);
    if (!binding || binding.runtime === callerRuntime) return;
    if (binding.type.kind !== "func") return;

    const funcType = binding.type as C.FuncType;
    this.checkCallArgTypesForFunc(expr, callerRuntime, funcType, binding.runtime);
  }

  /**
   * Check each argument's type against the function's parameter types.
   */
  private checkCallArgTypesForFunc(
    call: AST.Call,
    callerRuntime: string,
    funcType: C.FuncType,
    targetRuntime: string,
  ): void {
    for (let i = 0; i < call.args.length && i < funcType.params.length; i++) {
      const arg = call.args[i];
      const paramType = funcType.params[i].type;

      // Try to resolve the argument's type
      let argType: C.CanonicalType = C.ANY;
      if (arg.kind === "Identifier") {
        const argBinding = this.typeChecker.getBinding(arg.name);
        if (argBinding) argType = argBinding.type;
      } else if (arg.kind === "StringLiteral") {
        argType = C.STRING;
      } else if (arg.kind === "NumericLiteral") {
        argType = C.FLOAT64; // JS numbers are f64
      } else if (arg.kind === "BooleanLiteral") {
        argType = C.BOOL;
      } else if (arg.kind === "Lambda") {
        // Infer function type from lambda's typed params
        const lambda = arg as AST.Lambda;
        const params = (lambda.params || []).map((p: AST.Param) => ({
          name: p.name?.kind === "Identifier" ? p.name.name : undefined,
          type: p.type ? lowerType(p.type, callerRuntime as any) : C.ANY,
        }));
        const returns = lambda.returnType ? lowerType(lambda.returnType, callerRuntime as any) : C.ANY;
        argType = { kind: "func", params, returns };
      }

      if (argType.kind !== "any") {
        const argBindingName = `arg${i}:${call.callee.kind === "Identifier" ? call.callee.name : "?"}`;
        this.typeChecker.declare(argBindingName, argType, callerRuntime as any);
        this.typeChecker.checkCrossing(
          argBindingName,
          targetRuntime as any,
          paramType,
          call.span,
        );
      }
    }
  }

  /**
   * Register typed bindings from inside a function body.
   * If no type annotation, infer from the initializer (e.g., call to a known function).
   */
  private declareInnerBindings(body: (AST.Decl | AST.Stmt | AST.Expr)[], runtime: string): void {
    type RT = "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";
    for (const node of body) {
      if (node.kind === "VarDecl" || node.kind === "ConstDecl") {
        let t: C.CanonicalType | undefined;
        if (node.type) {
          t = lowerType(node.type, runtime as RT as any);
          // Enrich opaque named structs with field info from the type registry
          t = this.resolveFromRegistry(t);
        } else {
          // Infer type from initializer: if it's a call to a known function, use its return type
          const values = node.kind === "ConstDecl" ? node.values : node.values;
          if (values && values.length > 0) {
            t = this.inferExprType(values[0]);
          }
        }
        if (t) {
          const names = node.names;
          // Determine the binding's runtime from the expression's affinity
          const nodeAff = this.affinityMap.get(node);
          const bindRuntime = (nodeAff?.runtime || runtime) as RT;
          for (const name of names) {
            this.typeChecker.declare(name.name, t, bindRuntime);
          }
        }
      }
    }
  }

  /**
   * Try to infer the canonical type of an expression.
   * Handles:
   * - Calls to known functions (return type)
   * - Member access on known structs (field type)
   * - Array/object literals
   * - Identifiers (bound type)
   * - Generic calls with type arguments (instantiation)
   */
  private inferExprType(expr: AST.Expr): C.CanonicalType | undefined {
    switch (expr.kind) {
      case "Call": {
        const call = expr as AST.Call;
        if (call.callee.kind === "Identifier") {
          const binding = this.typeChecker.getBinding(call.callee.name);
          if (binding && binding.type.kind === "func") {
            const funcType = binding.type as C.FuncType;
            // Generic instantiation: substitute typeArgs into return type
            if (call.typeArgs && call.typeArgs.length > 0) {
              return this.instantiateReturn(funcType, call.typeArgs, binding.runtime);
            }
            return funcType.returns;
          }
        }
        // Method call: x.method() — infer from x's type if known
        if (expr.callee.kind === "Member" && (expr.callee as AST.Member).object.kind === "Identifier") {
          const member = expr.callee as AST.Member;
          const objBinding = this.typeChecker.getBinding((member.object as AST.Identifier).name);
          if (objBinding && objBinding.type.kind === "struct") {
            const field = (objBinding.type as C.StructType).fields.find(
              f => f.name === member.property.name
            );
            if (field && field.type.kind === "func") {
              return (field.type as C.FuncType).returns;
            }
          }
        }
        return undefined;
      }
      case "Member": {
        const member = expr as AST.Member;
        if (member.object.kind === "Identifier") {
          const binding = this.typeChecker.getBinding((member.object as AST.Identifier).name);
          if (binding && binding.type.kind === "struct") {
            const field = (binding.type as C.StructType).fields.find(f => f.name === member.property.name);
            if (field) return field.type;
          }
          // Map access: infer value type
          if (binding && binding.type.kind === "map") {
            return (binding.type as C.MapType).value;
          }
        }
        return undefined;
      }
      case "Index": {
        const idx = expr as AST.Index;
        if (idx.object.kind === "Identifier") {
          const binding = this.typeChecker.getBinding((idx.object as AST.Identifier).name);
          if (binding) {
            if (binding.type.kind === "array") return (binding.type as C.ArrayType).element;
            if (binding.type.kind === "map") return (binding.type as C.MapType).value;
          }
        }
        return undefined;
      }
      case "Identifier": {
        const binding = this.typeChecker.getBinding((expr as AST.Identifier).name);
        if (binding) return binding.type;
        return undefined;
      }
      case "StringLiteral":
        return C.STRING;
      case "NumericLiteral":
        return C.FLOAT64;
      case "BooleanLiteral":
        return C.BOOL;
      case "ArrayLiteral": {
        const arr = expr as AST.ArrayLiteral;
        if (arr.elements.length > 0) {
          const elemType = this.inferExprType(arr.elements[0]);
          if (elemType) return C.array(elemType);
        }
        return C.array(C.ANY);
      }
      case "ObjectLiteral":
        return { kind: "struct", fields: [], nominal: false };
      default:
        return undefined;
    }
  }


  /**
   * Convert a FuncDecl to a canonical FuncType for the type checker.
   */
  private funcDeclToCanonical(node: AST.FuncDecl): C.FuncType {
    const aff = this.affinityMap.get(node);
    const runtime = (aff?.runtime || this.defaultRuntime) as string as
      "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";

    const params = node.params.map(p => ({
      name: p.name?.kind === "Identifier" ? p.name.name : undefined,
      type: p.type ? lowerType(p.type, runtime) : C.ANY,
      optional: !!p.defaultValue,
    }));
    const returns = node.returnType ? lowerType(node.returnType, runtime) : C.ANY;
    return { kind: "func", params, returns, async: node.async };
  }

  /**
   * Convert a ClassDecl to a canonical StructType with fields.
   */
  private classDeclToCanonical(node: AST.ClassDecl, runtime: string): C.StructType {
    type RT = "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";
    const fields: C.Field[] = [];
    for (const member of node.members) {
      if (!member.name) continue;
      if (member.kind === "Field" || member.kind === "Property") {
        fields.push({
          name: member.name.name,
          type: member.type ? lowerType(member.type, runtime as RT) : C.ANY,
          optional: false,
          mutable: !member.readonly,
          visibility: member.visibility,
        });
      } else if (member.kind === "Method") {
        const params = (member.params || []).map(p => ({
          name: p.name?.kind === "Identifier" ? p.name.name : undefined,
          type: p.type ? lowerType(p.type, runtime as RT) : C.ANY,
          optional: !!p.defaultValue,
        }));
        const returns = member.type ? lowerType(member.type, runtime as RT) : C.ANY;
        fields.push({
          name: member.name.name,
          type: { kind: "func", params, returns },
        });
      }
    }
    return { kind: "struct", name: node.name.name, fields, nominal: true, origin: runtime };
  }

  /**
   * Convert an InterfaceDecl to a canonical StructType (or InterfaceType) with fields.
   */
  private interfaceDeclToCanonical(node: AST.InterfaceDecl, runtime: string): C.StructType {
    type RT = "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";
    const fields: C.Field[] = [];
    for (const member of node.members) {
      if (member.kind === "Method" || member.params) {
        const params = (member.params || []).map(p => ({
          name: p.name?.kind === "Identifier" ? p.name.name : undefined,
          type: p.type ? lowerType(p.type, runtime as RT) : C.ANY,
          optional: !!p.defaultValue,
        }));
        const returns = member.returnType ? lowerType(member.returnType, runtime as RT) : C.ANY;
        fields.push({
          name: member.name.name,
          type: { kind: "func", params, returns },
          optional: member.optional,
        });
      } else {
        fields.push({
          name: member.name.name,
          type: member.type ? lowerType(member.type, runtime as RT) : C.ANY,
          optional: member.optional,
        });
      }
    }
    // Interfaces are structural (duck typing at boundaries)
    return { kind: "struct", name: node.name.name, fields, nominal: false, origin: runtime };
  }

  /**
   * Convert an EnumDecl to a canonical EnumType.
   */
  private enumDeclToCanonical(node: AST.EnumDecl): C.EnumType {
    return {
      kind: "enum",
      name: node.name.name,
      variants: node.members.map(m => ({
        name: m.name.name,
        payload: m.value ? this.inferExprType(m.value) : undefined,
      })),
    };
  }

  /**
   * If a type is an opaque named struct with no fields, check the type registry
   * for a full definition with field info.
   */
  private resolveFromRegistry(type: C.CanonicalType): C.CanonicalType {
    if (type.kind === "struct" && type.name && type.fields.length === 0) {
      const registered = this.typeRegistry.get(type.name);
      if (registered && registered.kind === "struct" && (registered as C.StructType).fields.length > 0) {
        return registered;
      }
    }
    return type;
  }

  /**
   * Instantiate a generic function's return type with concrete type arguments.
   * Maps typevar positions to concrete types from the call-site type args.
   */
  private instantiateReturn(
    funcType: C.FuncType,
    typeArgs: AST.TypeNode[],
    runtime: string,
  ): C.CanonicalType {
    type RT = "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash";
    const concreteArgs = typeArgs.map(t => lowerType(t, runtime as RT));
    return this.substituteTypevars(funcType.returns, concreteArgs);
  }

  /**
   * Substitute typevars in a type with concrete types.
   * Uses positional mapping: first typevar → first concrete arg, etc.
   */
  private substituteTypevars(type: C.CanonicalType, args: C.CanonicalType[], depth = 0): C.CanonicalType {
    if (depth > 10) return type; // guard against infinite recursion
    switch (type.kind) {
      case "typevar":
        // Simple positional: first typevar gets first arg
        return args[0] || type;
      case "generic": {
        const gen = type as C.GenericType;
        return {
          ...gen,
          base: this.substituteTypevars(gen.base, args, depth + 1),
          args: gen.args.map(a => this.substituteTypevars(a, args, depth + 1)),
        };
      }
      case "async":
        return { ...type, inner: this.substituteTypevars((type as C.AsyncType).inner, args, depth + 1) };
      case "option":
        return { ...type, inner: this.substituteTypevars((type as C.OptionType).inner, args, depth + 1) };
      case "result": {
        const r = type as C.ResultType;
        return { ...r, ok: this.substituteTypevars(r.ok, args, depth + 1), err: this.substituteTypevars(r.err, args, depth + 1) };
      }
      case "array":
        return { ...type, element: this.substituteTypevars((type as C.ArrayType).element, args, depth + 1) };
      default:
        return type;
    }
  }

  /**
   * Convert a BridgeOp from the type checker into a ManifestBridgeOp.
   */
  private toBridgeManifestOp(b: { binding: string; op: { op: string; [k: string]: unknown } }): ManifestBridgeOp {
    const crossing = this.typeChecker.getCrossings().find(c => c.binding === b.binding && c.result.bridgeOp);
    const result: ManifestBridgeOp = {
      binding: b.binding,
      op: b.op.op,
    };
    if (crossing) {
      result.from = crossing.from.runtime;
      result.to = crossing.to.runtime;
    }
    // Extract any extra metadata from the bridge op
    const { op: _, ...meta } = b.op;
    if (Object.keys(meta).length > 0) {
      result.meta = meta as Record<string, unknown>;
    }
    return result;
  }

  /**
   * Check a cross-runtime reference and register the crossing with the type checker.
   * Called when a capture crosses a runtime boundary.
   */
  checkTypeCrossing(name: string, targetRuntime: OmniRuntime, expectedType?: C.CanonicalType): void {
    this.typeChecker.checkCrossing(
      name,
      targetRuntime as string as "javascript" | "typescript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "bash",
      expectedType,
    );
  }

  // ─── Parallel Pattern Detection ─────────────────────────────────

  /**
   * Detect if an expression is a parallelizable pattern:
   * - Promise.all([expr1, expr2, ...])
   * - asyncio.gather(expr1, expr2, ...)
   * - CompletableFuture.allOf(expr1, expr2, ...)
   * Optionally wrapped in Unary("await", ...).
   * Returns the list of branch expressions, or null.
   */
  private isParallelPattern(expr: AST.Expr): { exprs: AST.Expr[] } | null {
    let inner = expr;
    // Unwrap await
    if (inner.kind === "Unary" && inner.op === "await" && inner.prefix) {
      inner = inner.argument;
    }
    if (inner.kind !== "Call") return null;
    const callee = inner.callee;
    if (callee.kind !== "Member") return null;
    const obj = callee.object;
    const prop = callee.property;
    if (obj.kind !== "Identifier") return null;

    // Promise.all([expr1, expr2, ...]) — single ArrayLiteral arg
    if (obj.name === "Promise" && prop.name === "all") {
      if (inner.args.length === 1 && inner.args[0].kind === "ArrayLiteral") {
        return { exprs: (inner.args[0] as AST.ArrayLiteral).elements };
      }
      return null;
    }

    // asyncio.gather(expr1, expr2, ...)
    if (obj.name === "asyncio" && prop.name === "gather") {
      if (inner.args.length > 0) {
        return { exprs: inner.args };
      }
      return null;
    }

    // CompletableFuture.allOf(expr1, expr2, ...)
    if (obj.name === "CompletableFuture" && prop.name === "allOf") {
      if (inner.args.length > 0) {
        return { exprs: inner.args };
      }
      return null;
    }

    return null;
  }

  /**
   * Emit a ParallelOp from a list of branch expressions.
   * Each branch gets its own runtime affinity from the resolver.
   */
  private emitParallel(exprs: AST.Expr[], bindPrefix: string): ParallelOp {
    const branches = exprs.map((expr, i) => {
      const aff = this.affinityMap.get(expr);
      const runtime = aff?.runtime || this.defaultRuntime;
      const captures = this.computeCaptures(expr, runtime);
      return {
        runtime,
        code: exprToCode(expr, this.source),
        bind: `${bindPrefix}_${i}`,
        ...(captures ? { captures } : {}),
      };
    });
    return { op: "parallel" as const, branches };
  }

  // ─── Await Detection ────────────────────────────────────────────

  /**
   * Detect if an expression is `await expr` (not a parallel pattern).
   * Returns the inner expression, or null.
   */
  private isAwaitExpr(expr: AST.Expr): { inner: AST.Expr } | null {
    if (expr.kind === "Unary" && expr.op === "await" && expr.prefix) {
      return { inner: expr.argument };
    }
    return null;
  }

  /**
   * Emit an AwaitOp for a non-parallel await expression.
   */
  private emitAwait(inner: AST.Expr, runtime: OmniRuntime, bind?: string): AwaitOp {
    const captures = this.computeCaptures(inner, runtime);
    return {
      op: "await",
      runtime,
      from: {
        op: "eval",
        runtime,
        code: exprToCode(inner, this.source),
        bind: bind || "__awaited",
        ...(captures ? { captures } : {}),
      },
      ...(bind ? { bind } : {}),
    };
  }

  // ─── make() Detection ─────────────────────────────────────────

  /**
   * Detect if an expression is a `make(N)` call (channel creation).
   * Returns the buffer size, or null.
   */
  private isMakeCall(expr: AST.Expr): { size?: number } | null {
    if (expr.kind === "Call" && expr.callee.kind === "Identifier" && expr.callee.name === "make") {
      const size = expr.args.length > 0 && expr.args[0].kind === "NumericLiteral"
        ? Number((expr.args[0] as AST.NumericLiteral).raw)
        : undefined;
      return { size };
    }
    return null;
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

      case "Try":
        return [this.emitTry(node)];

      case "Throw":
        return [this.emitThrow(node)];

      case "ExportDecl":
        if (node.declaration) return this.emitNode(node.declaration, blockRuntime);
        return [];

      case "Import":
      case "ImportDecl":
        return [this.emitImport(node)];

      case "ShortDecl":
        return this.emitShortDecl(node);

      case "Go":
        return [this.emitSpawn(node)];

      case "Defer":
        return [{ op: "native", runtime: OmniRuntime.Go, code: "/* ERROR: defer not supported in OmniVM Go runtime. */" }];

      case "Select":
        return [this.emitSelect(node)];

      case "Yield":
        return [this.emitYield(node)];

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

    // Parallel pattern check (standalone expression)
    const parallel = this.isParallelPattern(expr);
    if (parallel) {
      return this.emitParallel(parallel.exprs, "__parallel");
    }

    // Await (non-parallel) → AwaitOp
    const awaitExpr = this.isAwaitExpr(expr);
    if (awaitExpr) {
      return this.emitAwait(awaitExpr.inner, runtime);
    }

    // make() → ChanOp make
    const makeCall = this.isMakeCall(expr);
    if (makeCall) {
      return {
        op: "chan",
        action: "make",
        runtime,
        size: makeCall.size,
      } as ChanOp;
    }

    // Channel operations
    const chanOp = this.detectChanOp(expr, runtime);
    if (chanOp) return chanOp;

    // Yield expression → YieldOp
    if (expr.kind === "Yield") {
      return this.emitYield(expr as AST.Yield);
    }

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

  // ─── Channel Detection Helpers ──────────────────────────────

  /** Detect channel send: Binary with op "<-" → { channel, value } */
  private isChanSend(expr: AST.Expr): { channel: string; value: AST.Expr } | null {
    if (expr.kind === "Binary" && expr.op === "<-") {
      const channel = exprToCode(expr.left, this.source);
      return { channel, value: expr.right };
    }
    return null;
  }

  /** Detect channel recv: Unary with op "<-", prefix: true → { channel } */
  private isChanRecv(expr: AST.Expr): { channel: string } | null {
    if (expr.kind === "Unary" && expr.op === "<-" && expr.prefix) {
      const channel = exprToCode(expr.argument, this.source);
      return { channel };
    }
    return null;
  }

  /** Detect channel close: Call to close(ch) → { channel } */
  private isChanClose(expr: AST.Expr): { channel: string } | null {
    if (expr.kind === "Call" && expr.callee.kind === "Identifier" && expr.callee.name === "close") {
      if (expr.args.length === 1) {
        const channel = exprToCode(expr.args[0], this.source);
        return { channel };
      }
    }
    return null;
  }

  /** Detect any channel operation and emit a ChanOp, or null. */
  private detectChanOp(expr: AST.Expr, runtime: OmniRuntime): ChanOp | null {
    // Channel send: ch <- value
    const send = this.isChanSend(expr);
    if (send) {
      const captures = this.computeCaptures(expr, runtime);
      const value: ManifestValue = this.isSimpleLiteral(send.value)
        ? { kind: "literal", value: this.literalValue(send.value) }
        : { kind: "ref", name: exprToCode(send.value, this.source) };
      return {
        op: "chan",
        action: "send",
        runtime,
        channel: send.channel,
        value,
        ...(captures ? { captures } : {}),
      };
    }

    // Channel recv: <-ch (standalone, no bind)
    const recv = this.isChanRecv(expr);
    if (recv) {
      const captures = this.computeCaptures(expr, runtime);
      return {
        op: "chan",
        action: "recv",
        runtime,
        channel: recv.channel,
        ...(captures ? { captures } : {}),
      };
    }

    // Channel close: close(ch)
    const close = this.isChanClose(expr);
    if (close) {
      return {
        op: "chan",
        action: "close",
        runtime,
        channel: close.channel,
      };
    }

    return null;
  }

  // ─── Spawn (goroutine) ─────────────────────────────────────────

  private emitSpawn(node: AST.Go): SpawnOp {
    const aff = this.affinityMap.get(node);
    const runtime = aff?.runtime || OmniRuntime.Go;
    const captures = this.computeCaptures(node.expr, runtime);
    return {
      op: "spawn",
      runtime,
      code: exprToCode(node.expr, this.source),
      ...(captures ? { captures } : {}),
    };
  }

  // ─── Select ────────────────────────────────────────────────────

  private emitSelect(node: AST.Select): SelectOp {
    const cases: SelectCase[] = [];
    let defaultBody: ManifestOp[] | undefined;

    for (const c of node.cases) {
      // Each case pattern should be a channel operation expression
      for (const pattern of c.patterns) {
        const bodyBlocks = consolidateBlocks(c.body.statements, this.affinityMap);
        const bodyOps: ManifestOp[] = [];
        for (const block of bodyBlocks) {
          bodyOps.push(...this.emitBlock(block));
        }

        // Detect recv pattern: <-ch or val := <-ch
        const recv = this.isChanRecv(pattern);
        if (recv) {
          cases.push({
            action: "recv",
            channel: recv.channel,
            body: bodyOps,
          });
          continue;
        }

        // Detect send pattern: ch <- value
        const send = this.isChanSend(pattern);
        if (send) {
          const value: ManifestValue = this.isSimpleLiteral(send.value)
            ? { kind: "literal", value: this.literalValue(send.value) }
            : { kind: "ref", name: exprToCode(send.value, this.source) };
          cases.push({
            action: "send",
            channel: send.channel,
            value,
            body: bodyOps,
          });
          continue;
        }

        // Fallback: treat as recv on the expression
        cases.push({
          action: "recv",
          channel: exprToCode(pattern, this.source),
          body: bodyOps,
        });
      }
    }

    // defaultCase is a separate Block on the AST node
    if (node.defaultCase) {
      const defBlocks = consolidateBlocks(node.defaultCase.statements, this.affinityMap);
      const defOps: ManifestOp[] = [];
      for (const block of defBlocks) {
        defOps.push(...this.emitBlock(block));
      }
      defaultBody = defOps;
    }

    return {
      op: "select",
      cases,
      ...(defaultBody ? { defaultBody } : {}),
    };
  }

  // ─── Yield ─────────────────────────────────────────────────────

  private emitYield(node: AST.Yield): YieldOp {
    const yieldOp: YieldOp = { op: "yield" };

    if (node.value) {
      if (this.isSimpleLiteral(node.value)) {
        yieldOp.value = { kind: "literal", value: this.literalValue(node.value) };
      } else if (node.value.kind === "Identifier") {
        yieldOp.value = { kind: "ref", name: node.value.name };
      } else {
        const aff = this.affinityMap.get(node.value);
        const runtime = aff?.runtime || this.defaultRuntime;
        const captures = this.computeCaptures(node.value, runtime);
        yieldOp.from = {
          op: "eval",
          runtime,
          code: exprToCode(node.value, this.source),
          bind: "__yield",
          ...(captures ? { captures } : {}),
        };
      }
    }

    if (node.delegate) {
      yieldOp.delegate = true;
    }

    return yieldOp;
  }

  // ─── Declarations ─────────────────────────────────────────────

  private emitVarDecl(node: AST.VarDecl): ManifestOp[] {
    const ops: ManifestOp[] = [];
    for (let i = 0; i < node.names.length; i++) {
      const name = node.names[i].name;

      if (node.values && node.values[i]) {
        const valExpr = node.values[i];
        const aff = this.affinityMap.get(valExpr);
        const runtime = aff?.runtime || this.defaultRuntime;

        // Parallel pattern check
        const parallel = this.isParallelPattern(valExpr);
        if (parallel) {
          ops.push(this.emitParallel(parallel.exprs, name));
          this.recordBinding(name, runtime);
          continue;
        }

        // Await (non-parallel) → AwaitOp with bind
        const awaitExpr = this.isAwaitExpr(valExpr);
        if (awaitExpr && !this.isParallelPattern(awaitExpr.inner)) {
          ops.push(this.emitAwait(awaitExpr.inner, runtime, name));
          this.recordBinding(name, runtime);
          continue;
        }

        // make() → ChanOp make with bind
        const makeCall = this.isMakeCall(valExpr);
        if (makeCall) {
          ops.push({
            op: "chan",
            action: "make",
            runtime,
            bind: name,
            size: makeCall.size,
          } as ChanOp);
          this.recordBinding(name, runtime);
          continue;
        }

        // Channel recv: val = <-ch → ChanOp recv with bind
        const recv = this.isChanRecv(valExpr);
        if (recv) {
          const captures = this.computeCaptures(valExpr, runtime);
          ops.push({
            op: "chan",
            action: "recv",
            runtime,
            channel: recv.channel,
            bind: name,
            ...(captures ? { captures } : {}),
          });
          this.recordBinding(name, runtime);
          continue;
        }

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

      // Parallel pattern check
      const parallel = this.isParallelPattern(valExpr);
      if (parallel) {
        ops.push(this.emitParallel(parallel.exprs, name));
        this.recordBinding(name, runtime);
        continue;
      }

      // Await (non-parallel) → AwaitOp with bind
      const awaitExpr = this.isAwaitExpr(valExpr);
      if (awaitExpr && !this.isParallelPattern(awaitExpr.inner)) {
        ops.push(this.emitAwait(awaitExpr.inner, runtime, name));
        this.recordBinding(name, runtime);
        continue;
      }

      // make() → ChanOp make with bind
      const makeCall = this.isMakeCall(valExpr);
      if (makeCall) {
        ops.push({
          op: "chan",
          action: "make",
          runtime,
          bind: name,
          size: makeCall.size,
        } as ChanOp);
        this.recordBinding(name, runtime);
        continue;
      }

      // Channel recv: val = <-ch → ChanOp recv with bind
      const recv = this.isChanRecv(valExpr);
      if (recv) {
        const captures = this.computeCaptures(valExpr, runtime);
        ops.push({
          op: "chan",
          action: "recv",
          runtime,
          channel: recv.channel,
          bind: name,
          ...(captures ? { captures } : {}),
        });
        this.recordBinding(name, runtime);
        continue;
      }

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

        // Await (non-parallel) → AwaitOp with bind
        const awaitExpr = this.isAwaitExpr(pair.expr);
        if (awaitExpr && !this.isParallelPattern(awaitExpr.inner)) {
          ops.push(this.emitAwait(awaitExpr.inner, runtime, name));
          this.recordBinding(name, runtime);
          continue;
        }

        // make() → ChanOp make with bind
        const makeCall = this.isMakeCall(pair.expr);
        if (makeCall) {
          ops.push({
            op: "chan",
            action: "make",
            runtime,
            bind: name,
            size: makeCall.size,
          } as ChanOp);
          this.recordBinding(name, runtime);
          continue;
        }

        // Channel recv: val := <-ch → ChanOp recv with bind
        const recv = this.isChanRecv(pair.expr);
        if (recv) {
          const captures = this.computeCaptures(pair.expr, runtime);
          ops.push({
            op: "chan",
            action: "recv",
            runtime,
            channel: recv.channel,
            bind: name,
            ...(captures ? { captures } : {}),
          });
          this.recordBinding(name, runtime);
          continue;
        }
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
    // Await (non-parallel) → AwaitOp with bind
    const awaitExpr = this.isAwaitExpr(valExpr);
    if (awaitExpr && !this.isParallelPattern(awaitExpr.inner)) {
      return this.emitAwait(awaitExpr.inner, runtime, bindName);
    }

    // make() → ChanOp make with bind
    const makeCall = this.isMakeCall(valExpr);
    if (makeCall) {
      return {
        op: "chan",
        action: "make",
        runtime,
        bind: bindName,
        size: makeCall.size,
      } as ChanOp;
    }

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

  private emitLoop(node: AST.Loop): ManifestOp {
    const bodyBlocks = consolidateBlocks(node.body.statements, this.affinityMap);
    const bodyOps: ManifestOp[] = [];
    for (const block of bodyBlocks) {
      bodyOps.push(...this.emitBlock(block));
    }

    const loopOp: LoopOp = {
      op: "loop",
      mode: node.mode === "while" ? "while" :
            node.mode === "for" ? "for" :
            node.mode === "foreach" ? "foreach" : "infinite",
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

    // Foreach: set variable and iterable
    if (node.mode === "foreach") {
      if (node.variable) {
        if (node.variable.kind === "ArrayPattern") {
          loopOp.variable = node.variable.elements
            .filter((e): e is AST.Identifier => e !== null && e.kind === "Identifier")
            .map(e => e.name)
            .join(", ");
        } else {
          loopOp.variable = node.variable.name;
        }
      }
      if (node.iterable) {
        if (node.iterable.kind === "Identifier") {
          loopOp.iterable = { kind: "ref", name: node.iterable.name };
        } else {
          // Complex iterable expression → ref to a literal representation
          loopOp.iterable = { kind: "ref", name: exprToCode(node.iterable, this.source) };
        }
      }
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

  // ─── Try/Catch/Throw ────────────────────────────────────────

  private emitTry(node: AST.Try): TryOp {
    // Decompose try body
    const bodyBlocks = consolidateBlocks(node.body.statements, this.affinityMap);
    const bodyOps: ManifestOp[] = [];
    for (const block of bodyBlocks) {
      bodyOps.push(...this.emitBlock(block));
    }

    // Decompose catch clauses with runtime and optional errorType
    const catches: ManifestCatch[] = node.catches.map(c => {
      const catchBlocks = consolidateBlocks(c.body.statements, this.affinityMap);
      const catchOps: ManifestOp[] = [];
      for (const block of catchBlocks) {
        catchOps.push(...this.emitBlock(block));
      }

      // Determine catch handler runtime from first body op or try body's dominant runtime
      let catchRuntime: string | undefined;
      if (catchBlocks.length > 0) {
        catchRuntime = catchBlocks[0].runtime;
      } else if (bodyBlocks.length > 0) {
        catchRuntime = bodyBlocks[0].runtime;
      }

      // Extract errorType from typed catch param (Python except ValueError, Java catch IOException)
      let errorType: string | undefined;
      if (c.type) {
        if (c.type.kind === "SimpleType") {
          errorType = c.type.id.name;
        } else if (this.source && c.type.span) {
          errorType = this.source.slice(c.type.span.start, c.type.span.end);
        }
      }

      return {
        ...(c.param ? { param: c.param.name } : {}),
        body: catchOps,
        ...(catchRuntime ? { runtime: catchRuntime } : {}),
        ...(errorType ? { errorType } : {}),
      };
    });

    const tryOp: TryOp = {
      op: "try",
      body: bodyOps,
      catches,
    };

    // Decompose finally body if present
    if (node.finallyBody) {
      const finallyBlocks = consolidateBlocks(node.finallyBody.statements, this.affinityMap);
      const finallyOps: ManifestOp[] = [];
      for (const block of finallyBlocks) {
        finallyOps.push(...this.emitBlock(block));
      }
      tryOp.finallyBody = finallyOps;
    }

    return tryOp;
  }

  private emitThrow(node: AST.Throw): ThrowOp {
    if (this.isSimpleLiteral(node.value)) {
      return {
        op: "throw",
        value: { kind: "literal", value: this.literalValue(node.value) },
      };
    }
    if (node.value.kind === "Identifier") {
      return {
        op: "throw",
        value: { kind: "ref", name: node.value.name },
      };
    }
    // Complex expression — use literal with stringified code
    return {
      op: "throw",
      value: { kind: "literal", value: exprToCode(node.value, this.source) },
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
