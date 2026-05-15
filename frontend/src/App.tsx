import { useState, useEffect } from 'react'
import './App.css'

interface TaskStatus {
  file_id: string;
  filename: string;
  status: string;
  results?: string[];
  folder?: string;
  error?: string;
  created_at?: string;
}

const Icons = {
  Bolt: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  Upload: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [history, setHistory] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [apiBase, setApiBase] = useState(localStorage.getItem("apiBase") || window.location.origin);
  const [showSettings, setShowSettings] = useState(false);
  
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${apiBase}/api/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.status === 401) {
        handleLogout();
        return;
      }
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
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
      const response = await fetch(`${apiBase}/api/token`, {
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
      alert(`Authentication Error: ${error.message}`);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${apiBase}/api/register?email=${email}&password=${password}`, {
        method: "POST"
      });
      if (response.ok) {
        alert("Account created! Please sign in.");
        setIsRegistering(false);
      } else {
        const data = await response.json();
        alert(data.detail || "Registration failed");
      }
    } catch (error) {
      alert("System Error: Could not connect to server.");
    }
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("token");
    setHistory([]);
    setCurrentTask(null);
  };

  const saveSettings = (url: string) => {
    const sanitized = url.endsWith('/') ? url.slice(0, -1) : url;
    setApiBase(sanitized);
    localStorage.setItem("apiBase", sanitized);
    setShowSettings(false);
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
      const response = await fetch(`${apiBase}/api/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error("Processing limits exceeded or invalid file.");
      const data = await response.json();
      setCurrentTask({ file_id: data.file_id, filename: file.name, status: "queued" });
    } catch (error: any) {
      alert(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (currentTask?.file_id && (currentTask.status === "queued" || currentTask.status === "processing")) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${apiBase}/api/status/${currentTask.file_id}`);
          if (!response.ok) return;
          const data = await response.json();
          setCurrentTask(prev => ({ ...prev!, ...data }));
          if (data.status === "completed" || data.status === "failed") {
            setLoading(false);
            clearInterval(interval);
            fetchHistory();
          }
        } catch (error) {
          console.error("Status sync failed", error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentTask?.file_id, currentTask?.status, apiBase]);

  if (!token) {
    return (
      <div className="auth-overlay">
        <div className="auth-card">
          <div className="auth-logo">
            <Icons.Bolt /> StemSplitter Pro
          </div>
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="auth-form">
            <div className="input-group">
              <label>Professional Email</label>
              <input 
                type="email" placeholder="name@studio.com" value={email} onChange={e => setEmail(e.target.value)} required 
                className="input-field"
              />
            </div>
            <div className="input-group">
              <label>Security Key</label>
              <input 
                type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required 
                className="input-field"
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '1rem' }}>
              {isRegistering ? 'Initialize Account' : 'Secure Sign In'}
            </button>
          </form>
          <p className="auth-toggle">
            {isRegistering ? 'Existing member?' : "New producer?"}
            <span onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Sign In' : 'Join Pro'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <nav className="navbar">
        <div className="container navbar-content">
          <div className="brand">
            <Icons.Bolt /> StemSplitter <span style={{ color: 'var(--accent-color)' }}>PRO</span>
          </div>
          <div className="nav-actions">
            <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)}>
              <Icons.Settings /> Settings
            </button>
            <button className="btn btn-danger" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="container">
        {showSettings && (
          <section className="progress-card">
            <h3 style={{ marginBottom: '1.5rem' }}>System Configuration</h3>
            <div className="input-group">
              <label>API Gateway Endpoint</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={apiBase} onChange={e => setApiBase(e.target.value)} className="input-field" style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={() => saveSettings(apiBase)}>Apply</button>
              </div>
            </div>
          </section>
        )}

        <section className="hero">
          <h1>High-Fidelity <br/> Audio Decomposition</h1>
          <p>Extract vocals, percussion, and melodic layers with studio-grade AI precision.</p>
        </section>

        <div className="dropzone-container">
          {!currentTask || currentTask.status === "completed" || currentTask.status === "failed" ? (
            <div 
              className={`dropzone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            >
              <input type="file" accept="audio/*" onChange={handleFileChange} />
              <div className="dropzone-ui">
                <div className="dropzone-icon-box">
                  <Icons.Upload />
                </div>
                <div className="dropzone-text">
                  <h3>{file ? file.name : "Load Studio Master"}</h3>
                  <p>Drag & drop high-resolution WAV or MP3</p>
                </div>
              </div>
              {file && !loading && (
                <button className="btn btn-primary action-btn" onClick={e => { e.stopPropagation(); handleUpload(); }}>
                  Initialize Separation Engine
                </button>
              )}
            </div>
          ) : null}

          {currentTask && (currentTask.status === "queued" || currentTask.status === "processing") && (
            <div className="progress-card">
              <div className="progress-info">
                <div>
                  <h4>{currentTask.filename}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Decomposing spectral layers...
                  </p>
                </div>
                <span className="progress-status">{currentTask.status}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: currentTask.status === 'processing' ? '75%' : '15%' }}></div>
              </div>
            </div>
          )}
        </div>

        {currentTask?.status === "completed" && (
          <div style={{ marginBottom: '6rem' }}>
            <h2 className="section-title">Extracted Stems</h2>
            <div className="results-grid">
              {currentTask.results?.map(filename => (
                <div key={filename} className="stem-card">
                  <div className="stem-header">
                    <span className="stem-name">{filename.replace(".wav", "")}</span>
                    <a href={`${apiBase}/outputs/htdemucs/${currentTask.folder}/${filename}`} download className="stem-download">
                      <Icons.Download /> Export
                    </a>
                  </div>
                  <audio controls src={`${apiBase}/outputs/htdemucs/${currentTask.folder}/${filename}`} />
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ marginTop: '3rem' }} onClick={() => { setCurrentTask(null); setFile(null); }}>
              ← Process New Track
            </button>
          </div>
        )}

        {currentTask?.status === "failed" && (
          <div className="progress-card" style={{ borderLeft: '4px solid var(--error-color)' }}>
            <h4 style={{ color: 'var(--error-color)' }}>Engine Failure</h4>
            <p>{currentTask.error || "The processing engine encountered an unexpected error."}</p>
            <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => { setCurrentTask(null); setFile(null); }}>
              Retry with new file
            </button>
          </div>
        )}

        <section className="history-section" style={{ paddingBottom: '10vh' }}>
          <h2 className="section-title">Production History</h2>
          <div className="history-list">
            {history.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No previous sessions found.</p>}
            {history.map(item => (
              <div 
                key={item.file_id} 
                className={`history-item ${currentTask?.file_id === item.file_id ? 'active' : ''}`} 
                onClick={() => { setCurrentTask(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <div className="history-meta">
                  <h5>{item.filename}</h5>
                  <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Active Session'}</span>
                </div>
                <span className={`status-tag status-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
