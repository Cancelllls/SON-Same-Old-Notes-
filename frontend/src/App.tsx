import { useState, useEffect } from 'react'
import './App.css'

interface TaskStatus {
  file_id: string;
  filename: string;
  status: string;
  files?: string[];
  folder?: string;
  error?: string;
  created_at?: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [history, setHistory] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [apiBase, setApiBase] = useState(localStorage.getItem("apiBase") || "http://localhost:8000");
  const [showSettings, setShowSettings] = useState(false);
  
  // Auth state
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [apiBase, token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    try {
      const response = await fetch(`${apiBase}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }
      const data = await response.json();
      if (data.access_token) {
        setToken(data.access_token);
        localStorage.setItem("token", data.access_token);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      alert(`Login failed: ${error.message}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiBase}/register?email=${email}&password=${password}`, {
        method: "POST"
      });
      if (response.ok) {
        alert("Registration successful! Please login.");
        setIsRegistering(false);
      } else {
        const data = await response.json();
        alert(data.detail || "Registration failed");
      }
    } catch (error) {
      alert("Registration failed");
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("token");
    setHistory([]);
    setCurrentTask(null);
  };

  const saveSettings = (url: string) => {
    // Sanitize: remove trailing slash
    const sanitized = url.endsWith('/') ? url.slice(0, -1) : url;
    setApiBase(sanitized);
    localStorage.setItem("apiBase", sanitized);
    setShowSettings(false);
  };

  const checkHealth = async () => {
    try {
      const res = await fetch(`${apiBase}/`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      alert(`API Status: ${data.message}`);
    } catch (e: any) {
      console.error("Health check failed:", e);
      alert(`Connection Failed: ${e.message}. Ensure your URL is correct and the backend is public.`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${apiBase}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      setCurrentTask({ file_id: data.file_id, filename: file.name, status: "queued" });
    } catch (error) {
      alert("Upload failed");
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: number;
    if (currentTask?.file_id && currentTask.status !== "completed" && currentTask.status !== "failed") {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${apiBase}/status/${currentTask.file_id}`);
          const data = await response.json();
          setCurrentTask(prev => ({ ...prev!, ...data }));
          if (data.status === "completed" || data.status === "failed") {
            setLoading(false);
            clearInterval(interval);
            fetchHistory();
          }
        } catch (error) {
          console.error("Status check failed", error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentTask?.file_id, currentTask?.status, apiBase]);

