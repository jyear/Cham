import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useT } from "@/i18n";
import { Tabs } from "@/components/Tabs";
import { ImageCard } from "@/components/ImageCard";
import { ImageViewer } from "@/components/ImageViewer";
import { Toast } from "@/components/Toast";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { SettingsModal } from "@/components/SettingsModal";
import { DownloadRecords } from "@/components/DownloadRecords";
import type { BingImage, FavoriteImage, DownloadRecord, ViewableImage, TabType } from "@/types";
import "./styles/global.css";

function BingGallery() {
  const t = useT();

  const [activeTab, setActiveTab] = useState<TabType>("daily");
  const [images, setImages] = useState<BingImage[]>([]);
  const [favorites, setFavorites] = useState<FavoriteImage[]>([]);
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(new Set());
  const [downloadRecords, setDownloadRecords] = useState<DownloadRecord[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewerImage, setViewerImage] = useState<ViewableImage | null>(null);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Refs
  const currentIdxRef = useRef(0);
  const loadingRef = useRef(false);
  const seenHashes = useRef<Set<string>>(new Set());
  const settingBgRef = useRef(false);
  const downloadPathRef = useRef<string>("");

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: "", visible: false }), 2500);
  }, []);

  // Load settings on mount
  useEffect(() => {
    if (!window.cham) return;
    Promise.all([
      window.cham.loadSettings(),
      window.cham.plugin.call( "get-settings"),
    ]).then(([, settingResult]: any) => {
      if (settingResult?.success && settingResult.settings) {
        downloadPathRef.current = settingResult.settings.download_path || "";
      }
      setSettingsLoaded(true);
    });
  }, []);

  // Register title bar settings action & listen for clicks via cham API
  useEffect(() => {
    if (!window.cham) return;

    // Register the settings button in the AppWindow title bar
    window.cham.registerTitleBarAction({
      id: 'bing-gallery-settings',
      icon: 'settings',
      tooltip: t.settings,
      pluginId: 'bing-gallery',
    });

    // Listen for clicks on the settings button
    const unsub = window.cham.onTitleBarAction((payload) => {
      if (payload.actionId === 'bing-gallery-settings') {
        setSettingsOpen(true);
      }
    });

    return () => {
      unsub();
      window.cham?.removeTitleBarAction('bing-gallery-settings');
    };
  }, []);

  // Fetch images on mount
  useEffect(() => {
    if (!settingsLoaded || !window.cham) return;
    fetchImages(0);
  }, [settingsLoaded]);

  // Load favorites when tab changes
  useEffect(() => {
    if (activeTab === "favorites" && window.cham) {
      loadFavorites();
    }
    if (activeTab === "downloads" && window.cham) {
      loadDownloadRecords();
    }
  }, [activeTab]);

  async function fetchImages(idx: number) {
    if (!window.cham || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const result = await window.cham.plugin.call(
        "fetch-images",
        { idx, n: 20 },
      );
      if (result.success) {
        // Deduplicate by hash (fallback to url if hash is empty)
        const fresh = (result.images || []).filter((img: BingImage) => {
          const key = img.hash || img.url;
          if (seenHashes.current.has(key)) return false;
          seenHashes.current.add(key);
          return true;
        });

        if (idx === 0) {
          setImages(fresh);
        } else {
          setImages((prev) => [...prev, ...fresh]);
        }
        const nextIdx = idx + 20;
        currentIdxRef.current = nextIdx;
        // Use API's hasMore flag; fallback to checking returned count
        if (result.hasMore !== undefined) {
          setHasMore(result.hasMore);
        } else if ((result.images || []).length < 20) {
          setHasMore(false);
        }
      } else {
        setError(result.error || t.errorLoading);
      }
    } catch (e: any) {
      setError(e.message || t.errorLoading);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  // Scroll-based infinite loading + fill viewport
  useEffect(() => {
    if (activeTab !== "daily") return;

    const gridBox = document.querySelector('.bing-grid-box') as HTMLElement | null;
    if (!gridBox) return;

    let cooldown = false;

    function checkAndLoad() {
      if (!hasMore || loadingRef.current || cooldown) return;
      const nearBottom =
        gridBox!.scrollTop + gridBox!.clientHeight + 200 >= gridBox!.scrollHeight;
      if (nearBottom) {
        cooldown = true;
        fetchImages(currentIdxRef.current);
        setTimeout(() => { cooldown = false; }, 500);
      }
    }

    // Check after images change (small delay for layout to settle)
    const timer = setTimeout(checkAndLoad, 100);

    gridBox.addEventListener('scroll', checkAndLoad, { passive: true });
    return () => {
      clearTimeout(timer);
      gridBox.removeEventListener('scroll', checkAndLoad);
    };
  }, [activeTab, hasMore, images, loading]);

  async function loadFavorites() {
    if (!window.cham) return;
    try {
      const result = await window.cham.plugin.call(
        "list-favorites",
      );
      if (result.success) {
        setFavorites(result.favorites);
        setFavoriteUrls(
          new Set(result.favorites.map((f: FavoriteImage) => f.url)),
        );
      }
    } catch {
      // silent
    }
  }

  async function loadDownloadRecords() {
    if (!window.cham) return;
    setDownloadsLoading(true);
    try {
      const result = await window.cham.plugin.call(
        "list-downloads",
      );
      if (result.success) {
        setDownloadRecords(result.records || []);
      }
    } catch {
      // silent
    } finally {
      setDownloadsLoading(false);
    }
  }

  async function handleDownload(image: BingImage | FavoriteImage) {
    if (!window.cham) return;

    // Refresh download path from settings
    try {
      const settingResult = await window.cham.plugin.call(
        "get-settings",
      );
      if (settingResult?.success && settingResult.settings) {
        downloadPathRef.current = settingResult.settings.download_path || "";
      }
    } catch { /* ignore */ }

    // If no download path set, auto-open settings
    if (!downloadPathRef.current) {
      showToast(t.downloadPathRequired);
      setSettingsOpen(true);
      return;
    }

    const fileName = `bing-wallpaper-${Date.now()}.jpg`;

    try {
      const result = await window.cham.plugin.call(
        "download-image",
        {
          imageUrl:
            "fullUrl" in image ? (image as BingImage).fullUrl : image.url,
          fullUrl:
            "fullUrl" in image ? (image as BingImage).fullUrl : image.url,
          copyright: image.copyright || "",
          title: image.title || "",
          hash: "hash" in image ? (image as BingImage).hash : "",
          fileName,
        },
      );
      if (result.success) {
        showToast(t.downloaded);
        // Refresh download records if on downloads tab
        if (activeTab === "downloads") {
          loadDownloadRecords();
        }
      }
    } catch {
      try {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t.downloaded);
      } catch {
        showToast(t.errorLoading);
      }
    }
  }

  // ── Set App Background (Cham internal library only) ──

  async function handleSetAppBackgroundFromPath(filePath: string) {
    if (!window.cham) return;
    try {
      const result = await (window.cham as any).backgroundSet(filePath);
      if (!result?.success) {
        showToast(t.errorLoading);
        return;
      }
      showToast(t.backgroundSet);
    } catch {
      showToast(t.errorLoading);
    }
  }

  async function handleSetAppBackground(image: BingImage | FavoriteImage) {
    if (!window.cham) return;
    const imgUrl = "fullUrl" in image ? (image as BingImage).fullUrl : image.url;
    try {
      const result = await (window.cham as any).backgroundSet(imgUrl);
      if (result?.success) {
        showToast(t.backgroundSet);
      } else {
        showToast(t.errorLoading);
      }
    } catch {
      showToast(t.errorLoading);
    }
  }

  // ── Set Desktop Background (system wallpaper) ──

  async function handleSetDesktopBackgroundFromPath(filePath: string) {
    if (!window.cham) return;
    try {
      const wpResult = await window.cham.plugin.call(
        "wallpaper:set",
        filePath,
      );
      if (wpResult?.success) {
        showToast(t.backgroundSet);
      } else {
        showToast(t.errorLoading);
      }
    } catch {
      showToast(t.errorLoading);
    }
  }

  async function handleSetDesktopBackground(image: BingImage | FavoriteImage) {
    if (!window.cham || settingBgRef.current) return;
    const imgUrl =
      "fullUrl" in image ? (image as BingImage).fullUrl : image.url;

    settingBgRef.current = true;
    try {
      // Download locally first so we have a file path for wallpaper:set
      const fileName = `bing-wallpaper-${Date.now()}.jpg`;
      const dlResult = await window.cham.plugin.call(
        "download-image",
        {
          imageUrl: imgUrl,
          fullUrl: imgUrl,
          copyright: image.copyright || "",
          title: image.title || "",
          hash: "hash" in image ? (image as BingImage).hash : "",
          fileName,
        },
      );

      if (dlResult?.success && dlResult.path) {
        // Set as system desktop wallpaper
        await window.cham.plugin.call(
          "wallpaper:set",
          dlResult.path,
        );
        showToast(t.backgroundSet);
      } else {
        showToast(t.errorLoading);
      }
    } catch {
      showToast(t.errorLoading);
    } finally {
      settingBgRef.current = false;
    }
  }

  async function handleToggleFavorite(image: BingImage | FavoriteImage) {
    if (!window.cham) return;
    const imgUrl = image.url;
    const isFav = favoriteUrls.has(imgUrl);

    try {
      if (isFav) {
        await window.cham.plugin.call( "remove-favorite", {
          imageUrl: imgUrl,
        });
        setFavoriteUrls((prev) => {
          const next = new Set(prev);
          next.delete(imgUrl);
          return next;
        });
        showToast(t.unfavorited);
      } else {
        await window.cham.plugin.call( "add-favorite", {
          imageUrl: imgUrl,
          copyright: image.copyright || "",
          title: "title" in image ? image.title : "",
        });
        setFavoriteUrls((prev) => new Set(prev).add(imgUrl));
        showToast(t.favorited);
      }

      if (activeTab === "favorites") {
        loadFavorites();
      }
    } catch {
      showToast(t.errorLoading);
    }
  }

  async function handleDeleteRecord(record: DownloadRecord) {
    if (!window.cham) return;
    try {
      await window.cham.plugin.call( "delete-download", {
        id: record.id,
      });
      loadDownloadRecords();
    } catch {
      // silent
    }
  }

  function isFavorite(img: BingImage | FavoriteImage): boolean {
    return favoriteUrls.has(img.url);
  }

  const displayItems: (BingImage | FavoriteImage)[] =
    activeTab === "daily" ? images : favorites;

  return (
    <div className="bing-gallery">
      {/* Header */}
      <div className="bing-header">
        <Tabs activeTab={activeTab} onChange={setActiveTab} t={t} />
      </div>

      {/* Error */}
      {error && <div className="bing-error">{error}</div>}

      {/* Loading */}
      {activeTab !== "downloads" && loading && displayItems.length === 0 && <Spinner message={t.loading} />}

      {/* Empty */}
      {activeTab !== "downloads" && !loading && !error && displayItems.length === 0 && (
        <EmptyState message={t.noImages} />
      )}

      {/* Image Grid */}
      {activeTab !== "downloads" && displayItems.length > 0 && (
        <div className="bing-grid-box">
          <div className="bing-grid">
            {displayItems.map((img) => (
              <ImageCard
                key={"hash" in img ? img.hash : `fav-${img.id}`}
                image={img}
                isFavorite={isFavorite(img)}
                onDownload={handleDownload}
                onSetAppBackground={handleSetAppBackground}
                onSetDesktopBackground={handleSetDesktopBackground}
                onToggleFavorite={handleToggleFavorite}
                onViewFull={setViewerImage}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom loading indicator */}
      {activeTab !== "downloads" && loading && displayItems.length > 0 && (
        <div className="bing-loading-more">
          <div className="bing-spinner-sm" />
        </div>
      )}

      {/* Download Records */}
      {activeTab === "downloads" && (
        <div className="bing-grid-box">
          <DownloadRecords
            records={downloadRecords}
            loading={downloadsLoading}
            t={t}
            onDelete={handleDeleteRecord}
            onViewImage={setViewerImage}
          />
        </div>
      )}

      {/* Image Viewer */}
      <ImageViewer
        image={viewerImage}
        onClose={() => setViewerImage(null)}
        onDownload={handleDownload}
        onSetAppBackground={handleSetAppBackground}
        onSetDesktopBackground={handleSetDesktopBackground}
        onSetAppBackgroundFromPath={handleSetAppBackgroundFromPath}
        onSetDesktopBackgroundFromPath={handleSetDesktopBackgroundFromPath}
        t={t}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // Reload settings after close
          window.cham?.plugin.call( "get-settings").then((result: any) => {
            if (result?.success && result.settings) {
              downloadPathRef.current = result.settings.download_path || "";
            }
          });
        }}
        t={t}
      />

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}

// Self-render into the iframe's #root div.
// The host provides #root in the srcdoc HTML shell.
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(React.createElement(BingGallery));
}
