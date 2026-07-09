import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { convertImage, getFileHash, type OutputFormat } from '../format';
import { makeSourceId, findBySourceId, upsertConversion } from '../db';

export function registerConversionHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Convert a single image (with SQLite caching)
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
      }
    ) => {
      try {
        const fmt: OutputFormat = params.format ?? 'webp';
        const ext = path.extname(params.inputPath).toLowerCase();
        const isConvertible = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'].includes(ext);

        const outputName = params.keepName
          ? path.basename(params.inputPath)
          : path.basename(params.inputPath).replace(/\.[^.]+$/, `.${fmt}`);

        const outputPath = path.join(params.outputDir, outputName);

        // Non-convertible files: copy instead of convert
        if (!isConvertible) {
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

        // 1. Calculate input file hash → source_id
        const inputHash = await getFileHash(params.inputPath);
        const sourceId = makeSourceId(params.inputPath, inputHash);

        const quality = params.quality ?? 100;

        // 2. Look up cache record by source_id (unique)
        const record = findBySourceId(sourceId);

        // 3. Compare stored settings with current settings
        if (
          record &&
          record.format === fmt &&
          record.quality === quality &&
          record.output_path === outputPath
        ) {
          // 3a. Settings match — verify output file integrity
          if (fs.existsSync(record.output_path)) {
            const existingOutputHash = await getFileHash(record.output_path);
            if (existingOutputHash === record.output_hash) {
              // Output file exists and hash matches — genuine cache hit
              console.log('[convert] SKIP (cached):', params.inputPath);
              return { success: true, outputPath: record.output_path, cached: true };
            }
          }
          // Output file missing or hash mismatch
          console.log('[convert] RE-CONVERT (stale output):', params.inputPath);
        } else if (record) {
          // Settings changed — re-convert with new settings
          console.log(
            '[convert] RE-CONVERT (params changed):',
            params.inputPath,
            `fmt:${record.format}→${fmt} q:${record.quality}→${quality}`,
          );
        }

        // 4. Convert the image
        await convertImage(params.inputPath, outputPath, {
          quality,
          format: fmt,
          extraOptions: (params as any).options ?? {},
        });

        // 5. Calculate output hash and upsert database
        const outputHash = await getFileHash(outputPath);
        const outputSize = fs.statSync(outputPath).size;
        upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

        return { success: true, outputPath, outputSize, cached: false };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  // Convert multiple images (with SQLite caching)
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
      }
    ) => {
      const results: Array<{
        inputPath: string;
        outputPath?: string;
        outputSize?: number;
        success: boolean;
        cached?: boolean;
        copied?: boolean;
        error?: string;
      }> = [];
      const fmt: OutputFormat = params.format ?? 'webp';

      for (const file of params.files) {
        try {
          const ext = path.extname(file.name).toLowerCase();
          const isConvertible = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'].includes(ext);

          const outputName = params.keepName
            ? file.name
            : file.name.replace(/\.[^.]+$/, `.${fmt}`);

          const outputPath = path.join(params.outputDir, outputName);

          // Non-convertible files: copy instead of convert
          if (!isConvertible) {
            if (params.copyNonConvertible) {
              const dirname = path.dirname(outputPath);
              if (!fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
              }
              fs.copyFileSync(file.path, outputPath);
              const copySize = fs.statSync(outputPath).size;
              const result = { inputPath: file.path, outputPath, outputSize: copySize, success: true, cached: false, copied: true };
              results.push(result);
              getMainWindow()?.webContents.send('convert-progress', result);
              continue;
            }
            const result = {
              inputPath: file.path,
              success: false,
              error: 'File type not convertible and copy is disabled',
            };
            results.push(result);
            getMainWindow()?.webContents.send('convert-progress', result);
            continue;
          }

          const quality = params.quality ?? 100;

          // 1. Calculate input file hash → source_id
          const inputHash = await getFileHash(file.path);
          const sourceId = makeSourceId(file.path, inputHash);

          // 2. Look up cache record by source_id (unique)
          const record = findBySourceId(sourceId);

          // 3. Compare stored settings with current settings
          if (
            record &&
            record.format === fmt &&
            record.quality === quality &&
            record.output_path === outputPath
          ) {
            // 3a. Settings match — verify output file integrity
            if (fs.existsSync(record.output_path)) {
              const existingOutputHash = await getFileHash(record.output_path);
              if (existingOutputHash === record.output_hash) {
                // Output file exists and hash matches — genuine cache hit
                console.log('[convert] SKIP (cached):', file.path);
                const cachedSize = fs.statSync(record.output_path).size;
                const cachedResult = {
                  inputPath: file.path,
                  outputPath: record.output_path,
                  outputSize: cachedSize,
                  success: true,
                  cached: true,
                };
                results.push(cachedResult);
                getMainWindow()?.webContents.send('convert-progress', cachedResult);
                continue;
              }
            }
            // Output file missing or hash mismatch
            console.log('[convert] RE-CONVERT (stale output):', file.path);
          } else if (record) {
            // Settings changed — re-convert with new settings
            console.log(
              '[convert] RE-CONVERT (params changed):',
              file.path,
              `fmt:${record.format}→${fmt} q:${record.quality}→${quality}`,
            );
          }

          // 4. Convert the image
          console.log('[convert]', file.path, '→', outputPath);
          await convertImage(file.path, outputPath, {
            quality,
            format: fmt,
            extraOptions: (params as any).options ?? {},
          });

          // 5. Calculate output hash and upsert database
          const outputHash = await getFileHash(outputPath);
          const outputSize = fs.statSync(outputPath).size;
          upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

          const okResult = { inputPath: file.path, outputPath, outputSize, success: true, cached: false };
          results.push(okResult);
          getMainWindow()?.webContents.send('convert-progress', okResult);
        } catch (error: any) {
          console.error('[convert] FAILED', file.path, error.message, error.stack);
          const failResult = { inputPath: file.path, success: false, error: error.message };
          results.push(failResult);
          getMainWindow()?.webContents.send('convert-progress', failResult);
        }
      }

      return results;
    }
  );

  // Check if a conversion is already cached (quick lookup without converting)
  ipcMain.handle('check-cached', async (_event, inputPath: string, format: string, quality: number) => {
    try {
      const q = quality ?? 100;
      const fmt = format || 'webp';
      const inputHash = await getFileHash(inputPath);
      const sourceId = makeSourceId(inputPath, inputHash);

      // Look up by source_id, then compare params in app layer
      const record = findBySourceId(sourceId);

      if (record && record.format === fmt && record.quality === q) {
        if (fs.existsSync(record.output_path)) {
          const outputHash = await getFileHash(record.output_path);
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
