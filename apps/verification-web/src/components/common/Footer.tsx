import React from 'react';
import { Shield, Lock, FileText, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: Government Authority */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Legal Metrology Division</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Department of Consumer Affairs, Ministry of Consumer Affairs, Food & Public Distribution, Government of India.
            </p>
            <p className="text-[11px] text-slate-500">
              Administered under The Legal Metrology Act, 2009 & The Legal Metrology (General) Rules, 2011.
            </p>
          </div>

          {/* Col 2: Statutory Standards */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Statutory Directives</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <a
                  href="https://consumeraffairs.gov.in/pages/legal-metrology-act"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-amber-400 flex items-center gap-1 transition-colors"
                >
                  <span>Legal Metrology Act, 2009</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Section 24: Mandatory Periodic Verification</li>
              <li>Section 22: Statutory Model Approval</li>
              <li>OIML R 76-1: Non-Automatic Weighing</li>
              <li>OIML R 111: Weight Classes E1 to M3</li>
            </ul>
          </div>

          {/* Col 3: Security & Trust */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Cryptographic Security</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>SHA-256 Digest Verification</span>
              </div>
              <p className="text-slate-400">Digital certificates are immutably hashed and cryptographically signed.</p>
              <div className="flex items-center gap-1.5 text-slate-300 pt-1">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Zero-PII Public QR Token</span>
              </div>
              <p className="text-slate-400">Public scan pages reveal zero trader personal or banking information.</p>
            </div>
          </div>

          {/* Col 4: Platform Architecture */}
          <div className="space-y-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Platform Specifications</h4>
            <ul className="space-y-1 text-[11px] font-mono text-slate-400">
              <li>Framework: React 18 + Vite + TS</li>
              <li>Backend: FastAPI + PostgreSQL</li>
              <li>Procedure: IND-LM-NAWI-2026.1</li>
              <li>Jurisdiction: Delhi Central (JUR-DL-01)</li>
              <li className="text-emerald-400 pt-1 font-sans font-semibold">National Unified Platform (v0.0.1)</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            © {new Date().getFullYear()} National Legal Metrology Platform. All Rights Reserved.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>NIC / MeitY Compliant</span>
            <span>•</span>
            <span>DPDP Act 2023 Aligned</span>
            <span>•</span>
            <span>Deterministic Metrological Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
