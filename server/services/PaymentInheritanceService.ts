import type { ExcelRow } from './ExcelService';
import { excelLogger } from './LoggerService';

/**
 * 付款資訊繼承服務
 * 負責處理費用報銷單從預先付款單繼承付款資訊
 */
export class PaymentInheritanceService {
  /**
   * 需要繼承的付款相關欄位
   */
  private static readonly PAYMENT_FIELDS = [
    '供應商/銀行/員工',
    '入帳對象代號',
    '入帳對象',
    '付款對象統編',
    '付款金額',
    '付款方式',
    '供應商來源',
    '付款銀行戶名',
    '付款銀行代號',
    '付款銀行名稱',
    '付款對象帳戶號碼',
  ];

  /**
   * 建立預先付款單索引
   * 以表單編號為鍵，方便後續查詢
   */
  static buildPrepaymentIndex(rows: ExcelRow[]): Map<string, ExcelRow> {
    const index = new Map<string, ExcelRow>();

    for (const row of rows) {
      const formType = row['表單種類'];
      const formNumber = row['表單編號'];

      // 只索引預先付款單
      if (formType === '預先付款單' && formNumber) {
        index.set(formNumber, row);
        excelLogger.debug('建立預先付款單索引', {
          formNumber,
          hasPaymentInfo: this.hasPaymentInfo(row),
        });
      }
    }

    excelLogger.info('預先付款單索引建立完成', {
      totalPrepayments: index.size,
    });

    return index;
  }

  /**
   * 為費用報銷單繼承付款資訊
   */
  static enrichPaymentInfo(
    rows: ExcelRow[],
    prepaymentIndex: Map<string, ExcelRow>
  ): ExcelRow[] {
    return rows.map((row) =>
      this.processRowPaymentInheritance(row, prepaymentIndex)
    );
  }

  /**
   * 處理單一行的付款資訊繼承
   */
  private static processRowPaymentInheritance(
    row: ExcelRow,
    prepaymentIndex: Map<string, ExcelRow>
  ): ExcelRow {
    const enrichedRow = { ...row };

    // 只處理費用報銷單
    if (!this.isExpenseReimbursementForm(enrichedRow)) {
      return enrichedRow;
    }

    // 查找對應的預先付款單
    const prepaymentData = this.findPrepaymentData(
      enrichedRow,
      prepaymentIndex
    );

    if (!prepaymentData) {
      this.logMissingPrepayment(enrichedRow);
      return enrichedRow;
    }

    // 繼承付款資訊
    this.inheritPaymentInfo(enrichedRow, prepaymentData);
    this.logSuccessfulInheritance(enrichedRow, prepaymentData);

    return enrichedRow;
  }

  /**
   * 記錄找不到預先付款單的警告
   */
  private static logMissingPrepayment(row: ExcelRow): void {
    excelLogger.warn('找不到對應的預先付款單', {
      expenseFormNumber: row['表單編號'],
      prepaymentFormNumber: row['勾稽單號'],
    });
  }

  /**
   * 記錄成功繼承的資訊
   */
  private static logSuccessfulInheritance(
    enrichedRow: ExcelRow,
    prepaymentData: ExcelRow
  ): void {
    excelLogger.info('費用報銷單付款資訊繼承完成', {
      expenseFormNumber: enrichedRow['表單編號'],
      prepaymentFormNumber: enrichedRow['勾稽單號'],
      inheritedFields: this.getInheritedFields(enrichedRow, prepaymentData),
    });
  }

  /**
   * 檢查是否為費用報銷單
   */
  private static isExpenseReimbursementForm(row: ExcelRow): boolean {
    return row['表單種類'] === '費用報銷單';
  }

  /**
   * 根據勾稽單號找到對應的預先付款單資料
   */
  private static findPrepaymentData(
    expenseRow: ExcelRow,
    prepaymentIndex: Map<string, ExcelRow>
  ): ExcelRow | null {
    const prepaymentFormNumber = expenseRow['勾稽單號'];

    if (!prepaymentFormNumber) {
      return null;
    }

    return prepaymentIndex.get(prepaymentFormNumber) || null;
  }

  /**
   * 繼承付款資訊
   */
  private static inheritPaymentInfo(target: ExcelRow, source: ExcelRow): void {
    for (const field of this.PAYMENT_FIELDS) {
      const sourceValue = source[field];

      // 只有當目標欄位為空且來源有值時才繼承
      if (this.isValueEmpty(target[field]) && !this.isValueEmpty(sourceValue)) {
        target[field] = sourceValue;
        excelLogger.debug('繼承付款欄位', {
          field,
          value: sourceValue,
        });
      }
    }
  }

  /**
   * 檢查值是否為空
   */
  private static isValueEmpty(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      value === '' ||
      (typeof value === 'string' && value.trim() === '')
    );
  }

  /**
   * 檢查是否有付款資訊
   */
  private static hasPaymentInfo(row: ExcelRow): boolean {
    return this.PAYMENT_FIELDS.some((field) => !this.isValueEmpty(row[field]));
  }

  /**
   * 取得已繼承的欄位清單
   */
  private static getInheritedFields(
    target: ExcelRow,
    source: ExcelRow
  ): string[] {
    return this.PAYMENT_FIELDS.filter((field) => {
      const targetValue = target[field];
      const sourceValue = source[field];
      return !this.isValueEmpty(targetValue) && !this.isValueEmpty(sourceValue);
    });
  }
}
