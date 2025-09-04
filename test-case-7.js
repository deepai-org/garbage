
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# DI container with mixed paradigms
interface ServiceProvider {
  get<T>(token: string | Symbol): T
  has(token: string | Symbol): boolean
}

class Container implements ServiceProvider {
  services := new Map()
  factories := new Map()
  singletons := new Map()
  
  # Register with Python-style decorators (simulated)
  def register(token, provider, options = {}):
    if options.singleton:
      this.singletons.set(token, null)
    
    this.factories.set(token, provider)
    return this
  
  # Resolve with pattern matching
  fn get<T>(token: string | Symbol): T {
    # Check if already instantiated singleton
    if this.singletons.has(token) && this.singletons.get(token) != nil {
      return this.singletons.get(token)
    }
    
    # Get factory
    factory := this.factories.get(token)
    if factory == nil {
      throw new Error(\`Service not found: \${token.toString()}\`)
    }
    
    # Resolve dependencies
    deps := []
    if factory.deps {
      foreach dep in factory.deps do
        deps.push(this.get(dep))
      done
    }
    
    # Create instance
    instance := match factory.type {
      "class" => new factory.provider(...deps),
      "factory" => factory.provider(...deps),
      "value" => factory.provider,
      _ => throw new Error("Invalid provider type")
    }
    
    # Store singleton if needed
    if this.singletons.has(token) {
      this.singletons.set(token, instance)
    }
    
    return instance
  }
  
  # Batch registration with Ruby block
  def configure(&block)
    begin
      proxy := {
        service: (token, provider) => {
          this.register(token, provider)
        },
        singleton: (token, provider) => {
          this.register(token, provider, {singleton: true})
        },
        factory: (token, fn) => {
          this.register(token, {type: "factory", provider: fn})
        }
      }
      
      block(proxy)
    rescue => e
      console.error("Configuration failed:", e)
      throw e
    ensure
      return this
    end
  end
  
  # Auto-wire with bash-style checks
  async autowire(target) {
    if [ -z "$target.constructor.inject" ]; then
      return target
    fi
    
    for key, token of target.constructor.inject {
      target[key] = await this.get(token)
    }
    
    return target
  }
}

# Configure container
container := new Container()
  .configure(c => {
    c.singleton("database", DatabaseConnection)
    c.singleton("cache", RedisCache)
    c.service("userRepo", UserRepository)
    c.factory("logger", () => new Logger({level: "debug"}))
  })

# Usage
userRepo := container.get("userRepo")
`;

console.log('Testing: parses dependency injection container');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
