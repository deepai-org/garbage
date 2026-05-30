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
      expect(runtimes[3]).toBe("python"); // def crawl
    });

    it("assigns go to channels and workers", () => {
      expect(runtimes[1]).toBe("go"); // inbox = make(16)
      expect(runtimes[2]).toBe("go"); // outbox = make(16)
      expect(runtimes[5]).toBe("go"); // func worker
      expect(runtimes[6]).toBe("go"); // w1 = go worker(1)
    });

    it("assigns javascript to process function", () => {
      expect(runtimes[4]).toBe("javascript"); // function process
    });

    it("assigns go to close() and channel sends", () => {
      expect(runtimes[11]).toBe("go"); // close(inbox)
      expect(runtimes[12]).toBe("go"); // joined = wait(w1, w2, w3, w4)
      expect(runtimes[14]).toBe("go"); // close(outbox)
      expect(runtimes[22]).toBe("go"); // const done = make(1)
      expect(runtimes[23]).toBe("go"); // done <- report
      expect(runtimes[24]).toBe("go"); // close(done)
    });

    it("assigns js to arrow-function expressions", () => {
      expect(runtimes[15]).toBe("javascript"); // rows = Array.from(outbox).map(...)
      expect(runtimes[16]).toBe("javascript"); // raw = rows.map(...)
      expect(runtimes[17]).toBe("javascript"); // names = raw.map(r => ...)
      expect(runtimes[18]).toBe("javascript"); // deduped = names.filter(...)
    });

    it("assigns python to sorted/len/final report", () => {
      expect(runtimes[13]).toBe("python"); // worker_count = len(joined)
      expect(runtimes[19]).toBe("python"); // ranked = sorted(deduped)
      expect(runtimes[20]).toBe("python"); // total = len(ranked)
      expect(runtimes[21]).toBe("python"); // report = ranked
      expect(runtimes[25]).toBe("python"); // final_report = list(done)
      expect(runtimes[26]).toBe("python"); // delivered = len(final_report)
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
      expect(spawnOps.map((o: any) => o.bind)).toEqual(["w1", "w2", "w3", "w4"]);
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
      expect(runtimes[27]).toBe("python"); // print(f"Processed {total}...")
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

  describe("django-go-typescript-views.poly", () => {
    const { manifest, runtimes } = compile(
      path.join(examplesDir, "django-go-typescript-views.poly")
    );

    it("imports Django in Python and emits Go plus JavaScript handlers", () => {
      expect(runtimes).not.toContain("unknown");
      expect(runtimes.slice(0, 4)).toEqual([
        "python",
        "python",
        "python",
        "python",
      ]);
      expect(runtimes).toContain("go");
      expect(runtimes).toContain("javascript");
    });

    it("compiles framework view handlers into manifest-callable functions", () => {
      const funcs = manifest.ops.filter((o: any) => o.op === "func_def");
      const goView = funcs.find((o: any) => o.name === "go_view");
      const tsView = funcs.find((o: any) => o.name === "ts_view");

      expect((goView as any)?.bodyRuntime).toBe("go");
      expect((goView as any)?.source).toContain("func GoView(path interface{}) interface{}");
      expect((tsView as any)?.bodyRuntime).toBe("javascript");
    });

    it("keeps the Django callable native while delegating through OmniVM stubs", () => {
      const djangoView = manifest.ops.find(
        (o: any) => o.op === "eval" && o.bind === "django_view"
      ) as any;

      expect(djangoView?.runtime).toBe("python");
      expect(djangoView?.code).not.toContain("@py");
      expect(djangoView?.code).toContain("JsonResponse");
      expect(djangoView?.code).toContain("go_view(request.path)");
      expect(djangoView?.code).toContain("ts_view(request.path)");
      expect(djangoView?.code).not.toContain("json.loads");
      expect(djangoView?.code).toContain("lambda request");
    });
  });

  describe("Java ecosystem examples", () => {
    const javaExamples = [
      "java-gson-pandas-zod-express.poly",
      "java-commons-csv-pydantic-go-batching.poly",
      "java-jsoup-bs4-cheerio.poly",
      "java-okhttp-httpx-go-retry.poly",
    ];

    for (const example of javaExamples) {
      it(`${example} infers Java and JavaScript without runtime tags`, () => {
        const { manifest, runtimes, code } = compile(path.join(examplesDir, example));

        expect(code).not.toMatch(/@(java|js)\(/);
        expect(runtimes).not.toContain("unknown");
        expect(runtimes).toContain("java");
        expect(manifest.ops.length).toBeGreaterThan(3);

        const evalOps = manifest.ops.filter((o: any) => o.op === "eval" && o.code);
        const javaOps = evalOps.filter((o: any) => o.runtime === "java");
        expect(javaOps.length).toBeGreaterThan(0);
        for (const op of evalOps) {
          expect((op as any).code).not.toMatch(/@(java|js)\(/);
        }
      });
    }
  });

  describe("express-python-view.poly", () => {
    const { manifest, runtimes } = compile(
      path.join(examplesDir, "express-python-view.poly")
    );

    it("imports Express in JavaScript and defines the view in Python", () => {
      expect(runtimes).not.toContain("unknown");
      expect(runtimes[0]).toBe("javascript");
      expect(runtimes[1]).toBe("python");
    });

    it("compiles the Python view as a manifest-callable handler", () => {
      const pyView = manifest.ops.find(
        (o: any) => o.op === "func_def" && o.name === "py_view"
      ) as any;

      expect(pyView).toBeDefined();
      expect(pyView.bodyRuntime).toBe("python");
    });

    it("keeps the Express route native while delegating into Python", () => {
      const route = manifest.ops.find(
        (o: any) => o.op === "eval" && o.bind === "express_view"
      ) as any;
      const registration = manifest.ops.find(
        (o: any) => o.op === "exec" && String((o as any).code).includes("app.get")
      ) as any;

      expect(route?.runtime).toBe("javascript");
      expect(route?.code).toContain("py_view(req.path)");
      expect(route?.code).not.toContain("JSON.parse");
      expect(registration?.runtime).toBe("javascript");
    });
  });
});
