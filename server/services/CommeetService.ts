import fs from 'node:fs';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import fetch from 'node-fetch';
import { automationLogger } from './LoggerService';
import { commeetSelectors } from '../config/commeetSelectors';

interface LoginResult {
  success: boolean;
  message: string;
}

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

interface ExcelDownloadResult {
  success: boolean;
  message: string;
  buffer?: Buffer;
  fileName?: string;
}

/**
 * COMMEET 自動化登入服務
 *
 * 功能：
 * - 自動登入 COMMEET 系統
 * - 環境自動適配（本地有頭模式 / NAS 無頭模式）
 * - Mac 使用已安裝的 Chrome（不下載 Chromium）
 * - 基本反偵測機制
 */
export class CommeetService {
  private browser: Browser | null = null;

  /**
   * 執行 COMMEET 登入
   */
  async login(): Promise<LoginResult> {
    try {
      automationLogger.info('開始執行 COMMEET 自動登入');

      // 啟動瀏覽器
      this.browser = await this.launchBrowser();
      const page = await this.browser.newPage();

      // 設定反偵測
      await this.setupAntiDetection(page);

      // 執行 5 步驟登入流程（對應 Axiom）
      const result = await this.performLogin(page);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      automationLogger.error('COMMEET 登入失敗', error);
      return {
        success: false,
        message: `登入失敗: ${errorMessage}`,
      };
    } finally {
      // 確保瀏覽器關閉
      await this.closeBrowser();
    }
  }

