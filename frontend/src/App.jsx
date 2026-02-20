import { useEffect, useState } from 'react'
import AppHeader from './compornets/AppHeader'
import StatusPanel  from './compornets/StatusPanel'


import './App.css'
import { fetchHealth } from './api/health';

function App() {
  const [health, setHealth] = useState("未確認");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function checkHealth() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchHealth();
      setHealth(data.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main>
      <AppHeader />
      <p>API Health: {health}</p>
      {error ? <p style={{ color: 'red' }}>error: {error}</p> : null}
      <button onClick={checkHealth} disabled={loading}>
        {loading ? '確認中...' : '再確認'}
      </button>
    </main>
  );
}

export default App
