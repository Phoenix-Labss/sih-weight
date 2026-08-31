import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Instrument } from '../../types/instrument';
import { ApplicationCreateRequest, ApplicationType, ServiceMode } from '../../types/application';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { api } from '../../api/client';
import { CheckCircle2, ChevronRight, ShieldAlert, Calendar, MapPin, Scale } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface VerificationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  instruments: Instrument[];
  onApplicationCreated: () => void;
}

export const VerificationWizard: React.FC<VerificationWizardProps> = ({
  isOpen,
  onClose,
  instruments,
  onApplicationCreated,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    instruments[0]?.instrument_id || ''
  );
  const [applicationType, setApplicationType] = useState<ApplicationType>('PERIODICAL_REVERIFICATION');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('ON_SITE');
  const [preferredDate, setPreferredDate] = useState<string>(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedInst = instruments.find((i) => i.instrument_id === selectedInstrumentId) || instruments[0];

  // Calculate estimated fee
  const baseFee = selectedInst?.model?.accuracy_class === 'CLASS_II' ? 1500 : 1000;
  const userCharge = serviceMode === 'ON_SITE' ? 200 : 0;
  const estimatedTotal = baseFee + userCharge;

  const handleNext = () => {
    if (currentStep === 1 && !selectedInstrumentId) {
      notify('error', 'Select Instrument', 'Please select an instrument to verify.');
      return;
    }
    if (currentStep === 3 && !declarationAccepted) {
      notify('error', 'Declaration Required', 'You must accept the statutory legal declaration before submitting.');
      return;
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: ApplicationCreateRequest = {
        instrument_id: selectedInstrumentId,
        applicant_id: user.actorId,
        application_type: applicationType,
        service_mode: serviceMode,
        preferred_verification_date: preferredDate,
        applicant_declaration_accepted: declarationAccepted,
      };

      await api.applications.createApplication(user.tenantId, payload);
      notify('success', 'Application Submitted', 'Verification application filed successfully for departmental scrutiny.');
      onApplicationCreated();
      onClose();
      setCurrentStep(1);
    } catch (err) {
      notify('error', 'Submission Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="File Verification Application"
      subtitle="4-Step Statutory Wizard under Section 24 of The Legal Metrology Act, 2009"
      maxWidth="4xl"
    >
      {/* Wizard Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
          <span className={currentStep >= 1 ? 'text-gov-blue font-bold' : ''}>1. Select Instrument</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={currentStep >= 2 ? 'text-gov-blue font-bold' : ''}>2. Mode & Schedule</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={currentStep >= 3 ? 'text-gov-blue font-bold' : ''}>3. Statutory Declaration</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={currentStep >= 4 ? 'text-gov-blue font-bold' : ''}>4. Review & Submit</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gov-blue h-full transition-all duration-300"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Select Instrument */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Select the registered weighing or measuring instrument unit requiring statutory verification:
          </p>
          <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1">
            {instruments.map((inst) => {
              const isSelected = inst.instrument_id === selectedInstrumentId;
              return (
                <div
                  key={inst.instrument_id}
                  onClick={() => setSelectedInstrumentId(inst.instrument_id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-gov-blue bg-blue-50/60 ring-2 ring-gov-blue/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-gov-blue text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Scale className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {inst.model?.model_name || 'Standard Scale'}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Serial: {inst.serial_number} | Class: {inst.model?.accuracy_class} | Max: {inst.model?.max_capacity} {inst.model?.capacity_unit}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-gov-blue" />}
                  </div>
                  {inst.installation_location_notes && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{inst.installation_location_notes}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Mode & Schedule */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Verification Purpose *
            </label>
            <select
              value={applicationType}
              onChange={(e) => setApplicationType(e.target.value as ApplicationType)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-gov-blue"
            >
              <option value="PERIODICAL_REVERIFICATION">Periodical Re-Verification (Annual Statutory Due)</option>
              <option value="INITIAL_VERIFICATION">Initial Verification (Newly Manufactured / Imported)</option>
              <option value="VERIFICATION_AFTER_REPAIR">Verification After Repair / Seal Break</option>
              <option value="VOLUNTARY_VERIFICATION">Voluntary Special Verification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Service Delivery Mode *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'ON_SITE',
                  title: 'On-Site Inspection',
                  desc: 'LMO visits commercial trader premises',
                },
                {
                  id: 'DEPARTMENTAL_LAB',
                  title: 'Departmental Lab',
                  desc: 'Trader brings unit to Metrology Lab',
                },
                {
                  id: 'GATC_CENTRE',
                  title: 'GATC Testing Centre',
                  desc: 'Government Approved Test Centre facility',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setServiceMode(m.id as ServiceMode)}
                  className={`p-3 rounded-lg border cursor-pointer text-xs transition-all ${
                    serviceMode === m.id
                      ? 'border-gov-blue bg-blue-50/60 font-semibold text-gov-navy'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900">{m.title}</div>
                  <div className="text-xs text-slate-500 font-normal mt-0.5">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Preferred Inspection Date *
            </label>
            <div className="relative">
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 pl-9 focus:ring-2 focus:ring-gov-blue"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Statutory Declaration */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Statutory Undertaking under The Legal Metrology Act, 2009</span>
            </div>
            <p className="leading-relaxed">
              I hereby solemnly affirm and declare that the measuring instrument particulars submitted herein correspond
              truthfully to the physical unit in trade use at the registered location.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>The instrument has not been tampered with, altered, or modified from its approved pattern.</li>
              <li>I undertake to pay the assessed statutory verification fees via government treasury challan.</li>
              <li>I shall facilitate inspection by the Legal Metrology Officer and make available suitable working standard weights if required.</li>
              <li>I understand that false statements or unauthorized commercial trade use without valid verification is an offense under Section 30 of the Act.</li>
            </ul>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-gov-blue focus:ring-gov-blue"
            />
            <span className="text-xs font-semibold text-slate-800">
              I accept the statutory undertaking and agree to abide by the Legal Metrology Rules, 2011.
            </span>
          </label>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h4 className="font-bold text-sm text-gov-navy border-b pb-2">Application Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Instrument:</span>
                <span className="font-semibold text-slate-800">{selectedInst?.model?.model_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Serial Number:</span>
                <span className="font-semibold text-slate-800 font-mono">{selectedInst?.serial_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Accuracy Class:</span>
                <span className="font-semibold text-slate-800">{selectedInst?.model?.accuracy_class}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Application Type:</span>
                <span className="font-semibold text-slate-800">{applicationType.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Service Mode:</span>
                <span className="font-semibold text-slate-800">{serviceMode.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Preferred Date:</span>
                <span className="font-semibold text-slate-800">{preferredDate}</span>
              </div>
            </div>

            {/* Estimated Fee Assessment */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 mt-2">
              <div className="flex justify-between items-center text-xs pb-1 border-b">
                <span className="text-slate-600">Base Statutory Verification Fee:</span>
                <span className="font-mono font-semibold">{formatCurrency(baseFee)}</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b">
                <span className="text-slate-600">Inspection & User Charges:</span>
                <span className="font-mono font-semibold">{formatCurrency(userCharge)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 font-bold text-gov-navy">
                <span>Estimated Total Assessment:</span>
                <span className="font-mono text-sm text-emerald-700">{formatCurrency(estimatedTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation Buttons */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-lg bg-gov-blue text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
          >
            Proceed to Step {currentStep + 1}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application for Scrutiny'}
          </button>
        )}
      </div>
    </Modal>
  );
};
