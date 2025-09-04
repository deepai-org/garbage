const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

console.log('EXAMPLES OF REMAINING PARSE ERRORS IN PARSER.TS\n');
console.log('='.repeat(60));

// Test each problematic pattern
const testCases = [
  {
    name: "1. Optional property in class",
    code: `class ParseError {
  public quickFix?: string;
}`
  },
  {
    name: "2. Method with type parameter names",
    code: `class Parser {
  private createSyntheticToken(type: TokenType, value: string): Token {
    return null;
  }
}`
  },
  {
    name: "3. Object literal with non-null assertion",
    code: `function test() {
  return {
    path: path!,
    alias: name!
  };
}`
  },
  {
    name: "4. Type assertion with 'as'",
    code: `function test() {
  const token = {} as Token;
  visibility = this.previous()!.value as any;
}`
  },
  {
    name: "5. Switch statement with TypeScript syntax",
    code: `function test(value: string) {
  switch(value) {
    case "case": return "esac";
    case "begin": return "end";
    default: return "";
  }
}`
  },
  {
    name: "6. Optional parameters in function signature",
    code: `function must(expected: string, options?: { recoverWithSynthetic?: boolean }): boolean {
  return true;
}`
  },
  {
    name: "7. Property shorthand with ternary",
    code: `const obj = {
  line: this.current > 0 ? this.tokens[this.current - 1].line : 1,
  column: this.current > 0 ? this.tokens[this.current - 1].column + 1 : 1,
  synthetic: true
};`
  },
  {
    name: "8. Type predicate (type guard)",
    code: `function isIdentifier(node: any): node is AST.Identifier {
  return node && node.kind === "Identifier";
}`
  },
  {
    name: "9. Readonly array type",
    code: `class Parser {
  private readonly tokens: readonly Token[];
}`
  },
  {
    name: "10. Escaped characters in string switch",
    code: `switch(char) {
  case '\\\\': current += '\\\\'; break;
  case '\\n': current += '\\n'; break;
}`
  },
  {
    name: "11. Interface with optional and readonly",
    code: `interface Options {
  readonly name: string;
  value?: number;
  callback?(x: number): void;
}`
  },
  {
    name: "12. Conditional type expression",
    code: `type Result<T> = T extends string ? string[] : T[];`
  }
];

testCases.forEach(testCase => {
  console.log(`\n${testCase.name}:`);
  console.log('-'.repeat(testCase.name.length + 1));
  console.log('Code:');
  console.log(testCase.code.split('\n').map(line => '  ' + line).join('\n'));
  
  const lexer = new Lexer(testCase.code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('\nErrors:');
    const uniqueErrors = new Map();
    parser.errors.forEach(e => {
      const key = e.message;
      if (!uniqueErrors.has(key)) {
        uniqueErrors.set(key, []);
      }
      uniqueErrors.get(key).push(e.token.value);
    });
    
    uniqueErrors.forEach((tokens, message) => {
      console.log(`  • ${message}`);
      console.log(`    at token(s): '${tokens.slice(0, 3).join("', '")}'`);
    });
  } else {
    console.log('\n✓ Parses successfully!');
  }
});

console.log('\n' + '='.repeat(60));
console.log('\nSUMMARY OF MISSING FEATURES:\n');

const missingFeatures = [
  "• Optional properties with '?' (e.g., property?: type)",
  "• Non-null assertion operator '!' (e.g., value!)",
  "• Type assertion with 'as' keyword (e.g., x as Type)",
  "• Type predicates/guards (e.g., x is Type)",
  "• Readonly modifier for properties",
  "• Function overload signatures",
  "• Conditional types (T extends U ? X : Y)",
  "• Method/constructor parameter properties",
  "• Index signatures ([key: string]: any)",
  "• Namespace and module declarations",
  "• Type-only imports/exports",
  "• Generic constraints (T extends BaseType)",
  "• Mapped types and utility types",
  "• Intersection and union type operators",
  "• Escaped characters in case statements"
];

missingFeatures.forEach(feature => {
  console.log(feature);
});

console.log('\nThese are advanced TypeScript features not currently');
console.log('in the PolyScript specification.');