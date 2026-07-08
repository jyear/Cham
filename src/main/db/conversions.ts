import { getDb } from './connection';

export interface ConversionRecord {
  id: number;
  source_id: string;
  format: string;
  quality: number;
  output_path: string;
  output_hash: string;
  created_at: string;
  updated_at: string;
}

export function makeSourceId(inputPath: string, inputHash: string): string {
  return `${inputPath}|${inputHash}`;
}

export function findBySourceId(sourceId: string): ConversionRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM conversions WHERE source_id = ?')
    .get(sourceId) as ConversionRecord | undefined;
  return row ?? null;
}

export function upsert(
  sourceId: string,
  format: string,
  quality: number,
  outputPath: string,
  outputHash: string
): void {
  getDb()
    .prepare(
      `INSERT INTO conversions (source_id, format, quality, output_path, output_hash)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (source_id)
       DO UPDATE SET
         format      = excluded.format,
         quality     = excluded.quality,
         output_path = excluded.output_path,
         output_hash = excluded.output_hash,
         updated_at  = datetime('now')`
    )
    .run(sourceId, format, quality, outputPath, outputHash);
}

export function clearAll(): void {
  getDb().exec('DELETE FROM conversions');
}
