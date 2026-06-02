import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { RuntimeResolver } from "../src/runtime-resolver";
import { ManifestCodeGenerator } from "../src/codegen-omnivm";

function compile(example: string) {
  const filePath = path.join(__dirname, "..", "examples", example);
  const code = fs.readFileSync(filePath, "utf8");
  const tokens = new Lexer(code).tokenize();
  const ast = new Parser(tokens, code).parse();
  const resolver = new RuntimeResolver();
  const annotated = resolver.resolve(ast, code);
  const manifest = new ManifestCodeGenerator().generate(annotated);
  return { ast, manifest };
}

describe("unchanged source compatibility corpus", () => {
  test("runs Python service helpers without dropping decorators or class fields", () => {
    const { ast, manifest } = compile("compat-python-service.py");

    expect(ast.body.some((node: any) => node.kind === "ClassDecl" && node.name.name === "UserScore")).toBe(true);
    const classOp = manifest.ops.find((op: any) => op.op === "native" && op.code.includes("UserScore")) as any;
    expect(classOp).toBeDefined();
    expect(classOp.runtime).toBe("python");
    expect(classOp.code).toContain("@dataclass");
    expect(classOp.code).toContain("user_id: str");
    expect(classOp.code).toContain("score: int");

    const rankUser = manifest.ops.find((op: any) => op.op === "func_def" && op.name === "rank_user") as any;
    expect(rankUser?.bodyRuntime).toBe("python");
  });

  test("runs TypeScript modules without executing type-only declarations", () => {
    const { manifest } = compile("compat-order-schema.ts");

    expect(manifest.ops.some((op: any) => op.op === "native" && op.code.includes("type Order"))).toBe(false);
    const summarize = manifest.ops.find((op: any) => op.op === "func_def" && op.name === "summarize") as any;
    expect(summarize?.bodyRuntime).toBe("javascript");
    const log = manifest.ops.find((op: any) => op.op === "exec" && op.runtime === "javascript") as any;
    expect(log?.code).toContain("summarize(sample)");
  });

  test("runs Go helper files without executing package declarations", () => {
    const { manifest } = compile("compat-go-status.go");

    expect(manifest.ops.some((op: any) => op.op === "native" && op.code.includes("package main"))).toBe(false);
    const statusLabel = manifest.ops.find((op: any) => op.op === "func_def" && op.name === "statusLabel") as any;
    expect(statusLabel?.bodyRuntime).toBe("go");
    expect(statusLabel?.source).toContain('"net/http"');
    expect(statusLabel?.source).toContain("http.StatusBadRequest");

    const topLevelInit = manifest.ops.find((op: any) => op.op === "eval" && op.bind === "compatibilityStatus") as any;
    expect(topLevelInit?.runtime).toBe("go");
    expect(topLevelInit?.func).toBe("statusLabel");
    expect(topLevelInit?.args).toEqual(["202"]);
  });
});
