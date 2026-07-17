/**
 * Bing Gallery — Store Plugin Main Process Module (plain JS)
 *
 * Written in plain JavaScript to avoid webpack/TypeScript ESM-CJS
 * interop issues with the VM sandbox.
 *
 * Webpack copies this file through to dist/ as-is.
 */

var cache = new Map();
var CACHE_TTL = 30 * 60 * 1000;
var BING_API = 'https://api.timelessq.com/bing/list';

function getCacheKey(page, pageSize) {
  return 'bing_' + page + '_' + pageSize;
}

module.exports = function bingGalleryMain(api) {
  // ── Ensure tables exist (idempotent) ──
  try {
    api.db.prepare(
      'CREATE TABLE IF NOT EXISTS plugin_bing_settings (key TEXT PRIMARY KEY, value TEXT)'
    ).run();
  } catch (e) {
    api.log.warn('Failed to create settings table: ' + e.message);
  }

  // ── Helpers ──

  /** Return the writable plugin data directory.
   *  For .asar installs, api.pluginDir points to the .asar file; the actual
   *  writable companion folder is pluginDir without the .asar extension. */
  function getDataDir() {
    var dir = api.pluginDir;
    if (dir.slice(-5) === '.asar') {
      dir = dir.slice(0, -5);
    }
    return dir;
  }

  /** Fix paths that were incorrectly stored pointing inside the .asar archive.
   *  Old versions of this plugin computed local_path as:
   *    join(pluginDir, ...)  →  ".../bing-gallery.asar/downloads/..."
   *  The actual files live in the companion folder:
   *    ".../bing-gallery/downloads/..."
   *  This corrects those stale records transparently. */
  function fixPath(filePath) {
    if (!filePath) return filePath;
    // Match ".asar\" or ".asar/" and replace with just the separator
    return filePath.replace(/\.asar([\\/])/g, '$1');
  }

  // ── Fetch Bing Images ──
  api.registerHandler('fetch-images', function (_event, params) {
    var idx = (params && params.idx) || 0;
    var n = (params && params.n) || 20;
    var page = Math.floor(idx / n) + 1;
    var cacheKey = getCacheKey(page, n);

    var cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { success: true, images: cached.data, hasMore: cached.hasMore };
    }

    var url = BING_API + '?page=' + page + '&pageSize=' + n;
    api.log.info('Fetching: ' + url);

    return api.native.http.get(url).then(function (responseText) {
      var type = typeof responseText;
      var len = responseText ? responseText.length : 0;
      api.log.info('Bing response: type=' + type + ', len=' + len);

      if (!responseText || len === 0) {
        return { success: false, error: 'Bing API returned empty response' };
      }

      var result;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        return { success: false, error: 'Bing API returned invalid JSON' };
      }

      if (result.errno !== 0 || !result.data || !Array.isArray(result.data.data)) {
        return { success: false, error: 'Bing API unexpected response' };
      }

      var hasMore = result.data.currentPage < result.data.totalPages;
      var images = result.data.data.map(function (img) {
        var fullUrl = img.url || '';
        // Try to get UHD version by replacing resolution
        var fullResUrl = fullUrl.replace(/_\d+x\d+\./, '_UHD.');
        return {
          url: fullUrl,
          fullUrl: fullResUrl,
          copyright: img.copyright || 'Bing Wallpaper',
          title: img.title || '',
          time: img.time || '',
          hash: img._id || img.url || '',
        };
      });

      cache.set(cacheKey, { data: images, timestamp: Date.now(), hasMore: hasMore });
      api.log.info('Bing: got ' + images.length + ' images (page ' + page + ', hasMore=' + hasMore + ')');
      return { success: true, images: images, hasMore: hasMore };
    }).catch(function (err) {
      api.log.error('Bing fetch failed: ' + (err && err.message ? err.message : String(err)));
      return { success: false, error: 'Network error: ' + (err && err.message ? err.message : String(err)) };
    });
  });

  // ── Download Image ──
  api.registerHandler('download-image', function (_event, params) {
    try {
      // Read save path from settings
      var savePath = '';
      try {
        var row = api.db.prepare(
          'SELECT value FROM plugin_bing_settings WHERE key = ?'
        ).get('download_path');
        if (row) savePath = row.value;
      } catch (e) {
        // Table may not exist yet, fall through
      }

      // Save download record helper
      function saveRecord(absPath, fileName) {
        // skipRecord: true — used by wallpaper setting to avoid polluting download history
        if (params.skipRecord) return;
        try {
          api.db.prepare(
            'INSERT INTO plugin_bing_downloads (image_url, full_url, copyright, title, hash, local_path, file_name) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(
            params.imageUrl || '',
            params.fullUrl || '',
            params.copyright || '',
            params.title || '',
            params.hash || '',
            absPath,
            fileName
          );
        } catch (dbErr) {
          api.log.warn('Failed to save download record: ' + (dbErr && dbErr.message ? dbErr.message : String(dbErr)));
        }
      }

      if (savePath) {
        // Use absolute path download
        var absPath = api.native.path.join(savePath, params.fileName);
        return api.native.http.downloadTo(params.imageUrl, absPath).then(function () {
          api.log.info('Downloaded: ' + params.fileName + ' to ' + savePath);
          saveRecord(absPath, params.fileName);
          return { success: true, path: absPath };
        }).catch(function (err) {
          api.log.error('Download failed: ' + (err && err.message ? err.message : String(err)));
          return { success: false, error: 'Download failed: ' + (err && err.message ? err.message : String(err)) };
        });
      } else {
        // Fallback: download to plugin data directory (companion folder for .asar installs)
        var destPath = 'downloads/' + params.fileName;
        var absFallbackPath = api.native.path.join(getDataDir(), destPath);
        return api.native.http.download(params.imageUrl, destPath).then(function () {
          api.log.info('Downloaded: ' + params.fileName + ' to plugin downloads/');
          saveRecord(absFallbackPath, params.fileName);
          return { success: true, path: absFallbackPath };
        }).catch(function (err) {
          api.log.error('Download failed: ' + (err && err.message ? err.message : String(err)));
          return { success: false, error: 'Download failed: ' + (err && err.message ? err.message : String(err)) };
        });
      }
    } catch (error) {
      api.log.error('Download failed: ' + error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Add Favorite ──
  api.registerHandler('add-favorite', function (_event, params) {
    try {
      api.db.prepare(
        'INSERT OR IGNORE INTO plugin_bing_favorites (image_url, copyright, title) VALUES (?, ?, ?)'
      ).run(params.imageUrl, params.copyright, params.title);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Remove Favorite ──
  api.registerHandler('remove-favorite', function (_event, params) {
    try {
      api.db.prepare(
        'DELETE FROM plugin_bing_favorites WHERE image_url = ?'
      ).run(params.imageUrl);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── List Favorites ──
  api.registerHandler('list-favorites', function () {
    try {
      var rows = api.db.prepare(
        'SELECT id, image_url, copyright, title, created_at FROM plugin_bing_favorites ORDER BY created_at DESC'
      ).all();
      return {
        success: true,
        favorites: rows.map(function (row) {
          return {
            id: row.id,
            url: row.image_url,
            copyright: row.copyright,
            title: row.title,
            createdAt: row.created_at,
          };
        }),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Get Settings ──
  api.registerHandler('get-settings', function () {
    try {
      var rows = api.db.prepare(
        'SELECT key, value FROM plugin_bing_settings'
      ).all();
      var settings = {};
      for (var i = 0; i < rows.length; i++) {
        settings[rows[i].key] = rows[i].value;
      }
      return { success: true, settings: settings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Save Setting ──
  api.registerHandler('save-setting', function (_event, params) {
    try {
      api.db.prepare(
        'INSERT OR REPLACE INTO plugin_bing_settings (key, value) VALUES (?, ?)'
      ).run(params.key, params.value);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── List Downloads ──
  api.registerHandler('list-downloads', function () {
    try {
      var rows = api.db.prepare(
        'SELECT id, image_url, full_url, copyright, title, hash, local_path, file_name, downloaded_at FROM plugin_bing_downloads ORDER BY downloaded_at DESC'
      ).all();
      return {
        success: true,
        records: rows.map(function (row) {
          return {
            id: row.id,
            imageUrl: row.image_url,
            fullUrl: row.full_url,
            copyright: row.copyright,
            title: row.title,
            hash: row.hash,
            localPath: fixPath(row.local_path),
            fileName: row.file_name,
            downloadedAt: row.downloaded_at,
          };
        }),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Open Folder (reveal file in system file manager) ──
  api.registerHandler('open-folder', function (_event, params) {
    try {
      api.native.shell.showItemInFolder(fixPath(params.filePath));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Read Local Image (for thumbnails) ──
  api.registerHandler('read-local-image', function (_event, params) {
    try {
      // Fix old records that had paths pointing inside the .asar archive
      var filePath = fixPath(params.filePath);
      var dataUrl = api.native.readImage(filePath);
      return { success: true, dataUrl: dataUrl };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Delete Download Record ──
  api.registerHandler('delete-download', function (_event, params) {
    try {
      api.db.prepare(
        'DELETE FROM plugin_bing_downloads WHERE id = ?'
      ).run(params.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Select Folder (for download path) ──
  api.registerHandler('select-folder', function () {
    return api.native.dialog.selectFolder().then(function (folderPath) {
      return { success: true, path: folderPath };
    }).catch(function (error) {
      return { success: false, error: error.message };
    });
  });

  // ── Set Wallpaper ──
  // Uses windows-wallpaper-x86-64.exe bundled in the companion folder.
  // api.native.child_process.execFile searches pluginDataDir → pluginDir,
  // so it works for both .asar and plain-folder installs.
  var WALLPAPER_EXE_PATH = 'dependence/windows-wallpaper-x86-64.exe';

  function setWallpaperBinary(filePath) {
    return api.native.child_process.execFile(
      WALLPAPER_EXE_PATH,
      ['set', filePath, '--scale', 'fill'],
      { timeout: 10000 }
    ).then(function (result) {
      if (result.exitCode !== 0) {
        throw new Error(result.stderr || 'Exit code ' + result.exitCode);
      }
      return result;
    });
  }

  api.registerHandler('wallpaper:set', function (_event, filePath) {
    // Resolve relative paths against the plugin data directory (companion folder
    // for .asar installs). The download-image handler now returns absolute paths,
    // but this guard ensures wallpaper:set still works with relative paths too.
    var absPath = filePath;
    // On Windows, absolute paths start with a drive letter (e.g. "C:\") or UNC ("\\").
    var isAbsolute = /^[A-Za-z]:[\\/]/.test(filePath) || /^\\\\/.test(filePath);
    if (!isAbsolute) {
      absPath = api.native.path.join(getDataDir(), filePath);
      api.log.info('Resolved wallpaper path: ' + filePath + ' → ' + absPath);
    }
    return setWallpaperBinary(absPath).then(function () {
      api.log.info('Wallpaper set: ' + absPath);
      return { success: true };
    }).catch(function (err) {
      api.log.error('Wallpaper set error: ' + (err && err.message ? err.message : String(err)));
      return { success: false, error: err && err.message ? err.message : 'Unknown error' };
    });
  });

  // ── Clear Cache Hook ──
  api.registerHook('cache:clear', function () {
    cache.clear();
    api.log.info('Bing gallery cache cleared');
  }, 'startup');

  api.log.info('Bing Gallery plugin activated');
};
