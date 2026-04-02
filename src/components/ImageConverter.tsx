"use client";

import { useState, useRef, DragEvent, useEffect, useCallback } from "react";
import { Download, Loader2, Trash2, Archive, Settings2, Play, AlertTriangle, ArrowLeftRight, FileUp, ListRestart, Layers } from "lucide-react";
import JSZip from "jszip";

// --- TIPOS Y ESTADOS ---
export interface ConversionSettings {
  format: 'image/webp' | 'image/jpeg' | 'image/png';
  quality: number; 
  resizeMode: 'original' | '1080p' | '720p' | 'custom';
  customWidth: number;
  customHeight: number;
  maintainAspectRatio: boolean;
  suffix: string;
}

export const DEFAULT_SETTINGS: ConversionSettings = {
  format: 'image/webp',
  quality: 80, 
  resizeMode: 'original',
  customWidth: 1920,
  customHeight: 1080,
  maintainAspectRatio: true,
  suffix: '_optimizado',
};

export interface ProcessedFile {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalUrl: string;
  status: "pending" | "decoding" | "processing" | "done" | "error";
  settings: ConversionSettings;
  optimizedSize?: number;
  optimizedUrl?: string;
  blob?: Blob;
  errorMsg?: string;
}

// --- SUB-COMPONENTE: SLIDER COMPARATIVO MODO TÉCNICO ---
function ImageCompareSlider({ beforeUrl, afterUrl }: { beforeUrl: string, afterUrl: string }) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min((x / rect.width) * 100, 100));
    setSliderPosition(percent);
  }, []);

  const onMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const onTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp, onTouchMove]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-lg overflow-hidden cursor-ew-resize touch-none bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-zinc-100 border border-zinc-200 group"
      onMouseDown={(e) => { setIsDragging(true); handleMove(e.clientX); }}
      onTouchStart={(e) => { setIsDragging(true); handleMove(e.touches[0].clientX); }}
    >
      {/* Fondo: Imagen Convertida (After) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt="Optimizada" className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1" />
      
      {/* Frente: Imagen Original (Before) */}
      <div className="absolute inset-0 z-10" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
         {/* eslint-disable-next-line @next/next/no-img-element */}
         <img src={beforeUrl} alt="Original" className="absolute inset-0 w-full h-full object-contain pointer-events-none p-1" />
      </div>

      {/* Etiquetas compactas técnicas */}
      <div className="absolute top-2 left-2 z-20 bg-zinc-900/80 backdrop-blur-sm text-zinc-100 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
        ORIGINAL
      </div>
      <div className="absolute top-2 right-2 z-0 bg-blue-600/90 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
        OPTIMIZADA
      </div>

      {/* Línea Divisoria Interactiva Fina */}
      <div 
        className="absolute top-0 bottom-0 w-[1px] bg-white cursor-ew-resize z-20 shadow-[0_0_5px_rgba(0,0,0,0.5)] pointer-events-none"
        style={{ left: `calc(${sliderPosition}% - 0.5px)` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-zinc-200 pointer-events-auto">
          <ArrowLeftRight className="w-3 h-3 text-zinc-600" />
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function ImageConverter() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [globalSettings, setGlobalSettings] = useState<ConversionSettings>(DEFAULT_SETTINGS);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runConversionLogic = (fileObj: ProcessedFile) => {
    return new Promise<void>((resolve) => {
      const worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url));
      
      worker.onmessage = (e) => {
        const { id, status, blob, optimizedSize, errorMsg } = e.data;
        if (status === 'done') {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "done", optimizedSize, blob, optimizedUrl: URL.createObjectURL(blob) }
                : f
            )
          );
        } else {
          setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", errorMsg } : f)));
        }
        worker.terminate();
        resolve();
      };
      
      worker.onerror = (err) => {
        setFiles((prev) => prev.map((f) => (f.id === fileObj.id ? { ...f, status: "error", errorMsg: "Error en Worker" } : f)));
        worker.terminate();
        resolve();
      };

      worker.postMessage({
        id: fileObj.id,
        file: fileObj.file,
        settings: fileObj.settings
      });
    });
  };

  const processFile = async (id: string) => {
    const fileObj = files.find(f => f.id === id);
    if (!fileObj || fileObj.status === 'processing') return;

    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "processing" } : f)));
    await runConversionLogic(fileObj);
  };

  const processAllPending = async () => {
    const pendings = files.filter(f => f.status === 'pending');
    for (const p of pendings) {
      setFiles((prev) => prev.map((f) => (f.id === p.id ? { ...f, status: "processing" } : f)));
      await runConversionLogic(p);
    }
  };

  const handleFiles = async (incomingFiles: FileList | File[]) => {
    const validFiles = Array.from(incomingFiles).filter((f) => f.type.startsWith("image/") || f.name.toLowerCase().endsWith(".heic") || f.name.toLowerCase().endsWith(".heif"));
    if (validFiles.length === 0) {
      alert("Por favor, selecciona imágenes válidas (WebP, PNG, JPG o HEIC/HEIF).");
      return;
    }

    // Add them immediately as pending to show UI feedback
    const placeholderFiles = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: file,
      name: file.name,
      originalSize: file.size,
      originalUrl: "", 
      status: "pending" as ProcessedFile['status'],
      settings: { ...globalSettings }, 
    }));
    setFiles((prev) => [...prev, ...placeholderFiles]);

    // Asynchronously decode HEIC/HEIF and create Blob URLs
    for (const fObj of placeholderFiles) {
      const file = fObj.file;
      const isHeic = file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
      let finalFile = file;
      let originalUrl = "";

      if (isHeic) {
        setFiles(prev => prev.map(f => f.id === fObj.id ? { ...f, status: "decoding" as const } : f));
        try {
          // Dynamic import
          const heic2any = (await import("heic2any")).default;
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
          });
          // convert blob back to File
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          finalFile = new File([finalBlob], file.name.replace(/\.heic|\.heif/i, ".jpg"), { type: "image/jpeg" });
          originalUrl = URL.createObjectURL(finalFile);
        } catch (e) {
          setFiles(prev => prev.map(f => f.id === fObj.id ? { ...f, status: "error", errorMsg: "Fallo al decodificar HEIC" } : f));
          continue;
        }
      } else {
        originalUrl = URL.createObjectURL(file);
      }

      setFiles(prev => prev.map(f => {
        if (f.id === fObj.id) {
          return { ...f, file: finalFile, originalUrl, status: "pending", name: finalFile.name, originalSize: finalFile.size };
        }
        return f;
      }));
    }
  };

  const updateFileSettings = (id: string, newSettings: Partial<ConversionSettings>) => {
    setFiles((prev) => prev.map((f) => {
      if (f.id === id) {
        const updatedStatus = f.status === 'done' ? 'pending' : f.status; 
        if (f.status === 'done') { if (f.optimizedUrl) URL.revokeObjectURL(f.optimizedUrl); }
        return { ...f, settings: { ...f.settings, ...newSettings }, status: updatedStatus, optimizedSize: undefined, blob: undefined };
      }
      return f;
    }));
  };

  const applyGlobalSettingsToAll = () => {
    setFiles((prev) => prev.map(f => {
      if (f.status === 'done' && f.optimizedUrl) URL.revokeObjectURL(f.optimizedUrl);
      return { ...f, settings: { ...globalSettings }, status: 'pending', optimizedSize: undefined, blob: undefined };
    }));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.optimizedUrl) URL.revokeObjectURL(target.optimizedUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024, sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const calculateSavingsPercentage = (orig: number, opt: number) => {
    return (((orig - opt) / orig) * 100).toFixed(1);
  };

  const getTotalSavings = () => {
    let totalOrig = 0, totalOpt = 0;
    files.forEach((f) => {
      if (f.status === "done" && f.optimizedSize) {
        totalOrig += f.originalSize;
        totalOpt += f.optimizedSize;
      }
    });
    if (totalOrig === 0) return 0;
    return (((totalOrig - totalOpt) / totalOrig) * 100).toFixed(1);
  };

  const downloadAllZip = async () => {
    const doneFiles = files.filter((f) => f.status === "done" && f.blob);
    if (doneFiles.length === 0) return;
    
    setIsZipping(true);
    const zip = new JSZip();
    
    doneFiles.forEach((file) => {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const ext = file.settings.format === 'image/jpeg' ? '.jpg' : file.settings.format === 'image/png' ? '.png' : '.webp';
      zip.file(`${nameWithoutExt}${file.settings.suffix}${ext}`, file.blob!);
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = `optimizadas_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href); 
    } catch(err) {
      alert("Error al generar el ZIP");
    } finally {
      setIsZipping(false);
    }
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const doneCount = files.filter(f => f.status === "done").length;

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6">
      
      {/* SIDEBAR: PANEL DE AJUSTES GLOBALES */}
      {files.length > 0 && (
        <aside className="w-full xl:w-[280px] shrink-0 h-fit flex flex-col gap-6 relative xl:sticky xl:top-[88px] z-10">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-colors">
            <div className="px-5 py-4 border-b border-[var(--surface-border)] flex items-center gap-2 bg-[var(--background)]">
              <Settings2 className="w-[18px] h-[18px] text-[#86868b]" />
              <h2 className="text-[13px] font-semibold text-[var(--foreground)] tracking-tight">Ajustes Rápidos</h2>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* Optimización Rapida */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] tracking-wide mb-2 block">Nivel Visual</label>
                <div className="flex bg-[var(--background)] rounded-lg p-1 border border-[var(--surface-border)]">
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 90}))} className={`flex-1 px-2 py-1.5 text-[12px] font-medium rounded-md transition-all ${globalSettings.quality >= 90 ? 'bg-[var(--surface)] shadow-sm text-foreground' : 'text-[#86868b] hover:text-[var(--foreground)]'}`}>Premium</button>
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 75}))} className={`flex-1 px-2 py-1.5 text-[12px] font-medium rounded-md transition-all ${(globalSettings.quality < 90 && globalSettings.quality > 50) ? 'bg-[var(--surface)] shadow-sm text-foreground' : 'text-[#86868b] hover:text-[var(--foreground)]'}`}>Balance</button>
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 50}))} className={`flex-1 px-2 py-1.5 text-[12px] font-medium rounded-md transition-all ${globalSettings.quality <= 50 ? 'bg-[var(--surface)] shadow-sm text-foreground' : 'text-[#86868b] hover:text-[var(--foreground)]'}`}>Ligero</button>
                </div>
              </div>

              {/* Controles de Formulario Densos */}
              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-medium text-[#86868b] tracking-wide mb-2 block">Formato de Salida</label>
                  <select 
                    value={globalSettings.format} onChange={e => setGlobalSettings(s => ({...s, format: e.target.value as any}))}
                    className="w-full bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] font-medium text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0066cc]/30 focus:border-[#0066cc] dark:focus:ring-[#2997ff]/30 dark:focus:border-[#2997ff] transition-colors"
                  >
                    <option value="image/webp">A WebP (Recomendado)</option>
                    <option value="image/jpeg">A JPEG (Clásico)</option>
                    <option value="image/png">A PNG (Transparente)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[11px] font-medium text-[#86868b] tracking-wide">
                      Calidad {globalSettings.format === 'image/png' && <span className="text-[#ff3b30] font-medium text-[10px]"> (No aplica)</span>}
                    </label>
                    <span className={`text-[12px] font-semibold bg-[var(--background)] px-2 py-0.5 rounded-md ${globalSettings.format === 'image/png' ? 'text-[#86868b]' : 'text-[#0066cc] dark:text-[#2997ff]'}`}>{globalSettings.quality}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" value={globalSettings.quality} onChange={e => setGlobalSettings(s => ({...s, quality: parseInt(e.target.value, 10)}))}
                    disabled={globalSettings.format === 'image/png'}
                    className={`w-full h-1.5 rounded-full appearance-none ${globalSettings.format === 'image/png' ? 'bg-[var(--surface-border)] accent-[#86868b] cursor-not-allowed' : 'bg-[var(--surface-border)] accent-[#0066cc] dark:accent-[#2997ff] cursor-pointer'}`}
                  />
                  {globalSettings.format === 'image/png' && <p className="text-[11px] text-[#86868b] mt-1.5 leading-tight tracking-tight">PNG no usa pérdida. Para reducir peso, cambia la resolución.</p>}
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#86868b] tracking-wide mb-2 block">Tamaño Máximo</label>
                  <select 
                    value={globalSettings.resizeMode} onChange={e => setGlobalSettings(s => ({...s, resizeMode: e.target.value as any}))}
                    className="w-full bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] font-medium text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#0066cc]/30 focus:border-[#0066cc] dark:focus:ring-[#2997ff]/30 dark:focus:border-[#2997ff] transition-colors"
                  >
                    <option value="original">Original</option>
                    <option value="1080p">HD Max 1920x1080</option>
                    <option value="720p">MD Max 1280x720</option>
                    <option value="custom">Personalizado</option>
                  </select>

                  {globalSettings.resizeMode === 'custom' && (
                    <div className="flex gap-2 mt-2">
                       <input type="number" placeholder="Ancho" value={globalSettings.customWidth || ''} onChange={e => setGlobalSettings(s => ({...s, customWidth: Number(e.target.value)}))} className="w-1/2 bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] font-medium text-[13px] rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-[#0066cc]/30 focus:border-[#0066cc] dark:focus:ring-[#2997ff]/30 dark:focus:border-[#2997ff]" />
                       <input type="number" placeholder="Alto" value={globalSettings.customHeight || ''} onChange={e => setGlobalSettings(s => ({...s, customHeight: Number(e.target.value)}))} className="w-1/2 bg-[var(--background)] border border-[var(--surface-border)] text-[var(--foreground)] font-medium text-[13px] rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-[#0066cc]/30 focus:border-[#0066cc] dark:focus:ring-[#2997ff]/30 dark:focus:border-[#2997ff]" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 mt-1 border-t border-[var(--surface-border)]">
                <button 
                  onClick={applyGlobalSettingsToAll}
                  className="w-full py-2 bg-[var(--background)] hover:opacity-80 text-[#0066cc] dark:text-[#2997ff] font-medium text-[13px] rounded-lg transition-opacity flex justify-center items-center gap-1.5"
                >
                  <ListRestart className="w-[14px] h-[14px]" /> Aplicar a Pendientes
                </button>
              </div>
            </div>
          </div>

          {(pendingCount > 0) && (
            <button 
              onClick={processAllPending}
              className="w-full py-3.5 bg-[#0066cc] dark:bg-[#2997ff] hover:opacity-90 text-white font-medium text-[15px] rounded-full shadow-[0_2px_8px_rgba(0,102,204,0.3)] dark:shadow-[0_2px_8px_rgba(41,151,255,0.3)] transition-opacity flex justify-center items-center gap-2 group"
            >
              <Play className="w-[14px] h-[14px] fill-white" />
              Convertir {pendingCount} Archivos
            </button>
          )}
        </aside>
      )}

      {/* ÁREA PRINCIPAL DE LISTADO */}
      <div className="flex-1 flex flex-col min-w-0">
        {files.length === 0 ? (
          // Vista Inicial Vacía (Empty UI state elegante)
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border rounded-[24px] flex flex-col items-center justify-center p-12 transition-all duration-300 cursor-pointer min-h-[400px] relative overflow-hidden group
              ${isDragging 
                ? "border-[#0066cc] dark:border-[#2997ff] bg-[#0066cc]/[0.02] dark:bg-[#2997ff]/[0.05] scale-[1.01]" 
                : "border-[var(--surface-border)] bg-[var(--surface)] hover:border-black/20 dark:hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"}
            `}
          >

            <div className="relative z-10 w-16 h-16 rounded-[18px] border border-[var(--surface-border)] shadow-[0_4px_12px_rgba(0,0,0,0.03)] flex items-center justify-center bg-[var(--surface)] mb-6 text-[#0066cc] dark:text-[#2997ff] group-hover:scale-105 transition-transform duration-300">
              <FileUp className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="relative z-10 text-[22px] font-semibold text-[var(--foreground)] mb-2 tracking-tight">Selecciona o arrastra imágenes aquí</h3>
            <p className="relative z-10 text-[15px] font-medium text-[#86868b] dark:text-[#86868b] mb-8 max-w-md text-center">
              Reconoce formato <b>HEIC/iOS</b>, WebP, PNG y JPG. Todo ocurre en tu propio dispositivo.
            </p>
            <button className="relative z-10 px-6 py-2 pb-[10px] bg-[#0066cc] dark:bg-[#2997ff] hover:opacity-90 text-white font-medium text-[15px] rounded-full shadow-[0_2px_8px_rgba(0,102,204,0.3)] dark:shadow-[0_2px_8px_rgba(41,151,255,0.3)] transition-opacity">
              Explorar Archivos
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Top Toolbar del listado */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--surface-border)] p-4 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative xl:sticky xl:top-[88px] z-20 w-full mb-3 transition-colors">
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-[#f5f5f7] dark:bg-[#3d3d40] hover:bg-[#e8e8ed] dark:hover:bg-[#4d4d50] text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-[13px] rounded-full transition-colors flex items-center gap-2"
                 >
                   <Layers className="w-4 h-4" /> Añadir Más Fotos
                 </button>
                 <span className="text-[#86868b] text-[13px] font-medium border-l border-[var(--surface-border)] pl-4">
                   {doneCount} Completadas de {files.length} (Ahorro: {getTotalSavings()}%)
                 </span>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setFiles([])}
                  className="px-5 py-2.5 bg-transparent hover:bg-[#ff3b30]/10 text-[#ff3b30] border border-transparent hover:border-[#ff3b30]/30 font-medium text-[13px] rounded-full transition-all flex items-center gap-2"
                >
                  Vaciar Todo
                </button>
                <button 
                  onClick={downloadAllZip}
                  disabled={doneCount === 0 || isZipping}
                  className="px-6 py-2 pb-[10px] bg-[#34c759] hover:opacity-90 disabled:bg-[var(--background)] disabled:text-[#86868b] disabled:border-[var(--surface-border)] disabled:shadow-none border border-[#34c759] text-white font-medium text-[14px] rounded-full shadow-[0_2px_8px_rgba(52,199,89,0.3)] transition-all flex items-center gap-2"
                >
                  {isZipping ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : <Archive className="w-[14px] h-[14px]" />}
                  ZIP de {doneCount} Imágenes
                </button>
              </div>
            </div>

            {/* Listado de Archivos en Grilla Densa */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {files.map((file) => {
                const isConverted = file.status === "done";
                const formatLabel = file.settings.format.split('/')[1].toUpperCase();
                const dangerB = isConverted && file.optimizedSize && file.optimizedSize > file.originalSize;
                const savings = isConverted && file.optimizedSize ? calculateSavingsPercentage(file.originalSize, file.optimizedSize) : "0";

                return (
                  <div key={file.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex flex-col p-4 group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 pr-4">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate" title={file.name}>{file.name}</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">{formatSize(file.originalSize)}</p>
                      </div>
                      <button onClick={() => removeFile(file.id)} className="text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-100 dark:hover:border-red-900/50 p-1.5 rounded-md transition-colors shadow-sm opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Fila Dividida: Preview Izq, Controles Der */}
                    <div className="flex flex-col sm:flex-row gap-5 mb-4">
                       <div className="w-full sm:w-44 shrink-0 flex items-center justify-center mx-auto">
                         {file.status === "processing" ? (
                           <div className="w-full aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800 pb-1">
                             <Loader2 className="w-5 h-5 animate-spin text-blue-500 dark:text-blue-400 mb-1" />
                             <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">Procesando</span>
                           </div>
                         ) : file.status === "decoding" ? (
                           <div className="w-full aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-800 pb-1">
                             <Loader2 className="w-5 h-5 animate-spin text-purple-500 dark:text-purple-400 mb-1" />
                             <span className="text-[8px] font-bold text-zinc-400 dark:text-zinc-500 tracking-widest uppercase">Decodificando original...</span>
                           </div>
                         ) : (
                           isConverted && file.optimizedUrl ? (
                             <ImageCompareSlider beforeUrl={file.originalUrl} afterUrl={file.optimizedUrl} />
                           ) : (
                              <div className="w-full aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1 bg-[url('https://transparenttextures.com/patterns/cubes.png')] overflow-hidden shadow-inner">
                                 {/* eslint-disable-next-line @next/next/no-img-element */}
                                 {file.originalUrl && <img src={file.originalUrl} className="max-w-full max-h-full object-contain drop-shadow-sm" alt="Original" />}
                              </div>
                           )
                         )}
                       </div>

                       <div className="flex-1 flex flex-col justify-center sm:border-l border-t sm:border-t-0 border-zinc-100 pt-3 sm:pt-0 pl-0 sm:pl-4 space-y-2.5">
                          <select value={file.settings.format} onChange={e => updateFileSettings(file.id, {format: e.target.value as any})} className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 text-[10px] font-bold rounded px-2 py-1 outline-none hover:bg-white hover:border-blue-400 transition-colors">
                            <option value="image/webp">A WebP</option>
                            <option value="image/jpeg">A JPEG</option>
                            <option value="image/png">A PNG</option>
                          </select>
                          
                          <select value={file.settings.resizeMode} onChange={e => updateFileSettings(file.id, {resizeMode: e.target.value as any})} className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded px-2 py-1 outline-none hover:bg-white dark:hover:bg-zinc-700 hover:border-blue-400 transition-colors">
                            <option value="original">Original</option>
                            <option value="1080p">A 1080p Max</option>
                            <option value="720p">A 720p Max</option>
                            <option value="custom">Personalizado</option>
                          </select>
                          
                          {file.settings.resizeMode === 'custom' && (
                             <div className="flex gap-1">
                               <input type="number" placeholder="Ancho px" value={file.settings.customWidth || ''} onChange={e => updateFileSettings(file.id, {customWidth: Number(e.target.value)})} className="w-1/2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded px-2 py-1 outline-none focus:border-blue-400" />
                               <input type="number" placeholder="Alto px" value={file.settings.customHeight || ''} onChange={e => updateFileSettings(file.id, {customHeight: Number(e.target.value)})} className="w-1/2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold rounded px-2 py-1 outline-none focus:border-blue-400" />
                             </div>
                          )}

                          <div className="flex items-center gap-2">
                             <span className={`text-[9px] font-extrabold uppercase w-7 tracking-wider ${file.settings.format === 'image/png' ? 'text-zinc-400' : 'text-blue-600'}`}>QLTY</span>
                             {file.settings.format === 'image/png' ? (
                               <span className="text-[9px] text-zinc-400 font-medium">No soportado en PNG</span>
                             ) : (
                               <input type="range" min="1" max="100" value={file.settings.quality} onChange={e => updateFileSettings(file.id, {quality: parseInt(e.target.value, 10)})} className="flex-1 accent-blue-600 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer" />
                             )}
                          </div>
                       </div>
                    </div>

                    {/* Barra de pie: Salida y Botones locales */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-[var(--surface-border)] pt-4 mt-auto gap-3 sm:gap-0">
                       {(!isConverted) ? (
                          <div className="text-[12px] text-[#86868b] bg-[var(--background)] font-medium px-4 py-1.5 rounded-full border border-[var(--surface-border)] shadow-[0_2px_8px_rgba(0,0,0,0.02)] w-auto inline-block">Estado: Pendiente</div>
                       ) : (
                          <div className="flex items-center gap-2 bg-[#34c759]/5 dark:bg-[#34c759]/10 px-3 py-1.5 rounded-full border border-[#34c759]/20">
                            {dangerB ? <AlertTriangle className="w-[14px] h-[14px] text-[#ffcc00]" /> : <div className="w-2 h-2 bg-[#34c759] rounded-full" />}
                            <span className={`text-[12px] font-semibold ${dangerB ? 'text-[#ffcc00]' : 'text-[#1d1d1f] dark:text-[#f5f5f7]'} font-mono`}>{formatSize(file.optimizedSize!)}</span>
                            {!dangerB && <span className="text-[11px] font-bold text-[#34c759] bg-[#34c759]/20 px-1.5 py-0.5 rounded-md">-{savings}%</span>}
                          </div>
                       )}

                       <div className="flex items-center gap-3 w-full sm:w-auto">
                          {!isConverted ? (
                            <button onClick={() => processFile(file.id)} className="w-full sm:w-auto bg-[#f5f5f7] dark:bg-[#3d3d40] hover:bg-[#e8e8ed] dark:hover:bg-[#4d4d50] text-[#0066cc] dark:text-[#2997ff] border border-transparent px-5 py-2 rounded-full text-[13px] font-medium transition-colors">Procesar Ahora</button>
                          ) : (
                            <>
                              <button onClick={() => updateFileSettings(file.id, {})} className="bg-[var(--background)] hover:opacity-80 text-[#86868b] px-4 py-2 rounded-full text-[12px] font-medium transition-opacity" title="Aplicar nuevos ajustes">Refrescar</button>
                              <a href={file.optimizedUrl} download={`${file.name.substring(0, file.name.lastIndexOf('.')) || file.name}${file.settings.suffix}.${file.settings.format.split('/')[1]}`} className="flex-1 sm:flex-none bg-[#0066cc] dark:bg-[#2997ff] hover:opacity-90 text-white px-5 py-2 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5 shadow-[0_2px_8px_rgba(0,102,204,0.3)] dark:shadow-[0_2px_8px_rgba(41,151,255,0.3)] transition-opacity">
                                <Download className="w-4 h-4" /> Descargar
                              </a>
                            </>
                          )}
                       </div>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      <input type="file" multiple className="hidden" ref={fileInputRef} accept="image/png, image/jpeg, image/jpg" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }} />
    </div>
  );
}
