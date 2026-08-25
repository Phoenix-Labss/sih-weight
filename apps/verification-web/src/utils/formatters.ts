export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return '—';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateTimeStr;
  }
}

export function formatCurrency(amount?: number | null, currency = 'INR'): string {
  if (amount === undefined || amount === null) return '₹ 0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function maskSerialNumber(serialNumber?: string | null): string {
  if (!serialNumber) return '******';
  const clean = serialNumber.trim();
  if (clean.length <= 4) {
    return `******${clean}`;
  }
  const lastFour = clean.slice(-4);
  return `******${lastFour}`;
}

export function truncateHash(hashStr?: string | null, length = 16): string {
  if (!hashStr) return '—';
  if (hashStr.length <= length) return hashStr;
  return `${hashStr.substring(0, length / 2)}...${hashStr.substring(hashStr.length - length / 2)}`;
}

export function getStatusColorClasses(status: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case 'ISSUED':
    case 'VERIFIED':
    case 'PAYMENT_RECONCILED':
    case 'ACCEPTED':
    case 'COMPLETED':
    case 'VERIFICATION_PASSED_PENDING_AUTHORIZATION':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };

    case 'UNDER_SCRUTINY':
    case 'FEE_PENDING':
    case 'SCHEDULED':
    case 'IN_PROGRESS':
    case 'VERIFICATION_IN_PROGRESS':
    case 'PAYMENT_PROCESSING':
    case 'IDENTITY_CONFIRMED':
    case 'NEEDS_REVIEW':
    case 'PENDING_SIGNATURE':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };

    case 'EXPIRED':
    case 'OVERDUE':
    case 'VERIFICATION_DUE':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-800',
        border: 'border-orange-200',
        dot: 'bg-orange-500',
      };

    case 'REVOKED':
    case 'REJECTED':
    case 'PAYMENT_FAILED':
    case 'VERIFICATION_FAILED':
    case 'SEALED_OUT_OF_SERVICE':
    case 'SIGNING_FAILED':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };

    case 'SUSPENDED':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
      };

    case 'SUPERSEDED':
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };

    case 'DRAFT':
    case 'SUBMITTED':
    case 'QUERY_RAISED':
    case 'QUERY_RESPONDED':
    case 'PLANNED':
    case 'UNVERIFIED':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        dot: 'bg-slate-400',
      };
  }
}
