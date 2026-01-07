'use client'

import { useEffect, useState } from 'react'

type SplashScreenProps = {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // Stage 0 (0-800ms): Logo 出現
    const timer1 = setTimeout(() => setStage(1), 800)

    // Stage 1 (800-2000ms): 文字 + 進度條
    const timer2 = setTimeout(() => setStage(2), 2000)

    // Stage 2 (2000-3200ms): 淡出
    const timer3 = setTimeout(() => onFinish(), 3200)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [onFinish])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950">
      {/* 背景粒子效果 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="splash-blob splash-blob-1" />
        <div className="splash-blob splash-blob-2" />
        <div className="splash-blob splash-blob-3" />
      </div>

      {/* 主要內容 */}
      <div
        className={`relative z-10 text-center transition-all duration-1000 ${
          stage >= 2 ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Logo 容器 */}
        <div
          className={`mb-8 flex justify-center transition-all duration-1000 ${
            stage >= 0 ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 -rotate-12'
          }`}
        >
          <div className="relative">
            {/* Logo 外發光 */}
            <div className="absolute -inset-8 animate-pulse rounded-full bg-gradient-to-r from-yellow-400/30 via-orange-400/30 to-yellow-400/30 blur-3xl" />

            {/* Logo 圖片（直接顯示，不加白底） */}
            <div className="relative">
              <img
                src="/logo.jpg"
                alt="失控事務所"
                width={280}
                height={280}
                className="rounded-2xl shadow-2xl drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* 文字動畫 */}
        <div
          className={`mb-8 transition-all duration-1000 delay-300 ${
            stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <h1 className="mb-2 bg-gradient-to-r from-yellow-200 via-white to-yellow-200 bg-clip-text text-5xl font-bold text-transparent drop-shadow-lg">
            失控事務所
          </h1>
          <p className="text-xl font-medium text-yellow-100 drop-shadow-md">GK · 盲盒 · 一番賞 · ERP 系統</p>
        </div>

        {/* 進度條 */}
        <div
          className={`mx-auto w-64 transition-all duration-500 delay-500 ${
            stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
            <div
              className={`h-full bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 transition-all duration-[2800ms] ease-out ${
                stage >= 1 ? 'w-full' : 'w-0'
              }`}
              style={{ boxShadow: '0 0 20px rgba(250, 204, 21, 0.6)' }}
            />
          </div>
        </div>

        {/* 裝飾光點 */}
        <div className="absolute -top-20 left-1/2 h-2 w-2 -translate-x-1/2 animate-ping rounded-full bg-yellow-300" />
        <div className="absolute -bottom-20 left-1/4 h-2 w-2 animate-ping rounded-full bg-yellow-300 delay-300" />
        <div className="absolute -bottom-20 right-1/4 h-2 w-2 animate-ping rounded-full bg-yellow-300 delay-700" />
      </div>
    </div>
  )
}
