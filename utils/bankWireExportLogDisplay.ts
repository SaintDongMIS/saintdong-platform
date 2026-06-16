/** BankWireExport_Log 列表 UI 共用格式 */

export type BankWireBatchTypeFilter =
  | ''
  | 'commeet'
  | 'adhoc'
  | 'manual_backfill';

export type BankWireExportLogRow = {
  id: string;
  batchId: string;
  exportedAt: string;
  sourceFilename: string;
  mergedLineIndex: number;
  payeeName: string;
  payeeAccountDigits: string | null;
  bankCodeDigits: string | null;
  branchCode: string | null;
  payeeBankCode7: string | null;
  payeeAccountId: string | null;
  scheduledTxDate: string | null;
  batchType: string | null;
  lineNote: string | null;
  alreadyUploaded: boolean;
  formNo: string;
  amountCents: string;
};

export const BANK_WIRE_BATCH_TYPE_OPTIONS: {
  value: BankWireBatchTypeFilter;
  label: string;
}[] = [
  { value: '', label: '全部類型' },
  { value: 'commeet', label: 'Commeet' },
  { value: 'adhoc', label: '臨時整批' },
  { value: 'manual_backfill', label: '事後登錄' },
];

export function batchTypeLabel(t: string | null | undefined): string {
  switch (t) {
    case 'commeet':
      return 'Commeet';
    case 'adhoc':
      return '臨時';
    case 'manual_backfill':
      return '事後登錄';
    default:
      return t ? String(t) : 'Commeet';
  }
}

export function batchTypeBadgeClass(t: string | null | undefined): string {
  switch (t) {
    case 'adhoc':
      return 'bg-amber-100 text-amber-900';
    case 'manual_backfill':
      return 'bg-violet-100 text-violet-900';
    case 'commeet':
    default:
      return 'bg-emerald-100 text-emerald-900';
  }
}

export function formatAmountCentsDisplay(amountCents: string | number): string {
  const cents =
    typeof amountCents === 'number'
      ? amountCents
      : parseInt(String(amountCents), 10);
  if (!Number.isFinite(cents)) return String(amountCents);
  const yuan = Math.floor(cents / 100);
  const dec = cents % 100;
  return (
    yuan.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) +
    '.' +
    String(dec).padStart(2, '0')
  );
}

export function formatExportedAtTaipei(isoLike: string): string {
  if (!isoLike) return '—';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) {
    return isoLike.slice(0, 19).replace('T', ' ');
  }
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatYmdDisplay(ymd: string | null | undefined): string {
  const s = String(ymd ?? '').trim();
  if (!/^\d{8}$/.test(s)) return '—';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function buildBankWireLogListUrl(options?: {
  limit?: number;
  batchType?: BankWireBatchTypeFilter;
  q?: string;
}): string {
  const params = new URLSearchParams();
  const limit = options?.limit ?? 200;
  params.set('limit', String(limit));
  if (options?.batchType) params.set('batchType', options.batchType);
  const q = String(options?.q ?? '').trim();
  if (q) params.set('q', q);
  return `/api/bank-wire-export-log?${params.toString()}`;
}
