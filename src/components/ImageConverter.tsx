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
  status: "pending" | "processing" | "done" | "error";
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

  const handleFiles = (incomingFiles: FileList | File[]) => {
    const validFiles = Array.from(incomingFiles).filter((f) => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      alert("Por favor, selecciona imágenes válidas en formato PNG, JPG o JPEG.");
      return;
    }

    const newProcessedFiles: ProcessedFile[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: file,
      name: file.name,
      originalSize: file.size,
      originalUrl: URL.createObjectURL(file), 
      status: "pending",
      settings: { ...globalSettings }, 
    }));

    setFiles((prev) => [...prev, ...newProcessedFiles]);
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
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-colors">
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/50">
              <Settings2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-widest">Ajustes Rápidos</h2>
            </div>

            <div className="p-4 flex flex-col gap-5">
              {/* Optimización Rapida */}
              <div>
                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Nivel Visual</label>
                <div className="flex bg-zinc-100 rounded-md p-0.5 border border-zinc-200/50">
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 90}))} className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-[4px] border border-transparent hover:text-zinc-900 text-zinc-500 transition-all focus:bg-white focus:shadow-sm focus:border-zinc-200 focus:text-blue-600">Premium</button>
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 75}))} className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-[4px] border border-transparent hover:text-zinc-900 text-zinc-500 transition-all focus:bg-white focus:shadow-sm focus:border-zinc-200 focus:text-blue-600">Balance</button>
                  <button onClick={() => setGlobalSettings(s => ({...s, format: 'image/webp', quality: 50}))} className="flex-1 px-2 py-1.5 text-[11px] font-medium rounded-[4px] border border-transparent hover:text-zinc-900 text-zinc-500 transition-all focus:bg-white focus:shadow-sm focus:border-zinc-200 focus:text-blue-600">Ligero</button>
                </div>
              </div>

              {/* Controles de Formulario Densos */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 block">Formato de Salida</label>
                  <select 
                    value={globalSettings.format} onChange={e => setGlobalSettings(s => ({...s, format: e.target.value as any}))}
                    className="w-full bg-white border border-zinc-200 text-zinc-800 text-xs rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  >
                    <option value="image/webp">A WebP (Recomendado)</option>
                    <option value="image/jpeg">A JPEG (Clásico)</option>
                    <option value="image/png">A PNG (Transparente)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                      Calidad {globalSettings.format === 'image/png' && <span className="text-red-400 font-bold lowercase"> (No aplica a png)</span>}
                    </label>
                    <span className={`text-[10px] font-semibold bg-blue-50/50 px-1.5 rounded ${globalSettings.format === 'image/png' ? 'text-zinc-400' : 'text-blue-600'}`}>{globalSettings.quality}%</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" value={globalSettings.quality} onChange={e => setGlobalSettings(s => ({...s, quality: parseInt(e.target.value, 10)}))}
                    disabled={globalSettings.format === 'image/png'}
                    className={`w-full h-1 rounded-lg appearance-none ${globalSettings.format === 'image/png' ? 'bg-zinc-100 accent-zinc-300 cursor-not-allowed' : 'bg-zinc-200 accent-blue-600 cursor-pointer'}`}
                  />
                  {globalSettings.format === 'image/png' && <p className="text-[9px] text-zinc-400 mt-1">El formato PNG no usa compresión con pérdida. Para reducir su peso severamente, cambia la resolución o usa WebP.</p>}
                </div>

                <div>
                  <label className="text-[10px] font-semibold dark:text-zinc-400 text-zinc-500 uppercase tracking-widest mb-1.5 block">Tamaño Máximo</label>
                  <select 
                    value={globalSettings.resizeMode} onChange={e => setGlobalSettings(s => ({...s, resizeMode: e.target.value as any}))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-colors"
                  >
                    <option value="original">Org. Conservar tamaño</option>
                    <option value="1080p">HD Max 1920x1080</option>
                    <option value="720p">MD Max 1280x720</option>
                    <option value="custom">Personalizado</option>
                  </select>

                  {globalSettings.resizeMode === 'custom' && (
                    <div className="flex gap-2 mt-2">
                       <input type="number" placeholder="Ancho px" value={globalSettings.customWidth || ''} onChange={e => setGlobalSettings(s => ({...s, customWidth: Number(e.target.value)}))} className="w-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2 py-1.5 outline-none focus:border-blue-500" />
                       <input type="number" placeholder="Alto px" value={globalSettings.customHeight || ''} onChange={e => setGlobalSettings(s => ({...s, customHeight: Number(e.target.value)}))} className="w-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded-md px-2 py-1.5 outline-none focus:border-blue-500" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100">
                <button 
                  onClick={applyGlobalSettingsToAll}
                  className="w-full py-2 bg-white hover:bg-zinc-50 text-blue-600 font-bold text-xs rounded-md transition-all flex justify-center items-center gap-1.5 border border-zinc-200 shadow-sm"
                >
                  <ListRestart className="w-3.5 h-3.5" /> Aplicar a Sin Procesar
                </button>
              </div>
            </div>
          </div>

          {(pendingCount > 0) && (
            <button 
              onClick={processAllPending}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2 group border border-blue-700"
            >
              <Play className="w-4 h-4 fill-white" />
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
            className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-12 transition-all duration-300 cursor-pointer min-h-[400px]
              ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"}
            `}
          >
            <div className="w-14 h-14 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center justify-center bg-white dark:bg-zinc-800 mb-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <FileUp className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-1">Selecciona o arrastra imágenes aquí</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm text-center">
              Ahorra gigabytes enteros usando nuestros pipelines de optimización WebP locales. Sube decenas de fotos a la vez.
            </p>
            <button className="px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 border hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs rounded-md shadow-md transition-colors">
              Explorar Archivos
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            
            {/* Top Toolbar del listado */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm relative xl:sticky xl:top-[88px] z-20 w-full mb-2 transition-colors">
              <div className="flex items-center gap-3">
                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-medium text-xs rounded-md shadow-sm transition-colors flex items-center gap-2"
                 >
                   <Layers className="w-3.5 h-3.5" /> Añadir Más Fotos
                 </button>
                 <span className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold border-l border-zinc-200 dark:border-zinc-800 pl-3">
                   {doneCount} Completadas de {files.length} (Ahorro Total: {getTotalSavings()}%)
                 </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setFiles([])}
                  className="px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-700 font-bold text-xs rounded-md transition-all flex items-center gap-2"
                >
                  Vaciar Todo
                </button>
                <button 
                  onClick={downloadAllZip}
                  disabled={doneCount === 0 || isZipping}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 border border-emerald-600 text-white font-bold text-xs rounded-md transition-all flex items-center gap-2"
                >
                  {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
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
                         ) : (
                           isConverted && file.optimizedUrl ? (
                             <ImageCompareSlider beforeUrl={file.originalUrl} afterUrl={file.optimizedUrl} />
                           ) : (
                              <div className="w-full aspect-[4/3] rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center p-1 bg-[url('https://transparenttextures.com/patterns/cubes.png')] overflow-hidden shadow-inner">
                                 {/* eslint-disable-next-line @next/next/no-img-element */}
                                 <img src={file.originalUrl} className="max-w-full max-h-full object-contain drop-shadow-sm" alt="Original" />
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-zinc-100 pt-3 mt-auto gap-3 sm:gap-0">
                       {(!isConverted) ? (
                          <div className="text-[10px] text-zinc-500 font-bold bg-zinc-50 px-2 py-1 rounded border border-zinc-200 w-auto inline-block">Estado: Pendiente</div>
                       ) : (
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            {dangerB ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                            <span className={`text-[11px] font-bold ${dangerB ? 'text-amber-600' : 'text-zinc-900'} font-mono`}>{formatSize(file.optimizedSize!)}</span>
                            {!dangerB && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1 rounded">-{savings}%</span>}
                          </div>
                       )}

                       <div className="flex items-center gap-2">
                          {!isConverted ? (
                            <button onClick={() => processFile(file.id)} className="bg-white border border-zinc-200 hover:border-blue-500 text-zinc-800 hover:text-blue-600 hover:bg-blue-50 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all shadow-sm">Procesar Ahora</button>
                          ) : (
                            <>
                              <button onClick={() => updateFileSettings(file.id, {})} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all" title="Aplicar nuevos ajustes del panel">Refrescar</button>
                              <a href={file.optimizedUrl} download={`${file.name.substring(0, file.name.lastIndexOf('.')) || file.name}${file.settings.suffix}.${file.settings.format.split('/')[1]}`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
                                <Download className="w-3.5 h-3.5" /> Descargar
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
