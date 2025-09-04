class Parser {
}
getErrors();
{
return this.errors  ;
}parse();
{
const body = []  ;
while (this.current < this.tokens.length)   {
const item = this.parseStatement()    ;
if (item)     {
body.push(item)      ;
    }  }const result = {}  ;
result.kind = 'Program'  ;
result.body = body  ;
return result  ;
}parseStatement();
{
const token = this.tokens[this.current]  ;
if (!token)   {
return null    ;
  }if (token.type === 'function')   {
return this.parseFunction()    ;
  }if (token.type === 'const')   {
return this.parseConst()    ;
  }if (token.type === 'let')   {
return this.parseVar()    ;
  }return this.parseExpression()  ;
}parseFunction();
{
this.current++  ;
const name = this.tokens[this.current]  ;
this.current++  ;
const func = {}  ;
func.kind = 'FuncDecl'  ;
func.name = name.value  ;
func.params = []  ;
func.body = this.parseBlock()  ;
return func  ;
}parseConst();
{
this.current++  ;
const name = this.tokens[this.current]  ;
this.current++  ;
const decl = {}  ;
decl.kind = 'ConstDecl'  ;
decl.name = name.value  ;
decl.value = this.parseExpression()  ;
return decl  ;
}parseVar();
{
this.current++  ;
const name = this.tokens[this.current]  ;
this.current++  ;
const decl = {}  ;
decl.kind = 'VarDecl'  ;
decl.name = name.value  ;
decl.value = this.parseExpression()  ;
return decl  ;
}parseExpression();
{
const token = this.tokens[this.current]  ;
this.current++  ;
const expr = {}  ;
expr.kind = 'Identifier'  ;
expr.name = token.value  ;
return expr  ;
}parseBlock();
{
const statements = []  ;
if (this.tokens[this.current].value === '{')   {
this.current++    ;
  }while (this.current < this.tokens.length)   {
if (this.tokens[this.current].value === '}')     {
this.current++      ;
break      ;
    }const stmt = this.parseStatement()    ;
if (stmt)     {
statements.push(stmt)      ;
    }  }const block = {}  ;
block.kind = 'Block'  ;
block.statements = statements  ;
return block  ;
}function testParser() {
const tokens = []  ;
const parser = new.undefined()  ;
const ast = parser.parse()  ;
console.log('Parsed AST:')  ;
console.log(ast)  ;
return ast  ;
}const result = testParser();
console.log('Done');
