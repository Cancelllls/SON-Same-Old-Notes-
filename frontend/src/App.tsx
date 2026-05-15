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

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  const [history, setHistory] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [apiBase, setApiBase] = useState(localStorage.getItem("apiBase") || window.location.origin);
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
      const response = await fetch(`${apiBase}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setCurrentTask({ file_id: data.file_id, filename: file.name, status: "queued" });
    } catch (error) {
      alert("Upload failed");
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: number;
    if (currentTask?.file_id && (currentTask.status === "queued" || currentTask.status === "processing")) {
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
        <div className="container auth-container">
          <div className="logo auth-logo">
            <div className="logo-icon">⚡</div> StemSplitter
          </div>
          <section className="process-card">
            <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="auth-form">
              <input 
                type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required 
                className="input-field"
              />
              <input 
                type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required 
                className="input-field"
              />
              <button className="btn-primary" type="submit">
                {isRegistering ? 'Sign Up' : 'Sign In'}
              </button>
            </form>
            <p className="auth-toggle">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              <span onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? 'Login' : 'Sign Up'}
              </span>
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">
            <div className="logo-icon">⚡</div> StemSplitter
          </div>
          <div className="nav-actions">
            <button className="btn-secondary" onClick={() => setShowDocs(!showDocs)}>
              {showDocs ? "Close Guide" : "How it Works"}
            </button>
            <button className="btn-icon" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
            <button className="btn-danger" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <div className="container">
        {showSettings && (
          <section className="process-card settings-card">
            <h3>Instance Settings</h3>
            <div className="settings-fields">
              <label>API Endpoint</label>
              <input type="text" value={apiBase} onChange={e => setApiBase(e.target.value)} className="input-field" />
              <button className="btn-primary" onClick={() => saveSettings(apiBase)}>Save</button>
            </div>
          </section>
        )}

        {showDocs ? (
          <section className="process-card docs-card">
            <h2>Separation Intelligence</h2>
            <div className="docs-content">
              <p><strong>1. Neural Analysis:</strong> Upload your track. Our high-fidelity model analyzes the complex spectral data.</p>
              <p><strong>2. Frequency Extraction:</strong> The AI identifies unique harmonic signatures for vocals, drums, and bass.</p>
              <p><strong>3. Studio-Grade Stems:</strong> Download 4 independent 32-bit WAV stems for your production.</p>
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
            <input type="file" accept="audio/*" onChange={handleFileChange} />
            <div className="dropzone-text">
              <span className="dropzone-icon">✨</span>
              <h3>{file ? file.name : "Select your studio master"}</h3>
              <p>Drag & drop or click to browse (MP3, WAV, FLAC)</p>
            </div>
            {file && !loading && (
              <button className="btn-primary upload-btn" onClick={e => { e.stopPropagation(); handleUpload(); }}>
                Begin Neural Separation
              </button>
            )}
          </div>
        ) : null}

        {currentTask && (currentTask.status === "queued" || currentTask.status === "processing") && (
          <div className="process-card progress-card">
            <div className="progress-header">
              <div>
                <h4>{currentTask.filename}</h4>
                <p>Analyzing harmonic structure...</p>
              </div>
              <span className={`status-badge status-${currentTask.status}`}>{currentTask.status}</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: currentTask.status === 'processing' ? '70%' : '20%' }}></div>
            </div>
          </div>
        )}

        {currentTask?.status === "completed" && (
          <div className="results-grid">
            {currentTask.results?.map(filename => (
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

        {currentTask && (
          <button className="btn-back" onClick={() => { setCurrentTask(null); setFile(null); }}>
            ← New Separation
          </button>
        )}

        <section className="history-section">
          <h2 className="history-title">Separation Vault</h2>
          <div className="history-list">
            {history.map(item => (
              <div 
                key={item.file_id} 
                className={`history-item ${currentTask?.file_id === item.file_id ? 'active' : ''}`} 
                onClick={() => { setCurrentTask(item); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                <div className="history-info">
                  <div className="history-name">{item.filename}</div>
                  <div className="history-date">{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</div>
                </div>
                <span className={`status-badge status-${item.status}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
