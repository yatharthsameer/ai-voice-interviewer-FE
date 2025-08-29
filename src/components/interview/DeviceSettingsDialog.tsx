import React, { useState, useEffect } from 'react';
import { Camera, Mic, Volume2, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

interface DeviceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVideoStream?: MediaStream | null;
  onDeviceChange?: (videoStream: MediaStream) => void;
}

export default function DeviceSettingsDialog({
  open,
  onOpenChange,
  currentVideoStream,
  onDeviceChange
}: DeviceSettingsDialogProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Get available devices
  const getDevices = async () => {
    try {
      setIsLoading(true);
      
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const deviceInfo: DeviceInfo[] = deviceList.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        kind: device.kind
      }));
      
      setDevices(deviceInfo);
      
      // Set current devices as selected
      if (currentVideoStream) {
        const videoTrack = currentVideoStream.getVideoTracks()[0];
        const audioTrack = currentVideoStream.getAudioTracks()[0];
        
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.deviceId) {
            setSelectedCamera(settings.deviceId);
          }
        }
        
        if (audioTrack) {
          const settings = audioTrack.getSettings();
          if (settings.deviceId) {
            setSelectedMicrophone(settings.deviceId);
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to get devices:', error);
      toast({
        title: 'Device Access Error',
        description: 'Failed to access media devices. Please check permissions.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply device changes
  const applyChanges = async () => {
    try {
      setIsLoading(true);
      
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
        audio: selectedMicrophone ? { deviceId: { exact: selectedMicrophone } } : true
      };
      
      // Stop current stream
      if (currentVideoStream) {
        currentVideoStream.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream with selected devices
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Notify parent component
      if (onDeviceChange) {
        onDeviceChange(newStream);
      }
      
      toast({
        title: 'Settings Applied',
        description: 'Device settings have been updated successfully.',
      });
      
      onOpenChange(false);
      
    } catch (error) {
      console.error('Failed to apply device changes:', error);
      toast({
        title: 'Settings Error',
        description: 'Failed to apply device settings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load devices when dialog opens
  useEffect(() => {
    if (open) {
      getDevices();
    }
  }, [open]);

  const cameras = devices.filter(d => d.kind === 'videoinput');
  const microphones = devices.filter(d => d.kind === 'audioinput');
  const speakers = devices.filter(d => d.kind === 'audiooutput');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Device Settings
          </DialogTitle>
          <DialogDescription>
            Select your preferred camera, microphone, and speaker devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Camera Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Camera
            </Label>
            <Select
              value={selectedCamera}
              onValueChange={setSelectedCamera}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map(camera => (
                  <SelectItem key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Microphone Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Microphone
            </Label>
            <Select
              value={selectedMicrophone}
              onValueChange={setSelectedMicrophone}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {microphones.map(mic => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId}>
                    {mic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Speaker Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Speaker
            </Label>
            <Select
              value={selectedSpeaker}
              onValueChange={setSelectedSpeaker}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select speaker" />
              </SelectTrigger>
              <SelectContent>
                {speakers.length > 0 ? (
                  speakers.map(speaker => (
                    <SelectItem key={speaker.deviceId} value={speaker.deviceId}>
                      {speaker.label}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="default" disabled>
                    Default Speaker (Browser controlled)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={getDevices}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Devices
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={applyChanges}
              disabled={isLoading || !selectedCamera || !selectedMicrophone}
            >
              {isLoading ? 'Applying...' : 'Apply Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
