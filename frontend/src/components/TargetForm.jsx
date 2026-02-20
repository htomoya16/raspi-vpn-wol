import { useState } from 'react';

const INITIAL_FORM = {
  id: '',
  name: '',
  macAddress: '',
  ipAddress: '',
};

function TargetForm({ loading, error, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      id: form.id.trim(),
      name: form.name.trim(),
      mac_address: form.macAddress.trim(),
      ip_address: form.ipAddress.trim() || null,
    };

    const saved = await onSubmit(payload);
    if (saved) {
      setForm(INITIAL_FORM);
    }
  }

  return (
    <section>
      <h2>Target登録</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="target-id">ID</label>
        <input
          id="target-id"
          value={form.id}
          onChange={(event) => updateField('id', event.target.value)}
          required
        />

        <label htmlFor="target-name">Name</label>
        <input
          id="target-name"
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
          required
        />

        <label htmlFor="target-mac">MAC Address</label>
        <input
          id="target-mac"
          value={form.macAddress}
          onChange={(event) => updateField('macAddress', event.target.value)}
          placeholder="AA:BB:CC:DD:EE:FF"
          required
        />

        <label htmlFor="target-ip">IP Address（任意）</label>
        <input
          id="target-ip"
          value={form.ipAddress}
          onChange={(event) => updateField('ipAddress', event.target.value)}
          placeholder="192.168.10.50"
        />

        <button type="submit" disabled={loading}>
          {loading ? '保存中...' : '保存'}
        </button>
      </form>

      {error ? <p style={{ color: 'red' }}>error: {error}</p> : null}
    </section>
  );
}

export default TargetForm;
