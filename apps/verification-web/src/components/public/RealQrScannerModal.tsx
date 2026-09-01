import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Modal } from '../common/Modal';
import {
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Flashlight,
  SwitchCamera,
  X,
  FileImage,
  Sparkles,
} from 'lucide-react';

interface RealQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedToken: string) => void;
}

/**
 * Extracts the clean certificate token or identifier from a raw scanned string or URL.
 */
export function extractTokenFromScannedText(scannedText: string): string {
  const trimmed = scannedText.trim();
  if (!trimmed) return '';

  // 1. If scanned text is a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/verify/')) {
    try {
      const url = new URL(trimmed);
      // Query param: ?token=... or ?qr=...
      const tokenParam = url.searchParams.get('token') || url.searchParams.get('qr');
      if (tokenParam) return tokenParam.trim();

      // Path segments: /verify/qr/:token or /public/certificates/verify/:token or /v/:token
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const lastSegment = pathParts[pathParts.length - 1];
        if (lastSegment && lastSegment !== 'pdf' && lastSegment !== 'verify') {
          return lastSegment.trim();
        }
      }

      // Hash segments: #public?token=... or #/verify/:token
      if (url.hash) {
        const hash = url.hash;
        if (hash.includes('?')) {
          const hashParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
          const hToken = hashParams.get('token') || hashParams.get('qr');
          if (hToken) return hToken.trim();
        }
        if (hash.startsWith('#/verify/') || hash.startsWith('#verify/')) {
          return hash.replace(/^#\/verify\//, '').replace(/^#verify\//, '').trim();
        }
      }
    } catch {
      // Fall through to regex extraction
    }
  }

  // 2. Regex match for common certificate or token patterns
  const tokenMatch = trimmed.match(/(?:token=|qr=|\/v\/|\/qr\/)?([A-Za-z0-9_\-\.\:\/]+)/);
  if (tokenMatch && tokenMatch[1]) {
    return tokenMatch[1].trim();
  }

  return trimmed;
}

