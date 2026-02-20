import { useCallback, useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import TargetsList from './components/TargetsList'
import LogsPanel from './components/LogsPanel'


import './App.css'
import { fetchHealth } from './api/health';
import { fetchTargets } from './api/targets';
import { sendWol } from './api/wol';
import { fetchStatus } from './api/status';
import { fetchLogs } from './api/logs';

function App() {
  const [healthStatus, setHealthStatus] = useState("未確認");
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState("");

  const [wolLoadingId, setWolLoadingId] = useState(null);
  const [wolError, setWolError] = useState("");
  const [statusById, setStatusById] = useState({});
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [logs, setLogs] = useState([]);
  const [logsLimit, setLogsLimit] = useState(20);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const checkHealth = useCallback(async () => {
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
  }, []);

  const loadTargets = useCallback(async () => {
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
  }, []);

  const onWake = useCallback(async (targetId) => {
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
  }, [loadTargets]);

  const onCheckStatus = useCallback(async (targetId) => {
    setStatusLoadingId(targetId);
    setStatusError("");
    try {
      const data = await fetchStatus(targetId);
      setStatusById((prev) => ({ ...prev, [targetId]: data.status }));
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setStatusLoadingId(null);
    }
  }, []);

  const loadLogs = useCallback(async (limit) => {
    setLogsLoading(true);
    setLogsError("");
    try {
      const data = await fetchLogs(limit);
      setLogsLimit(data.limit ?? limit);
      setLogs(data.items ?? []);
    } catch (err) {
      setLogsError(err.message);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const onChangeLogsLimit = useCallback(async (nextLimit) => {
    await loadLogs(nextLimit);
  }, [loadLogs]);

  useEffect(() => {
    checkHealth();
    loadTargets();
    loadLogs(20);
  }, [checkHealth, loadLogs, loadTargets]);

  return (
    <main>
      <AppHeader />
      <p>API Health: {healthStatus}</p>
      {healthError ? <p style={{ color: 'red' }}>error: {healthError}</p> : null}
      <button onClick={checkHealth} disabled={healthLoading}>
        {healthLoading ? '確認中...' : '再確認'}
      </button>
      <TargetsList items={targets} loading={targetsLoading} error={targetsError} onReload={loadTargets} 
      wolLoadingId={wolLoadingId} onWake={onWake} wolError={wolError}
      statusById={statusById} statusLoadingId={statusLoadingId} onCheckStatus={onCheckStatus} statusError={statusError} />
      <LogsPanel
        items={logs}
        loading={logsLoading}
        error={logsError}
        limit={logsLimit}
        onLimitChange={onChangeLogsLimit}
        onReload={() => loadLogs(logsLimit)}
      />
    </main>
  );
}

export default App
