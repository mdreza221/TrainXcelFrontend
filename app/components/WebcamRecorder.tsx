import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, Video, UploadCloud, X } from 'lucide-react';

export function WebcamRecorder({ onUpload, onCancel }: { onUpload: (file: File) => void, onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not access camera/microphone. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleStartRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks(prev => [...prev, event.data]);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    };

    setRecordedChunks([]);
    mediaRecorder.start(100);
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setVideoUrl(null);
    setRecordedChunks([]);
    startCamera();
  };

  const handleSubmit = () => {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const file = new File([blob], `recorded-video-${Date.now()}.webm`, { type: 'video/webm' });
    onUpload(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800">
          <h3 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Camera size={18} /> Record Video Response
          </h3>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-black aspect-video flex items-center justify-center flex-1 min-h-0">
          {error ? (
            <p className="text-rose-500 font-semibold p-4 text-center">{error}</p>
          ) : videoUrl ? (
            <video src={videoUrl} controls className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-contain ${isRecording ? 'border-4 border-red-500' : ''}`} />
          )}
          {isRecording && (
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-pulse shadow-lg">
              <div className="w-2 h-2 rounded-full bg-white" /> Recording...
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 flex justify-center gap-4">
          {!videoUrl ? (
            isRecording ? (
              <button onClick={handleStopRecording} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-md">
                <Square size={16} fill="currentColor" /> Stop
              </button>
            ) : (
              <button onClick={handleStartRecording} disabled={!!error} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-md disabled:opacity-50">
                <Video size={16} /> Start Recording
              </button>
            )
          ) : (
            <>
              <button onClick={handleRetake} className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 font-bold py-2.5 px-6 rounded-xl transition">
                Retake
              </button>
              <button onClick={handleSubmit} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-md">
                <UploadCloud size={16} /> Use Video
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
