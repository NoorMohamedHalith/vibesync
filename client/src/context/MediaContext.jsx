import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

const MediaContext = createContext(undefined);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export function MediaProvider({ children, socket, roomId, username }) {
  // Local state
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [pinnedPeer, setPinnedPeer] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [sharedFiles, setSharedFiles] = useState([]);

  // Refs
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> { pc: RTCPeerConnection, username }
  const pendingCandidatesRef = useRef(new Map()); // peerId -> ICECandidate[]

  // --- Device Enumeration ---
  const enumerateDevices = useCallback(async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const grouped = { audioinput: [], videoinput: [], audiooutput: [] };
      deviceList.forEach((d) => {
        if (grouped[d.kind]) {
          grouped[d.kind].push({ deviceId: d.deviceId, label: d.label || `${d.kind} ${grouped[d.kind].length + 1}` });
        }
      });
      setDevices(grouped);
    } catch (err) {
      console.error('[VibeSync] Device enumeration failed:', err);
    }
  }, []);

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
  }, [enumerateDevices]);

  // --- Peer Connection Helpers ---
  const createPeerConnection = useCallback((peerId, peerUsername) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          roomId,
          targetId: peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerId) || {};
          next.set(peerId, { ...existing, stream, username: peerUsername });
          return next;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        removePeer(peerId);
      }
    };

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add screen share track if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStreamRef.current);
      });
    }

    peersRef.current.set(peerId, { pc, username: peerUsername });
    return pc;
  }, [socket, roomId]);

  const removePeer = useCallback((peerId) => {
    const peerData = peersRef.current.get(peerId);
    if (peerData) {
      peerData.pc.close();
      peersRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    if (pinnedPeer === peerId) setPinnedPeer(null);
  }, [pinnedPeer]);

  const flushCandidates = useCallback(async (peerId) => {
    const candidates = pendingCandidatesRef.current.get(peerId) || [];
    const peerData = peersRef.current.get(peerId);
    if (!peerData) return;
    for (const candidate of candidates) {
      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) { /* ignore */ }
    }
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  const renegotiatePeer = useCallback(async (peerId, pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socket) {
        socket.emit('webrtc-offer', {
          roomId,
          targetId: peerId,
          sdp: pc.localDescription,
        });
      }
    } catch (err) {
      console.error('[VibeSync] Renegotiation failed for peer:', peerId, err);
    }
  }, [socket, roomId]);

  // --- Get Local Media ---
  const getLocalStream = useCallback(async (audio = true, video = false) => {
    try {
      const constraints = {
        audio: audio ? {
          deviceId: selectedAudioDevice ? { exact: selectedAudioDevice } : undefined,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        } : false,
        video: video ? {
          deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (!audio) {
        stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      }

      setIsAudioEnabled(audio);
      setIsVideoEnabled(video);
      await enumerateDevices();
      return stream;
    } catch (err) {
      console.error('[VibeSync] getUserMedia failed:', err);
      throw err;
    }
  }, [selectedAudioDevice, selectedVideoDevice, enumerateDevices]);

  // --- Join / Leave Call ---
  const joinCall = useCallback(async (withVideo = false) => {
    try {
      // Receiver standby join: do not getUserMedia on mount to prevent permission blocks.
      setIsInCall(true);
      if (socket) {
        socket.emit('webrtc-join', { roomId, username });
      }
    } catch (err) {
      console.error('[VibeSync] Join call failed:', err);
      throw err;
    }
  }, [socket, roomId, username]);

  const leaveCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    peersRef.current.forEach(({ pc }) => pc.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();

    setRemoteStreams(new Map());
    setIsInCall(false);
    setIsAudioEnabled(false);
    setIsVideoEnabled(false);
    setIsScreenSharing(false);
    setPinnedPeer(null);

    if (socket) {
      socket.emit('webrtc-leave', { roomId });
    }
  }, [socket, roomId]);

  // --- Toggle Audio ---
  const toggleAudio = useCallback(async () => {
    try {
      const newState = !isAudioEnabled;
      if (newState) {
        let audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (!audioTrack) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true }
          });
          audioTrack = stream.getAudioTracks()[0];
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
          }
          localStreamRef.current.addTrack(audioTrack);

          peersRef.current.forEach(({ pc }) => {
            pc.addTrack(audioTrack, localStreamRef.current);
          });
        } else {
          audioTrack.enabled = true;
        }
        setIsAudioEnabled(true);
        if (socket) {
          socket.emit('webrtc-toggle-audio', { roomId, enabled: true });
        }
      } else {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
        }
        setIsAudioEnabled(false);
        if (socket) {
          socket.emit('webrtc-toggle-audio', { roomId, enabled: false });
        }
      }
    } catch (err) {
      console.error('[VibeSync] toggleAudio error:', err);
    }
  }, [isAudioEnabled, socket, roomId]);

  // --- Toggle Video ---
  const toggleVideo = useCallback(async () => {
    try {
      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }

      if (isVideoEnabled) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => {
          t.stop();
          localStreamRef.current.removeTrack(t);
        });
        setIsVideoEnabled(false);

        peersRef.current.forEach(({ pc }) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) pc.removeTrack(videoSender);
        });

        if (socket) {
          socket.emit('webrtc-toggle-video', { roomId, enabled: false });
        }
      } else {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedVideoDevice ? { exact: selectedVideoDevice } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);
        setIsVideoEnabled(true);

        peersRef.current.forEach(({ pc }, peerId) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
          }
          renegotiatePeer(peerId, pc);
        });

        if (socket) {
          socket.emit('webrtc-toggle-video', { roomId, enabled: true });
        }
      }
    } catch (err) {
      console.error('[VibeSync] Camera toggle failed:', err);
    }
  }, [isVideoEnabled, socket, roomId, selectedVideoDevice, renegotiatePeer]);

  // --- Screen Share ---
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true,
      });

      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      peersRef.current.forEach(({ pc }, peerId) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, stream);
          renegotiatePeer(peerId, pc);
        }
      });

      if (socket) {
        socket.emit('webrtc-screen-share', { roomId, sharing: true });
      }
    } catch (err) {
      console.error('[VibeSync] Screen share failed:', err);
    }
  }, [socket, roomId, renegotiatePeer]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (isVideoEnabled && localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        peersRef.current.forEach(({ pc }) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
      }
    } else {
      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) pc.removeTrack(sender);
      });
    }

    if (socket) {
      socket.emit('webrtc-screen-share', { roomId, sharing: false });
    }
  }, [isVideoEnabled, socket, roomId]);

  // --- Device Selection ---
  const selectAudioDevice = useCallback(async (deviceId) => {
    setSelectedAudioDevice(deviceId);
    if (!localStreamRef.current || !isInCall) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      const newTrack = newStream.getAudioTracks()[0];
      newTrack.enabled = isAudioEnabled;

      const oldTrack = localStreamRef.current.getAudioTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newTrack);

      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) sender.replaceTrack(newTrack);
      });
    } catch (err) {
      console.error('[VibeSync] Audio device switch failed:', err);
    }
  }, [isInCall, isAudioEnabled]);

  const selectVideoDevice = useCallback(async (deviceId) => {
    setSelectedVideoDevice(deviceId);
    if (!localStreamRef.current || !isInCall || !isVideoEnabled) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const newTrack = newStream.getVideoTracks()[0];

      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newTrack);

      peersRef.current.forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack);
      });
    } catch (err) {
      console.error('[VibeSync] Video device switch failed:', err);
    }
  }, [isInCall, isVideoEnabled]);

  // --- File Sharing ---
  const shareFile = useCallback((file) => {
    if (!socket || !file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const fileData = {
        roomId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: reader.result,
        senderName: username,
        timestamp: new Date().toISOString(),
      };
      socket.emit('file-share', fileData);
    };
    reader.readAsDataURL(file);
  }, [socket, roomId, username]);

  const deleteSharedFile = useCallback((fileId) => {
    if (socket) {
      socket.emit('delete-file', { roomId, fileId });
    }
  }, [socket, roomId]);

  // --- Socket Signaling Listeners ---
  useEffect(() => {
    if (!socket) return;

    const handleRoomJoined = (data) => {
      if (data.files) {
        setSharedFiles(data.files);
      }
    };

    const handleFileDeleted = ({ files }) => {
      if (files) {
        setSharedFiles(files);
      }
    };

    const handlePeerJoined = async ({ peerId, peerUsername }) => {
      if (peersRef.current.has(peerId)) return;
      const pc = createPeerConnection(peerId, peerUsername);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', {
          roomId,
          targetId: peerId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error('[VibeSync] Create offer failed:', err);
      }
    };

    const handleOffer = async ({ senderId, senderUsername, sdp }) => {
      let peerData = peersRef.current.get(senderId);
      if (!peerData) {
        const pc = createPeerConnection(senderId, senderUsername);
        peerData = { pc, username: senderUsername };
      }

      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushCandidates(senderId);
        const answer = await peerData.pc.createAnswer();
        await peerData.pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          roomId,
          targetId: senderId,
          sdp: peerData.pc.localDescription,
        });
      } catch (err) {
        console.error('[VibeSync] Handle offer failed:', err);
      }
    };

    const handleAnswer = async ({ senderId, sdp }) => {
      const peerData = peersRef.current.get(senderId);
      if (!peerData) return;
      try {
        await peerData.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushCandidates(senderId);
      } catch (err) {
        console.error('[VibeSync] Handle answer failed:', err);
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const peerData = peersRef.current.get(senderId);
      if (!peerData || !peerData.pc.remoteDescription) {
        const pending = pendingCandidatesRef.current.get(senderId) || [];
        pending.push(candidate);
        pendingCandidatesRef.current.set(senderId, pending);
        return;
      }
      try {
        await peerData.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { /* ignore */ }
    };

    const handlePeerLeft = ({ peerId }) => {
      removePeer(peerId);
    };

    const handleAudioToggled = ({ peerId, enabled }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) next.set(peerId, { ...existing, audioEnabled: enabled });
        return next;
      });
    };

    const handleVideoToggled = ({ peerId, enabled }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) next.set(peerId, { ...existing, videoEnabled: enabled });
        return next;
      });
    };

    const handleFileReceived = (data) => {
      setSharedFiles((prev) => {
        if (prev.some((f) => f.id === data.id)) return prev;
        return [...prev, data];
      });
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('file-deleted', handleFileDeleted);
    socket.on('webrtc-peer-joined', handlePeerJoined);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('webrtc-peer-left', handlePeerLeft);
    socket.on('webrtc-audio-toggled', handleAudioToggled);
    socket.on('webrtc-video-toggled', handleVideoToggled);
    socket.on('file-received', handleFileReceived);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('file-deleted', handleFileDeleted);
      socket.off('webrtc-peer-joined', handlePeerJoined);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('webrtc-peer-left', handlePeerLeft);
      socket.off('webrtc-audio-toggled', handleAudioToggled);
      socket.off('webrtc-video-toggled', handleVideoToggled);
      socket.off('file-received', handleFileReceived);
    };
  }, [socket, roomId, createPeerConnection, removePeer, flushCandidates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      peersRef.current.forEach(({ pc }) => pc.close());
      peersRef.current.clear();
    };
  }, []);

  const value = {
    // State
    isInCall,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    pinnedPeer,
    remoteStreams,
    devices,
    selectedAudioDevice,
    selectedVideoDevice,
    localStream: localStreamRef.current,
    sharedFiles,
    // Actions
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setPinnedPeer,
    selectAudioDevice,
    selectVideoDevice,
    shareFile,
    deleteSharedFile,
  };

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
}
