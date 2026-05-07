import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { RuntimeResolver } from "../src/runtime-resolver";
import { ManifestCodeGenerator } from "../src/codegen-omnivm";

function compile(filePath: string) {
  const code = fs.readFileSync(filePath, "utf8");
  const tokens = new Lexer(code).tokenize();
  const ast = new Parser(tokens, code).parse();
  const resolver = new RuntimeResolver();
  const annotated = resolver.resolve(ast, code);
  const gen = new ManifestCodeGenerator();
  const manifest = gen.generate(annotated);

  const runtimes = annotated.program.body.map((node) => {
    const aff = annotated.affinityMap.get(node);
    return aff?.runtime ?? "unknown";
  });

  return { annotated, manifest, runtimes, code };
}

const examplesDir = path.join(__dirname, "..", "examples");

describe("Example files: end-to-end pipeline", () => {
  describe("cursed-polyglot.poly", () => {
    const { manifest, runtimes } = compile(
      path.join(examplesDir, "cursed-polyglot.poly")
    );

    it("has no unknown runtimes", () => {
      expect(runtimes).not.toContain("unknown");
    });

    it("produces a valid manifest with ops", () => {
      expect(manifest.version).toBe(1);
      expect(manifest.ops.length).toBeGreaterThan(10);
    });

    it("starts with python imports", () => {
      expect(runtimes[0]).toBe("python");
      expect(runtimes[1]).toBe("python");
      expect(runtimes[2]).toBe("python");
    });

    it("ping-pongs between python and javascript", () => {
      // entries=py, stems=js, matched=py, unique=js, ordered=py, records=js, wire=py
      expect(runtimes[3]).toBe("python"); // entries
      expect(runtimes[4]).toBe("javascript"); // stems (arrow)
      expect(runtimes[5]).toBe("python"); // matched (list comp)
      expect(runtimes[6]).toBe("javascript"); // unique (arrow + ===)
      expect(runtimes[7]).toBe("python"); // ordered (sorted)
      expect(runtimes[8]).toBe("javascript"); // records (arrow)
      expect(runtimes[9]).toBe("python"); // wire (json.dumps)
      expect(runtimes[10]).toBe("python"); // survived (len)
      expect(runtimes[11]).toBe("javascript"); // status (arrow + template)
    });

    it("detects f-string print as python", () => {
      expect(runtimes[12]).toBe("python"); // print(f"Pipeline complete...")
    });

    it("manifest ops have valid code strings", () => {
      const evalOps = manifest.ops.filter(
        (o: any) => o.op === "eval" && o.code
      );
      for (const op of evalOps) {
        expect((op as any).code).not.toContain("/* ");
        expect((op as any).code.length).toBeGreaterThan(0);
      }
    });

    it("has cross-runtime captures", () => {
      const withCaptures = manifest.ops.filter(
        (o: any) => o.captures && Object.keys(o.captures).length > 0
      );
      expect(withCaptures.length).toBeGreaterThan(0);
    });
  });

  describe("cursed-concurrency.poly", () => {
    const { manifest, runtimes } = compile(
      path.join(examplesDir, "cursed-concurrency.poly")
    );

    it("has no unknown runtimes", () => {
      expect(runtimes).not.toContain("unknown");
    });

    it("assigns python to imports and crawl", () => {
      expect(runtimes[0]).toBe("python"); // import os
      expect(runtimes[1]).toBe("python"); // import json
      expect(runtimes[4]).toBe("python"); // def crawl
    });

    it("assigns go to channels and workers", () => {
      expect(runtimes[2]).toBe("go"); // inbox = make(16)
      expect(runtimes[3]).toBe("go"); // outbox = make(16)
      expect(runtimes[6]).toBe("go"); // func worker
      expect(runtimes[7]).toBe("go"); // go worker(1)
    });

    it("assigns javascript to async function", () => {
      expect(runtimes[5]).toBe("javascript"); // async function process
    });

    it("assigns go to close() and channel sends", () => {
      expect(runtimes[12]).toBe("go"); // close(inbox)
      expect(runtimes[19]).toBe("go"); // const done = make(0)
      expect(runtimes[20]).toBe("go"); // done <- report
      expect(runtimes[21]).toBe("go"); // close(done)
    });

    it("assigns js to arrow-function expressions", () => {
      expect(runtimes[14]).toBe("javascript"); // names = raw.map(r => ...)
      expect(runtimes[15]).toBe("javascript"); // deduped = names.filter(...)
    });

    it("assigns python to sorted/len/json.dumps", () => {
      expect(runtimes[16]).toBe("python"); // ranked = sorted(deduped)
      expect(runtimes[17]).toBe("python"); // total = len(ranked)
      expect(runtimes[18]).toBe("python"); // report = json.dumps(ranked)
    });

    it("emits chan ops for make/send/close", () => {
      const chanOps = manifest.ops.filter((o: any) => o.op === "chan");
      const actions = chanOps.map((o: any) => o.action);
      expect(actions).toContain("make");
      expect(actions).toContain("send");
      expect(actions).toContain("close");
    });

    it("emits spawn ops for goroutines", () => {
      const spawnOps = manifest.ops.filter((o: any) => o.op === "spawn");
      expect(spawnOps.length).toBe(4);
    });

    it("emits func_def with correct bodyRuntime", () => {
      const funcs = manifest.ops.filter((o: any) => o.op === "func_def");
      const crawl = funcs.find((o: any) => o.name === "crawl");
      const process = funcs.find((o: any) => o.name === "process");
      const worker = funcs.find((o: any) => o.name === "worker");
      expect((crawl as any)?.bodyRuntime).toBe("python");
      expect((process as any)?.bodyRuntime).toBe("javascript");
      expect((worker as any)?.bodyRuntime).toBe("go");
    });

    it("detects f-string print as python", () => {
      expect(runtimes[22]).toBe("python"); // print(f"Processed {total}...")
    });

    it("has type crossing summary", () => {
      expect(manifest.typeSummary).toBeDefined();
    });
  });

  describe("syntactic-dominance.poly", () => {
    const { manifest, runtimes } = compile(
      path.join(examplesDir, "syntactic-dominance.poly")
    );

    it("has no unknown runtimes", () => {
      expect(runtimes).not.toContain("unknown");
    });

    it("arrows override python provenance", () => {
      expect(runtimes[2]).toBe("python"); // files = os.listdir
      expect(runtimes[3]).toBe("javascript"); // loud = files.map(f => ...)
      expect(runtimes[4]).toBe("javascript"); // valid = loud.filter(f => f !== ...)
    });

    it("python builtins stay python", () => {
      expect(runtimes[5]).toBe("python"); // count = len(valid)
      expect(runtimes[7]).toBe("python"); // ordered = sorted(logs)
      expect(runtimes[8]).toBe("python"); // payload = json.dumps(ordered)
    });

    it("regex literal signals javascript", () => {
      expect(runtimes[6]).toBe("javascript"); // logs with /\.log$/i
    });

    it("produces valid manifest", () => {
      expect(manifest.version).toBe(1);
      expect(manifest.ops.length).toBeGreaterThan(8);
      const evalOps = manifest.ops.filter(
        (o: any) => o.op === "eval" && o.code
      );
      for (const op of evalOps) {
        expect((op as any).code).not.toContain("/* ");
      }
    });
  });
});
