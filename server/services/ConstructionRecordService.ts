import { getConnectionPool } from '../config/database';
import sql from 'mssql';
import { apiLogger } from './LoggerService';
import { sanitizeString, validateQuantity, validateDate } from '../utils/validationHelper';

export interface ConstructionRecord {
  DCRid?: number;
  單位: string;
  日期: string;
  建立時間?: Date;
  更新時間?: Date;
  // 動態欄位：從明細表組合而來
  [key: string]: any;
}

export interface ConstructionRecordDetail {
  DetailId?: number;
  RecordId: number;
  ItemId: number;
  Quantity: number;
  UnitPrice: number;
  Amount: number;
}

export interface QueryOptions {
  startDate?: string;
  endDate?: string;
  單位?: string;
  page?: number;
  limit?: number;
}

export class ConstructionRecordService {
  /**
   * 查詢記錄（JOIN 明細表，組合成寬表格式以保持向後兼容）
   */
  static async getRecords(options: QueryOptions = {}) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      const {
        startDate,
        endDate,
        單位,
        page = 1,
        limit = 100,
      } = options;

      // 建立 WHERE 條件
      const whereConditions: string[] = [];

      if (startDate) {
        whereConditions.push('R.[日期] >= @startDate');
        request.input('startDate', sql.Date, startDate);
      }

      if (endDate) {
        whereConditions.push('R.[日期] <= @endDate');
        request.input('endDate', sql.Date, endDate);
      }

      if (單位) {
        whereConditions.push('R.[單位] = @單位');
        request.input('單位', sql.NVarChar, 單位);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(' AND ')}`
          : '';

      // 計算總數
      const countQuery = `
        SELECT COUNT(DISTINCT R.DCRid) as total
        FROM DailyConstructionRecord R
        ${whereClause}
      `;

      const countResult = await request.query(countQuery);
      const total = countResult.recordset[0].total;

      // 查詢資料（JOIN 明細表）
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          R.DCRid,
          R.[單位],
          CONVERT(VARCHAR, R.[日期], 23) as [日期],
          R.[建立時間],
          R.[更新時間],
          D.DetailId,
          D.ItemId,
          I.ItemName,
          I.Unit,
          D.Quantity,
          D.UnitPrice,
          D.Amount
        FROM DailyConstructionRecord R
        LEFT JOIN ConstructionRecordDetail D ON R.DCRid = D.RecordId
        LEFT JOIN ConstructionItemMaster I ON D.ItemId = I.ItemId
        ${whereClause}
        ORDER BY R.[日期] DESC, R.[單位] ASC, I.DisplayOrder ASC
      `;

      request.input('offset', sql.Int, offset);
      request.input('limit', sql.Int, limit);

      const dataResult = await request.query(dataQuery);

      // 將 JOIN 結果組合成寬表格式（向後兼容）
      const recordsMap = new Map<number, any>();

      dataResult.recordset.forEach((row) => {
        const recordId = row.DCRid;

        if (!recordsMap.has(recordId)) {
          recordsMap.set(recordId, {
            DCRid: row.DCRid,
            單位: row.單位,
            日期: row.日期,
            建立時間: row.建立時間,
            更新時間: row.更新時間,
            _details: [], // 內部使用，保留明細資訊
          });
        }

        // 組合明細資料
        if (row.DetailId) {
          const record = recordsMap.get(recordId);
          
          // 動態欄位：根據項目名稱建立欄位（向後兼容舊格式）
          const fieldName = this.getFieldNameFromItemName(row.ItemName);
          record[fieldName] = row.Quantity;

          // 保留明細資訊供後續使用
          record._details.push({
            DetailId: row.DetailId,
            ItemId: row.ItemId,
            ItemName: row.ItemName,
            Unit: row.Unit,
            Quantity: row.Quantity,
            UnitPrice: row.UnitPrice,
            Amount: row.Amount,
          });
        }
      });

      const data = Array.from(recordsMap.values()).slice(
        offset,
        offset + limit
      );

