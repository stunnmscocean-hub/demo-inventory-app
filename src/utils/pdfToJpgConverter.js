// src/utils/pdfToJpgConverter.js

// PDF.js will be loaded dynamically from CDN (same as ref SheetPdfExporter.js)
// No import needed - using window.pdfjsLib from CDN

/**
 * Converts a PDF blob to an array of JPG images
 * @param {Blob} pdfBlob - The PDF file as a blob
 * @param {Object} options - Conversion options
 * @param {number} options.scale - Scale factor for the output images (default: 2)
 * @param {number} options.quality - JPEG quality (0-1, default: 0.8)
 * @param {number} options.maxPages - Maximum number of pages to convert (default: 10)
 * @returns {Promise<Array<{pageNumber: number, dataUrl: string, blob: Blob}>>} Array of converted JPG images
 */
export const convertPdfToJpg = async (pdfBlob, options = {}) => {
  const {
    scale = 2,
    quality = 0.8,
    maxPages = 10
  } = options;

  try {
    // Load PDF.js dynamically (same as ref SheetPdfExporter.js)
    if (!window.pdfjsLib) {
      await loadPdfJs();
    }
    
    // Convert blob to array buffer
    const arrayBuffer = await pdfBlob.arrayBuffer();
    
    // Convert ArrayBuffer to Uint8Array (same as ref SheetPdfExporter.js)
    const bytes = new Uint8Array(arrayBuffer);
    
    // Load the PDF document (same as ref SheetPdfExporter.js)
    const pdf = await window.pdfjsLib.getDocument(bytes).promise;
    
    const jpgImages = [];
    const totalPages = Math.min(pdf.numPages, maxPages);
    
    // Convert each page to JPG
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions (same as ref SheetPdfExporter.js)
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render the page to canvas (same as ref SheetPdfExporter.js)
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to JPG blob
      const jpgBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });
      
      // Get data URL for display
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      
      jpgImages.push({
        pageNumber: pageNum,
        dataUrl: dataUrl,
        blob: jpgBlob
      });
    }
    
    return jpgImages;
  } catch (error) {
    console.error('Error converting PDF to JPG:', error);
    throw new Error(`PDF to JPG conversion failed: ${error.message}`);
  }
};

// Load PDF.js dynamically (same as ref SheetPdfExporter.js)
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load PDF.js'));
    };
    document.head.appendChild(script);
  });
};

/**
 * Converts a PDF from a URL to JPG images
 * @param {string} pdfUrl - URL of the PDF file
 * @param {Object} options - Conversion options
 * @returns {Promise<Array<{pageNumber: number, dataUrl: string, blob: Blob}>>} Array of converted JPG images
 */
export const convertPdfUrlToJpg = async (pdfUrl, options = {}) => {
  try {
    // Try multiple CORS proxy services
    const corsProxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(pdfUrl)}`,
      `https://cors-anywhere.herokuapp.com/${pdfUrl}`,
      `https://thingproxy.freeboard.io/fetch/${pdfUrl}`,
      pdfUrl // Try direct access as fallback
    ];
    
    let response;
    let lastError;
    
    for (const proxyUrl of corsProxies) {
      try {
        console.log(`Trying to fetch PDF via: ${proxyUrl}`);
        response = await fetch(proxyUrl, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/pdf,application/octet-stream,*/*'
          }
        });
        
        if (response.ok) {
          console.log(`Successfully fetched PDF via: ${proxyUrl}`);
          break;
        } else {
          console.warn(`Failed to fetch via ${proxyUrl}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`Error fetching via ${proxyUrl}:`, error.message);
        lastError = error;
        continue;
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`Failed to fetch PDF from any proxy. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    const pdfBlob = await response.blob();
    console.log(`PDF blob size: ${pdfBlob.size} bytes`);
    
    if (pdfBlob.size === 0) {
      throw new Error('Downloaded PDF is empty');
    }
    
    return await convertPdfToJpg(pdfBlob, options);
  } catch (error) {
    console.error('Error converting PDF URL to JPG:', error);
    throw new Error(`PDF URL to JPG conversion failed: ${error.message}`);
  }
};

/**
 * Converts a PDF from Google Drive file ID to JPG images
 * @param {string} accessToken - Google API access token
 * @param {string} fileId - Google Drive file ID
 * @param {Object} options - Conversion options
 * @returns {Promise<Array<{pageNumber: number, dataUrl: string, blob: Blob}>>} Array of converted JPG images
 */
export const convertGoogleDrivePdfToJpg = async (accessToken, fileId, options = {}) => {
  try {
    // Load PDF.js dynamically (same as ref SheetPdfExporter.js)
    if (!window.pdfjsLib) {
      await loadPdfJs();
    }
    
    // Download PDF from Google Drive
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download PDF from Google Drive: ${response.status} ${response.statusText}`);
    }
    
    const pdfBlob = await response.blob();
    return await convertPdfToJpg(pdfBlob, options);
  } catch (error) {
    console.error('Error converting Google Drive PDF to JPG:', error);
    throw new Error(`Google Drive PDF to JPG conversion failed: ${error.message}`);
  }
};

/**
 * Downloads a JPG blob as a file
 * @param {Blob} jpgBlob - The JPG blob to download
 * @param {string} filename - The filename for the download
 */
export const downloadJpgBlob = (jpgBlob, filename) => {
  const url = URL.createObjectURL(jpgBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Downloads all JPG images as a zip file (requires additional library)
 * @param {Array<{pageNumber: number, blob: Blob}>} jpgImages - Array of JPG images
 * @param {string} baseFilename - Base filename for the zip
 */
export const downloadJpgImagesAsZip = async (jpgImages, baseFilename) => {
  // This would require a library like JSZip
  // For now, we'll download them individually
  jpgImages.forEach((image, index) => {
    const filename = `${baseFilename}_page_${image.pageNumber}.jpg`;
    downloadJpgBlob(image.blob, filename);
  });
};
