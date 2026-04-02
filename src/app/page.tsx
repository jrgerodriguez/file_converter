import ImageConverter from '@/components/ImageConverter'
import { ThemeToggle } from '@/components/ThemeToggle'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-zinc-900 flex flex-col items-center pb-20 transition-colors">
      {/* SaaS Style Header */}
      <header className="w-full bg-white dark:bg-[#1f1f22] border-b border-zinc-200/80 dark:border-zinc-800 sticky top-0 z-50 transition-colors shadow-sm dark:shadow-none">
        <div className="max-w-[1800px] w-full mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/fileoptimizer.png" alt="FileOptimizer Logo" width={32} height={32} className="rounded-lg shadow-md" />
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              File<span className="text-blue-600">Optimizer</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="w-full max-w-[1800px] mx-auto px-6 lg:px-10 py-10">
        <div className="mb-10">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Conversión por Lotes</h2>
          <p className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 mt-2.5 max-w-2xl leading-relaxed">
            Convierte, redimensiona y comprime decenas de imágenes simultáneamente en tu navegador. 100% Seguro. Tus archivos jamás son subidos a Internet.
          </p>
        </div>

        <ImageConverter />
      </div>
    </main>
  )
}
