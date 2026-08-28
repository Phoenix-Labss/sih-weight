import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Instrument } from '../../types/instrument';
import { VerificationSession } from '../../types/session';
import { CheckCircle2, AlertTriangle, ShieldCheck, Scale, QrCode } from 'lucide-react';
import { PhotoEvidenceHasher } from '../common/PhotoEvidenceHasher';

interface PhysicalSerialMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: Instrument | null | undefined;
  session: VerificationSession | null | undefined;
  onConfirmMatch: (physicalSerial: string) => Promise<void>;
}

export const PhysicalSerialMatchModal: React.FC<PhysicalSerialMatchModalProps> = ({
  isOpen,
  onClose,
  instrument,
  session,
  onConfirmMatch,
}) => {
  const registeredSerial = instrument?.serial_number || 'N/A';
  const [enteredSerial, setEnteredSerial] = useState('');
  const [sealChecked, setSealChecked] = useState(false);
  const [photoHash, setPhotoHash] = useState('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !session) return null;

  const handleVerifyAndConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const entered = enteredSerial.trim();
    if (!entered) {
      setErrorMessage('Please enter the serial number observed on the physical instrument nameplate.');
      return;
    }

    if (entered.toLowerCase() !== registeredSerial.trim().toLowerCase()) {
      setErrorMessage(
        `Physical Serial Mismatch: Entered physical serial "${entered}" does not match registered record "${registeredSerial}". Legal Metrology regulations prohibit testing an unverified physical unit.`
      );
      return;
    }

    if (!sealChecked) {
      setErrorMessage('Please check and confirm the visual inspection of the instrument chassis and lead seals.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmMatch(entered);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Physical verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutofill = () => {
    setEnteredSerial(registeredSerial);
    setSealChecked(true);
    setErrorMessage('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Instrument Serial & Stamping Plate Verification"
      subtitle={`Session: ${session.session_id} | On-Site Physical Identity Confirmation`}
      maxWidth="lg"
    >
      <form onSubmit={handleVerifyAndConfirm} className="space-y-4">
        {/* Registered vs Physical comparison banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-gov-navy flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-gov-blue" />
              <span>Registered Instrument Specifications</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold text-[10px]">
              Class {instrument?.model?.accuracy_class || 'CLASS_III'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block">Registered Model:</span>
              <strong className="text-slate-900">{instrument?.model?.model_name || 'Counter Scale'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Registered Serial No:</span>
              <strong className="font-mono text-gov-navy bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                {registeredSerial}
              </strong>
            </div>
          </div>
        </div>

        {/* Physical input field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Enter Physical Serial Number (Observed on Nameplate) *
            </label>
            <button
              type="button"
              onClick={handleAutofill}
              className="text-[10px] text-gov-blue hover:text-blue-800 font-semibold underline cursor-pointer"
            >
              [ Autofill Registered SN ]
            </button>
          </div>

          <input
            type="text"
            required
            autoFocus
            placeholder={`Enter physical serial from instrument plate (e.g. ${registeredSerial})`}
            value={enteredSerial}
            onChange={(e) => {
              setEnteredSerial(e.target.value);
              setErrorMessage('');
            }}
            className={`w-full text-xs font-mono font-bold rounded-lg border px-3 py-2.5 focus:ring-2 focus:ring-gov-blue bg-white ${
              errorMessage
                ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                : enteredSerial.toLowerCase() === registeredSerial.toLowerCase() && enteredSerial.length > 0
                ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950'
                : 'border-slate-300'
            }`}
          />
        </div>

        {/* Photo Evidence Hashing Engine */}
        <PhotoEvidenceHasher
          value={photoHash}
          onChange={(h) => setPhotoHash(h)}
          label="Instrument Nameplate & Chassis Photo Evidence"
          defaultSampleType="nameplate"
          helperText="Captures on-site physical photograph of the serial nameplate & computes cryptographic SHA-256 byte digest."
        />

        {/* Checkbox confirmation */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={sealChecked}
              onChange={(e) => {
                setSealChecked(e.target.checked);
                setErrorMessage('');
              }}
              className="mt-0.5 rounded border-slate-300 text-gov-blue focus:ring-gov-blue"
            />
            <span>
              I confirm that I have physically inspected the instrument chassis, manufacturer stamp plate, and lead seal integrity on-site.
            </span>
          </label>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Modal footer actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-gov-navy text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isSubmitting ? 'Verifying...' : 'Confirm Physical Serial Match'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
