import { useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import TargetsList from './components/TargetsList'


import './App.css'
import { fetchHealth } from './api/health';
import { fetchTargets } from './api/targets';
import { sendWol } from './api/wol';

function App() {
  const [healthStatus, setHealthStatus] = useState("未確認");
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState("");

  const [wolLoadingId, setWolLoadingId] = useState(null);
  const [wolError, setWolError] = useState("");

  async function checkHealth() {
    setHealthLoading(true);
    setHealthError("");
    try {
      const data = await fetchHealth();
      setHealthStatus(data.status);
    } catch (err) {
      setHealthError(err.message);
    } finally {
      setHealthLoading(false);
    }
  }

  async function loadTargets() {
    setTargetsLoading(true);
    setTargetsError("");
    try {
      const data = await fetchTargets();
      setTargets(data.items ?? []);
    } catch (err) {
      setTargetsError(err.message);
    } finally {
      setTargetsLoading(false);
    }
  }

  async function onWake(targetId) {
    setWolLoadingId(targetId);
    setWolError("");
    try {
      await sendWol(targetId);
      await loadTargets(); // 再読み込みして更新
    } catch (err) {
      setWolError(err.message);
    } finally {
      setWolLoadingId(null);
    }
  }

  useEffect(() => {
    checkHealth();
    loadTargets();
  }, []);

  return (
    <main>
      <AppHeader />
      <p>API Health: {healthStatus}</p>
      {healthError ? <p style={{ color: 'red' }}>error: {healthError}</p> : null}
      <button onClick={checkHealth} disabled={healthLoading}>
        {healthLoading ? '確認中...' : '再確認'}
      </button>
      <TargetsList items={targets} loading={targetsLoading} error={targetsError} onReload={loadTargets} 
      wolLoadingId={wolLoadingId} onWake={onWake} wolError={wolError} />
    </main>
  );
}

export default App
