import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { minimatch } from 'minimatch';

interface ManifestData {
  distribute?: string[];
  internal?: string[];
  exclude?: string[];
}

export class Manifest {
  private allhandsRoot: string;
  private manifestPath: string;
  private data: ManifestData;

  constructor(allhandsRoot: string) {
    this.allhandsRoot = allhandsRoot;
    this.manifestPath = join(allhandsRoot, '.allhands-manifest.json');
    this.data = this.load();
  }

  private load(): ManifestData {
    if (!existsSync(this.manifestPath)) {
      throw new Error(`Manifest not found: ${this.manifestPath}`);
    }
    const content = readFileSync(this.manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  get distributePatterns(): string[] {
    return this.data.distribute || [];
  }

  get internalPatterns(): string[] {
    return this.data.internal || [];
  }

  get excludePatterns(): string[] {
    return this.data.exclude || [];
  }

  isExcluded(path: string): boolean {
    return this.excludePatterns.some(pattern => this.matches(path, pattern));
  }

  isDistributable(path: string): boolean {
    return this.distributePatterns.some(pattern => this.matches(path, pattern));
  }

  isInternal(path: string): boolean {
    return this.internalPatterns.some(pattern => this.matches(path, pattern));
  }

  private matches(path: string, pattern: string): boolean {
    return minimatch(path, pattern, { dot: true });
  }

  getDistributableFiles(): Set<string> {
    const files = new Set<string>();

    for (const pattern of this.distributePatterns) {
      this.collectMatchingFiles(pattern, files);
    }

    // Filter out excluded files
    const filtered = new Set<string>();
    for (const file of files) {
      if (!this.isExcluded(file)) {
        filtered.add(file);
      }
    }

    return filtered;
  }

  private collectMatchingFiles(pattern: string, files: Set<string>): void {
    // For patterns with **, do recursive directory walk
    if (pattern.includes('**')) {
      const parts = pattern.split('**');
      const base = parts[0].replace(/\/$/, '') || '.';
      const basePath = base === '.' ? this.allhandsRoot : join(this.allhandsRoot, base);

      if (existsSync(basePath)) {
        this.walkDir(basePath, (filePath) => {
          const relPath = relative(this.allhandsRoot, filePath);
          if (this.isDistributable(relPath)) {
            files.add(relPath);
          }
        });
      }
    } else {
      // Direct file or simple glob
      const fullPath = join(this.allhandsRoot, pattern);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        files.add(pattern);
      }
    }
  }

  private walkDir(dir: string, callback: (filePath: string) => void): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }
}

export function loadIgnorePatterns(targetRoot: string): string[] {
  const ignoreFile = join(targetRoot, '.allhandsignore');
  if (!existsSync(ignoreFile)) {
    return [];
  }

  const content = readFileSync(ignoreFile, 'utf-8');
  const patterns: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

export function isIgnored(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => minimatch(path, pattern, { dot: true }));
}
