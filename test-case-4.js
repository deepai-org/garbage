
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Configuration system mixing multiple paradigms
interface Config {
  database: {
    host: string
    port: number
    credentials?: Credentials
  }
  cache: CacheConfig
  features: Map<string, boolean>
}

# Builder pattern with method chaining
class ConfigBuilder {
  config := {
    database: {},
    cache: {},
    features: new Map()
  }
  
  def withDatabase(host, port = 5432):
    this.config.database = {host, port}
    return this
  
  fn withCache(type: "redis" | "memory") -> ConfigBuilder {
    match type {
      "redis" => this.config.cache = new RedisCache(),
      "memory" => this.config.cache = new MemoryCache(),
      _ => throw new Error("Invalid cache type")
    }
    return this
  }
  
  # Feature flags with Ruby-style blocks
  def features(&block)
    begin
      proxy := new Proxy({}, {
        set: (_, key, value) => {
          this.config.features.set(key, value)
          return true
        }
      })
      block(proxy)
    ensure
      return this
    end
  end
  
  async build(): Config {
    # Validate with bash-style checks
    if [ -z "$this.config.database.host" ]; then
      throw new Error("Database host required")
    fi
    
    # Apply environment overrides
    if process.env.DB_HOST {
      this.config.database.host = process.env.DB_HOST
    }
    
    # Async validation
    await this.validate()
    
    return this.config
  }
}

# Usage with fluent interface
config := await new ConfigBuilder()
  .withDatabase("localhost", 5432)
  .withCache("redis")
  .features(f => {
    f.darkMode = true
    f.betaFeatures = false
    f.analytics = true
  })
  .build()
`;

console.log('Testing: parses configuration DSL with mixed syntax');
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
