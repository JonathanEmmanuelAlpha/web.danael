"use client";

import * as React from "react";
import {
  FileText,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFViewerProps {
  url: string;
  title: string;
}

export function PDFViewer({ url, title }: PDFViewerProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages] = React.useState(8);
  const [zoom, setZoom] = React.useState(100);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      ref={containerRef}
      className={`glass-card overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 rounded-none"
          : "relative"
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary-400" />
          <span className="text-sm text-white/70 truncate max-w-xs">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(Math.max(50, zoom - 25))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="text-xs text-white/40 min-w-[3rem] text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => setZoom(Math.min(200, zoom + 25))}
          >
            <ZoomIn className="size-4" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Page navigation */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-white/50 min-w-[4rem] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:text-white hover:bg-white/10"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-white/50 hover:text-white hover:bg-white/10"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF Content Area */}
      <div
        className="flex items-center justify-center bg-secondary-800/50"
        style={{
          height: isFullscreen ? "calc(100vh - 48px)" : "600px",
        }}
      >
        {url && url !== "#" ? (
          <iframe
            src={url}
            title={title}
            className="w-full h-full border-0"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
          />
        ) : (
          /* Placeholder when no PDF */
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <div className="size-20 rounded-2xl bg-white/[0.06] flex items-center justify-center">
              <FileText className="size-10 text-white/20" />
            </div>
            <div>
              <p className="text-white/50 font-medium">
                Aperçu du document
              </p>
              <p className="text-white/30 text-sm mt-1">
                Le visualiseur PDF sera disponible ici
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 rounded-full bg-white/[0.08]"
                    style={{
                      width: `${120 + i * 30}px`,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-white/20 mt-4">
              Page {currentPage} sur {totalPages}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
