import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PhysicalStamp, PhysicalStampRecordRequest, PhysicalSealAction, SealType } from '../../types/stamp';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { Shield, Camera, CheckCircle2, Lock } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

interface StampRecordFormProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  instrumentId: string;
  onStampRecorded: (stamp: PhysicalStamp) => void;
}

export const StampRecordForm: React.FC<StampRecordFormProps> = ({
  isOpen,
  onClose,
  sessionId,
  instrumentId,
  onStampRecorded,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [actionType, setActionType] = useState<PhysicalSealAction>('SEAL_APPLIED');
  const [sealType, setSealType] = useState<SealType>('LEAD_WIRE_SEAL');
  const [sealNumber, setSealNumber] = useState(`DL-SEAL-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [sealPosition, setSealPosition] = useState('CALIBRATION_PORT_MAIN');
  const [photoHash, setPhotoHash] = useState('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  const [notes, setNotes] = useState('Official Delhi LM lead wire seal embossed with department emblem.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sealNumber.trim()) {
      notify('error', 'Seal Number Required', 'Please provide the physical seal identifier.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PhysicalStampRecordRequest = {
        instrument_id: instrumentId,
        action_type: actionType,
        seal_type: sealType,
        seal_identification_number: sealNumber.trim(),
        seal_position: sealPosition.trim(),
        photo_evidence_hash: photoHash || undefined,
        notes: notes.trim() || undefined,
      };

      const result = await api.stamps.recordStampAction(user.tenantId, sessionId, payload);
      notify(
        'success',
        'Physical Seal Recorded in Decoupled Ledger',
        `Affixed seal ${result.seal_identification_number} at ${result.seal_position}`
      );
      onStampRecorded(result);
      onClose();
    } catch (err) {
      notify('error', 'Recording Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Physical Stamping & Security Sealing"
      subtitle="Statutory Decoupled Physical Seal Ledger under Legal Metrology Rules"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Seal Decoupling Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-gov-blue flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Mandatory Domain Safety Rule (AGENTS.md §3.2)</strong>: Physical lead wire seals, stamping marks, and tamper-evident stickers are recorded independently in this tamper-evident ledger, strictly decoupled from digital certificates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Physical Action Type *
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as PhysicalSealAction)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="SEAL_APPLIED">Seal Applied (New Lead Wire / Sticker)</option>
              <option value="SEAL_INSPECTED_INTACT">Seal Inspected & Found Intact</option>
              <option value="SEAL_BROKEN_RECORDED">Broken / Tampered Seal Recorded</option>
              <option value="SEAL_REPLACED">Seal Replaced After Maintenance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Seal & Mark Material *
            </label>
            <select
              value={sealType}
              onChange={(e) => setSealType(e.target.value as SealType)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="LEAD_WIRE_SEAL">Lead Wire Seal with Die Impression</option>
              <option value="TAMPER_EVIDENT_STICKER">Holographic Tamper-Evident Sticker</option>
              <option value="HEAT_SHRINK_SEAL">Heat Shrink Polymeric Collar Seal</option>
              <option value="SECURITY_LABEL">Numbered Barcoded Security Label</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Seal Identifier / Die Serial Number *
            </label>
            <input
              type="text"
              required
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              className="w-full text-xs font-mono font-bold rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-gov-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Seal Position on Instrument *
            </label>
            <select
              value={sealPosition}
              onChange={(e) => setSealPosition(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="CALIBRATION_PORT_MAIN">Main Calibration Port / Jumper Cover</option>
              <option value="HOUSING_SCREW_JUNCTION">Housing Junction Screw Seal</option>
              <option value="LOAD_CELL_JUNCTION_BOX">Load Cell Cable Junction Box</option>
              <option value="ANALOG_BOARD_ENCLOSURE">Analog Mainboard Security Casing</option>
            </select>
          </div>
        </div>

        {/* Photo evidence SHA-256 */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-slate-500" />
              <span>Photo Evidence SHA-256 Hash Digest</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Immutable Integrity Check</span>
          </label>
          <input
            type="text"
            value={photoHash}
            onChange={(e) => setPhotoHash(e.target.value)}
            className="w-full text-xs font-mono text-slate-700 rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Physical Inspection Remarks
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-gov-blue"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gov-navy text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSubmitting ? 'Recording...' : 'Affix & Record Physical Seal'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
