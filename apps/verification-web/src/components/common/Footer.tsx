import React from 'react';
import { Shield, Lock, FileText, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-900 text-xs text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 mb-8">
          {/* Col 1: Government Authority */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>Legal Metrology Division</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              Department of Consumer Affairs, Ministry of Consumer Affairs, Food &amp; Public Distribution, Government of India.
            </p>
            <p className="text-slate-500">
              Administered under The Legal Metrology Act, 2009 &amp; The Legal Metrology (General) Rules, 2011.
            </p>
          </div>

          {/* Col 2: Statutory Standards */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Statutory Directives</h4>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="https://consumeraffairs.gov.in/pages/legal-metrology-act"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-amber-400"
                >
                  <span>Legal Metrology Act, 2009</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
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
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Certificate Security</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>SHA-256 Digest Verification</span>
              </div>
              <p className="text-slate-400">Digital certificates are hashed and cryptographically signed.</p>
              <div className="flex items-center gap-1.5 pt-1 text-slate-300">
                <FileText className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>Zero-PII Public QR Token</span>
              </div>
              <p className="text-slate-400">Public verification pages reveal no trader personal or banking information.</p>
            </div>
          </div>

          {/* Col 4: Platform Reference */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Platform Reference</h4>
            <ul className="space-y-1">
              <li>Verification Procedure: IND-LM-NAWI-2026.1</li>
              <li>Jurisdiction: Delhi Central (JUR-DL-01)</li>
              <li className="pt-1 font-semibold text-emerald-400">National Unified Platform (v0.0.1)</li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row text-xs">
          <div className="space-y-0.5 text-center sm:text-left">
            <div className="font-semibold text-white">© {new Date().getFullYear()} Department of Legal Metrology</div>
            <div className="text-slate-400">
              Ministry of Consumer Affairs, Food &amp; Public Distribution, Government of India
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400">
            <span>NIC / MeitY</span>
            <span aria-hidden="true">•</span>
            <span>Privacy Policy</span>
            <span aria-hidden="true">•</span>
            <span>Terms of Service</span>
            <span aria-hidden="true">•</span>
            <span>Accessibility</span>
            <span aria-hidden="true">•</span>
            <span>Contact</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
