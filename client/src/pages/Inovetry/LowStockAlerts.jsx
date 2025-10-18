import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function LowStockAlerts({ engineerId }) {
  const [alerts, setAlerts] = useState({ central: [], engineer: [] });
  const [loading, setLoading] = useState(false);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await axios.get('/api/stock/alerts', { params: engineerId ? { engineerId } : {} });
      // normalize response shape to avoid crashes if API returns unexpected values
      const data = res.data || {};
      const central = Array.isArray(data.central) ? data.central : (data.central ? [data.central] : []);
      const engineer = Array.isArray(data.engineer) ? data.engineer : (data.engineer ? [data.engineer] : []);
      setAlerts({ central, engineer });
    } catch (err) {
      console.error('Failed to fetch alerts', err);
      setAlerts({ central: [], engineer: [] });
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAlerts(); }, [engineerId]);

  function exportAlerts() {
    const rows = [
      ...alerts.central.map(a => ({ scope: 'central', name: a.name, quantity: a.quantity, threshold: a.threshold })),
      ...alerts.engineer.map(a => ({ scope: 'engineer', name: a.name, quantity: a.quantity, threshold: a.threshold, engineer_id: a.engineer_id }))
    ];
    if (rows.length === 0) return alert('No alerts to export');
    const header = Object.keys(rows[0]);
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${String(r[h] ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `low_stock_alerts_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
        
    </div>
  );
}
