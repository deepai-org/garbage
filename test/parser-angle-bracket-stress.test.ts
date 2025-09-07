import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import * as AST from '../src/ast';
import {
  parseCode,
  verifyJSXElement,
  verifyGenericType,
  verifyComparison,
  verifyChannelSend,
  verifyChannelReceive,
  findFirst,
  findByKind,
  verifyAngleBrackets,
  analyzeAngleBrackets
} from './helpers';

describe('Parser - Angle Bracket Stress Tests', () => {
  
  describe('1. Generics vs JSX vs Comparison', () => {
    
    test('distinguishes generic function from JSX', () => {
      const code = `
function foo<T>(x: T): T { return x }
const frag = <>{x < 5 ? <div>{x}</div> : <span>{x*2}</span>}</>
`;
      const ast = parseCode(code);
      
      // Verify generic function
      const func = ast.body[0] as AST.FuncDecl;
      expect(func.kind).toBe('FuncDecl');
      expect(func.name.name).toBe('foo');
      expect(func.genericParams).toHaveLength(1);
      expect(func.genericParams![0].name).toBe('T');
      
      // Verify JSX fragment
      const fragDecl = ast.body[1] as AST.ConstDecl;
      const fragInit = (fragDecl as any).decls[0].init as AST.JSXFragment;
      expect(fragInit.kind).toBe('JSXFragment');
      
      // Verify comparison inside JSX
      const comparisons = findByKind<AST.Binary>(ast, 'Binary')
        .filter(n => n.op === '<');
      expect(comparisons.length).toBeGreaterThan(0);
      expect((comparisons[0].left as any).name).toBe('x');
      expect((comparisons[0].right as any).value).toBe(5);
    });
    
    test('distinguishes type assertion from JSX', () => {
      const code = `
let y = <number>(x) + 2
const el = <MyComponent x={a < 5} />
`;
      const ast = parseCode(code);
      
      // Verify type assertion
      const letDecl = ast.body[0] as AST.VarDecl;
      const binary = (letDecl as any).decls[0].init as AST.Binary;
      expect(binary.kind).toBe('Binary');
      expect(binary.op).toBe('+');
      const typeAssertion = binary.left as AST.TypeAssertion;
      expect(typeAssertion.kind).toBe('TypeAssertion');
      expect((typeAssertion.type as any).name || (typeAssertion.type as any).id?.name).toBe('number');
      
      // Verify JSX element with comparison prop
      const constDecl = ast.body[1] as AST.ConstDecl;
      const jsx = (constDecl as any).decls[0].init as AST.JSXElement;
      verifyJSXElement(jsx, 'MyComponent', { selfClosing: true });
      
      // Verify comparison in JSX prop
      const prop = (jsx as any).attrs[0];
      expect(prop.name.name).toBe('x');
      const propValue = prop.value as AST.Binary;
      verifyComparison(propValue, '<', 'a', 5);
    });
    
    test('distinguishes generic call from JSX', () => {
      const code = `
let z = map<string, int>(["1","2","3"], parseInt)
<MyComponent value={foo<string>("hi")} />
`;
      const ast = parseCode(code);
      
      // Verify generic call
      const letDecl = ast.body[0] as AST.VarDecl;
      const call = (letDecl as any).decls[0].init as AST.Call;
      expect(call.kind).toBe('Call');
      const callee = (call as any).func || call.callee;
      expect((callee as any).name).toBe('map');
      expect((call as any).typeArgs).toHaveLength(2);
      
      // Verify JSX with generic call in prop
      const jsx = (ast.body[1] as AST.ExprStmt).expr as AST.JSXElement;
      verifyJSXElement(jsx, 'MyComponent', { selfClosing: true });
      const prop = (jsx as any).attrs[0];
      const propCall = prop.value as AST.Call;
      expect(propCall.kind).toBe('Call');
      expect((propCall as any).typeArgs).toHaveLength(1);
    });
    
    test('parses generic channel type correctly', () => {
      const code = `let c: chan<int>`;
      const ast = parseCode(code);
      
      const letDecl = ast.body[0] as AST.VarDecl;
      const type = (letDecl as any).decls[0].type;
      verifyGenericType(type, 'chan', 1);
    });
  });
  
  describe('2. Whitespace and Adjacency', () => {
    
    test('whitespace disables generic parsing', () => {
      const code = `
const y = foo<Bar>(baz)
const z = foo < Bar > (baz)
`;
      const ast = parseCode(code);
      
      // First: generic call
      const decl1 = ast.body[0] as AST.ConstDecl;
      const call1 = (decl1 as any).decls[0].init as AST.Call;
      expect(call1.kind).toBe('Call');
      expect((call1 as any).typeArgs).toHaveLength(1);
      
      // Second: comparison operators
      const decl2 = ast.body[1] as AST.ConstDecl;
      const expr2 = (decl2 as any).decls[0].init;
      // Should be parsed as (foo < Bar) > (baz)
      const outer = expr2 as AST.Binary;
      expect(outer.op).toBe('>');
      const inner = outer.left as AST.Binary;
      expect(inner.op).toBe('<');
    });
    
    test('handles shift operators vs generics', () => {
      const code = `
a << b
let r = foo<Bar>(x) << 2
`;
      const ast = parseCode(code);
      
      // First: left shift
      const shift1 = (ast.body[0] as AST.ExprStmt).expr as AST.Binary;
      expect(shift1.op).toBe('<<');
      
      // Second: generic call then shift
      const letDecl = ast.body[1] as AST.VarDecl;
      const shift2 = (letDecl as any).decls[0].init as AST.Binary;
      expect(shift2.op).toBe('<<');
      const call = shift2.left as AST.Call;
      expect(call.kind).toBe('Call');
      expect((call as any).typeArgs).toHaveLength(1);
    });
    
    test('parses JSX fragment with conditionals', () => {
      const code = `
const f = <>
    <A>{foo < bar ? <B/> : <C/>}</A>
</>
`;
      const ast = parseCode(code);
      
      const constDecl = ast.body[0] as AST.ConstDecl;
      const frag = (constDecl as any).decls[0].init as AST.JSXFragment;
      expect(frag.kind).toBe('JSXFragment');
      
      // Find comparison in conditional
      const comparisons = findByKind<AST.Binary>(ast, 'Binary')
        .filter(n => n.op === '<');
      expect(comparisons.length).toBeGreaterThan(0);
      
      // Find nested JSX elements
      const jsxElements = findByKind<AST.JSXElement>(ast, 'JSXElement');
      expect(jsxElements.length).toBeGreaterThanOrEqual(3); // A, B, C
    });
  });
  
  describe('3. Channels and Angle Brackets', () => {
    
    test('parses channel operations correctly', () => {
      const code = `
let c: chan<int> = make(chan<int>, 10)
c <- 42
let v = <-c
`;
      const ast = parseCode(code);
      
      // Verify channel type
      const letDecl1 = ast.body[0] as AST.VarDecl;
      verifyGenericType((letDecl1 as any).decls[0].type, 'chan', 1);
      
      // Verify channel send
      const send = (ast.body[1] as AST.ExprStmt).expr as AST.Binary;
      verifyChannelSend(send, 'c', '42');
      
      // Verify channel receive
      const letDecl2 = ast.body[2] as AST.VarDecl;
      const receive = (letDecl2 as any).decls[0].init as AST.Unary;
      verifyChannelReceive(receive, 'c');
    });
    
    test('parses nested generics with channels', () => {
      const code = `let d: chan<Result<Foo<Bar>, Error>>`;
      const ast = parseCode(code);
      
      const letDecl = ast.body[0] as AST.VarDecl;
      const chanType = (letDecl as any).decls[0].type;
      verifyGenericType(chanType, 'chan', 1);
      
      // Verify nested Result type
      const resultType = (chanType as AST.GenericType).args[0];
      verifyGenericType(resultType, 'Result', 2);
      
      // Verify Foo<Bar> inside Result
      const fooType = (resultType as AST.GenericType).args[0];
      verifyGenericType(fooType, 'Foo', 1);
    });
    
    test('parses channel in JSX prop', () => {
      const code = `<Worker channel={c} />`;
      const ast = parseCode(code);
      
      const jsx = (ast.body[0] as AST.ExprStmt).expr as AST.JSXElement;
      verifyJSXElement(jsx, 'Worker', { selfClosing: true });
      const prop = (jsx as any).attrs[0];
      expect(prop.name.name).toBe('channel');
      expect((prop.value as any).name).toBe('c');
    });
    
    test('parses channel receive in ternary inside JSX', () => {
      const code = `<div>{(count > 0) ? (<span>ok</span>) : (<span>{<-c}</span>)}</div>`;
      const ast = parseCode(code);
      
      const jsx = (ast.body[0] as AST.ExprStmt).expr as AST.JSXElement;
      verifyJSXElement(jsx, 'div', { selfClosing: false });
      
      // Find channel receive
      const receives = findByKind<AST.Unary>(ast, 'Unary')
        .filter(n => n.op === '<-');
      expect(receives.length).toBe(1);
      expect((receives[0].argument as any).name).toBe('c');
      
      // Verify comparison
      const comparisons = findByKind<AST.Binary>(ast, 'Binary')
        .filter(n => n.op === '>');
      expect(comparisons.length).toBeGreaterThan(0);
    });
  });
  
  describe('4. Type Assertion vs JSX vs Generic', () => {
    
    test('distinguishes type assertions in different contexts', () => {
      const code = `
let n = <number>x
let y = (<number>x) * 2
`;
      const ast = parseCode(code);
      
      // First: simple type assertion
      const letDecl1 = ast.body[0] as AST.VarDecl;
      const assertion1 = (letDecl1 as any).decls[0].init as AST.TypeAssertion;
      expect(assertion1.kind).toBe('TypeAssertion');
      expect((assertion1.type as any).name || (assertion1.type as any).id?.name).toBe('number');
      
      // Second: type assertion in expression
      const letDecl2 = ast.body[1] as AST.VarDecl;
      const binary = (letDecl2 as any).decls[0].init as AST.Binary;
      expect(binary.op).toBe('*');
      const assertion2 = binary.left as AST.TypeAssertion;
      expect(assertion2.kind).toBe('TypeAssertion');
    });
    
    test('uses "as" for type assertion in JSX context', () => {
      const code = `
<div>{x as number}</div>
<MyComponent prop={x as string} />
`;
      const ast = parseCode(code);
      
      // First JSX with type assertion
      const jsx1 = (ast.body[0] as AST.ExprStmt).expr as AST.JSXElement;
      verifyJSXElement(jsx1, 'div', { selfClosing: false });
      const child = (jsx1 as any).children[0];
      const assertion1 = (child as any).expr as AST.Binary;
      expect(assertion1.op).toBe('as');
      
      // Second JSX with type assertion in prop
      const jsx2 = (ast.body[1] as AST.ExprStmt).expr as AST.JSXElement;
      const prop = (jsx2 as any).attrs[0];
      const assertion2 = prop.value as AST.Binary;
      expect(assertion2.op).toBe('as');
    });
  });
  
  describe('5. JSX with Generic Components', () => {
    
    test('parses JSX with generic component and children', () => {
      const code = `
<MyComponent<string>
    value={foo<string>("hi")}
>
    <ChildComponent<int> value={42} />
</MyComponent>
`;
      const ast = parseCode(code);
      
      const jsx = (ast.body[0] as AST.ExprStmt).expr as AST.JSXElement;
      expect((jsx as any).tag.name).toBe('MyComponent');
      expect((jsx as any).typeArgs).toHaveLength(1);
      expect(((jsx as any).typeArgs[0] as any).name || ((jsx as any).typeArgs[0] as any).id?.name).toBe('string');
      
      // Verify prop with generic call
      const prop = (jsx as any).attrs[0];
      const propCall = prop.value as AST.Call;
      expect((propCall as any).typeArgs).toHaveLength(1);
      
      // Verify child component with generics
      const child = (jsx as any).children[0] as AST.JSXElement;
      expect((child as any).tag.name).toBe('ChildComponent');
      expect((child as any).typeArgs).toHaveLength(1);
    });
    
    test('parses JSX fragment with generic components', () => {
      const code = `
<>
    <Table<RowData<string>> columns={["a","b"]} />
</>
`;
      const ast = parseCode(code);
      
      const frag = (ast.body[0] as AST.ExprStmt).expr as AST.JSXFragment;
      expect(frag.kind).toBe('JSXFragment');
      
      const table = (frag as any).children[0] as AST.JSXElement;
      expect((table as any).tag.name).toBe('Table');
      expect((table as any).typeArgs).toHaveLength(1);
      
      // Verify nested generic in type args
      const rowDataType = (table as any).typeArgs[0] as AST.GenericType;
      verifyGenericType(rowDataType, 'RowData', 1);
    });
  });
  
  describe('6. Complex Nesting and Edge Cases', () => {
    
    test('parses deeply nested generics', () => {
      const code = `let r = foo<Bar<Baz<Qux<chan<List<Result<A, B>>>>>>>(x)`;
      const ast = parseCode(code);
      
      const letDecl = ast.body[0] as AST.VarDecl;
      const call = (letDecl as any).decls[0].init as AST.Call;
      expect(call.kind).toBe('Call');
      expect((call as any).typeArgs).toHaveLength(1);
      
      // Verify deep nesting
      let current = (call as any).typeArgs[0] as AST.GenericType;
      const expectedTypes = ['Bar', 'Baz', 'Qux', 'chan', 'List', 'Result'];
      
      for (const expectedType of expectedTypes.slice(0, -1)) {
        expect(current.base.name).toBe(expectedType);
        expect(current.args).toHaveLength(1);
        current = current.args[0] as AST.GenericType;
      }
      
      // Last one is Result<A, B>
      expect(current.base.name).toBe('Result');
      expect(current.args).toHaveLength(2);
    });
    
    test('parses mixed generics, shifts, comparisons, and JSX', () => {
      const code = `let v = foo<chan<Result<A, B>>>() << (bar < baz ? <A>c</A> : <D>f</D>)`;
      const ast = parseCode(code);
      
      const letDecl = ast.body[0] as AST.VarDecl;
      const shift = (letDecl as any).decls[0].init as AST.Binary;
      expect(shift.op).toBe('<<');
      
      // Left of shift: generic call
      const call = shift.left as AST.Call;
      expect((call as any).typeArgs).toHaveLength(1);
      verifyGenericType((call as any).typeArgs[0], 'chan', 1);
      
      // Right of shift: conditional with comparison and JSX
      const conditional = shift.right as any;
      const comparison = conditional.test as AST.Binary;
      verifyComparison(comparison, '<', 'bar', 'baz');
      
      // Verify JSX in then/else branches
      const thenJsx = conditional.then as AST.JSXElement;
      verifyJSXElement(thenJsx, 'A', { selfClosing: false });
      
      const elseJsx = conditional.else as AST.JSXElement;
      verifyJSXElement(elseJsx, 'D', { selfClosing: false });
    });
    
    test('comprehensive angle bracket analysis', () => {
      const code = `
function test<T>() {
  const jsx = <Button onClick={() => x < 5} />;
  const generic: Array<string> = [];
  const comparison = a < b && c > d;
  const channel = <-ch;
  const send = ch <- value;
  const shift = x << 2 >> 1;
}
`;
      const ast = parseCode(code);
      
      // Use comprehensive verification
      verifyAngleBrackets(ast, {
        jsx: [{ tag: 'Button', selfClosing: true }],
        generics: [{ base: 'Array', argCount: 1 }],
        comparisons: [
          { op: '<', left: 'x', right: 5 },
          { op: '<', left: 'a' },
          { op: '>', left: 'c' }
        ],
        channels: { sends: 1, receives: 1 }
      });
      
      // Analyze statistics
      const stats = analyzeAngleBrackets(ast);
      expect(stats.jsxCount).toBe(1);
      expect(stats.genericCount).toBe(1);
      expect(stats.comparisonCount).toBe(3);
      expect(stats.channelCount).toBe(2);
      expect(stats.shiftCount).toBe(2);
    });
  });
  
  describe('7. Monster Test Cases', () => {
    
    test('parses the all-in-one monster example', () => {
      const code = `
function crazy<T>(xs: List<T>, ch: chan<T>): any {
    let x = foo<Bar>(baz < 2 ? <B/> : <C/>)
    let v = <number>xs[0]
    return <Container>
        <Header>{x < y ? "Less" : "Greater"}</Header>
        <Send onClick={() => ch <- x}>{x}</Send>
    </Container>
}
`;
      const ast = parseCode(code);
      
      const func = ast.body[0] as AST.FuncDecl;
      expect(func.genericParams).toHaveLength(1);
      expect(func.genericParams![0].name).toBe('T');
      
      // Verify parameter types
      verifyGenericType(func.params[0].type, 'List', 1);
      verifyGenericType(func.params[1].type, 'chan', 1);
      
      const body = func.body as AST.Block;
      
      // First statement: generic call with ternary containing JSX
      const stmt1 = body.statements[0] as AST.VarDecl;
      const call = (stmt1 as any).decls[0].init as AST.Call;
      expect((call as any).typeArgs).toHaveLength(1);
      
      // Find comparison in ternary
      const ternary = call.args[0] as any;
      const comparison = ternary.test as AST.Binary;
      verifyComparison(comparison, '<', 'baz', 2);
      
      // Verify JSX in ternary branches
      verifyJSXElement(ternary.then as AST.JSXElement, 'B', { selfClosing: true });
      verifyJSXElement(ternary.else as AST.JSXElement, 'C', { selfClosing: true });
      
      // Second statement: type assertion
      const stmt2 = body.statements[1] as AST.VarDecl;
      const assertion = (stmt2 as any).decls[0].init as AST.TypeAssertion;
      expect(assertion.kind).toBe('TypeAssertion');
      
      // Return statement: JSX with channel send in handler
      const returnStmt = body.statements[2] as AST.Return;
      const container = (returnStmt as any).argument as AST.JSXElement;
      verifyJSXElement(container, 'Container', { selfClosing: false });
      
      // Find channel send in onClick handler
      const sends = findByKind<AST.Binary>(ast, 'Binary')
        .filter(n => n.op === '<-');
      expect(sends.length).toBe(1);
      verifyChannelSend(sends[0], 'ch', 'x');
      
      // Count all angle bracket usages
      const stats = analyzeAngleBrackets(ast);
      expect(stats.genericCount).toBeGreaterThanOrEqual(3); // T, List<T>, chan<T>, Bar
      expect(stats.jsxCount).toBeGreaterThanOrEqual(4); // B, C, Container, Header, Send
      expect(stats.comparisonCount).toBeGreaterThanOrEqual(2); // baz < 2, x < y
      expect(stats.channelCount).toBe(1); // ch <- x
    });
  });
});