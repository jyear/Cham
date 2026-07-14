/**
 * Shared path validation utilities.
 */
import * as path from 'path';
import * as fs from 'fs';

/**
 * Check that a path resides within one of the allowed root directories.
 * Prevents path traversal attacks.
 */
export function isSafePath(filePath: string, allowedRoots: string[]): boolean {
  const normalized = path.normalize(filePath);
  return allowedRoots.some((root) => {
    const rootNorm = path.normalize(root) + path.sep;
    return normalized.startsWith(rootNorm);
  });
}

/**
 * Resolve a relative path within a base directory.
 * Rejects absolute paths and '..' traversal.
 */
export function resolveSafe(baseDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Absolute paths are not allowed');
  }
  const resolved = path.resolve(baseDir, relativePath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Path traversal detected: "${relativePath}"`);
  }
  return resolved;
}

/**
 * Recursively walk a directory, returning all file paths.
 */
export function walkDir(dirPath: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
