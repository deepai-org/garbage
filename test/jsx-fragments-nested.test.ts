// JSX Fragments and Nested Elements Tests
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';

describe('JSX Fragments and Nested Elements', () => {
    it('should parse simple fragment', () => {
        const code = `<>Hello World</>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse fragment with multiple children', () => {
        const code = `
<>
    <Header />
    <Main />
    <Footer />
</>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse deeply nested elements', () => {
        const code = `
<div>
    <section>
        <article>
            <header>
                <h1>Title</h1>
            </header>
            <main>
                <p>Content</p>
            </main>
        </article>
    </section>
</div>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse fragment in expression', () => {
        const code = `const element = <>First<br />Second</>;`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse conditional rendering', () => {
        const code = `
<div>
    {isLoading ? <Spinner /> : <Content />}
    {error && <ErrorMessage />}
</div>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse map with keys', () => {
        const code = `
<ul>
    {items.map(item => (
        <li key={item.id}>{item.name}</li>
    ))}
</ul>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse nested fragments', () => {
        const code = `
<>
    <div>
        <>
            <span>Nested</span>
            <span>Fragment</span>
        </>
    </div>
</>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse JSX comments', () => {
        const code = `
<div>
    {/* This is a JSX comment */}
    <span>Content</span>
    {/* 
        Multi-line
        comment 
    */}
</div>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse spread children', () => {
        const code = `
<Container>
    {...childElements}
</Container>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });

    it('should parse namespaced components', () => {
        const code = `
<Form.Group>
    <Form.Label>Name</Form.Label>
    <Form.Control type="text" />
</Form.Group>`;
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expect(() => parser.parse()).not.toThrow();
    });
});