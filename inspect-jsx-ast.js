const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const util = require('util');

function inspectAST(code, description) {
    console.log('\n' + '='.repeat(80));
    console.log(`TEST: ${description}`);
    console.log('='.repeat(80));
    console.log('CODE:');
    console.log(code);
    console.log('-'.repeat(80));
    
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST:');
        console.log(util.inspect(ast, { 
            depth: null, 
            colors: true, 
            compact: false,
            breakLength: 80
        }));
        
        console.log('-'.repeat(80));
        console.log(`✓ Successfully parsed - ${ast.body.length} top-level node(s)`);
        
        // Analyze key aspects
        analyzeAST(ast, code);
        
    } catch (e) {
        console.log('ERROR:', e.message);
        console.log('Stack:', e.stack);
    }
}

function analyzeAST(ast, code) {
    console.log('\nANALYSIS:');
    
    // Count different node types
    const nodeTypes = {};
    function countNodes(node) {
        if (!node || typeof node !== 'object') return;
        
        if (node.type) {
            nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
        }
        
        for (const key in node) {
            if (key === 'type' || key === 'loc') continue;
            const value = node[key];
            if (Array.isArray(value)) {
                value.forEach(countNodes);
            } else if (typeof value === 'object') {
                countNodes(value);
            }
        }
    }
    
    ast.body.forEach(countNodes);
    
    console.log('Node type distribution:');
    for (const [type, count] of Object.entries(nodeTypes).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }
    
    // Check for JSX nodes
    const jsxNodes = Object.keys(nodeTypes).filter(type => 
        type.includes('JSX') || type.includes('jsx')
    );
    if (jsxNodes.length > 0) {
        console.log(`\nJSX-specific nodes found: ${jsxNodes.join(', ')}`);
    } else {
        console.log('\n⚠️  WARNING: No JSX-specific nodes found in AST!');
    }
}

// Test 1: Complex nested JSX with expressions
inspectAST(`
<Container>
    {items
        .filter(item => item.active)
        .map(item => (
            <Item 
                key={item.id}
                onClick={() => handleClick(item.id)}
            >
                {item.children?.map(child => 
                    <Child key={child.id}>{child.name}</Child>
                )}
            </Item>
        ))
    }
</Container>`, 
'Complex nested JSX with expressions');

// Test 2: JSX with TypeScript types
inspectAST(`
interface ButtonProps {
    size: 'small' | 'medium' | 'large'
    variant: string
    onClick?: () => void
}

function Button({ size, variant, onClick }: ButtonProps) {
    return <button className={size} onClick={onClick}>{variant}</button>
}`,
'JSX component with TypeScript interface');

// Test 3: JSX with conditional rendering and fragments
inspectAST(`
function Component({ items, loading, error }) {
    return (
        <>
            {loading ? (
                <Spinner />
            ) : error ? (
                <ErrorMessage message={error} />
            ) : (
                <ul>
                    {items.map(item => (
                        <li key={item.id}>
                            <span>{item.name}</span>
                            {item.badge && <Badge>{item.badge}</Badge>}
                        </li>
                    ))}
                </ul>
            )}
        </>
    )
}`,
'JSX with conditional rendering and fragments');

// Test 4: JSX with spread props and style objects
inspectAST(`
const Component = (props) => {
    const style = { color: 'red', fontSize: 16 };
    return (
        <div style={{...style, padding: 10}}>
            <Button {...props} disabled={false} />
            <Input {...{placeholder: 'Enter text', type: 'text'}} />
        </div>
    );
}`,
'JSX with spread props and style objects');

// Test 5: JSX mixed with Go channels and pattern matching
inspectAST(`
function AsyncComponent() {
    const ch = make(chan<JSX.Element>)
    
    go async () => {
        const data = await fetch('/api')
        ch <- <DataView data={data} />
    }
    
    return match status {
        case 'loading' => <Spinner />
        case 'success' => <div>{<- ch}</div>
        case 'error' => <ErrorIcon color="red" />
        default => <QuestionIcon />
    }
}`,
'JSX mixed with Go channels and pattern matching');

// Test 6: Generic JSX component
inspectAST(`
function List<T>({ items }: { items: T[] }) {
    return (
        <ul>
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    )
}

const stringList = <List<string> items={['a', 'b', 'c']} />
const numberList = <List<number> items={[1, 2, 3]} />`,
'Generic JSX component with type parameters');

console.log('\n' + '='.repeat(80));
console.log('INSPECTION COMPLETE');
console.log('='.repeat(80));