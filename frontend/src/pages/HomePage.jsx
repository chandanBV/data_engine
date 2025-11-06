import React from 'react';
import { Navigation } from '../components/Navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Database, 
  LineChart, 
  Search, 
  Cpu, 
  ArrowRight, 
  Zap, 
  Code2,
  Boxes,
  BookOpen,
  Github
} from 'lucide-react';

const HomePage = () => {
  const features = [
    {
      icon: Database,
      title: 'WebAssembly Data Engine',
      description: 'Process large tabular data with aggregations, pivots, and filters directly in the browser using Rust + WASM.',
      path: '/data-engine',
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      capabilities: ['Aggregations', 'Pivots', 'Filtering', 'Arrow Format']
    },
    {
      icon: LineChart,
      title: 'Real-time Chart Renderer',
      description: 'Precompute and aggregate 1M+ data points in Rust, then stream chunks to Canvas/WebGL for smooth rendering.',
      path: '/chart-renderer',
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10',
      capabilities: ['1M+ Points', 'Async Streaming', 'WebGL', 'Real-time']
    },
    {
      icon: Search,
      title: 'Query Optimizer',
      description: 'Execute SQL-like queries against CSV/JSON data sources, parsed and optimized in Rust WASM.',
      path: '/query-optimizer',
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      capabilities: ['SQL Syntax', 'CSV/JSON', 'Query Parse', 'Optimization']
    },
    {
      icon: Cpu,
      title: 'Parallel Computation',
      description: 'Leverage Rust threads with Web Workers for multi-core browser processing using SharedArrayBuffer.',
      path: '/parallel-compute',
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      capabilities: ['Multi-threading', 'Web Workers', 'Shared Memory', 'Atomics']
    },
  ];

  const techStack = [
    { name: 'Rust', icon: '🦀' },
    { name: 'WebAssembly', icon: '🕸️' },
    { name: 'wasm-bindgen', icon: '🔗' },
    { name: 'wasm-pack', icon: '📦' },
    { name: 'React', icon: '⚛️' },
    { name: 'Vite', icon: '⚡' },
    { name: 'TypeScript', icon: '📘' },
    { name: 'Tailwind', icon: '🎨' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Navigation />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <Badge variant="outline" className="px-4 py-2 text-sm">
            <Zap className="h-3 w-3 mr-2 inline" />
            High-Performance Browser Data Processing
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            Rust + WebAssembly
            <br />
            <span className="gradient-text">Boilerplate Project</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A production-ready foundation for building high-performance browser applications
            with Rust and WebAssembly. Four complete examples showcasing real-world use cases.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/data-engine">
              <Button size="lg" className="gap-2 group">
                Explore Examples
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2">
              <Github className="h-4 w-4" />
              View on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Four Complete Use Cases</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Each example includes working Rust code, React integration, and comprehensive documentation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link key={index} to={feature.path}>
                <Card className="card-hover h-full border-2 hover:border-primary/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${feature.bgColor}`}>
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {feature.capabilities.map((cap, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-16">
        <Card className="border-2">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Boxes className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl mb-2">Modern Tech Stack</CardTitle>
            <CardDescription className="text-base">
              Built with industry-leading tools and best practices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {techStack.map((tech, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-3xl">{tech.icon}</span>
                  <span className="text-sm font-medium">{tech.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick Start */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-success/10">
                  <Code2 className="h-5 w-5 text-[hsl(var(--success))]" />
                </div>
                <CardTitle>Quick Start</CardTitle>
              </div>
              <CardDescription>Get up and running in minutes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="code-block">
                <pre className="text-xs leading-relaxed overflow-x-auto">
{`# Clone the repository
git clone [repo-url]

# Install Rust toolchain
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# Build WASM modules
cd rust-modules
wasm-pack build --target web

# Start development server
cd ../frontend
npm install
npm run dev`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-info/10">
                  <BookOpen className="h-5 w-5 text-[hsl(var(--info))]" />
                </div>
                <CardTitle>Documentation</CardTitle>
              </div>
              <CardDescription>Comprehensive guides and examples</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium text-sm mb-1">Rust Module Structure</p>
                    <p className="text-xs text-muted-foreground">Learn how to organize WASM modules</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2" />
                  <div>
                    <p className="font-medium text-sm mb-1">Data Serialization</p>
                    <p className="text-xs text-muted-foreground">Optimize JS ↔ WASM communication</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
                  <div>
                    <p className="font-medium text-sm mb-1">Performance Tips</p>
                    <p className="text-xs text-muted-foreground">Best practices for production</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>Built with Rust 🦀 + WebAssembly 🕸️ + React ⚛️</p>
            <p className="mt-2">Ready for production • Fully typed • Extensively documented</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
