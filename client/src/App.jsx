import { Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import Home from './pages/Home';
import Room from './pages/Room';
import './App.css';

function AppContent() {
  const location = useLocation();
  const isInRoom = location.pathname.startsWith('/room/');

  return (
    <>
      {/* Animated background blobs */}
      <div className="bg-animated">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {!isInRoom && <Navbar />}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomCode" element={<Room />} />
          </Routes>
        </main>
      </div>

      <Toast />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;
