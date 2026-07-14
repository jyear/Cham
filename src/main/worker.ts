/**
 * Image conversion worker — runs in a child process via fork().
 *
 * All sharp image processing and file hashing happens here so the main
 * process event loop stays responsive.  Communicates with the parent via
 * process.send() / process.on('message').
 */

import { convertImage, getFileHash } from './format';

interface WorkerTask {
  id: number;
  type: 'convert' | 'hash';
  [key: string]: any;
}

interface WorkerResult {
  id: number;
  type?: 'convert' | 'hash';
  success?: boolean;
  hash?: string;
  outputSize?: number;
  error?: string;
}

process.on('message', async (msg: WorkerTask) => {
  const { id, type } = msg;

  if (type === 'hash') {
    try {
      const hash = await getFileHash(msg.filePath);
      send({ id, type: 'hash', hash });
    } catch (err: any) {
      send({ id, error: err.message });
    }
    return;
  }

  if (type === 'convert') {
    try {
      const fs = await import('fs');
      await convertImage(msg.inputPath, msg.outputPath, msg.options ?? {});
      const outputSize = fs.statSync(msg.outputPath).size;
      send({ id, type: 'convert', success: true, outputSize });
    } catch (err: any) {
      send({ id, error: err.message });
    }
    return;
  }

  send({ id, error: `Unknown task type: ${type}` });
});

function send(result: WorkerResult): void {
  if (process.send) {
    process.send(result);
  }
}