  if (!token) {
    return (
      <div className="app-wrapper">
        <div className="container" style={{ maxWidth: '450px', marginTop: '10vh' }}>
          <div className="logo" style={{ fontSize: '2.5rem', justifyContent: 'center', marginBottom: '3rem' }}>
            <div className="logo-icon">⚡</div> StemSplitter
          </div>
          <section className="process-card">
            <h2 style={{ marginBottom: '2rem', textAlign: 'center', fontWeight: '700' }}>
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h2>
            <form onSubmit={isRegistering ? handleRegister : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <input 
                  type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required 
                  className="btn" style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', cursor: 'text', padding: '1rem' }}
                />
              </div>
              <div className="input-group">
                <input 
                  type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required 
                  className="btn" style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', cursor: 'text', padding: '1rem' }}
                />
              </div>
              <button className="btn-primary" type="submit" style={{ width: '100%', padding: '1rem' }}>
                {isRegistering ? 'Sign Up' : 'Sign In'}
              </button>
            </form>
            <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              <span 
                style={{ color: 'var(--primary-color)', cursor: 'pointer', marginLeft: '0.5rem', fontWeight: '600' }}
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? 'Login' : 'Sign Up'}
              </span>
            </p>
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '0.5rem' }}>API Endpoint Configuration:</p>
              <input 
                type="text" 
                value={apiBase} 
                onChange={e => saveSettings(e.target.value)}
                className="btn" 
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', cursor: 'text' }}
              />
              <p style={{ marginTop: '0.5rem' }}>If using Codespaces, paste your Port 8000 forwarded URL here.</p>
              <button 
                className="btn-primary" 
                style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }}
                onClick={checkHealth}
              >
                Test Connection
              </button>
              </div>
              </section>
              </div>
              </div>    );
  }

  return (
    <div className="app-wrapper">
      <nav className="navbar">
        <div className="navbar-content">
          <a href="/" className="logo">
            <div className="logo-icon">⚡</div> StemSplitter
          </a>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }} onClick={() => setShowDocs(!showDocs)}>
              {showDocs ? "Close Guide" : "How it Works"}
            </button>
            <button className="btn-primary" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => setShowSettings(!showSettings)}>
              ⚙️
            </button>
            <button className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-color)', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: 'none' }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        {showSettings && (
          <section className="process-card" style={{ marginBottom: '3rem' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '700' }}>Instance Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API Endpoint</label>
              <input 
                type="text" value={apiBase} onChange={e => setApiBase(e.target.value)}
                className="btn" style={{ width: '100%', textAlign: 'left', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', cursor: 'text' }}
              />
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => saveSettings(apiBase)}>Save Configuration</button>
            </div>
          </section>
        )}

        {showDocs ? (
          <section className="process-card" style={{ textAlign: 'left', marginBottom: '3rem' }}>
            <h2 className="history-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Separation Intelligence</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-secondary)' }}>
              <p><strong style={{ color: '#fff' }}>1. Neural Analysis:</strong> Upload your track. Our high-fidelity demucs model analyzes the complex spectral data.</p>
              <p><strong style={{ color: '#fff' }}>2. Frequency Extraction:</strong> The AI identifies unique harmonic signatures for vocals, drums, and bass.</p>
              <p><strong style={{ color: '#fff' }}>3. Studio-Grade Stems:</strong> Download 4 independent 32-bit WAV stems for your production or practice.</p>
            </div>
          </section>
        ) : (
          <section className="hero">
            <h1>Professional Audio <br/> Stem Separation</h1>
            <p>Studio-grade AI intelligence. Extract vocals, drums, and music with surgical precision.</p>
          </section>
        )}

        {!currentTask || currentTask.status === "completed" || currentTask.status === "failed" ? (
          <div 
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          >
            <input type="file" accept="audio/*" onChange={handleFileChange} title="" />
            <div className="dropzone-text">
              <span className="dropzone-icon">✨</span>
              <h3>{file ? file.name : "Select your studio master"}</h3>
              <p>Drag & drop or click to browse (MP3, WAV, FLAC)</p>
            </div>
            {file && !loading && (
              <button className="btn-primary" onClick={e => { e.stopPropagation(); handleUpload(); }} style={{ marginTop: '2.5rem', padding: '1rem 2.5rem', fontSize: '1rem' }}>
                Begin Neural Separation
              </button>
            )}
          </div>
        ) : null}

        {currentTask && (currentTask.status === "queued" || currentTask.status === "processing") && (
          <div className="process-card">
            <div className="progress-header">
              <div>
                <h4 style={{ fontWeight: '700', fontSize: '1.1rem' }}>{currentTask.filename}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Analyzing harmonic structure...
                </p>
              </div>
              <span className="status-badge status-processing">{currentTask.status}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: currentTask.status === 'processing' ? '65%' : '15%' }}></div>
            </div>
          </div>
        )}

        {currentTask?.status === "completed" && (
          <div className="results-grid">
            {currentTask.files?.map(filename => (
              <div key={filename} className="stem-card">
                <div className="stem-info">
                  <span className="stem-title">{filename.replace(".wav", "")}</span>
                  <a href={`${apiBase}/outputs/htdemucs/${currentTask.folder}/${filename}`} download className="btn-download">Export Stem</a>
                </div>
                <audio controls src={`${apiBase}/outputs/htdemucs/${currentTask.folder}/${filename}`} />
              </div>
            ))}
          </div>
        )}

        <section className="history-section">
          <h2 className="history-title">Separation Vault</h2>
          <div className="history-list">
            {history.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Your processed stems will appear here.</p>}
            {history.map(item => (
              <div key={item.file_id} className="history-item" onClick={() => setCurrentTask(item)}>
                <div>
                  <div className="history-name">{item.filename}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                  </div>
                </div>
                <span className={`status-badge ${item.status === 'completed' ? 'status-completed' : 'status-processing'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