  /**
   * 登入並取得 Cookies（用於後續 API 呼叫）
   */
  async loginAndGetCookies(): Promise<{
    success: boolean;
    message: string;
    cookies?: Cookie[];
  }> {
    try {
      automationLogger.info('開始執行 COMMEET 登入並取得 Cookies');

      // 啟動瀏覽器
      this.browser = await this.launchBrowser();
      const page = await this.browser.newPage();

      // 設定反偵測
      await this.setupAntiDetection(page);

      // 執行登入流程
      const loginResult = await this.performLogin(page);

      if (!loginResult.success) {
        await this.closeBrowser();
        return loginResult;
      }

      // 取得 Cookies
      const cookies = await this.getCookies(page);

      automationLogger.info('成功取得 Cookies', {
        cookieCount: cookies.length,
      });

      return {
        success: true,
        message: '登入成功並取得 Cookies',
        cookies,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      automationLogger.error('登入並取得 Cookies 失敗', error);
      await this.closeBrowser();
      return {
        success: false,
        message: `失敗: ${errorMessage}`,
      };
    }
  }

  /**
   * 從頁面取得 Cookies
   */
  private async getCookies(page: Page): Promise<Cookie[]> {
    const cookies = await page.cookies();
    automationLogger.info('取得 Cookies', {
      count: cookies.length,
      domains: [...new Set(cookies.map((c) => c.domain))],
    });
    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));
  }

  /**
   * 啟動瀏覽器（自動偵測環境）
   */
  private async launchBrowser(): Promise<Browser> {
    const isProduction = process.env.NODE_ENV === 'production';
    const isMac = process.platform === 'darwin';

    // 自動選擇 Chrome 路徑（Alpine 可能裝在不同路徑，依序嘗試）
    const linuxChromiumPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/lib/chromium/chromium',
    ];
    const executablePath = isProduction
      ? (linuxChromiumPaths.find((p) => fs.existsSync(p)) ??
        '/usr/bin/chromium')
      : isMac
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Mac 的 Chrome
        : undefined; // Windows/Linux 使用預設

    automationLogger.info('啟動瀏覽器', {
      environment: isProduction ? 'production' : 'development',
      platform: process.platform,
      executablePath,
      headless: isProduction,
    });

    const browser = await puppeteer.launch({
      headless: isProduction ? true : false, // 生產用無頭，本地用有頭
      executablePath,
      slowMo: isProduction ? 0 : 100, // 本地慢速，方便觀察
      args: [
        '--no-sandbox', // NAS Docker 必須
        '--disable-setuid-sandbox', // NAS Docker 必須
        '--disable-dev-shm-usage', // 避免共享記憶體問題
        '--disable-blink-features=AutomationControlled', // 隱藏自動化痕跡
      ],
    });

    automationLogger.info('瀏覽器啟動成功');
    return browser;
  }

  /**
   * 設定基本反偵測機制
   */
  private async setupAntiDetection(page: Page): Promise<void> {
    // 隱藏 navigator.webdriver 標記
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    automationLogger.info('反偵測機制已設定');
  }

  /**
   * 執行登入流程（5 步驟，對應 Axiom）
   */
  private async performLogin(page: Page): Promise<LoginResult> {
    const email = process.env.COMMEET_EMAIL;
    const password = process.env.COMMEET_PASSWORD;
    // 移除 .env 可能帶入的前後引號，避免 "Cannot navigate to invalid URL"
    const rawLoginUrl =
      process.env.COMMEET_LOGIN_URL || 'https://bimgroup.commeet.co/ap/login';
    const loginUrl = rawLoginUrl
      .replace(/^["']+/, '')
      .replace(/["']+$/, '')
      .trim();

    if (!email || !password) {
      throw new Error('缺少 COMMEET_EMAIL 或 COMMEET_PASSWORD 環境變數');
    }

    // 步驟 1：導航到登入頁
    automationLogger.info('步驟 1：導航到 COMMEET 登入頁', { loginUrl });
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 步驟 2：等待 1000ms
    automationLogger.info('步驟 2：等待 1000ms');
    await this.delay(1000);

    // 步驟 3：填入 Email
    automationLogger.info('步驟 3：填入 Email', { email });
    await page.waitForSelector(commeetSelectors.emailInput, { timeout: 10000 });
    await page.type(commeetSelectors.emailInput, email);

    // 步驟 4：填入密碼
    automationLogger.info('步驟 4：填入密碼');
    await page.waitForSelector(commeetSelectors.passwordInput, {
      timeout: 10000,
    });
    await page.type(commeetSelectors.passwordInput, password);

    // 步驟 5：點擊登入按鈕
    automationLogger.info('步驟 5：點擊登入按鈕');
    const loginButton = await page.$(commeetSelectors.loginButton);
    if (!loginButton) {
      throw new Error('找不到登入按鈕');
    }

    // 嘗試點擊並等待導航
    automationLogger.info('點擊登入按鈕並等待導航...');
    try {
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }), // 等待最多 10 秒
        loginButton.click(),
      ]);

      // 導航成功
      const currentUrl = page.url();
      automationLogger.info('登入成功（頁面已跳轉）', { currentUrl });

      return {
        success: true,
        message: '登入成功',
      };
    } catch (error) {
      // 導航超時，檢查是否有錯誤訊息
      automationLogger.warn('登入後未發生導航，檢查錯誤訊息');

      const currentUrl = page.url();
      const pageContent = await page.content();

      // 檢查是否有錯誤訊息（常見的錯誤元素）
      const errorSelectors = [
        '.error-message',
        '.alert-danger',
        '[role="alert"]',
        '.text-red-500',
        '.text-danger',
      ];

      let errorMessage = '';
      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const text = await page.evaluate(
            (el) => el.textContent,
            errorElement,
          );
          if (text) {
            errorMessage = text.trim();
            break;
          }
        }
      }

      if (errorMessage) {
        automationLogger.error('登入失敗，發現錯誤訊息', { errorMessage });
        return {
          success: false,
          message: `登入失敗: ${errorMessage}`,
        };
      }

      // 如果沒有錯誤訊息，可能是選擇器問題或其他原因
      automationLogger.warn('未偵測到導航或錯誤訊息', {
        currentUrl,
        pageContentLength: pageContent.length,
      });

      return {
        success: false,
        message: '登入失敗：頁面未跳轉且無明確錯誤訊息（可能是選擇器問題）',
      };
    }
  }

  /**
   * 延遲執行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * 關閉瀏覽器
   */
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      automationLogger.info('瀏覽器已關閉');
    }
  }

  /**
   * 下載 Excel 報表（使用 listDocByPageExcel API）
   *
   * @param cookies 登入後取得的 Cookies
   * @param dateRange 可選的日期範圍，預設為最近 90 天
   */
  async downloadExcelReport(
    cookies: Cookie[],
    dateRange?: DateRange,
  ): Promise<ExcelDownloadResult> {
    try {
      // 計算預設日期範圍（最近 90 天）
      const endDate = dateRange?.end || this.formatDate(new Date());
      const startDate =
        dateRange?.start ||
        this.formatDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

      automationLogger.info('開始下載 Excel 報表', {
        dateRange: { start: startDate, end: endDate },
      });

      // 將 Cookies 轉換為 Cookie header 字串
      const cookieString = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      // 構建 API URL（GET 請求，參數在 URL 中）
      // 重要：export_report_setting=tab1 指定使用「模板一」匯出所有欄位
      const params = new URLSearchParams({
        apply_date_start: startDate,
        apply_date_end: endDate,
        query_type: 'v2',
        query_txn: 'C1',
        'doc_id[]': 'all',
        'multi_doc_status[]': '0',
        finance_status: '1',
        overview_query: 'Y',
        show_data: 'Y',
        order_by: '1',
        export_report_setting: 'tab1', // 關鍵參數：使用模板一匯出完整欄位
      });

      const apiUrl = `https://bimgroup.commeet.co/ap/api/doc/listDocByPageExcel?${params.toString()}`;

      automationLogger.info('發送 Excel 下載請求', { apiUrl });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Cookie: cookieString,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          Referer: 'https://bimgroup.commeet.co/ap/membercenter/overview',
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });

      automationLogger.info('Excel 下載回應', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // COMMEET API：無符合條件表單時回 400 + error_message「查無此表單」(error_code -353)，與網頁「沒有搜尋結果」對應
        let body: { error_code?: number; error_message?: string } | null = null;
        try {
          body = JSON.parse(errorText) as { error_code?: number; error_message?: string };
        } catch {
          body = null;
        }
        const isNoForm =
          body?.error_code === -353 ||
          (typeof body?.error_message === 'string' &&
            body.error_message.includes('查無此表單'));
        if (response.status === 400 && isNoForm) {
          automationLogger.info('COMMEET 查無符合條件的表單，視為無資料', {
            dateRange: { start: startDate, end: endDate },
            error_message: body?.error_message,
          });
          return {
            success: true,
            message: '查無符合條件的表單',
            buffer: undefined,
            fileName: undefined,
          };
        }
        automationLogger.error('Excel 下載失敗', {
          status: response.status,
          errorText: errorText.substring(0, 500),
        });
        return {
          success: false,
          message: `Excel 下載失敗: ${response.status} ${response.statusText}`,
        };
      }

      // 取得檔案名稱（從 Content-Disposition header）
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `Report_${startDate}_${endDate}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
        );
        if (match && match[1]) {
          fileName = match[1].replace(/['"]/g, '');
        }
      }

      // 將回應轉換為 Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      automationLogger.info('Excel 下載成功', {
        fileName,
        bufferSize: buffer.length,
      });

      return {
        success: true,
        message: 'Excel 下載成功',
        buffer,
        fileName,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      automationLogger.error('Excel 下載失敗', error);
      return {
        success: false,
        message: `Excel 下載失敗: ${errorMessage}`,
      };
    }
  }

  /**
   * 格式化日期為 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 完整同步流程：登入 → 下載 Excel → 關閉瀏覽器
   *
   * @param dateRange 可選的日期範圍
   */
  async downloadReportFlow(
    dateRange?: DateRange,
  ): Promise<ExcelDownloadResult> {
    try {
      // 步驟 1: 登入並取得 Cookies
      const loginResult = await this.loginAndGetCookies();

      if (!loginResult.success || !loginResult.cookies) {
        return {
          success: false,
          message: `登入失敗: ${loginResult.message}`,
        };
      }

      // 步驟 2: 下載 Excel
      const downloadResult = await this.downloadExcelReport(
        loginResult.cookies,
        dateRange,
      );

      return downloadResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      automationLogger.error('下載報表流程失敗', error);
      return {
        success: false,
        message: `下載失敗: ${errorMessage}`,
      };
    } finally {
      // 確保瀏覽器關閉
      await this.closeBrowser();
    }
  }
}
