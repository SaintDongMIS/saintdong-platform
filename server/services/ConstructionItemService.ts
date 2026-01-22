import { getConnectionPool } from '../config/database';
import sql from 'mssql';
import { apiLogger } from './LoggerService';
import { sanitizeString, validateItemName, validatePrice, validateUnit } from '../utils/validationHelper';

export interface ConstructionItem {
  ItemId?: number;
  ItemName: string;
  Unit: string;
  Price: number;
  IsActive?: boolean;
  DisplayOrder?: number;
  CreatedAt?: Date;
  UpdatedAt?: Date;
}

export class ConstructionItemService {
  /**
   * 取得所有項目（包含停用的）
   */
  static async getAllItems() {
    try {
      const pool = await getConnectionPool();
      const result = await pool
        .request()
        .query('SELECT * FROM ConstructionItemMaster ORDER BY DisplayOrder ASC, ItemId ASC');

      return {
        success: true,
        data: result.recordset,
      };
    } catch (error) {
      apiLogger.error('取得項目清單失敗', error);
      throw new Error(
        `取得項目清單失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 取得啟用的項目
   */
  static async getActiveItems() {
    try {
      const pool = await getConnectionPool();
      const result = await pool
        .request()
        .query(
          'SELECT * FROM ConstructionItemMaster WHERE IsActive = 1 ORDER BY DisplayOrder ASC, ItemId ASC'
        );

      return {
        success: true,
        data: result.recordset,
      };
    } catch (error) {
      apiLogger.error('取得啟用項目清單失敗', error);
      throw new Error(
        `取得啟用項目清單失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 新增項目
   */
  static async createItem(item: ConstructionItem) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      // 驗證必要欄位
      if (!item.ItemName || !item.Unit || item.Price === undefined) {
        throw new Error('項目名稱、單位和單價為必填欄位');
      }

      // 驗證項目名稱
      const nameValidation = validateItemName(item.ItemName);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.message);
      }

      // 清理和驗證輸入
      const cleanedName = sanitizeString(item.ItemName, 100);
      const cleanedUnit = sanitizeString(item.Unit, 20);

      // 驗證單位（白名單）
      if (!validateUnit(cleanedUnit)) {
        throw new Error('單位不在允許清單中（允許：天、頓、台、小時、桶等）');
      }

      // 驗證單價
      const priceValidation = validatePrice(item.Price);
      if (!priceValidation.valid) {
        throw new Error(priceValidation.message);
      }

      // 檢查項目名稱是否重複
      request.input('checkName', sql.NVarChar, cleanedName);
      const checkResult = await request.query(
        'SELECT ItemId FROM ConstructionItemMaster WHERE ItemName = @checkName'
      );

      if (checkResult.recordset.length > 0) {
        throw new Error('項目名稱已存在');
      }

      // 插入新項目
      const insertRequest = pool.request();
      insertRequest.input('ItemName', sql.NVarChar, cleanedName);
      insertRequest.input('Unit', sql.NVarChar, cleanedUnit);
      insertRequest.input('Price', sql.Decimal(18, 2), priceValidation.value);
      insertRequest.input('DisplayOrder', sql.Int, item.DisplayOrder || 0);

      const result = await insertRequest.query(`
        INSERT INTO ConstructionItemMaster (ItemName, Unit, Price, DisplayOrder)
        VALUES (@ItemName, @Unit, @Price, @DisplayOrder);
        SELECT SCOPE_IDENTITY() as ItemId;
      `);

      const newId = result.recordset[0].ItemId;

      apiLogger.info('新增施工項目成功', { ItemId: newId, ItemName: item.ItemName });

      return {
        success: true,
        ItemId: newId,
        message: '新增成功',
      };
    } catch (error) {
      apiLogger.error('新增施工項目失敗', error);
      throw new Error(
        `新增施工項目失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 更新項目
   */
  static async updateItem(id: number, item: Partial<ConstructionItem>) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      const updateFields: string[] = [];

      // 項目名稱
      if (item.ItemName !== undefined) {
        const nameValidation = validateItemName(item.ItemName);
        if (!nameValidation.valid) {
          throw new Error(nameValidation.message);
        }
        const cleanedName = sanitizeString(item.ItemName, 100);
        updateFields.push('[ItemName] = @ItemName');
        request.input('ItemName', sql.NVarChar, cleanedName);
      }

      // 單價（可編輯）
      if (item.Price !== undefined) {
        const priceValidation = validatePrice(item.Price);
        if (!priceValidation.valid) {
          throw new Error(priceValidation.message);
        }
        updateFields.push('[Price] = @Price');
        request.input('Price', sql.Decimal(18, 2), priceValidation.value);
      }

      // 單位（可編輯，但前端應給警告）
      if (item.Unit !== undefined) {
        const cleanedUnit = sanitizeString(item.Unit, 20);
        if (!validateUnit(cleanedUnit)) {
          throw new Error('單位不在允許清單中（允許：天、頓、台、小時、桶等）');
        }
        updateFields.push('[Unit] = @Unit');
        request.input('Unit', sql.NVarChar, cleanedUnit);
      }

      // 啟用狀態
      if (item.IsActive !== undefined) {
        updateFields.push('[IsActive] = @IsActive');
        request.input('IsActive', sql.Bit, item.IsActive);
      }

      // 顯示順序
      if (item.DisplayOrder !== undefined) {
        updateFields.push('[DisplayOrder] = @DisplayOrder');
        request.input('DisplayOrder', sql.Int, item.DisplayOrder);
      }

      if (updateFields.length === 0) {
        throw new Error('沒有要更新的欄位');
      }

      // 加入更新時間
      updateFields.push('[UpdatedAt] = GETDATE()');

      request.input('ItemId', sql.Int, id);

      const result = await request.query(`
        UPDATE ConstructionItemMaster
        SET ${updateFields.join(', ')}
        WHERE ItemId = @ItemId
      `);

      if (result.rowsAffected[0] === 0) {
        throw new Error('找不到要更新的項目');
      }

      apiLogger.info('更新施工項目成功', { ItemId: id });

      return {
        success: true,
        message: '更新成功',
      };
    } catch (error) {
      apiLogger.error('更新施工項目失敗', error);
      throw new Error(
        `更新施工項目失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 停用項目（不是刪除）
   */
  static async deactivateItem(id: number) {
    try {
      return await this.updateItem(id, { IsActive: false });
    } catch (error) {
      apiLogger.error('停用施工項目失敗', error);
      throw new Error(
        `停用施工項目失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }

  /**
   * 刪除項目（只有沒有歷史記錄的項目才能刪除）
   */
  static async deleteItem(id: number) {
    try {
      const pool = await getConnectionPool();
      const request = pool.request();

      // 檢查是否有歷史記錄
      request.input('ItemId', sql.Int, id);
      const checkResult = await request.query(
        'SELECT COUNT(*) as count FROM ConstructionRecordDetail WHERE ItemId = @ItemId'
      );

      const count = checkResult.recordset[0].count;

      if (count > 0) {
        throw new Error(
          `此項目有 ${count} 筆歷史記錄，無法刪除。建議使用「停用」功能。`
        );
      }

      // 刪除項目
      const deleteRequest = pool.request();
      deleteRequest.input('ItemId', sql.Int, id);
      const result = await deleteRequest.query(
        'DELETE FROM ConstructionItemMaster WHERE ItemId = @ItemId'
      );

      if (result.rowsAffected[0] === 0) {
        throw new Error('找不到要刪除的項目');
      }

      apiLogger.info('刪除施工項目成功', { ItemId: id });

      return {
        success: true,
        message: '刪除成功',
      };
    } catch (error) {
      apiLogger.error('刪除施工項目失敗', error);
      throw new Error(
        `刪除施工項目失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }
  }
}
