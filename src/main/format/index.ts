import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * Supported image formats that can be converted to WebP.
 * Adapted from cham-cli's includeFiles config.
 */
export const CONVERTIBLE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.tiff',
  '.bmp',
];

/**
 * Check if a file extension is convertible to WebP.
 * Adapted from cham-cli's checkNeedCovert function.
 */
export function isConvertible(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CONVERTIBLE_EXTENSIONS.includes(ext);
}

/**
 * Convert a single image to WebP format.
 * Core logic adapted from cham-cli's convertToWebP function.
 *
 * @param inputPath  - Source image file path
 * @param outputPath - Destination WebP file path
 * @param options    - Conversion options
 */
export type OutputFormat = 'webp' | 'avif';

export async function convertImage(
  inputPath: string,
  outputPath: string,
  options: {
    quality?: number;
    lossless?: boolean;
    format?: OutputFormat;
    extraOptions?: Record<string, any>;
  } = {}
): Promise<sharp.OutputInfo> {
  const { quality = 80, lossless = false, format = 'webp', extraOptions = {} } = options;

  // Ensure output directory exists
  const dirname = path.dirname(outputPath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }

  let pipeline = sharp(inputPath, { animated: true });
  const formatOpts = { quality, lossless, ...extraOptions };

  if (format === 'avif') {
    pipeline = pipeline.avif(formatOpts);
  } else {
    pipeline = pipeline.webp(formatOpts);
  }

  return pipeline.toFile(outputPath);
}

/**
 * Convert multiple images to WebP format.
 * Based on cham-cli's doHandle function.
 */
export async function convertImages(
  inputPaths: string[],
  outputDir: string,
  options: {
    quality?: number;
    keepName?: boolean;
  } = {}
): Promise<
  Array<{
    inputPath: string;
    outputPath: string;
    success: boolean;
    error?: string;
  }>
> {
  const results: Array<{
    inputPath: string;
    outputPath: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const inputPath of inputPaths) {
    const fileName = path.basename(inputPath);

    try {
      if (!isConvertible(inputPath)) {
        // Copy non-convertible files to output (from cham-cli's logic)
        const outputPath = path.join(outputDir, fileName);
        const dirname = path.dirname(outputPath);
        if (!fs.existsSync(dirname)) {
          fs.mkdirSync(dirname, { recursive: true });
        }
        fs.copyFileSync(inputPath, outputPath);
        results.push({ inputPath, outputPath, success: true });
        continue;
      }

      const outputName = options.keepName
        ? fileName
        : fileName.replace(/\.[^.]+$/, '.webp');

      const outputPath = path.join(outputDir, outputName);

      await convertImage(inputPath, outputPath, {
        quality: options.quality,
      });

      results.push({ inputPath, outputPath, success: true });
    } catch (error: any) {
      results.push({
        inputPath,
        outputPath: '',
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Calculate MD5 hash of a file for change detection.
 * Taken directly from cham-cli's getFileHash function.
 */
export function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Get file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
