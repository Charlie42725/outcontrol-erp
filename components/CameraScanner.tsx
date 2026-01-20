'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

interface CameraScannerProps {
    isOpen: boolean
    onClose: () => void
    onScan: (code: string) => void
}

export default function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
    const [error, setError] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
    const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const scanCooldownRef = useRef<boolean>(false)

    useEffect(() => {
        if (isOpen && !scannerRef.current) {
            initScanner()
        }

        return () => {
            stopScanner()
        }
    }, [isOpen])

    // 清除訊息
    useEffect(() => {
        if (scanMessage) {
            const timer = setTimeout(() => {
                setScanMessage(null)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [scanMessage])

    const initScanner = async () => {
        try {
            setError(null)
            setLastScannedCode(null)
            setScanMessage(null)

            // Wait for DOM to be ready
            await new Promise(resolve => setTimeout(resolve, 150))

            if (!containerRef.current) return

            const scannerId = 'camera-scanner-region'

            // Create scanner instance with more formats
            scannerRef.current = new Html5Qrcode(scannerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.CODABAR,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                ],
                verbose: false,
            })

            // Start scanning with optimized settings
            await scannerRef.current.start(
                { facingMode: 'environment' }, // 後置鏡頭
                {
                    fps: 15, // 提高掃描頻率
                    qrbox: { width: 280, height: 180 }, // 加大掃描框
                    aspectRatio: 1.777, // 16:9
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
            } else if (err.message?.includes('already scanning')) {
                // Already scanning, ignore
                setIsScanning(true)
            } else {
                setError(`無法啟動相機：${err.message || '未知錯誤'}`)
            }
        }
    }

    const handleScanSuccess = useCallback((code: string) => {
        // 防止短時間內重複掃描同一個條碼
        if (scanCooldownRef.current) return
        if (lastScannedCode === code) return

        // 設定冷卻期 (1秒)
        scanCooldownRef.current = true
        setTimeout(() => {
            scanCooldownRef.current = false
        }, 1000)

        setLastScannedCode(code)

        // 震動反饋（如果支援）
        if (navigator.vibrate) {
            navigator.vibrate(100)
        }

        // 回傳掃描結果 - 不自動關閉，讓父組件處理
        onScan(code)
    }, [lastScannedCode, onScan])

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

    // 手動輸入條碼
    const [manualInput, setManualInput] = useState('')
    const handleManualSubmit = () => {
        if (manualInput.trim()) {
            onScan(manualInput.trim())
            setManualInput('')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="relative w-full max-w-md mx-4 bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">
                        📷 相機掃描
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scanner Area */}
                <div ref={containerRef} className="relative bg-black">
                    <div id="camera-scanner-region" className="w-full" style={{ minHeight: '320px' }} />

                    {/* Scanning indicator overlay */}
                    {isScanning && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-72 h-44 border-2 border-green-400 rounded-lg relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />

                                {/* Scanning line animation */}
                                <div className="absolute left-2 right-2 h-0.5 bg-green-400 animate-scan-line" />
                            </div>
                        </div>
                    )}

                    {/* 掃描結果訊息 */}
                    {scanMessage && (
                        <div className={`absolute bottom-4 left-4 right-4 p-3 rounded-lg text-center ${scanMessage.type === 'success'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}>
                            {scanMessage.text}
                        </div>
                    )}
                </div>

                {/* 最後掃描的條碼 */}
                {lastScannedCode && (
                    <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="text-xs text-slate-400">最近掃描：</div>
                        <div className="text-sm font-mono text-white">{lastScannedCode}</div>
                    </div>
                )}

                {/* Status / Error */}
                <div className="p-4">
                    {error ? (
                        <div className="text-center">
                            <p className="text-red-400 font-medium mb-3">{error}</p>
                            <button
                                onClick={initScanner}
                                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                            >
                                重試
                            </button>
                        </div>
                    ) : isScanning ? (
                        <div className="text-center text-slate-400 text-sm">
                            將條碼對準框內，自動識別
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            正在啟動相機...
                        </div>
                    )}

                    {/* 手動輸入區 */}
                    {isScanning && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="text-xs text-slate-400 mb-2">掃不到？手動輸入條碼：</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleManualSubmit()
                                    }}
                                    placeholder="輸入條碼..."
                                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleManualSubmit}
                                    disabled={!manualInput.trim()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                                >
                                    確認
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CSS for scan line animation */}
            <style jsx global>{`
                @keyframes scan-line {
                    0% { top: 0; }
                    50% { top: calc(100% - 2px); }
                    100% { top: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    )
}
