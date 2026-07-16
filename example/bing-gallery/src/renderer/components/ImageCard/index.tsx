import React from "react";
import type { BingImage, FavoriteImage } from "../../types";
import "./index.module.css";

interface ImageCardProps {
  image: BingImage | FavoriteImage;
  isFavorite: boolean;
  onDownload: (img: BingImage | FavoriteImage) => void;
  onSetBackground: (img: BingImage | FavoriteImage) => void;
  onToggleFavorite: (img: BingImage | FavoriteImage) => void;
  onViewFull: (img: BingImage | FavoriteImage) => void;
  t: Record<string, string>;
}

export function ImageCard({
  image,
  isFavorite,
  onDownload,
  onSetBackground,
  onToggleFavorite,
  onViewFull,
  t,
}: ImageCardProps) {
  return (
    <div className="card-wrapper">
      <div className="card" onClick={() => onViewFull(image)}>
        {/* Image */}
        <div className="card-image">
          <img src={image.url} alt={image.title || ""} loading="lazy" />
        </div>

        {/* Title — always visible, bottom of image */}
        <div className="card-title">
          {image.title || "Bing Wallpaper"}
        </div>

        {/* Overlay — visible on hover */}
        <div className="card-overlay">
          <div className="card-overlay-bg" />
          <div className="card-overlay-content">
            <div className="card-meta">
              {image.copyright && (
                <div style={{ opacity: 0.7 }}>{image.copyright}</div>
              )}
            </div>

            <div className="card-actions-row">
              <div className="card-actions">
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(image);
                  }}
                  title={t.download}
                >
                  <svg
                    width={15}
                    height={15}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1={12} y1={15} x2={12} y2={3} />
                  </svg>
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(image);
                  }}
                  title={t.addToFavorites}
                  style={isFavorite ? { color: "#ff6b6b" } : undefined}
                >
                  <svg
                    width={15}
                    height={15}
                    viewBox="0 0 24 24"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetBackground(image);
                  }}
                  title={t.setAsBackground}
                >
                  <svg
                    width={15}
                    height={15}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <rect x={2} y={3} width={20} height={14} rx={2} />
                    <path d="M8 21h8" />
                    <line x1={12} y1={17} x2={12} y2={21} />
                  </svg>
                </button>
              </div>
              {"time" in image && (image as BingImage).time && (
                <div className="card-date">{(image as BingImage).time}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
