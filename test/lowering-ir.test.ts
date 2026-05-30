import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import { RuntimeResolver, OmniRuntime } from '../src/runtime-resolver';
import { lowerAnnotatedProgram } from '../src/codegen-omnivm/lowering';
import { chooseRuntime, EVIDENCE_WEIGHTS, affinityFromEvidence } from '../src/runtime-resolver/evidence';

function lower(code: string) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, code);
  const ast = parser.parse();
  const annotated = new RuntimeResolver().resolve(ast, code);
  return lowerAnnotatedProgram(annotated);
}

describe('Manifest Lowering IR', () => {
  test('lowers functions, channels, spawns, runtime calls, and eval expressions', () => {
    const ir = lower(`
const inbox = make(2)
func worker(id) { return id }
const w1 = go worker(1)
inbox <- 42
const item = recv("inbox")
close(inbox)
const xs = Array.from(inbox)
`);

    expect(ir.version).toBe(1);
    expect(ir.nodes.map(n => n.kind).slice(0, 7)).toEqual([
      'ChannelMake',
      'DefineFunc',
      'Spawn',
      'ChannelSend',
      'ChannelRecv',
      'ChannelClose',
      'EvalExpr',
    ]);
    expect(ir.nodes.slice(0, 7).every(n => n.native?.source)).toBe(true);
  });

  test('records explicit bridge value nodes from resolver crossings', () => {
    const ir = lower('import os\nconst files = os.listdir("/tmp")\nconst count = Array.from(files)');
    expect(ir.nodes.map(n => n.kind)).toContain('BridgeValue');
  });
});

describe('Runtime Evidence Facts', () => {
  test('selects the highest weighted runtime deterministically and records conflicts', () => {
    const decision = chooseRuntime([
      {
        runtime: OmniRuntime.Java,
        source: 'global',
        weight: EVIDENCE_WEIGHTS.global,
        detail: 'global: com',
      },
      {
        runtime: OmniRuntime.Python,
        source: 'method',
        weight: EVIDENCE_WEIGHTS.method,
        detail: '.append()',
      },
    ], OmniRuntime.JavaScript);

    expect(decision.runtime).toBe(OmniRuntime.Java);
    expect(decision.conflicts).toHaveLength(1);
    expect(decision.trace.join('\n')).toContain('conflict python');
  });

  test('explicit runtime tags become definite affinity', () => {
    const decision = chooseRuntime([
      {
        runtime: OmniRuntime.Python,
        source: 'runtime_tag',
        weight: EVIDENCE_WEIGHTS.explicit,
        detail: '@py()',
      },
      {
        runtime: OmniRuntime.JavaScript,
        source: 'global',
        weight: EVIDENCE_WEIGHTS.global,
        detail: 'global: Array',
      },
    ], OmniRuntime.JavaScript);
    const affinity = affinityFromEvidence(decision);

    expect(affinity.runtime).toBe(OmniRuntime.Python);
    expect(affinity.confidence).toBe('definite');
    expect(affinity.evidence[0].detail).toContain('conflicts');
  });
});
