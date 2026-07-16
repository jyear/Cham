/**
 * Shared path validation utilities.
 */
import * as path from 'path';
import * as fs from 'fs';

/** Normalize a path for comparison (handles Windows case-insensitivity) */
function normalizeForCompare(p: string): string {
  return path.normalize(p).toLowerCase();
}

/**
 * Check that a path resides within one of the allowed root directories.
 * Case-insensitive on Windows.
 */
export function isSafePath(filePath: string, allowedRoots: string[]): boolean {
  const normalized = normalizeForCompare(filePath);
  return allowedRoots.some((root) => {
    const rootNorm = normalizeForCompare(root) + path.sep;
    return normalized.startsWith(rootNorm);
  });
}

/**
 * Resolve a relative path within a base directory.
 * Rejects absolute paths and '..' traversal. Case-insensitive on Windows.
 */
export function resolveSafe(baseDir: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error('Absolute paths are not allowed');
  }
  const resolved = path.resolve(baseDir, relativePath);
  const baseNorm = normalizeForCompare(path.resolve(baseDir)) + path.sep;
  if (!normalizeForCompare(resolved).startsWith(baseNorm)) {
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
