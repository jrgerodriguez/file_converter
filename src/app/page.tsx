import ImageConverter from '@/components/ImageConverter'
import { ThemeToggle } from '@/components/ThemeToggle'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col items-center pb-20 transition-colors relative overflow-hidden">
      
      {/* Apple macOS Acrylic Header */}
      <header className="w-full bg-white/70 dark:bg-[#1d1d1f]/70 backdrop-blur-3xl border-b border-black/5 dark:border-white/10 sticky top-0 z-50 transition-colors shadow-sm dark:shadow-none">
        <div className="max-w-[1800px] w-full mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <Image src="/fileoptimizer.png" alt="FileOptimizer Logo" width={32} height={32} className="rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] group-hover:scale-105 transition-transform" />
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              File<span className="text-[#0066cc] dark:text-[#2997ff]">Optimizer</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-10 py-12">
        <div className="mb-10 text-center lg:text-left flex flex-col items-center lg:items-start">
          <h2 className="text-4xl lg:text-[44px] font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] pb-2 leading-tight">Conversión Masiva Dinámica.</h2>
          <p className="text-base lg:text-[19px] font-medium text-[#86868b] dark:text-[#86868b] mt-2 max-w-2xl leading-relaxed">
            Comprime decenas de imágenes simultáneamente directo en tu navegador. Incluyendo HEIC nativo.
          </p>
        </div>

        <ImageConverter />
      </div>
    </main>
  )
}
