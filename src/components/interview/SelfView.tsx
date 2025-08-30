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
    <div
      className={`w-full h-full bg-gray-900 rounded-lg overflow-hidden ${className}`}
    >
      {/* Video Container */}
      <div className="relative w-full h-full bg-gray-900">
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
            <CameraOff className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground text-center px-2">
              Camera unavailable
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}