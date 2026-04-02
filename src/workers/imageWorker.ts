// src/workers/imageWorker.ts

interface ConversionSettings {
  format: 'image/webp' | 'image/jpeg' | 'image/png';
  quality: number;
  resizeMode: 'original' | '1080p' | '720p' | 'custom';
  customWidth: number;
  customHeight: number;
  maintainAspectRatio: boolean;
  suffix: string;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, file, settings } = e.data as { id: string, file: File, settings: ConversionSettings };

  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    if (settings.resizeMode !== 'original') {
      let targetW = width;
      let targetH = height;

      if (settings.resizeMode === '1080p') { targetW = 1920; targetH = 1080; }
      else if (settings.resizeMode === '720p') { targetW = 1280; targetH = 720; }
      else if (settings.resizeMode === 'custom') { 
        targetW = settings.customWidth || width; 
        targetH = settings.customHeight || height; 
      }

      if (settings.maintainAspectRatio) {
        if (width > height) {
          if (width > targetW) { height = Math.round((height * targetW) / width); width = targetW; }
        } else {
          if (height > targetH) { width = Math.round((width * targetH) / height); height = targetH; }
        }
      } else { 
        width = targetW; 
        height = targetH; 
      }
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error("No 2D context available");
    }

    // Draw bitmap onto canvas
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Free memory
    bitmap.close();

    const qualityFloat = settings.quality / 100;
    
    // Asynchronously convert to Blob
    const blob = await canvas.convertToBlob({
      type: settings.format,
      quality: qualityFloat
    });

    self.postMessage({ id, status: 'done', blob: blob, optimizedSize: blob.size });
  } catch (err: any) {
    self.postMessage({ id, status: 'error', errorMsg: err.message || "Error procesando imagen" });
  }
};