      return {
        success: true,
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      apiLogger.error('查詢施工記錄失敗', error);
      throw new Error(
        `查詢施工記錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 新增記錄（主記錄 + 明細）
   */
  static async createRecord(record: ConstructionRecord) {
    const pool = await getConnectionPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // 驗證必要欄位
      if (!record.單位 || !record.日期) {
        throw new Error('單位和日期為必填欄位');
      }

      // 驗證日期格式
      const dateValidation = validateDate(record.日期);
      if (!dateValidation.valid) {
        throw new Error(dateValidation.message || '日期格式錯誤');
      }

      // 清理單位字串
      const cleanedUnit = sanitizeString(record.單位, 50);
      if (!cleanedUnit) {
        throw new Error('單位格式錯誤');
      }

      // 檢查是否已存在相同單位和日期的記錄
      const checkRequest = new sql.Request(transaction);
      checkRequest.input('check單位', sql.NVarChar, cleanedUnit);
      checkRequest.input('check日期', sql.Date, record.日期);

      const checkResult = await checkRequest.query(`
        SELECT DCRid FROM DailyConstructionRecord
        WHERE [單位] = @check單位 AND [日期] = @check日期
      `);

      if (checkResult.recordset.length > 0) {
        throw new Error('該單位在此日期已有記錄，請使用更新功能');
      }

      // 1. 建立主記錄
      const insertRequest = new sql.Request(transaction);
      insertRequest.input('單位', sql.NVarChar, cleanedUnit);
      insertRequest.input('日期', sql.Date, record.日期);

      const insertResult = await insertRequest.query(`
        INSERT INTO DailyConstructionRecord ([單位], [日期])
        VALUES (@單位, @日期);
        SELECT SCOPE_IDENTITY() as DCRid;
      `);

      const newRecordId = insertResult.recordset[0].DCRid;

      // 2. 如果有數量資料，建立明細記錄
      // 從動態欄位中提取數量（向後兼容）
      const items = await this.getActiveItemsFromMaster(transaction);
      
      for (const item of items) {
        const fieldName = this.getFieldNameFromItemName(item.ItemName);
        const quantity = record[fieldName];

        if (quantity && quantity > 0) {
          // 驗證數量
          const quantityValidation = validateQuantity(quantity);
          if (!quantityValidation.valid) {
            throw new Error(`${item.ItemName} 的數量無效: ${quantityValidation.message}`);
          }

          const validQuantity = quantityValidation.value || 0;

          const detailRequest = new sql.Request(transaction);
          detailRequest.input('RecordId', sql.Int, newRecordId);
          detailRequest.input('ItemId', sql.Int, item.ItemId);
          detailRequest.input('Quantity', sql.Decimal(18, 2), validQuantity);
          detailRequest.input('UnitPrice', sql.Decimal(18, 2), item.Price);
          detailRequest.input(
            'Amount',
            sql.Decimal(18, 2),
            validQuantity * item.Price
          );

          await detailRequest.query(`
            INSERT INTO ConstructionRecordDetail (RecordId, ItemId, Quantity, UnitPrice, Amount)
            VALUES (@RecordId, @ItemId, @Quantity, @UnitPrice, @Amount)
          `);
        }
      }

      await transaction.commit();

      apiLogger.info('新增施工記錄成功', {
        DCRid: newRecordId,
        單位: record.單位,
        日期: record.日期,
      });

      return {
        success: true,
        DCRid: newRecordId,
        message: '新增成功',
      };
    } catch (error) {
      await transaction.rollback();
      apiLogger.error('新增施工記錄失敗', error);
      throw new Error(
        `新增施工記錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 更新記錄（更新明細）
   */
  static async updateRecord(id: number, record: Partial<ConstructionRecord>) {
    const pool = await getConnectionPool();
    const transaction = pool.transaction();

    try {
      await transaction.begin();

      const updateFields: string[] = [];
      const updateRequest = new sql.Request(transaction);

      // 更新主表的基本欄位
      if (record.單位 !== undefined) {
        const cleanedUnit = sanitizeString(record.單位, 50);
        if (!cleanedUnit) {
          throw new Error('單位格式錯誤');
        }
        updateFields.push('[單位] = @單位');
        updateRequest.input('單位', sql.NVarChar, cleanedUnit);
      }

      if (record.日期 !== undefined) {
        const dateValidation = validateDate(record.日期);
        if (!dateValidation.valid) {
          throw new Error(dateValidation.message || '日期格式錯誤');
        }
        updateFields.push('[日期] = @日期');
        updateRequest.input('日期', sql.Date, record.日期);
      }

      if (updateFields.length > 0) {
        updateFields.push('[更新時間] = GETDATE()');
        updateRequest.input('DCRid', sql.Int, id);

        await updateRequest.query(`
          UPDATE DailyConstructionRecord
          SET ${updateFields.join(', ')}
          WHERE DCRid = @DCRid
        `);
      }

      // 更新明細（數量欄位）
      const items = await this.getActiveItemsFromMaster(transaction);

      for (const item of items) {
        const fieldName = this.getFieldNameFromItemName(item.ItemName);
        const quantity = record[fieldName];

        if (quantity !== undefined) {
          // 驗證數量
          const quantityValidation = validateQuantity(quantity);
          if (!quantityValidation.valid) {
            throw new Error(`${item.ItemName} 的數量無效: ${quantityValidation.message}`);
          }

          const validQuantity = quantityValidation.value || 0;

          // 檢查是否已存在明細
          const checkRequest = new sql.Request(transaction);
          checkRequest.input('RecordId', sql.Int, id);
          checkRequest.input('ItemId', sql.Int, item.ItemId);

          const existing = await checkRequest.query(`
            SELECT DetailId, UnitPrice FROM ConstructionRecordDetail
            WHERE RecordId = @RecordId AND ItemId = @ItemId
          `);

          if (existing.recordset.length > 0) {
            // 更新現有明細（保留原本的 UnitPrice）
            const existingDetail = existing.recordset[0];
            const updateDetailRequest = new sql.Request(transaction);
            updateDetailRequest.input('DetailId', sql.Int, existingDetail.DetailId);
            updateDetailRequest.input('Quantity', sql.Decimal(18, 2), validQuantity);
            updateDetailRequest.input(
              'Amount',
              sql.Decimal(18, 2),
              validQuantity * existingDetail.UnitPrice
            );

            await updateDetailRequest.query(`
              UPDATE ConstructionRecordDetail
              SET Quantity = @Quantity,
                  Amount = @Amount,
                  UpdatedAt = GETDATE()
              WHERE DetailId = @DetailId
            `);
          } else if (validQuantity > 0) {
            // 新增明細（使用當前的單價）
            const insertDetailRequest = new sql.Request(transaction);
            insertDetailRequest.input('RecordId', sql.Int, id);
            insertDetailRequest.input('ItemId', sql.Int, item.ItemId);
            insertDetailRequest.input('Quantity', sql.Decimal(18, 2), validQuantity);
            insertDetailRequest.input('UnitPrice', sql.Decimal(18, 2), item.Price);
            insertDetailRequest.input(
              'Amount',
              sql.Decimal(18, 2),
              validQuantity * item.Price
            );

            await insertDetailRequest.query(`
              INSERT INTO ConstructionRecordDetail (RecordId, ItemId, Quantity, UnitPrice, Amount)
              VALUES (@RecordId, @ItemId, @Quantity, @UnitPrice, @Amount)
            `);
          }
        }
      }

      await transaction.commit();

      apiLogger.info('更新施工記錄成功', { DCRid: id });

      return {
        success: true,
        message: '更新成功',
      };
    } catch (error) {
      await transaction.rollback();
      apiLogger.error('更新施工記錄失敗', error);
      throw new Error(
        `更新施工記錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 刪除記錄（CASCADE 會自動刪除明細）
   */
  static async deleteRecord(id: number) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      request.input('DCRid', sql.Int, id);

      const deleteQuery = `
        DELETE FROM DailyConstructionRecord
        WHERE DCRid = @DCRid
      `;

      const result = await request.query(deleteQuery);

      if (result.rowsAffected[0] === 0) {
        throw new Error('找不到要刪除的記錄');
      }

      apiLogger.info('刪除施工記錄成功', { DCRid: id });

      return {
        success: true,
        message: '刪除成功',
      };
    } catch (error) {
      apiLogger.error('刪除施工記錄失敗', error);
      throw new Error(
        `刪除施工記錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 取得單筆記錄（JOIN 明細表）
   */
  static async getRecordById(id: number) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      request.input('DCRid', sql.Int, id);

      const query = `
        SELECT 
          R.DCRid,
          R.[單位],
          CONVERT(VARCHAR, R.[日期], 23) as [日期],
          R.[建立時間],
          R.[更新時間],
          D.DetailId,
          D.ItemId,
          I.ItemName,
          I.Unit,
          D.Quantity,
          D.UnitPrice,
          D.Amount
        FROM DailyConstructionRecord R
        LEFT JOIN ConstructionRecordDetail D ON R.DCRid = D.RecordId
        LEFT JOIN ConstructionItemMaster I ON D.ItemId = I.ItemId
        WHERE R.DCRid = @DCRid
        ORDER BY I.DisplayOrder ASC
      `;

      const result = await request.query(query);

      if (result.recordset.length === 0) {
        throw new Error('找不到記錄');
      }

      // 組合成寬表格式
      const firstRow = result.recordset[0];
      const record: any = {
        DCRid: firstRow.DCRid,
        單位: firstRow.單位,
        日期: firstRow.日期,
        建立時間: firstRow.建立時間,
        更新時間: firstRow.更新時間,
        _details: [],
      };

      result.recordset.forEach((row) => {
        if (row.DetailId) {
          const fieldName = this.getFieldNameFromItemName(row.ItemName);
          record[fieldName] = row.Quantity;

          record._details.push({
            DetailId: row.DetailId,
            ItemId: row.ItemId,
            ItemName: row.ItemName,
            Unit: row.Unit,
            Quantity: row.Quantity,
            UnitPrice: row.UnitPrice,
            Amount: row.Amount,
          });
        }
      });

      return {
        success: true,
        data: record,
      };
    } catch (error) {
      apiLogger.error('查詢施工記錄失敗', error);
      throw new Error(
        `查詢施工記錄失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 從項目主檔取得啟用的項目
   */
  private static async getActiveItemsFromMaster(transaction: any) {
    const request = new sql.Request(transaction);
    const result = await request.query(
      'SELECT ItemId, ItemName, Unit, Price FROM ConstructionItemMaster WHERE IsActive = 1 ORDER BY DisplayOrder ASC'
    );
    return result.recordset;
  }

  /**
   * 根據項目名稱生成欄位名稱（向後兼容）
   */
  private static getFieldNameFromItemName(itemName: string): string {
    const mapping: Record<string, string> = {
      '拖車租工': '拖車租工_數量',
      '台北市.拖車運費': '台北市拖車運費_數量',
      '台北市.瀝青渣運費(拖)': '台北市瀝青渣運費_數量',
      '補運費(拖車)': '補運費拖車_數量',
      '補單趟運費(拖車)': '補單趟運費拖車_數量',
      '補拖車移點運費': '補拖車移點運費_數量',
      '板橋.拖車運費': '板橋拖車運費_數量',
      '瀝青渣': '瀝青渣_數量',
      '瀝青渣(超大塊)': '瀝青渣超大塊_數量',
      '瀝青渣(廢土.級配)': '瀝青渣廢土級配_數量',
      '泡沫瀝青': '泡沫瀝青_數量',
      '3/8(三)瀝青混凝土': '三分之八三瀝青混凝土_數量',
      '3/8(四)瀝青混凝土': '三分之八四瀝青混凝土_數量',
      '改質 瀝青四-F': '改質瀝青四F_數量',
      '冷油(大桶)': '冷油大桶_數量',
    };

    return mapping[itemName] || `${itemName}_數量`;
  }
}
