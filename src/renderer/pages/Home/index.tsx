import React, { useState, useCallback, useEffect, useRef } from 'react';
import SourcePanel, { type ConvertedItem } from '@/components/SourcePanel';
import ConfigPanel from '@/components/ConfigPanel';
import OutputPanel from '@/components/OutputPanel';
import type { FileItem } from '@/components/FileRow';
import { useT, type Lang } from '@/i18n';
import { useTheme, type Theme } from '@/i18n/useTheme';
import { getDefaultOptions } from '@shared/formatConfig';
import s from './index.module.css';

type ConversionStatus = 'idle' | 'converting' | 'done';

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputDir, setOutputDir] = useState('');
  const [quality, setQuality] = useState(100);
  const [keepName, setKeepName] = useState(false);
  const [format, setFormat] = useState('webp');
  const [copyNonConvertible, setCopyNonConvertible] = useState(false);
  const [status, setStatus] = useState<ConversionStatus>('idle');
  const [convertedItems, setConvertedItems] = useState<ConvertedItem[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [watchMode, setWatchMode] = useState(false);
  const [watchFolder, setWatchFolder] = useState('');
  const [formatOptions, setFormatOptions] = useState<Record<string, number | boolean | string>>(() =>
    getDefaultOptions('webp')
  );
  const { setLang } = useT();
  const { setTheme } = useTheme();

  // Refs for latest values used in watch callbacks (avoids stale closures)
  const latestRef = useRef({ outputDir, quality, keepName, format, copyNonConvertible, watchMode, watchFolder, files, formatOptions });
  latestRef.current = { outputDir, quality, keepName, format, copyNonConvertible, watchMode, watchFolder, files, formatOptions };

  // Load settings from DB on mount
  useEffect(() => {
    if (!window.cham) return;
    window.cham.loadSettings().then((result) => {
      if (result.success && result.settings) {
        const s = result.settings;
        if (s.quality !== undefined) setQuality(Number(s.quality));
        if (s.keepName !== undefined) setKeepName(s.keepName === 'true');
        if (s.copyNonConvertible !== undefined) setCopyNonConvertible(s.copyNonConvertible === 'true');
        if (s.format !== undefined) setFormat(s.format);
        if (s.language !== undefined) setLang(s.language as Lang);
        if (s.theme !== undefined) setTheme(s.theme as Theme);
      }
      setSettingsLoaded(true);
    });
  }, []);

  // Load / reset format options when format changes
  useEffect(() => {
    if (!settingsLoaded || !window.cham) return;
    window.cham.loadFormatOptions(format).then((result) => {
      const defaults = getDefaultOptions(format);
      if (result.success && result.options) {
        setFormatOptions({ ...defaults, ...result.options });
      } else {
        setFormatOptions(defaults);
      }
    });
  }, [format, settingsLoaded]);

  // Save format options when they change
  useEffect(() => {
    if (!settingsLoaded || !window.cham) return;
    window.cham.saveFormatOptions(format, formatOptions);
  }, [format, formatOptions, settingsLoaded]);

  // Save settings on change
  useEffect(() => {
    if (!settingsLoaded || !window.cham) return;
    window.cham.saveSettings({
      quality: String(quality),
      format,
      keepName: String(keepName),
      copyNonConvertible: String(copyNonConvertible),
    });
  }, [quality, format, keepName, copyNonConvertible, settingsLoaded]);

  // --- Watch mode: start / stop watcher ---
  useEffect(() => {
    if (!window.cham || !watchFolder) return;

    if (watchMode) {
      window.cham.watchStart(watchFolder);
    } else {
      window.cham.watchStop();
    }

    return () => {
      if (watchMode) {
        window.cham.watchStop();
      }
    };
  }, [watchMode, watchFolder]);

  // --- Watch mode: run initial conversion when enabled or folder changes ---
  useEffect(() => {
    if (!watchMode || !watchFolder || files.length === 0 || !outputDir || !window.cham) return;

    setStatus('converting');
    setConvertedItems([]);
    setProcessedCount(0);

    window.cham.convertImages({
      files, outputDir, quality, keepName, copyNonConvertible, format,
      options: latestRef.current.formatOptions,
    }).then(() => {
      setStatus('done');
    });
  }, [watchMode, watchFolder]);

  // --- Convert progress: real-time per-file results ---
  useEffect(() => {
    if (!window.cham) return;

    const unsub = window.cham.onConvertProgress((result) => {
      // Count every processed file (including cached/copied)
      setProcessedCount((prev) => prev + 1);

      // Look up the source file for name/size/ext info
      const sourceFile = latestRef.current.files.find((f) => f.path === result.inputPath);

      const item: ConvertedItem = {
        path: result.inputPath,
        name: sourceFile?.name ?? result.inputPath.split(/[\\/]/).pop()!,
        size: sourceFile?.size ?? 0,
        ext: sourceFile?.ext ?? '',
        converted: result.success,
        cached: result.cached ?? false,
        copied: result.copied ?? false,
        error: result.error,
        outputPath: result.outputPath,
        outputSize: result.outputSize,
      };

      // Prepend so newest result appears at the top; skip cached from display
      if (!result.cached) {
        setConvertedItems((prev) => [item, ...prev]);
      }
    });

    return unsub;
  }, []);

  // --- Helpers for computing output paths ---
  function joinPath(base: string, rel: string): string {
    const normalizedBase = base.replace(/\\/g, '/').replace(/\/$/, '');
    const normalizedRel = rel.replace(/\\/g, '/');
    return normalizedBase + '/' + normalizedRel;
  }

  function getOutputRelativePath(fileName: string, keep: boolean, fmt: string): string {
    if (keep) return fileName;
    return fileName.replace(/\.[^.]+$/, `.${fmt}`);
  }

  // --- Watch mode: listen for file changes ---
  useEffect(() => {
    if (!window.cham) return;

    const unsub = window.cham.onWatchChange((ev) => {
      const { outputDir: curOutput, quality: curQuality, keepName: curKeep,
              format: curFormat, copyNonConvertible: curCopy, watchMode: curWatch,
              watchFolder: curWatchFolder, files: curFiles, formatOptions: curFormatOptions } = latestRef.current;

      if (!curWatch) return;

      if (ev.event === 'add' && ev.file) {
        // Add new file to list
        setFiles((prev) => {
          if (prev.some((f) => f.path === ev.file!.path)) return prev;
          return [...prev, {
            path: ev.file!.path,
            name: ev.file!.name,
            size: ev.file!.size,
            ext: ev.file!.ext,
          }];
        });

        // Auto-convert if output dir is set
        if (curOutput && window.cham) {
          window.cham.convertImage({
            inputPath: ev.file.path,
            outputDir: curOutput,
            quality: curQuality,
            keepName: curKeep,
            copyNonConvertible: curCopy,
            format: curFormat,
            options: curFormatOptions,
          }).then((result) => {
            if (!result.success && !result.cached) return;
            setConvertedItems((prev) => {
              const exists = prev.some((item) => item.path === ev.file!.path);
              if (exists) return prev;
              const newItem = {
                path: ev.file!.path,
                name: ev.file!.name,
                size: ev.file!.size,
                ext: ev.file!.ext,
                converted: result.success,
                cached: result.cached ?? false,
                copied: result.copied ?? false,
                error: result.error,
                outputPath: result.outputPath,
                outputSize: result.outputSize,
              };
              return [...prev, newItem];
            });
          });
        }
      } else if (ev.event === 'change' && ev.file) {
        // Re-convert changed file
        setFiles((prev) =>
          prev.map((f) =>
            f.path === ev.file!.path
              ? { ...f, size: ev.file!.size }
              : f
          )
        );

        if (curOutput && window.cham) {
          window.cham.convertImage({
            inputPath: ev.file.path,
            outputDir: curOutput,
            quality: curQuality,
            keepName: curKeep,
            copyNonConvertible: curCopy,
            format: curFormat,
            options: curFormatOptions,
          }).then((result) => {
            setConvertedItems((prev) =>
              prev.map((item) =>
                item.path === ev.file!.path
                  ? {
                      ...item,
                      converted: result.success,
                      cached: result.cached ?? false,
                      copied: result.copied ?? false,
                      error: result.error,
                      outputPath: result.outputPath,
                      outputSize: result.outputSize,
                    }
                  : item
              )
            );
          });
        }
      } else if (ev.event === 'unlink' && ev.path) {
        // Find the file in current list to get its relative name
        const existingFile = curFiles.find((f) => f.path === ev.path);

        // Delete corresponding output file
        if (existingFile && curOutput) {
          const relOut = getOutputRelativePath(existingFile.name, curKeep, curFormat);
          const outputPath = joinPath(curOutput, relOut);
          window.cham.deleteFile(outputPath);
        }

        // Remove from lists
        setFiles((prev) => prev.filter((f) => f.path !== ev.path));
        setConvertedItems((prev) => prev.filter((item) => item.path !== ev.path));
      } else if (ev.event === 'unlinkDir' && ev.path) {
        // Compute relative dir path from watch folder
        const relDir = ev.path.substring(curWatchFolder.length).replace(/\\/g, '/').replace(/^\//, '');

        // Delete corresponding output subdirectory
        if (relDir && curOutput) {
          const outputDirPath = joinPath(curOutput, relDir);
          window.cham.deleteDir(outputDirPath);
        }

        // Remove all files under the deleted directory
        const deletedPath = ev.path.replace(/\\/g, '/');
        setFiles((prev) =>
          prev.filter((f) => f.path.replace(/\\/g, '/').indexOf(deletedPath) !== 0)
        );
        setConvertedItems((prev) =>
          prev.filter((item) => item.path.replace(/\\/g, '/').indexOf(deletedPath) !== 0)
        );
      }
    });

    return unsub;
  }, []);

  const handleSelectFiles = useCallback(async () => {
    if (!window.cham) return;
    const selected = await window.cham.selectFiles();
    if (selected.length > 0) {
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.path));
        return [...prev, ...selected.filter((f) => !existing.has(f.path))];
      });
      setConvertedItems([]);
      setStatus('idle');
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    if (!window.cham) return;
    const result = await window.cham.selectFolder();
    if (result.files.length > 0) {
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.path));
        return [...prev, ...result.files.filter((f) => !existing.has(f.path))];
      });
      setConvertedItems([]);
      setStatus('idle');
      // Store folder path for watch mode
      if (result.folderPath) {
        setWatchFolder(result.folderPath);
      }
    }
  }, []);

  const handleSelectOutputDir = useCallback(async () => {
    if (!window.cham) return;
    const dir = await window.cham.selectOutputDir();
    if (dir) setOutputDir(dir);
  }, []);

  const handleRemoveFile = useCallback(
    (filePath: string) => setFiles((prev) => prev.filter((f) => f.path !== filePath)),
    [],
  );

  const handleClearFiles = useCallback(() => {
    setFiles([]);
    setConvertedItems([]);
    setStatus('idle');
    // Stop watch mode when clearing files
    if (watchMode && window.cham) {
      window.cham.watchStop();
      setWatchMode(false);
      setWatchFolder('');
    }
  }, [watchMode]);

  const handleConvert = useCallback(async () => {
    if (!window.cham || files.length === 0 || !outputDir) return;
    setStatus('converting');
    setConvertedItems([]);
    setProcessedCount(0);

    await window.cham.convertImages({
      files, outputDir, quality, keepName, copyNonConvertible, format,
      options: formatOptions,
    });
    // Progress events already populated convertedItems via onConvertProgress

    setStatus('done');
  }, [files, outputDir, quality, keepName, copyNonConvertible, format]);

  const handleFormatOptionChange = useCallback((key: string, value: number | boolean | string) => {
    setFormatOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleWatchModeChange = useCallback((v: boolean) => {
    setWatchMode(v);
  }, []);

  const canConvert = !!(files.length > 0 && outputDir && status !== 'converting');
  const canWatch = !!(watchFolder && outputDir);

  return (
    <div className={s.layout}>
      <SourcePanel
        files={files}
        status={status}
        convertedItems={convertedItems}
        onRemoveFile={handleRemoveFile}
        onClearFiles={handleClearFiles}
        onSelectFiles={handleSelectFiles}
        onSelectFolder={handleSelectFolder}
      />

      <ConfigPanel
        quality={quality}
        format={format}
        formatOptions={formatOptions}
        keepName={keepName}
        copyNonConvertible={copyNonConvertible}
        watchMode={watchMode}
        canWatch={canWatch}
        outputDir={outputDir}
        canConvert={canConvert}
        status={status}
        onQualityChange={setQuality}
        onFormatChange={setFormat}
        onFormatOptionChange={handleFormatOptionChange}
        onKeepNameChange={setKeepName}
        onCopyNonConvertibleChange={setCopyNonConvertible}
        onWatchModeChange={handleWatchModeChange}
        onSelectOutputDir={handleSelectOutputDir}
        onConvert={handleConvert}
      />

      <OutputPanel
        status={status}
        convertedItems={convertedItems}
        totalCount={files.length}
        processedCount={processedCount}
      />
    </div>
  );
}
