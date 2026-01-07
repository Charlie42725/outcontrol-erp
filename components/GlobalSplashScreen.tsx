'use client'

import { useEffect, useState } from 'react'
import SplashScreen from './SplashScreen'

type GlobalSplashScreenProps = {
  children: React.ReactNode
  showOnEveryVisit?: boolean // true = 每次都顯示，false = 只顯示一次
}

export default function GlobalSplashScreen({
  children,
  showOnEveryVisit = true // 預設每次都顯示（客戶覺得厲害）
}: GlobalSplashScreenProps) {
  const [showSplash, setShowSplash] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (showOnEveryVisit) {
      // 每次訪問都顯示
      setShowSplash(true)
      setIsChecking(false)
    } else {
      // 只在首次訪問顯示
      const hasVisited = sessionStorage.getItem('hasVisited')
      if (!hasVisited) {
        setShowSplash(true)
        sessionStorage.setItem('hasVisited', 'true')
      }
      setIsChecking(false)
    }
  }, [showOnEveryVisit])

  const handleFinish = () => {
    setShowSplash(false)
  }

  // 等待檢查完成
  if (isChecking) {
    return null
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleFinish} />}
      <div className={showSplash ? 'invisible' : 'visible'}>
        {children}
      </div>
    </>
  )
}
