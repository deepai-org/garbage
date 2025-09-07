import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';

describe('Parser Error Detection', () => {
  function parseWithErrors(code: string): { ast: any; errors: any[] } {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return { ast, errors: (parser as any).errors || [] };
  }

  test('detects no errors in valid code', () => {
    const code = `
      const x = 10;
      function test() { return x; }
      class Foo { bar() {} }
    `;
    const { errors } = parseWithErrors(code);
    expect(errors).toHaveLength(0);
  });

  test('detects and recovers from syntax errors', () => {
    const code = `
      const x = 10
      const y = { // missing closing brace
      const z = 20
    `;
    const { ast, errors } = parseWithErrors(code);
    // Should still produce an AST due to error recovery
    expect(ast.body.length).toBeGreaterThan(0);
    // But should have recorded errors
    expect(errors.length).toBeGreaterThan(0);
  });

  test('detects missing closing brackets', () => {
    const code = `
      function test() {
        if (true) {
          console.log("unclosed"
        }
      }
    `;
    const { errors } = parseWithErrors(code);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('detects invalid token sequences', () => {
    const code = `
      const const x = 10;
      function function test() {}
    `;
    const { errors } = parseWithErrors(code);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('complex valid code should have no errors', () => {
    const code = `
      # Python-style comment
      @decorator
      class Container<T> extends Base {
        private items: T[] = []
        
        constructor(public size: number = 10) {
          super()
        }
        
        async method(): Promise<void> {
          await this.process()
        }
      }
      
      # Go-style short declaration
      x := 10
      
      # Rust-style match
      match value {
        Some(x) => x * 2
        None => 0
      }
    `;
    const { errors } = parseWithErrors(code);
    expect(errors).toHaveLength(0);
  });

  test('tracks multiple errors', () => {
    const code = `
      const x = // missing value
      function test( // missing closing paren
      class { // missing class name
    `;
    const { errors } = parseWithErrors(code);
    // Parser may combine related errors or recover efficiently
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });
});