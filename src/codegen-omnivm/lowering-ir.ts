import * as AST from '../ast';
import { BridgeDescriptor, OmniRuntime } from '../runtime-resolver/types';

export type LoweredManifestNode =
  | LoweredEvalExpr
  | LoweredExecStmt
  | LoweredDefineFunc
  | LoweredCallRuntimeFunc
  | LoweredSpawn
  | LoweredChannelOp
  | LoweredBridgeValue;

export interface NativePayload {
  source: string;
  span: AST.Span;
}

export interface LoweredBase {
  id: number;
  runtime: OmniRuntime;
  sourceNode: AST.Program | AST.Decl | AST.Stmt | AST.Expr;
  native?: NativePayload;
}

export interface LoweredEvalExpr extends LoweredBase {
  kind: "EvalExpr";
  bind?: string;
  expr: AST.Expr;
}

export interface LoweredExecStmt extends LoweredBase {
  kind: "ExecStmt";
  node: AST.Decl | AST.Stmt | AST.Expr;
}

export interface LoweredDefineFunc extends LoweredBase {
  kind: "DefineFunc";
  name: string;
  params: string[];
  bodyRuntime: OmniRuntime;
}

export interface LoweredCallRuntimeFunc extends LoweredBase {
  kind: "CallRuntimeFunc";
  callee: string;
  args: AST.Expr[];
  expr: AST.Call;
  bind?: string;
}

export interface LoweredSpawn extends LoweredBase {
  kind: "Spawn";
  bind?: string;
  expr: AST.Go;
}

export type ChannelAction = "make" | "send" | "recv" | "close";

export interface LoweredChannelOp extends LoweredBase {
  kind: "ChannelMake" | "ChannelSend" | "ChannelRecv" | "ChannelClose";
  action: ChannelAction;
  channel?: string;
  size?: number;
  value?: AST.Expr;
  bind?: string;
}

export interface LoweredBridgeValue extends LoweredBase {
  kind: "BridgeValue";
  from: OmniRuntime;
  to: OmniRuntime;
  marshalKind: BridgeDescriptor["marshalKind"];
}

export interface LoweredManifestIR {
  version: 1;
  defaultRuntime: OmniRuntime;
  nodes: LoweredManifestNode[];
}
