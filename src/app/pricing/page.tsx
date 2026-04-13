'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabase';

interface PricingSetting {
  id: string;
  zone_id: string | null;
  zone: string;
  ride_type: string;
  base_fare: number;
  per_km_rate: number;
  per_min_rate: number;
  surge_multiplier: number;
  created_at: string;
  service_zones?: {
    id: string;
    key: string;
    name: string;
  } | null;
}

type ServiceZoneOption = {
  id: string;
  key: string;
  name: string;
};

export default function PricingPage() {
  const [settings, setSettings] = useState<PricingSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState<PricingSetting | null>(null);
  const [zones, setZones] = useState<ServiceZoneOption[]>([]);
  const [formData, setFormData] = useState({
    zone_id: '',
    zone: '',
    ride_type: 'standard',
    base_fare: 0,
    per_km_rate: 0,
    per_min_rate: 0,
    surge_multiplier: 1.0,
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    void loadSettings();
    void loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from('service_zones')
        .select('id,key,name')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setZones((data || []) as ServiceZoneOption[]);
    } catch (error) {
      console.error('Error loading service zones:', error);
      setZones([]);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pricing_settings')
        .select('*, service_zones(id,key,name)')
        .order('zone', { ascending: true });

      if (error) throw error;

      setSettings(data || []);
    } catch (error) {
      console.error('Error loading pricing settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSetting(null);
    setFormData({
      zone_id: '',
      zone: '',
      ride_type: 'standard',
      base_fare: 0,
      per_km_rate: 0,
      per_min_rate: 0,
      surge_multiplier: 1.0,
    });
    setShowModal(true);
  };

  const handleEdit = (setting: PricingSetting) => {
    setEditingSetting(setting);
    setFormData({
      zone_id: setting.zone_id ?? '',
      zone: setting.zone,
      ride_type: setting.ride_type,
      base_fare: setting.base_fare,
      per_km_rate: setting.per_km_rate,
      per_min_rate: setting.per_min_rate,
      surge_multiplier: setting.surge_multiplier,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const payload = {
        ...formData,
        zone_id: formData.zone_id || null,
      };

      if (editingSetting) {
        const { error } = await supabase
          .from('pricing_settings')
          .update(payload)
          .eq('id', editingSetting.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pricing_settings')
          .insert([payload]);

        if (error) throw error;
      }

      setShowModal(false);
      void loadSettings();
    } catch (error) {
      console.error('Error saving pricing setting:', error);
      alert('Failed to save pricing setting');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing setting?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadSettings();
    } catch (error) {
      console.error('Error deleting pricing setting:', error);
      alert('Failed to delete pricing setting');
    }
  };

  return (
    <AdminLayout>
      <div className="page-header">
        <h1 className="page-title">Pricing Settings</h1>
        <button onClick={handleCreate} className="btn btn-primary">
          Add Pricing Rule
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">Loading pricing settings...</div>
        ) : settings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            No pricing settings found. Click "Add Pricing Rule" to create one.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Linked Geographic Zone</th>
                <th>Ride Type</th>
                <th>Base Fare</th>
                <th>Per KM</th>
                <th>Per Min</th>
                <th>Surge</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.id}>
                  <td>{setting.zone}</td>
                  <td>{setting.service_zones?.name || 'Text fallback'}</td>
                  <td>
                    <span className="badge badge-active">{setting.ride_type}</span>
                  </td>
                  <td>{setting.base_fare} XOF</td>
                  <td>{setting.per_km_rate} XOF</td>
                  <td>{setting.per_min_rate} XOF</td>
                  <td>{setting.surge_multiplier}x</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '6px 12px', marginRight: 8 }}
                      onClick={() => handleEdit(setting)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => handleDelete(setting.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingSetting ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Geographic Zone (optional)</label>
                <select
                  className="form-select"
                  value={formData.zone_id}
                  onChange={(e) => {
                    const zoneId = e.target.value;
                    const matched = zones.find((zone) => zone.id === zoneId);
                    setFormData({
                      ...formData,
                      zone_id: zoneId,
                      zone: matched?.key || formData.zone,
                    });
                  }}
                  disabled={actionLoading}
                >
                  <option value="">No linked geographic zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} ({zone.key})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Zone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  required
                  disabled={actionLoading}
                  placeholder="e.g., Abidjan, Plateau, Cocody"
                />
                <small style={{ color: '#6b7280' }}>
                  Legacy key fallback used when no geographic zone match applies.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Ride Type</label>
                <select
                  className="form-select"
                  value={formData.ride_type}
                  onChange={(e) => setFormData({ ...formData, ride_type: e.target.value })}
                  required
                  disabled={actionLoading}
                >
                  <option value="eco">Eco</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Base Fare (XOF)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.base_fare}
                  onChange={(e) => setFormData({ ...formData, base_fare: parseFloat(e.target.value) })}
                  required
                  min="0"
                  step="0.01"
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Per KM Rate (XOF)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.per_km_rate}
                  onChange={(e) => setFormData({ ...formData, per_km_rate: parseFloat(e.target.value) })}
                  required
                  min="0"
                  step="0.01"
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Per Minute Rate (XOF)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.per_min_rate}
                  onChange={(e) => setFormData({ ...formData, per_min_rate: parseFloat(e.target.value) })}
                  required
                  min="0"
                  step="0.01"
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Surge Multiplier</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.surge_multiplier}
                  onChange={(e) => setFormData({ ...formData, surge_multiplier: parseFloat(e.target.value) })}
                  required
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  disabled={actionLoading}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
