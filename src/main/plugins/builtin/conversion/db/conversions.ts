/**
 * Conversion cache CRUD — takes db from PluginMainApi.
 */

/** Minimal DB interface that both the real DB and api.db satisfy */
interface PluginDB {
  prepare(sql: string): { get(...params: any[]): any; all(...params: any[]): any[]; run(...params: any[]): any };
  exec(sql: string): void;
}

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

export function findBySourceId(db: PluginDB, sourceId: string): ConversionRecord | null {
  const row = db.prepare('SELECT * FROM conversions WHERE source_id = ?').get(sourceId) as ConversionRecord | undefined;
  return row ?? null;
}

export function upsert(
  db: PluginDB,
  sourceId: string,
  format: string,
  quality: number,
  outputPath: string,
  outputHash: string,
): void {
  db.prepare(
    `INSERT INTO conversions (source_id, format, quality, output_path, output_hash)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (source_id)
     DO UPDATE SET
       format      = excluded.format,
       quality     = excluded.quality,
       output_path = excluded.output_path,
       output_hash = excluded.output_hash,
       updated_at  = datetime('now')`,
  ).run(sourceId, format, quality, outputPath, outputHash);
}

export function clearAll(db: PluginDB): void {
  db.exec('DELETE FROM conversions');
}