export const RealQrScannerModal: React.FC<RealQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isDecodingFile, setIsDecodingFile] = useState(false);
  const [fileDecodeError, setFileDecodeError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream & frame loop
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Frame scanning loop using canvas + jsQR
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameIdRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const extracted = extractTokenFromScannedText(code.data);
        if (extracted) {
          stopCamera();
          onScanSuccess(extracted);
          return;
        }
      }
    } catch (err) {
      // Continue next frame
    }

    animFrameIdRef.current = requestAnimationFrame(scanFrame);
  }, [onScanSuccess, stopCamera]);

  // Start live camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported in this browser. Please use the image upload option below.');
      }

      // Enumerate available video inputs
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      } catch {
        // Enumerate not critical
      }

      const constraints: MediaStreamConstraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        setIsCameraActive(true);
        animFrameIdRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.warn('Camera stream request failed:', err);
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings or upload a QR image.'
          : err instanceof Error && err.name === 'NotFoundError'
          ? 'No active camera hardware found on this device. Please upload a photo of the QR code.'
          : err instanceof Error
          ? err.message
          : 'Unable to start camera scanner.';
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, [scanFrame, selectedCameraId, stopCamera]);

  // Switch camera when requested
  const handleSwitchCamera = () => {
    if (availableCameras.length > 1) {
      const currentIndex = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
      const nextIndex = (currentIndex + 1) % availableCameras.length;
      setSelectedCameraId(availableCameras[nextIndex].deviceId);
    }
  };

  useEffect(() => {
    if (isOpen && activeMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, startCamera, stopCamera]);

  // Handle uploaded image file decoding
  const processImageFile = async (file: File) => {
    setIsDecodingFile(true);
    setFileDecodeError(null);

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            setIsDecodingFile(false);
            setFileDecodeError('Failed to initialize image decoder canvas.');
            return;
          }

          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          setIsDecodingFile(false);

          if (code && code.data) {
            const extracted = extractTokenFromScannedText(code.data);
            if (extracted) {
              onScanSuccess(extracted);
              return;
            }
          }

          setFileDecodeError(
            'Could not find a valid 2D QR code in this image. Please ensure the QR sticker is clear, unblurred, and well-lit.'
          );
        };

        img.onerror = () => {
          setIsDecodingFile(false);
          setFileDecodeError('Failed to load image file. Please try another file.');
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setIsDecodingFile(false);
        setFileDecodeError('Failed to read image file.');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setIsDecodingFile(false);
      setFileDecodeError(err instanceof Error ? err.message : 'Error decoding image file.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            break;
          }
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Real-Time QR Security Sticker Scanner"
      subtitle="Point camera at the metallic Legal Metrology QR sticker affixed to the scale"
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs" onPaste={handlePaste}>
        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
              setFileDecodeError(null);
            }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'camera'
                ? 'bg-white text-gov-navy shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-gov-blue" />
            <span>Live Camera Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('upload');
              stopCamera();
            }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'upload'
                ? 'bg-white text-gov-navy shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-gov-blue" />
            <span>Upload / Paste QR Image</span>
          </button>
        </div>

        {/* ── MODE 1: Live Video Camera Viewfinder ── */}
        {activeMode === 'camera' && (
          <div className="space-y-3">
            <div className="relative aspect-video sm:aspect-[4/3] rounded-2xl bg-slate-950 flex items-center justify-center overflow-hidden border-2 border-slate-800 shadow-inner">
              {/* Hidden off-screen canvas for frame extraction */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Target & Laser Scanning Animation */}
              {isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-56 border-2 border-amber-400/80 rounded-2xl bg-white/5 backdrop-blur-[1px] shadow-2xl overflow-hidden">
                    {/* Glowing Laser Scan Bar */}
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b] animate-bounce duration-1000" />

                    {/* Corner Target Markers */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />
                  </div>
                  <div className="mt-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 font-semibold text-[11px] border border-white/10">
                    Align QR sticker inside square to auto-verify
                  </div>
                </div>
              )}

              {/* Fallback error if camera blocked */}
              {cameraError && (
                <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-900/95 text-white space-y-3">
                  <AlertCircle className="w-10 h-10 text-rose-500" />
                  <div className="space-y-1 max-w-sm">
                    <h4 className="font-bold text-sm text-white">Camera Access Restricted</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-gov-blue hover:bg-blue-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('upload')}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Upload File Instead
                    </button>
                  </div>
                </div>
              )}

              {/* Top Controls Overlay */}
              {isCameraActive && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  {availableCameras.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-sm cursor-pointer"
                      title="Switch Camera (Front/Rear)"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              The camera continuously analyzes video frames using native hardware QR decoding and jsQR algorithms.
            </p>
          </div>
        )}

        {/* ── MODE 2: Upload or Drag & Drop Image File ── */}
        {activeMode === 'upload' && (
          <div className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-gov-blue rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-blue-50/30 transition-all cursor-pointer space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-blue-100 text-gov-blue mx-auto flex items-center justify-center">
                {isDecodingFile ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <FileImage className="w-6 h-6" />
                )}
              </div>

              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {isDecodingFile ? 'Decoding QR Code Pixels...' : 'Click to Upload QR Photo or Drag & Drop'}
                </span>
                <p className="text-slate-500 text-xs mt-1">
                  Supports PNG, JPG, JPEG, WEBP or Paste from Clipboard (<kbd className="font-mono bg-slate-200 px-1 rounded">Ctrl+V</kbd>)
                </p>
              </div>
            </div>

            {fileDecodeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{fileDecodeError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[11px] space-y-1">
              <strong className="block font-bold">Photo Verification Tips:</strong>
              <p className="text-slate-700">
                Ensure the QR code sticker on the scale is photographed straight-on with adequate lighting and zero glare.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Section 24 Public Anti-Cloning Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </Modal>
  );
};
