import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { InstrumentModel, InstrumentRegisterRequest } from '../../types/instrument';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';

interface InstrumentRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: InstrumentModel[];
  onRegistered: () => void;
}

export const InstrumentRegisterModal: React.FC<InstrumentRegisterModalProps> = ({
  isOpen,
  onClose,
  models,
  onRegistered,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [selectedModelId, setSelectedModelId] = useState<string>(models[0]?.model_id || 'mod-nawi-cl3-30kg');
  const [serialNumber, setSerialNumber] = useState('');
  const [yearOfManufacture, setYearOfManufacture] = useState(new Date().getFullYear());
  const [facilityId, setFacilityId] = useState('fac-retail-01');
  const [intendedUse, setIntendedUse] = useState('Commercial Trade Weighing');
  const [locationNotes, setLocationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (models.length > 0 && (!selectedModelId || !models.some(m => m.model_id === selectedModelId))) {
      setSelectedModelId(models[0].model_id);
    }
  }, [models, isOpen]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId) || models[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) {
      notify('error', 'Validation Error', 'Physical serial number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: InstrumentRegisterRequest = {
        jurisdiction_id: user.jurisdictionId,
        model_id: selectedModelId,
        owner_id: user.actorId,
        facility_id: facilityId,
        serial_number: serialNumber.trim(),
        year_of_manufacture: yearOfManufacture,
        intended_use: intendedUse,
        installation_location_notes: locationNotes,
      };

      await api.instruments.registerInstrument(user.tenantId, payload);
      notify('success', 'Instrument Registered', `Registered unit ${serialNumber} successfully.`);
      onRegistered();
      onClose();
    } catch (err) {
      notify('error', 'Registration Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Measuring Instrument"
      subtitle="Section 24 Statutory Registry of Trade Weighing & Measuring Instruments"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Model Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Approved Pattern / Model (Section 22 DCA Approval) *
          </label>
          <select
            value={selectedModelId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedModelId(newId);
              const m = models.find((mod) => mod.model_id === newId);
              if (m?.specifications && typeof m.specifications.application === 'string') {
                setIntendedUse(m.specifications.application);
              }
            }}
            className="w-full text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gov-blue"
          >
            {/* Category Groups */}
            <optgroup label="🛒 Commercial, Grocery & Retail Scales (Class III)">
              {models
                .filter((m) => m.subtype === 'COUNTER_SCALE_ELECTRONIC' || m.subtype === 'PRICE_COMPUTING_SCALE' || m.subtype === 'TABLETOP_SCALE_ELECTRONIC')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}, e={m.verification_scale_interval_e} {m.scale_interval_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="💎 Precious Jewelry & Bullion Balances (Class II High Accuracy)">
              {models
                .filter((m) => m.subtype === 'BULLION_BALANCE_HIGH_PRECISION' || m.subtype === 'JEWELRY_CARAT_BALANCE' || m.subtype === 'PRECISION_LABORATORY_BALANCE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}, e={m.verification_scale_interval_e} {m.scale_interval_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🔬 Special Accuracy Analytical Balances (Class I)">
              {models
                .filter((m) => m.accuracy_class === 'CLASS_I')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}, e={m.verification_scale_interval_e} {m.scale_interval_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🌾 APMC Mandi, Wholesale & Platform Scales (Class III)">
              {models
                .filter((m) => m.subtype === 'INDUSTRIAL_PLATFORM_SCALE' || m.subtype === 'HEAVY_DUTY_PLATFORM_SCALE' || m.subtype === 'AGRICULTURAL_MANDI_SCALE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}, e={m.verification_scale_interval_e} {m.scale_interval_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🥛 Dairy Automated Milk Collection Units (AMCU)">
              {models
                .filter((m) => m.subtype === 'AUTOMATED_MILK_COLLECTION_SCALE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🏗️ Heavy Crane & Hanging Scales">
              {models
                .filter((m) => m.subtype === 'WIRELESS_CRANE_SCALE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🚛 Highway Truck & Heavy Industrial Weighbridges (Class IIII)">
              {models
                .filter((m) => m.subtype === 'HIGHWAY_TRUCK_WEIGHBRIDGE' || m.subtype === 'HEAVY_INDUSTRIAL_WEIGHBRIDGE' || m.accuracy_class === 'CLASS_IIII')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}, e={m.verification_scale_interval_e} {m.scale_interval_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="📦 Automatic Gravimetric Catchweighers & Bagging (AWI)">
              {models
                .filter((m) => m.category === 'AWI')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="🏥 Medical & Healthcare Scales">
              {models
                .filter((m) => m.subtype === 'MEDICAL_PERSON_SCALE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="⛽ Motor Fuel & Petroleum Flow Meters (OIML R117)">
              {models
                .filter((m) => m.category === 'FLOW_METER')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>

            <optgroup label="📏 Linear & Dimensional Measures">
              {models
                .filter((m) => m.category === 'LINEAR_MEASURE')
                .map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.model_name} [{m.model_approval_number} — Max {m.max_capacity} {m.capacity_unit}]
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {/* Selected Model Technical Specs Preview Card */}
        {selectedModel && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Manufacturer &amp; Model</span>
                <strong className="text-slate-900 text-sm">{selectedModel.model_name}</strong>
                <p className="text-slate-600 text-[11px]">{selectedModel.manufacturer_name}</p>
              </div>
              <div className="text-right">
                <span className="font-mono text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                  {selectedModel.model_approval_number}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Govt Model Approval</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-slate-500 block text-[10px]">Accuracy Class:</span>
                <span className="font-bold text-slate-800">{selectedModel.accuracy_class}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Max Capacity:</span>
                <span className="font-bold text-slate-800">
                  {selectedModel.max_capacity} {selectedModel.capacity_unit}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Min Capacity:</span>
                <span className="font-bold text-slate-800">
                  {selectedModel.min_capacity} {selectedModel.capacity_unit}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Verification Scale Interval (e):</span>
                <span className="font-bold text-slate-800 font-mono">
                  {selectedModel.verification_scale_interval_e} {selectedModel.scale_interval_unit}
                </span>
              </div>
            </div>

            {selectedModel.specifications && (
              <div className="text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700">
                <strong className="text-slate-900">Statutory Use: </strong>
                {String(selectedModel.specifications.application || 'Commercial Trade & Legal Metrology Inspection')}
              </div>
            )}
          </div>
        )}

        {/* Serial & Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Manufacturer Serial Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. DL-2026-98122"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Year of Manufacture *
            </label>
            <input
              type="number"
              min={1990}
              max={2030}
              required
              value={yearOfManufacture}
              onChange={(e) => setYearOfManufacture(Number(e.target.value))}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-blue"
            />
          </div>
        </div>

        {/* Premises & Use */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Premises / Facility ID
            </label>
            <input
              type="text"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Intended Commercial Purpose
            </label>
            <input
              type="text"
              value={intendedUse}
              onChange={(e) => setIntendedUse(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-blue"
            />
          </div>
        </div>

        {/* Location notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Installation Location & Address Notes
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Counter 2, Star Hypermarket, Connaught Place, New Delhi"
            value={locationNotes}
            onChange={(e) => setLocationNotes(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Registering...' : 'Register Instrument Unit'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
