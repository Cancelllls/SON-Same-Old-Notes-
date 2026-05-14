import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = "http://localhost:8000";

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

  // Fetch history on load
  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setCurrentTask({ 
        file_id: data.file_id, 
        filename: file.name, 
        status: "queued" 
      });
    } catch (error) {
      alert("Upload failed. Is the backend running?");
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: number;

    if (currentTask?.file_id && currentTask.status !== "completed" && currentTask.status !== "failed") {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/status/${currentTask.file_id}`);
          const data = await response.json();
          setCurrentTask(prev => ({ ...prev!, ...data }));
          
          if (data.status === "completed" || data.status === "failed") {
            setLoading(false);
            clearInterval(interval);
            fetchHistory(); // Refresh history when done
          }
        } catch (error) {
          console.error("Status check failed", error);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [currentTask?.file_id, currentTask?.status]);

  return (
    <div className="app-wrapper">
      <nav className="navbar">
        <div className="navbar-content">
          <a href="/" className="logo">
            <div className="logo-icon">⚡</div>
            StemSplitter
          </a>
          <button 
            className="btn-primary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            onClick={() => setShowDocs(!showDocs)}
          >
            {showDocs ? "Close Docs" : "Documentation"}
          </button>
        </div>
      </nav>

      <div className="container">
        {showDocs ? (
          <section className="process-card" style={{ textAlign: 'left', marginBottom: '2rem' }}>
            <h2 className="history-title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>How it Works</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-secondary)' }}>
              <p><strong>1. Upload:</strong> Select an MP3 or WAV file. We support files up to 15MB.</p>
              <p><strong>2. Separation:</strong> Our AI engine (Facebook Demucs) uses deep learning to identify and extract different sound frequencies corresponding to specific instruments.</p>
              <p><strong>3. Result:</strong> You get 4 distinct tracks: <strong>Vocals, Drums, Bass,</strong> and <strong>Other</strong> (Melody/Instruments).</p>
              <hr style={{ opacity: 0.1 }} />
              <p><em>Note: Processing happens entirely on our secure servers. Your data is encrypted in transit and anonymized.</em></p>
            </div>
          </section>
        ) : (
          <section className="hero">
            <h1>Separate Audio <br/> with AI Precision</h1>
            <p>The fastest way to extract vocals, drums, and instruments from any song using high-fidelity demucs models.</p>
          </section>
        )}

        {!currentTask || currentTask.status === "completed" || currentTask.status === "failed" ? (
          <div 
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input type="file" accept="audio/*" onChange={handleFileChange} title="" />
            <div className="dropzone-text">
              <span className="dropzone-icon">📁</span>
              <h3>{file ? file.name : "Drop your track here"}</h3>
              <p>Supports MP3, WAV, and FLAC (Max 10MB)</p>
            </div>
            {file && !loading && (
              <button 
                className="btn-primary" 
                onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                style={{ marginTop: '2rem' }}
              >
                Start Separation
              </button>
            )}
          </div>
        ) : null}

        {currentTask && (currentTask.status === "queued" || currentTask.status === "processing") && (
          <div className="process-card">
            <div className="progress-header">
              <div>
                <h4 style={{ marginBottom: '0.25rem' }}>{currentTask.filename}</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {currentTask.status === 'queued' ? 'Waiting in queue...' : 'AI is separating stems...'}
                </p>
              </div>
              <span className="status-badge status-processing">
                {currentTask.status}
              </span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: currentTask.status === 'processing' ? '60%' : '10%' }}
              ></div>
            </div>
          </div>
        )}

        {currentTask?.status === "completed" && (
          <div className="results-grid">
            {currentTask.files?.map((filename) => (
              <div key={filename} className="stem-card">
                <div className="stem-info">
                  <span className="stem-title">{filename.replace(".wav", "")}</span>
                  <a 
                    href={`${API_BASE}/outputs/mdx_extra/${currentTask.folder}/${filename}`} 
                    download 
                    className="btn-download"
                  >
                    Download
                  </a>
                </div>
                <audio controls src={`${API_BASE}/outputs/mdx_extra/${currentTask.folder}/${filename}`} />
              </div>
            ))}
          </div>
        )}

        <section className="history-section">
          <h2 className="history-title">Recent Work</h2>
          <div className="history-list">
            {history.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No recent separations found.</p>}
            {history.map((item) => (
              <div 
                key={item.file_id} 
                className="history-item"
                onClick={() => setCurrentTask(item)}
              >
                <div>
                  <div className="history-name">{item.filename}</div>
                  <div className="history-date">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Just now'}
                  </div>
                </div>
                <span className={`status-badge ${item.status === 'completed' ? 'status-completed' : 'status-processing'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
