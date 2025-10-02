// src/components/JpgViewer.js

import React, { useState, useRef, useEffect } from 'react';
import styles from './JpgViewer.module.css';

/**
 * JPG Viewer Component for displaying converted PDF pages as images
 * @param {Object} props - Component props
 * @param {Array<{pageNumber: number, dataUrl: string, blob: Blob}>} props.images - Array of JPG images
 * @param {string} props.title - Title for the viewer
 * @param {boolean} props.showDownload - Whether to show download buttons
 * @param {Function} props.onClose - Callback when viewer is closed
 * @param {boolean} props.isVisible - Whether the viewer is visible
 */
const JpgViewer = ({ 
  images = [], 
  title = "PDF Preview", 
  showDownload = true, 
  onClose, 
  isVisible = false 
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const viewerRef = useRef(null);

  // Define handler functions first
  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < images.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageSelect = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleClose = () => {
    setIsFullscreen(false);
    if (onClose) onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Reset to first page when images change
  useEffect(() => {
    if (images.length > 0) {
      setCurrentPage(0);
    }
  }, [images]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePreviousPage();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextPage();
          break;
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, currentPage, images.length, handlePreviousPage, handleNextPage, handleClose, toggleFullscreen]);

  const handleDownloadCurrentPage = () => {
    if (images[currentPage] && images[currentPage].blob) {
      const filename = `${title}_page_${currentPage + 1}.jpg`;
      const url = URL.createObjectURL(images[currentPage].blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadAllPages = () => {
    images.forEach((image, index) => {
      if (image.blob) {
        const filename = `${title}_page_${index + 1}.jpg`;
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    });
  };

  if (!isVisible || images.length === 0) {
    return null;
  }

  const currentImage = images[currentPage];

  return (
    <div 
      className={`${styles.viewerOverlay} ${isFullscreen ? styles.fullscreen : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={styles.viewerContainer} ref={viewerRef}>
        {/* Header */}
        <div className={styles.viewerHeader}>
          <h3 className={styles.viewerTitle}>
            {title} - Page {currentPage + 1} of {images.length}
          </h3>
          <div className={styles.headerControls}>
            {showDownload && (
              <>
                <button 
                  onClick={handleDownloadCurrentPage}
                  className={styles.downloadButton}
                  title="Download current page"
                >
                  📥 Current Page
                </button>
                <button 
                  onClick={handleDownloadAllPages}
                  className={styles.downloadButton}
                  title="Download all pages"
                >
                  📥 All Pages
                </button>
              </>
            )}
            <button 
              onClick={toggleFullscreen}
              className={styles.fullscreenButton}
              title="Toggle fullscreen (F)"
            >
              {isFullscreen ? '⤓' : '⤢'}
            </button>
            <button 
              onClick={handleClose}
              className={styles.closeButton}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className={styles.imageContainer}>
          {isLoading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner}></div>
              <p>Loading image...</p>
            </div>
          )}
          <img
            src={currentImage.dataUrl}
            alt={`Page ${currentPage + 1}`}
            className={styles.viewerImage}
            onLoad={() => setIsLoading(false)}
            onLoadStart={() => setIsLoading(true)}
            onError={() => setIsLoading(false)}
          />
        </div>

        {/* Navigation Controls */}
        <div className={styles.navigationControls}>
          <button 
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
            className={styles.navButton}
            title="Previous page (←)"
          >
            ← Previous
          </button>
          
          {/* Page Thumbnails */}
          <div className={styles.pageThumbnails}>
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => handlePageSelect(index)}
                className={`${styles.thumbnailButton} ${
                  index === currentPage ? styles.activeThumbnail : ''
                }`}
                title={`Go to page ${index + 1}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleNextPage}
            disabled={currentPage === images.length - 1}
            className={styles.navButton}
            title="Next page (→)"
          >
            Next →
          </button>
        </div>

        {/* Instructions */}
        <div className={styles.instructions}>
          <p>Use arrow keys to navigate • Press F for fullscreen • Press Esc to close</p>
        </div>
      </div>
    </div>
  );
};

export default JpgViewer;
