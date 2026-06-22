import { useMedia } from '../context/MediaContext';

export default function DeviceSettingsModal({ isOpen, onClose }) {
  const {
    devices,
    selectedAudioDevice,
    selectedVideoDevice,
    selectAudioDevice,
    selectVideoDevice,
  } = useMedia();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-2xl glass-strong border border-white/20 dark:border-white/10 text-gray-900 dark:text-gray-100 shadow-2xl animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Device Settings</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Audio Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Microphone
            </label>
            <select
              value={selectedAudioDevice}
              onChange={(e) => selectAudioDevice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              <option value="">Default Microphone</option>
              {devices.audioinput.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>

          {/* Video Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Camera
            </label>
            <select
              value={selectedVideoDevice}
              onChange={(e) => selectVideoDevice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              <option value="">Default Camera</option>
              {devices.videoinput.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-primary w-full mt-8"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}
