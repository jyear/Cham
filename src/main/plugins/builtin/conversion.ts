/**
 * Conversion — Built-in Plugin Main Process Module
 *
 * Registers IPC handlers for image conversion, caching, watch mode,
 * and format options. All handlers are scoped to this plugin via the
 * PluginMainApi.registerHandler mechanism.
 *
 * This module is compiled into the main process bundle (not VM-loaded),
 * so it has full access to Cham's internal modules.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ipcMain } from 'electron';
import { type OutputFormat, CONVERTIBLE_EXTENSIONS } from '../../format';
import {
  makeSourceId,
  findBySourceId,
  upsertConversion,
  clearConversions,
} from '../../db';
import { saveFormatOptions, loadFormatOptions } from '../../db';
import { WorkerPool } from '../../worker-pool';
import { watch, type FSWatcher } from 'chokidar';
import type { PluginManifest, PluginMainApi } from '../../../shared/plugin/types';

// ── Plugin Manifest ──

export const manifest: PluginManifest = {
  id: 'conversion',
  name: 'conversionTool',
  version: '1.0.0',
  description: 'conversionToolDesc',
  icon: 'image',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  minWidth: 900,
  minHeight: 580,
  category: 'builtin',
  permissions: ['fs', 'convert', 'watch', 'settings', 'storage'],
  entry: 'index.js',
  main: 'conversion.js',
  dbTables: [
    {
      tableName: 'conversions',
      columns: [
        { name: 'id', type: 'INTEGER', constraints: 'PRIMARY KEY AUTOINCREMENT' },
        { name: 'source_id', type: 'TEXT', constraints: 'NOT NULL' },
        { name: 'format', type: 'TEXT', constraints: "NOT NULL DEFAULT 'webp'" },
        { name: 'quality', type: 'INTEGER', constraints: 'NOT NULL DEFAULT 100' },
        { name: 'output_path', type: 'TEXT', constraints: 'NOT NULL' },
        { name: 'output_hash', type: 'TEXT', constraints: 'NOT NULL' },
        { name: 'created_at', type: 'TEXT', constraints: "DEFAULT (datetime('now'))" },
        { name: 'updated_at', type: 'TEXT', constraints: "DEFAULT (datetime('now'))" },
      ],
    },
    {
      tableName: 'format_options',
      columns: [
        { name: 'format_type', type: 'TEXT', constraints: 'PRIMARY KEY' },
        { name: 'options', type: 'TEXT', constraints: 'NOT NULL' },
      ],
    },
  ],
};

// ── Singleton pool ──

let pool: WorkerPool | null = null;

function getPool(): WorkerPool {
  if (!pool) pool = new WorkerPool();
  return pool;
}

function destroyPool(): void {
  if (pool) { pool.destroy(); pool = null; }
}

// ── Watcher ──

let watcher: FSWatcher | null = null;

function stopWatcher(): void {
  if (watcher) { watcher.close(); watcher = null; }
}

// ── Main Module ──

export default function conversionMain(api: PluginMainApi) {
  // ── convert-image ──
  api.registerHandler('convert-image',
    async (_event, params: {
      inputPath: string;
      outputDir: string;
      quality?: number;
      keepName?: boolean;
      copyNonConvertible?: boolean;
      format?: OutputFormat;
      options?: Record<string, any>;
    }) => {
      try {
        const fmt: OutputFormat = params.format ?? 'webp';
        const quality = params.quality ?? 100;

        const outputName = params.keepName
          ? path.basename(params.inputPath)
          : path.basename(params.inputPath).replace(/\.[^.]+$/, `.${fmt}`);

        const outputPath = path.join(params.outputDir, outputName);

        if (!isConvertibleExt(params.inputPath)) {
          if (params.copyNonConvertible) {
            const dirname = path.dirname(outputPath);
            if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
            fs.copyFileSync(params.inputPath, outputPath);
            return { success: true, outputPath, cached: false, copied: true };
          }
          return { success: false, error: 'File type not convertible and copy is disabled' };
        }

        const { hash: inputHash } = await getPool().execute({ type: 'hash', filePath: params.inputPath });
        const sourceId = makeSourceId(params.inputPath, inputHash);
        const record = findBySourceId(sourceId);

        if (record && record.format === fmt && record.quality === quality &&
            record.output_path === outputPath && fs.existsSync(record.output_path)) {
          const { hash: existingHash } = await getPool().execute({ type: 'hash', filePath: record.output_path });
          if (existingHash === record.output_hash) {
            api.log.info(`SKIP (cached): ${params.inputPath}`);
            return { success: true, outputPath: record.output_path, cached: true };
          }
        }

        const { outputSize } = await getPool().execute({
          type: 'convert', inputPath: params.inputPath, outputPath,
          options: { quality, format: fmt, ...params.options },
        });

        const { hash: outputHash } = await getPool().execute({ type: 'hash', filePath: outputPath });
        upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

        return { success: true, outputPath, outputSize, cached: false };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── convert-images (batch) ──
  api.registerHandler('convert-images',
    async (_event, params: {
      files: Array<{ path: string; name: string }>;
      outputDir: string;
      quality?: number;
      keepName?: boolean;
      copyNonConvertible?: boolean;
      format?: OutputFormat;
      options?: Record<string, any>;
    }) => {
      const fmt: OutputFormat = params.format ?? 'webp';
      const quality = params.quality ?? 100;
      const workerPool = getPool();

      // Register *global* handler for progress events so renderer can subscribe.
      // Convert-progress is shared across the app (watcher + manual conversion).
      // We keep it global so the renderer doesn't need to poll.

      const results: any[] = [];
      for (const file of params.files) {
        try {
          const outputName = params.keepName ? file.name : file.name.replace(/\.[^.]+$/, `.${fmt}`);
          const outputPath = path.join(params.outputDir, outputName);

          if (!isConvertibleExt(file.name)) {
            if (params.copyNonConvertible) {
              const dirname = path.dirname(outputPath);
              if (!fs.existsSync(dirname)) fs.mkdirSync(dirname, { recursive: true });
              fs.copyFileSync(file.path, outputPath);
              results.push({ inputPath: file.path, outputPath, success: true, cached: false, copied: true });
              continue;
            }
            results.push({ inputPath: file.path, success: false, error: 'Not convertible' });
            continue;
          }

          const { hash: inputHash } = await workerPool.execute({ type: 'hash', filePath: file.path });
          const sourceId = makeSourceId(file.path, inputHash);
          const record = findBySourceId(sourceId);

          if (record && record.format === fmt && record.quality === quality &&
              record.output_path === outputPath && fs.existsSync(record.output_path)) {
            const { hash: existingHash } = await workerPool.execute({ type: 'hash', filePath: record.output_path });
            if (existingHash === record.output_hash) {
              results.push({ inputPath: file.path, outputPath: record.output_path, success: true, cached: true });
              continue;
            }
          }

          const convResult = await workerPool.execute({
            type: 'convert', inputPath: file.path, outputPath,
            options: { quality, format: fmt, ...params.options },
          });

          const { hash: outputHash } = await workerPool.execute({ type: 'hash', filePath: outputPath });
          upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

          const progressResult = { inputPath: file.path, outputPath, outputSize: convResult.outputSize, success: true, cached: false };
          api.sendEvent('convert-progress', progressResult);
          results.push(progressResult);
        } catch (err: any) {
          results.push({ inputPath: file.path, success: false, error: err.message });
        }
      }

      return results;
    },
  );

  // ── check-cached ──
  api.registerHandler('check-cached',
    async (_event, inputPath: string, format: string, quality: number) => {
      try {
        const q = quality ?? 100;
        const fmt = format || 'webp';
        const { hash: inputHash } = await getPool().execute({ type: 'hash', filePath: inputPath });
        const sourceId = makeSourceId(inputPath, inputHash);
        const record = findBySourceId(sourceId);

        if (record && record.format === fmt && record.quality === q && fs.existsSync(record.output_path)) {
          const { hash: outputHash } = await getPool().execute({ type: 'hash', filePath: record.output_path });
          if (outputHash === record.output_hash) {
            return { cached: true, outputPath: record.output_path };
          }
        }
        return { cached: false };
      } catch (error: any) {
        return { cached: false, error: error.message };
      }
    },
  );

  // ── clear-cache (hook + backward compat IPC) ──
  // Registered at 'startup' timing — only fires on app restart, not mid-session install.
  api.registerHook('cache:clear', async () => {
    clearConversions();
    api.log.info('Conversion cache cleared');
  }, 'startup');

  // Also keep IPC handler for direct calls (triggers startup hooks only)
  api.registerHandler('clear-cache', async () => {
    try {
      await api.emitHook('cache:clear');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── watch-start ──
  api.registerHandler('watch-start', async (_event, folderPath: string) => {
    try {
      stopWatcher();
      watcher = watch(folderPath, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
        depth: 99,
        awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      });

      watcher.on('add', (filePath: string) => {
        try {
          const stats = fs.statSync(filePath);
          const info = {
            path: filePath,
            name: path.relative(folderPath, filePath),
            size: stats.size,
            ext: path.extname(filePath).toLowerCase(),
          };
          api.sendEvent('watch-change', { event: 'add', file: info });
        } catch (e: any) {
          api.log.error(`watch add error: ${e.message}`);
        }
      });

      watcher.on('change', (filePath: string) => {
        try {
          const stats = fs.statSync(filePath);
          const info = {
            path: filePath,
            name: path.relative(folderPath, filePath),
            size: stats.size,
            ext: path.extname(filePath).toLowerCase(),
          };
          api.sendEvent('watch-change', { event: 'change', file: info });
        } catch (e: any) {
          api.log.error(`watch change error: ${e.message}`);
        }
      });

      watcher.on('unlink', (filePath: string) => {
        api.sendEvent('watch-change', { event: 'unlink', path: filePath });
      });

      watcher.on('unlinkDir', (dirPath: string) => {
        api.sendEvent('watch-change', { event: 'unlinkDir', path: dirPath });
      });

      watcher.on('error', (error: any) => {
        api.log.error(`watch error: ${error.message}`);
      });

      api.log.info(`watch started: ${folderPath}`);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── watch-stop ──
  api.registerHandler('watch-stop', async () => {
    stopWatcher();
    return { success: true };
  });

  // ── format options ──
  api.registerHandler('save-format-options',
    async (_event, formatType: string, options: Record<string, any>) => {
      try {
        saveFormatOptions(formatType, options);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  api.registerHandler('load-format-options',
    async (_event, formatType: string) => {
      try {
        const options = loadFormatOptions(formatType);
        return { success: true, options };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Cleanup ──
  return () => {
    destroyPool();
    stopWatcher();
    api.log.info('Conversion plugin deactivated');
  };
}

function isConvertibleExt(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.includes(ext);
}
