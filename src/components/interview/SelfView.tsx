import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CameraOff } from "lucide-react";

interface SelfViewProps {
  selectedCameraId?: string;
  className?: string;
}

export function SelfView({ selectedCameraId, className = "" }: SelfViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      try {
        setHasError(false);
        
        // Stop existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: selectedCameraId 
            ? { deviceId: { exact: selectedCameraId } }
            : true,
          audio: false
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!mounted) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (error) {
        console.error("Failed to access camera:", error);
        if (mounted) {
          setHasError(true);
          setStream(null);
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedCameraId]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <motion.div
      className={`
        fixed bottom-4 right-4 z-50
        w-48 md:w-56 lg:w-64
        bg-card border border-border rounded-lg shadow-lg overflow-hidden
        ${className}
      `}
      initial={{ opacity: 0, scale: 0.8, x: 20, y: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      {/* Header */}
      <div className="bg-muted/50 px-3 py-2 border-b border-border">
        <div className="flex items-center space-x-2">
          <Camera className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">You</span>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative aspect-video bg-muted">
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
            <CameraOff className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center px-2">
              Camera unavailable
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedMetadata={() => {
                // Ensure video plays when metadata is loaded
                if (videoRef.current) {
                  videoRef.current.play().catch(console.error);
                }
              }}
            />
            
            {/* Recording indicator */}
            <div className="absolute top-2 left-2">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-xs text-white font-medium px-1 bg-black/50 rounded">
                  Preview
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Touch area for mobile - makes it easier to tap on small screens */}
      <div className="absolute inset-0 md:hidden" />
    </motion.div>
  );
}