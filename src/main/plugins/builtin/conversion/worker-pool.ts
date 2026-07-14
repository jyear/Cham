/**
 * Worker pool — manages a fixed set of long-lived child processes for
 * CPU-intensive image conversion tasks.  Tasks are queued and dispatched
 * to the first available worker.
 */

import { fork, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

// ── Types ──

export interface ConvertTask {
  type: 'convert';
  inputPath: string;
  outputPath: string;
  options?: Record<string, any>;
}

export interface HashTask {
  type: 'hash';
  filePath: string;
}

export type PoolTask = ConvertTask | HashTask;

export interface ConvertResult {
  type: 'convert';
  success: boolean;
  outputSize: number;
}

export interface HashResult {
  type: 'hash';
  hash: string;
}

export type PoolResult = ConvertResult | HashResult;

// ── Internal ──

interface Pending {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

/**
 * Maximum pool size.  sharp already multithreads internally (libvips
 * thread pool) so we keep this moderate — one extra process per
 * physical core rarely helps and can cause memory pressure.
 */
const MAX_WORKERS = 4;

function poolSize(): number {
  return Math.max(1, Math.min(os.cpus().length - 1, MAX_WORKERS));
}

// ── Pool ──

export class WorkerPool {
  private workers: ChildProcess[] = [];
  private busy: Set<ChildProcess> = new Set();
  private pending: Map<number, Pending> = new Map();
  private queue: Array<{
    id: number;
    msg: any;
    resolve: (v: any) => void;
    reject: (e: any) => void;
  }> = [];
  private nextId = 1;
  private destroyed = false;

  constructor(size?: number) {
    const n = size ?? poolSize();
    for (let i = 0; i < n; i++) {
      this.spawn();
    }
  }

  // ── Public API ──

  /** Submit a conversion task. */
  execute(task: ConvertTask): Promise<ConvertResult>;
  /** Submit a hash task. */
  execute(task: HashTask): Promise<HashResult>;
  execute(task: PoolTask): Promise<PoolResult> {
    if (this.destroyed) {
      return Promise.reject(new Error('WorkerPool has been destroyed'));
    }

    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const worker = this.idle();

      if (worker) {
        this.dispatch(worker, id, task, resolve, reject);
      } else {
        this.queue.push({ id, msg: task, resolve, reject });
      }
    });
  }

  /** Gracefully terminate all workers. */
  destroy(): void {
    this.destroyed = true;

    // Reject all queued tasks
    for (const item of this.queue) {
      item.reject(new Error('WorkerPool destroyed'));
    }
    this.queue = [];

    // Reject all in-flight tasks
    for (const [, p] of this.pending) {
      p.reject(new Error('WorkerPool destroyed'));
    }
    this.pending.clear();

    // Kill workers
    for (const w of this.workers) {
      w.removeAllListeners();
      w.kill();
    }
    this.workers = [];
    this.busy.clear();
  }

  get activeWorkers(): number {
    return this.workers.length;
  }

  get queueLength(): number {
    return this.queue.length;
  }

  // ── Internals ──

  private spawn(): ChildProcess {
    // In both dev (webpack --watch) and production, the compiled worker
    // lives alongside the main entry in dist/main/worker.js
    const workerPath = path.join(__dirname, 'worker.js');

    const worker = fork(workerPath, [], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    worker.on('message', (result: { id: number; error?: string; [key: string]: any }) => {
      const pending = this.pending.get(result.id);
      if (!pending) return;

      this.pending.delete(result.id);
      this.busy.delete(worker);

      if (result.error) {
        pending.reject(new Error(result.error));
      } else {
        pending.resolve(result);
      }

      this.flushQueue();
    });

    worker.on('exit', (code) => {
      this.busy.delete(worker);
      this.workers = this.workers.filter((w) => w !== worker);

      // Fail all pending tasks on this worker
      for (const [id, p] of this.pending) {
        p.reject(new Error(`Worker exited with code ${code}`));
        this.pending.delete(id);
      }

      // Auto-restart unless shutting down
      if (!this.destroyed) {
        this.spawn();
        this.flushQueue();
      }
    });

    this.workers.push(worker);
    return worker;
  }

  private idle(): ChildProcess | null {
    return this.workers.find((w) => !this.busy.has(w)) ?? null;
  }

  private dispatch(
    worker: ChildProcess,
    id: number,
    task: PoolTask,
    resolve: (v: any) => void,
    reject: (e: any) => void,
  ): void {
    this.busy.add(worker);
    this.pending.set(id, { resolve, reject });
    worker.send({ id, ...task });
  }

  private flushQueue(): void {
    while (this.queue.length > 0) {
      const worker = this.idle();
      if (!worker) return;

      const next = this.queue.shift()!;
      this.dispatch(worker, next.id, next.msg, next.resolve, next.reject);
    }
  }
}
