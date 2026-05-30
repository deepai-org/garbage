import * as AST from '../ast';
import { AnnotatedProgram, OmniRuntime } from '../runtime-resolver/types';
import { exprToCode, nodeToSourceCode } from './source-reconstruct';
import {
  LoweredManifestIR,
  LoweredManifestNode,
  NativePayload,
} from './lowering-ir';

export function lowerAnnotatedProgram(annotated: AnnotatedProgram): LoweredManifestIR {
  const lowerer = new ManifestLowerer(annotated);
  return lowerer.lower();
}

class ManifestLowerer {
  private nextId = 1;

  constructor(private readonly annotated: AnnotatedProgram) {}

  lower(): LoweredManifestIR {
    const nodes: LoweredManifestNode[] = [];
    for (const node of this.annotated.program.body) {
      nodes.push(...this.lowerTopLevel(node));
    }
    for (const bridge of this.annotated.bridges) {
      nodes.push({
        id: this.allocId(),
        kind: "BridgeValue",
        runtime: bridge.to,
        sourceNode: this.annotated.program,
        from: bridge.from,
        to: bridge.to,
        marshalKind: bridge.marshalKind,
      });
    }

    return {
      version: 1,
      defaultRuntime: this.annotated.defaultRuntime,
      nodes,
    };
  }

  private lowerTopLevel(node: AST.Decl | AST.Stmt): LoweredManifestNode[] {
    const runtime = this.runtimeOf(node);
    const native = this.nativePayload(node);

    if (node.kind === "FuncDecl") {
      return [{
        id: this.allocId(),
        kind: "DefineFunc",
        runtime,
        sourceNode: node,
        native,
        name: node.name.name,
        params: node.params.flatMap(p => p.name.kind === "Identifier" ? [p.name.name] : []),
        bodyRuntime: runtime,
      }];
    }

    if (node.kind === "ConstDecl" || node.kind === "VarDecl") {
      const out: LoweredManifestNode[] = [];
      const values = node.values || [];
      for (let i = 0; i < values.length; i++) {
        const expr = values[i];
        const bind = node.names[i]?.name;
        out.push(this.lowerBoundExpr(expr, runtime, bind, node));
      }
      return out.length > 0 ? out : [this.execNode(node, runtime, native)];
    }

    if (node.kind === "ExprStmt") {
      return [this.lowerBoundExpr(node.expr, runtime, undefined, node)];
    }

    return [this.execNode(node, runtime, native)];
  }

  private lowerBoundExpr(
    expr: AST.Expr,
    runtime: OmniRuntime,
    bind: string | undefined,
    sourceNode: AST.Decl | AST.Stmt | AST.Expr,
  ): LoweredManifestNode {
    const channel = this.channelOp(expr, runtime, bind, sourceNode);
    if (channel) return channel;

    if (expr.kind === "Go") {
      return {
        id: this.allocId(),
        kind: "Spawn",
        runtime: OmniRuntime.Go,
        sourceNode,
        native: this.nativePayload(sourceNode),
        bind,
        expr,
      };
    }

    if (expr.kind === "Call" && expr.callee.kind === "Identifier") {
      return {
        id: this.allocId(),
        kind: "CallRuntimeFunc",
        runtime,
        sourceNode,
        native: this.nativePayload(sourceNode),
        callee: expr.callee.name,
        args: expr.args,
        bind,
      };
    }

    return {
      id: this.allocId(),
      kind: "EvalExpr",
      runtime,
      sourceNode,
      native: this.nativePayload(sourceNode),
      bind,
      expr,
    };
  }

  private channelOp(
    expr: AST.Expr,
    runtime: OmniRuntime,
    bind: string | undefined,
    sourceNode: AST.Decl | AST.Stmt | AST.Expr,
  ): LoweredManifestNode | undefined {
    if (expr.kind === "Call" && expr.callee.kind === "Identifier") {
      if (expr.callee.name === "make") {
        return {
          id: this.allocId(),
          kind: "ChannelMake",
          action: "make",
          runtime,
          sourceNode,
          native: this.nativePayload(sourceNode),
          bind,
        };
      }
      if (expr.callee.name === "close" && expr.args[0]) {
        return {
          id: this.allocId(),
          kind: "ChannelClose",
          action: "close",
          runtime,
          sourceNode,
          native: this.nativePayload(sourceNode),
          channel: exprToCode(expr.args[0], this.annotated.source),
        };
      }
      if (expr.callee.name === "recv" && expr.args[0]) {
        return {
          id: this.allocId(),
          kind: "ChannelRecv",
          action: "recv",
          runtime,
          sourceNode,
          native: this.nativePayload(sourceNode),
          bind,
          channel: exprToCode(expr.args[0], this.annotated.source),
        };
      }
    }

    if (expr.kind === "Binary" && expr.op === "<-") {
      return {
        id: this.allocId(),
        kind: "ChannelSend",
        action: "send",
        runtime,
        sourceNode,
        native: this.nativePayload(sourceNode),
        channel: exprToCode(expr.left, this.annotated.source),
        value: expr.right,
      };
    }

    return undefined;
  }

  private execNode(
    node: AST.Decl | AST.Stmt | AST.Expr,
    runtime: OmniRuntime,
    native?: NativePayload,
  ): LoweredManifestNode {
    return {
      id: this.allocId(),
      kind: "ExecStmt",
      runtime,
      sourceNode: node,
      native,
      node,
    };
  }

  private nativePayload(node: AST.Decl | AST.Stmt | AST.Expr): NativePayload | undefined {
    if (!this.annotated.source || !node.span || node.span.end <= node.span.start) return undefined;
    return {
      source: nodeToSourceCode(node, this.annotated.source),
      span: node.span,
    };
  }

  private runtimeOf(node: AST.Decl | AST.Stmt | AST.Expr): OmniRuntime {
    return this.annotated.affinityMap.get(node)?.runtime || this.annotated.defaultRuntime;
  }

  private allocId(): number {
    return this.nextId++;
  }
}
