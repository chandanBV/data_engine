import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Moon, Sun, Code2 } from 'lucide-react';
import { useTheme } from './theme-provider';

export const Navigation = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  
  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/data-engine', label: 'Data Engine' },
    { path: '/chart-renderer', label: 'Chart Renderer' },
    { path: '/query-optimizer', label: 'Query Optimizer' },
    { path: '/parallel-compute', label: 'Parallel Compute' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold gradient-text">Rust WASM Boilerplate</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive(item.path) ? 'default' : 'ghost'}
                  size="sm"
                  className="transition-all"
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
};
