import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { type OutputFormat, CONVERTIBLE_EXTENSIONS } from '../format';
import { makeSourceId, findBySourceId, upsertConversion } from '../db';
import { WorkerPool } from '../worker-pool';

// ── Singleton pool ──

let pool: WorkerPool | null = null;

function getPool(): WorkerPool {
  if (!pool) {
    pool = new WorkerPool();
  }
  return pool;
}

export function destroyConversionPool(): void {
  if (pool) {
    pool.destroy();
    pool = null;
  }
}

// ── Helpers ──

function isConvertibleExt(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.includes(ext);
}

// ── Single-file conversion ──

export function registerConversionHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    'convert-image',
    async (
      _event,
      params: {
        inputPath: string;
        outputDir: string;
        quality?: number;
        keepName?: boolean;
        copyNonConvertible?: boolean;
        format?: OutputFormat;
        options?: Record<string, any>;
      },
    ) => {
      try {
        const fmt: OutputFormat = params.format ?? 'webp';
        const quality = params.quality ?? 100;

        const outputName = params.keepName
          ? path.basename(params.inputPath)
          : path.basename(params.inputPath).replace(/\.[^.]+$/, `.${fmt}`);

        const outputPath = path.join(params.outputDir, outputName);

        // Non-convertible → copy inline (trivial I/O, no worker needed)
        if (!isConvertibleExt(params.inputPath)) {
          if (params.copyNonConvertible) {
            const dirname = path.dirname(outputPath);
            if (!fs.existsSync(dirname)) {
              fs.mkdirSync(dirname, { recursive: true });
            }
            fs.copyFileSync(params.inputPath, outputPath);
            return { success: true, outputPath, cached: false, copied: true };
          }
          return { success: false, error: 'File type not convertible and copy is disabled' };
        }

        // ── Cache lookup (main thread — fast SQLite) ──
        const { hash: inputHash } = await getPool().execute({
          type: 'hash',
          filePath: params.inputPath,
        });

        const sourceId = makeSourceId(params.inputPath, inputHash);
        const record = findBySourceId(sourceId);

        if (
          record &&
          record.format === fmt &&
          record.quality === quality &&
          record.output_path === outputPath
        ) {
          if (fs.existsSync(record.output_path)) {
            const { hash: existingHash } = await getPool().execute({
              type: 'hash',
              filePath: record.output_path,
            });
            if (existingHash === record.output_hash) {
              console.log('[convert] SKIP (cached):', params.inputPath);
              return { success: true, outputPath: record.output_path, cached: true };
            }
          }
          console.log('[convert] RE-CONVERT (stale output):', params.inputPath);
        } else if (record) {
          console.log(
            '[convert] RE-CONVERT (params changed):',
            params.inputPath,
            `fmt:${record.format}→${fmt} q:${record.quality}→${quality}`,
          );
        }

        // ── Convert in worker (offloaded from main thread) ──
        const { outputSize } = await getPool().execute({
          type: 'convert',
          inputPath: params.inputPath,
          outputPath,
          options: {
            quality,
            format: fmt,
            ...params.options,
          },
        });

        // ── Cache result (main thread) ──
        const { hash: outputHash } = await getPool().execute({
          type: 'hash',
          filePath: outputPath,
        });
        upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

        return { success: true, outputPath, outputSize, cached: false };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Batch conversion ──

  ipcMain.handle(
    'convert-images',
    async (
      _event,
      params: {
        files: Array<{ path: string; name: string }>;
        outputDir: string;
        quality?: number;
        keepName?: boolean;
        copyNonConvertible?: boolean;
        format?: OutputFormat;
        options?: Record<string, any>;
      },
    ) => {
      const fmt: OutputFormat = params.format ?? 'webp';
      const quality = params.quality ?? 100;
      const pool = getPool();
      const win = getMainWindow();

      // ── Phase 1: determine what each file needs ──
      interface FilePlan {
        file: { path: string; name: string };
        action: 'copy' | 'skip' | 'convert';
        outputPath: string;
        cached?: boolean;
      }

      const plans: FilePlan[] = [];

      for (const file of params.files) {
        const outputName = params.keepName
          ? file.name
          : file.name.replace(/\.[^.]+$/, `.${fmt}`);
        const outputPath = path.join(params.outputDir, outputName);

        if (!isConvertibleExt(file.name)) {
          if (params.copyNonConvertible) {
            const dirname = path.dirname(outputPath);
            if (!fs.existsSync(dirname)) {
              fs.mkdirSync(dirname, { recursive: true });
            }
            fs.copyFileSync(file.path, outputPath);
            const copySize = fs.statSync(outputPath).size;
            const result = { inputPath: file.path, outputPath, outputSize: copySize, success: true, cached: false, copied: true };
            win?.webContents.send('convert-progress', result);
            plans.push({ file, action: 'skip', outputPath, cached: false });
            continue;
          }
          const result = { inputPath: file.path, success: false, error: 'File type not convertible and copy is disabled' };
          win?.webContents.send('convert-progress', result);
          plans.push({ file, action: 'skip', outputPath });
          continue;
        }

        // Check cache
        const { hash: inputHash } = await pool.execute({ type: 'hash', filePath: file.path });
        const sourceId = makeSourceId(file.path, inputHash);
        const record = findBySourceId(sourceId);

        if (
          record &&
          record.format === fmt &&
          record.quality === quality &&
          record.output_path === outputPath &&
          fs.existsSync(record.output_path)
        ) {
          const { hash: existingHash } = await pool.execute({ type: 'hash', filePath: record.output_path });
          if (existingHash === record.output_hash) {
            console.log('[convert] SKIP (cached):', file.path);
            const cachedSize = fs.statSync(record.output_path).size;
            const cachedResult = { inputPath: file.path, outputPath: record.output_path, outputSize: cachedSize, success: true, cached: true };
            win?.webContents.send('convert-progress', cachedResult);
            plans.push({ file, action: 'skip', outputPath: record.output_path, cached: true });
            continue;
          }
        }

        plans.push({ file, action: 'convert', outputPath });
      }

      // ── Phase 2: dispatch all conversions in parallel to the pool ──
      const convertPlans = plans.filter((p) => p.action === 'convert');

      const convertPromises = convertPlans.map((plan) =>
        pool
          .execute({
            type: 'convert',
            inputPath: plan.file.path,
            outputPath: plan.outputPath,
            options: { quality, format: fmt, ...params.options },
          })
          .then(async (convResult) => {
            // Cache
            const { hash: outputHash } = await pool.execute({
              type: 'hash',
              filePath: plan.outputPath,
            });
            const { hash: inputHash } = await pool.execute({
              type: 'hash',
              filePath: plan.file.path,
            });
            const sourceId = makeSourceId(plan.file.path, inputHash);
            upsertConversion(sourceId, fmt, quality, plan.outputPath, outputHash);

            const result = { inputPath: plan.file.path, outputPath: plan.outputPath, outputSize: convResult.outputSize, success: true, cached: false };
            win?.webContents.send('convert-progress', result);
            return result;
          })
          .catch((err) => {
            const result = { inputPath: plan.file.path, success: false, error: err.message };
            win?.webContents.send('convert-progress', result);
            return result;
          }),
      );

      // Await all conversions
      const convertResults = await Promise.all(convertPromises);

      // Merge results in original order
      const results: any[] = [];
      let ci = 0;
      for (const plan of plans) {
        if (plan.action === 'skip') {
          results.push({
            inputPath: plan.file.path,
            outputPath: plan.outputPath,
            success: true,
            cached: plan.cached ?? false,
          });
        } else {
          results.push(convertResults[ci++]!);
        }
      }

      return results;
    },
  );

  // ── Quick cache check (no conversion) ──

  ipcMain.handle('check-cached', async (_event, inputPath: string, format: string, quality: number) => {
    try {
      const q = quality ?? 100;
      const fmt = format || 'webp';

      const { hash: inputHash } = await getPool().execute({ type: 'hash', filePath: inputPath });
      const sourceId = makeSourceId(inputPath, inputHash);
      const record = findBySourceId(sourceId);

      if (record && record.format === fmt && record.quality === q) {
        if (fs.existsSync(record.output_path)) {
          const { hash: outputHash } = await getPool().execute({ type: 'hash', filePath: record.output_path });
          if (outputHash === record.output_hash) {
            return { cached: true, outputPath: record.output_path };
          }
        }
      }
      return { cached: false };
    } catch (error: any) {
      return { cached: false, error: error.message };
    }
  });
}
