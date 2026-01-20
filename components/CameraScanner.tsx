'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

interface CameraScannerProps {
    isOpen: boolean
    onClose: () => void
    onScan: (code: string) => void
}

export default function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
    const [error, setError] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isOpen && !scannerRef.current) {
            initScanner()
        }

        return () => {
            stopScanner()
        }
    }, [isOpen])

    const initScanner = async () => {
        try {
            setError(null)

            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 100))

            if (!containerRef.current) return

            const scannerId = 'camera-scanner-region'

            // Create scanner instance
            scannerRef.current = new Html5Qrcode(scannerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.QR_CODE,
                ],
                verbose: false,
            })

            // Start scanning
            await scannerRef.current.start(
                { facingMode: 'environment' }, // 後置鏡頭
                {
                    fps: 10,
                    qrbox: { width: 250, height: 150 },
                },
                (decodedText) => {
                    // 掃描成功
                    handleScanSuccess(decodedText)
                },
                () => {
                    // 掃描中，忽略未識別的幀
                }
            )

            setIsScanning(true)
        } catch (err: any) {
            console.error('Camera scanner error:', err)
            if (err.name === 'NotAllowedError') {
                setError('請允許相機權限以使用掃描功能')
            } else if (err.name === 'NotFoundError') {
                setError('找不到相機設備')
            } else {
                setError(`無法啟動相機：${err.message || '未知錯誤'}`)
            }
        }
    }

    const handleScanSuccess = (code: string) => {
        // 震動反饋（如果支援）
        if (navigator.vibrate) {
            navigator.vibrate(100)
        }

        // 回傳掃描結果
        onScan(code)

        // 關閉掃描器
        handleClose()
    }

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (isScanning) {
                    await scannerRef.current.stop()
                }
                scannerRef.current.clear()
            } catch (err) {
                console.error('Error stopping scanner:', err)
            }
            scannerRef.current = null
            setIsScanning(false)
        }
    }

    const handleClose = async () => {
        await stopScanner()
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        📷 相機掃描
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scanner Area */}
                <div ref={containerRef} className="relative bg-black">
                    <div id="camera-scanner-region" className="w-full" style={{ minHeight: '300px' }} />

                    {/* Scanning indicator overlay */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-40 border-2 border-green-400 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />

                                {/* Scanning line animation */}
                                <div className="absolute left-2 right-2 h-0.5 bg-green-400 animate-scan-line" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Status / Error */}
                <div className="p-4 text-center">
                    {error ? (
                        <div className="text-red-500 dark:text-red-400">
                            <p className="font-medium">{error}</p>
                            <button
                                onClick={initScanner}
                                className="mt-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                重試
                            </button>
                        </div>
                    ) : isScanning ? (
                        <p className="text-gray-600 dark:text-gray-400">
                            將條碼對準框內進行掃描
                        </p>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            正在啟動相機...
                        </div>
                    )}
                </div>
            </div>

            {/* CSS for scan line animation */}
            <style jsx global>{`
        @keyframes scan-line {
          0% {
            top: 0;
          }
          50% {
            top: calc(100% - 2px);
          }
          100% {
            top: 0;
          }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}</style>
        </div>
    )
}
