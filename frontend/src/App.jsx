import { useCallback, useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import TargetForm from './components/TargetForm'
import TargetsList from './components/TargetsList'
import LogsPanel from './components/LogsPanel'


import './App.css'
import { fetchHealth } from './api/health';
import { fetchTargets, removeTarget, saveTarget } from './api/targets';
import { sendWol } from './api/wol';
import { fetchStatus } from './api/status';
import { fetchLogs } from './api/logs';
import { formatApiError } from './api/http';

function App() {
  const [healthStatus, setHealthStatus] = useState("未確認");
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetsError, setTargetsError] = useState("");
  const [targetSaveLoading, setTargetSaveLoading] = useState(false);
  const [targetSaveError, setTargetSaveError] = useState("");
  const [targetDeleteLoadingId, setTargetDeleteLoadingId] = useState(null);
  const [targetDeleteError, setTargetDeleteError] = useState("");

  const [wolLoadingId, setWolLoadingId] = useState(null);
  const [wolError, setWolError] = useState("");
  const [statusById, setStatusById] = useState({});
  const [statusLoadingById, setStatusLoadingById] = useState({});
  const [statusErrorById, setStatusErrorById] = useState({});
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
      setHealthError(formatApiError(err));
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
      setTargetsError(formatApiError(err));
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
      setWolError(formatApiError(err));
    } finally {
      setWolLoadingId(null);
    }
  }, [loadTargets]);

  const onCheckStatus = useCallback(async (targetId) => {
    setStatusLoadingById((prev) => ({ ...prev, [targetId]: true }));
    setStatusErrorById((prev) => ({ ...prev, [targetId]: "" }));
    try {
      const data = await fetchStatus(targetId);
      setStatusById((prev) => ({ ...prev, [targetId]: data.status }));
      setStatusErrorById((prev) => ({ ...prev, [targetId]: "" }));
    } catch (err) {
      setStatusById((prev) => ({ ...prev, [targetId]: "error" }));
      setStatusErrorById((prev) => ({ ...prev, [targetId]: formatApiError(err) }));
    } finally {
      setStatusLoadingById((prev) => ({ ...prev, [targetId]: false }));
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
      setLogsError(formatApiError(err));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const onSaveTarget = useCallback(async (payload) => {
    setTargetSaveLoading(true);
    setTargetSaveError("");
    try {
      await saveTarget(payload);
      await loadTargets();
      return true;
    } catch (err) {
      setTargetSaveError(formatApiError(err));
      return false;
    } finally {
      setTargetSaveLoading(false);
    }
  }, [loadTargets]);

  const onDeleteTarget = useCallback(async (targetId) => {
    setTargetDeleteLoadingId(targetId);
    setTargetDeleteError("");
    try {
      await removeTarget(targetId);
      setStatusById((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setStatusLoadingById((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      setStatusErrorById((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      await loadTargets();
    } catch (err) {
      setTargetDeleteError(formatApiError(err));
    } finally {
      setTargetDeleteLoadingId(null);
    }
  }, [loadTargets]);

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
      <TargetForm loading={targetSaveLoading} error={targetSaveError} onSubmit={onSaveTarget} />
      <TargetsList
        items={targets}
        loading={targetsLoading}
        error={targetsError}
        onReload={loadTargets}
        wolLoadingId={wolLoadingId}
        onWake={onWake}
        wolError={wolError}
        deleteLoadingId={targetDeleteLoadingId}
        onDelete={onDeleteTarget}
        deleteError={targetDeleteError}
        statusById={statusById}
        statusLoadingById={statusLoadingById}
        onCheckStatus={onCheckStatus}
        statusErrorById={statusErrorById}
      />
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
