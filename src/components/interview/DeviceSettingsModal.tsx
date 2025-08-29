import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Mic, Speaker, Play, Volume2, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput" | "audiooutput";
}

interface DeviceSettingsModalProps {
  onCameraChange?: (deviceId: string) => void;
  onMicrophoneChange?: (deviceId: string) => void;
  onSpeakerChange?: (deviceId: string) => void;
  children?: React.ReactNode;
}

export function DeviceSettingsModal({
  onCameraChange,
  onMicrophoneChange,
  onSpeakerChange,
  children
}: DeviceSettingsModalProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingSpeaker, setIsTestingSpeaker] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Load saved device preferences
  useEffect(() => {
    const savedCamera = localStorage.getItem("selectedCamera");
    const savedMic = localStorage.getItem("selectedMic");
    const savedSpeaker = localStorage.getItem("selectedSpeaker");
    
    if (savedCamera) setSelectedCamera(savedCamera);
    if (savedMic) setSelectedMic(savedMic);
    if (savedSpeaker) setSelectedSpeaker(savedSpeaker);
  }, []);

  // Enumerate devices when modal opens
  useEffect(() => {
    if (isOpen) {
      enumerateDevices();
    } else {
      cleanup();
    }
  }, [isOpen]);

  // Update camera preview when selection changes
  useEffect(() => {
    if (isOpen && selectedCamera) {
      updateCameraPreview();
    }
  }, [selectedCamera, isOpen]);

  const cleanup = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsTestingMic(false);
    setMicLevel(0);
  };

  const enumerateDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const processedDevices: DeviceInfo[] = deviceList
        .filter(device => device.deviceId && device.label)
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} ${device.deviceId.slice(-4)}`,
          kind: device.kind as DeviceInfo["kind"],
        }));

      setDevices(processedDevices);

      // Set defaults if not already selected
      const cameras = processedDevices.filter(d => d.kind === "videoinput");
      const mics = processedDevices.filter(d => d.kind === "audioinput");
      const speakers = processedDevices.filter(d => d.kind === "audiooutput");

      if (!selectedCamera && cameras.length > 0) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (!selectedMic && mics.length > 0) {
        setSelectedMic(mics[0].deviceId);
      }
      if (!selectedSpeaker && speakers.length > 0) {
        setSelectedSpeaker(speakers[0].deviceId);
      }

    } catch (error) {
      console.error("Failed to enumerate devices:", error);
      toast({
        title: "Device Access Error",
        description: "Please allow camera and microphone access to configure devices.",
        variant: "destructive",
      });
    }
  };

  const updateCameraPreview = async () => {
    try {
      if (previewStream) {
        previewStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCamera } },
        audio: false,
      });

      setPreviewStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to update camera preview:", error);
      toast({
        title: "Camera Error",
        description: "Failed to access the selected camera.",
        variant: "destructive",
      });
    }
  };

  const testMicrophone = async () => {
    if (isTestingMic) {
      setIsTestingMic(false);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setMicLevel(0);
      return;
    }

    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedMic } },
        video: false,
      });

      micStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMicLevel = () => {
        if (!isTestingMic) return;
        
        analyserRef.current?.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setMicLevel(Math.min(100, (average / 128) * 100));
        requestAnimationFrame(updateMicLevel);
      };

      updateMicLevel();

    } catch (error) {
      console.error("Failed to test microphone:", error);
      setIsTestingMic(false);
      toast({
        title: "Microphone Error",
        description: "Failed to access the selected microphone.",
        variant: "destructive",
      });
    }
  };

  const testSpeaker = async () => {
    setIsTestingSpeaker(true);
    
    try {
      if (!testAudioRef.current) {
        testAudioRef.current = new Audio('/api/test-sound.mp3'); // You can use a data URL or create a tone
      }

      // Use setSinkId if supported
      if ('setSinkId' in testAudioRef.current && selectedSpeaker) {
        try {
          await (testAudioRef.current as any).setSinkId(selectedSpeaker);
        } catch (error) {
          console.warn("setSinkId not supported or failed:", error);
        }
      }

      // Fallback: Create a test tone
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440; // A4 note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);

      setTimeout(() => {
        setIsTestingSpeaker(false);
        audioContext.close();
      }, 1000);

      toast({
        title: "Test Sound Played",
        description: "Did you hear the test sound?",
      });

    } catch (error) {
      console.error("Failed to test speaker:", error);
      setIsTestingSpeaker(false);
      toast({
        title: "Speaker Error",
        description: "Failed to play test sound.",
        variant: "destructive",
      });
    }
  };

  const applySettings = () => {
    // Save to localStorage
    localStorage.setItem("selectedCamera", selectedCamera);
    localStorage.setItem("selectedMic", selectedMic);
    localStorage.setItem("selectedSpeaker", selectedSpeaker);

    // Notify parent components
    onCameraChange?.(selectedCamera);
    onMicrophoneChange?.(selectedMic);
    onSpeakerChange?.(selectedSpeaker);

    setIsOpen(false);
    
    toast({
      title: "Settings Applied",
      description: "Device settings have been updated.",
    });
  };

  const cameras = devices.filter(d => d.kind === "videoinput");
  const microphones = devices.filter(d => d.kind === "audioinput");
  const speakers = devices.filter(d => d.kind === "audiooutput");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Device Settings</DialogTitle>
          <DialogDescription>
            Configure your camera, microphone, and speaker settings for the interview.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Camera Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-medium">Camera</h3>
            </div>
            
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Camera Preview */}
            {selectedCamera && (
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden max-w-md">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Microphone Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Mic className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-medium">Microphone</h3>
            </div>
            
            <div className="flex items-center space-x-3">
              <Select value={selectedMic} onValueChange={setSelectedMic}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={testMicrophone}
                className={isTestingMic ? "bg-brand text-brand-foreground" : ""}
              >
                {isTestingMic ? "Stop" : "Test"}
              </Button>
            </div>

            {/* Microphone Level */}
            {isTestingMic && (
              <div className="flex items-center space-x-3">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand"
                    style={{ width: `${micLevel}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10 text-right">
                  {Math.round(micLevel)}%
                </span>
              </div>
            )}
          </div>

          {/* Speaker Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Speaker className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-medium">Speaker</h3>
            </div>
            
            <div className="flex items-center space-x-3">
              <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent>
                  {speakers.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={testSpeaker}
                disabled={isTestingSpeaker}
              >
                {isTestingSpeaker ? (
                  <>
                    <Play className="w-3 h-3 mr-1 animate-pulse" />
                    Playing
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Test
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Apply Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applySettings}>
              Apply Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}