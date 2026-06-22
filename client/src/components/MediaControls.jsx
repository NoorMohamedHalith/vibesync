import { useState } from 'react';
import { useMedia } from '../context/MediaContext';
import DeviceSettingsModal from './DeviceSettingsModal';

export default function MediaControls() {
  const {
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  } = useMedia();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleJoin = async () => {
    try {
      await joinCall(false); // start with audio only, user can toggle video later
    } catch (e) {
      console.error('Call join failed:', e);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl glass border border-white/20 dark:border-white/5 shadow-lg">
      {!isInCall ? (
        <button
          onClick={handleJoin}
          className="btn-primary !py-2.5 !px-5 flex items-center gap-2"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Join Call
        </button>
      ) : (
        <>
          {/* Mute/Unmute Mic */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-xl backdrop-blur-md transition-all duration-200 border ${
              isAudioEnabled
                ? 'bg-brand-500/10 hover:bg-brand-500/25 border-brand-500/30 text-brand-600 dark:text-brand-400'
                : 'bg-red-500/10 hover:bg-red-500/25 border-red-500/30 text-red-600 dark:text-red-400'
            }`}
            title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
          >
            {isAudioEnabled ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
              </svg>
            )}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-xl backdrop-blur-md transition-all duration-200 border ${
              isVideoEnabled
                ? 'bg-brand-500/10 hover:bg-brand-500/25 border-brand-500/30 text-brand-600 dark:text-brand-400'
                : 'bg-red-500/10 hover:bg-red-500/25 border-red-500/30 text-red-600 dark:text-red-400'
            }`}
            title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoEnabled ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
              </svg>
            )}
          </button>

          {/* Toggle Screen Share */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`p-3 rounded-xl backdrop-blur-md transition-all duration-200 border ${
              isScreenSharing
                ? 'bg-neon-blue/10 hover:bg-neon-blue/25 border-neon-blue/30 text-neon-blue'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border-transparent text-gray-700 dark:text-gray-300'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Device Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 rounded-xl backdrop-blur-md transition-all duration-200 border border-transparent bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-gray-700 dark:text-gray-300"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Leave Call */}
          <button
            onClick={leaveCall}
            className="p-3 rounded-xl border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5 transition-all duration-200 ml-auto"
            title="Leave Call"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline text-sm">Leave Call</span>
          </button>
        </>
      )}

      {/* Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
