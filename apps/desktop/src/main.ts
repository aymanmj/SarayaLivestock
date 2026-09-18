import { app, BrowserWindow, ipcMain, Menu, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';

// فرض اتجاه الواجهة والقوائم من اليمين إلى اليسار (RTL) باللغة العربية
app.commandLine.appendSwitch('force-ui-direction', 'rtl');
app.commandLine.appendSwitch('lang', 'ar');

let mainWindow: BrowserWindow | null = null;

function isProductionRuntime() {
  return app.isPackaged || process.env.NODE_ENV === 'production';
}

interface DesktopConfiguration {
  apiBaseUrl?: string;
  stationId?: string;
  farmBranch?: string;
}

function refreshTokenPath() {
  return path.join(app.getPath('userData'), 'saraya-session.bin');
}

function loadDesktopConfiguration(): Required<DesktopConfiguration> {
  const candidates = [
    process.env.SARAYA_DESKTOP_CONFIG,
    process.env.ProgramData ? path.join(process.env.ProgramData, 'SarayaLivestock', 'client.json') : undefined,
    path.join(app.getPath('userData'), 'client.json'),
  ].filter((value): value is string => Boolean(value));
  let configured: DesktopConfiguration = {};
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        configured = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        break;
      }
    } catch {
      console.error(`Invalid desktop configuration file: ${candidate}`);
    }
  }
  const rawApiBaseUrl = process.env.SARAYA_API_BASE_URL || configured.apiBaseUrl || 'https://saraya.local/api/v1';
  const parsed = new URL(rawApiBaseUrl);
  const developmentLocalHttp = !isProductionRuntime()
    && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !developmentLocalHttp) {
    throw new Error('Desktop API URL must use HTTPS outside local development');
  }
  if (!parsed.pathname.endsWith('/api/v1')) throw new Error('Desktop API URL must end with /api/v1');
  return {
    apiBaseUrl: parsed.toString().replace(/\/$/, ''),
    stationId: configured.stationId || 'UNCONFIGURED',
    farmBranch: configured.farmBranch || 'غير مهيأ',
  };
}

function createWindow() {
  const desktopConfiguration = loadDesktopConfiguration();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'منظومة السرايا لإدارة مزارع الماشية والألبان والتسمين - Saraya Livestock ERP',
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      additionalArguments: [`--saraya-api-base-url=${encodeURIComponent(desktopConfiguration.apiBaseUrl)}`],
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.maximize();
      mainWindow.show();
    }
  });

  // ---------------------------------------------------------------------------
  // أمان: سياسة أمان المحتوى (CSP) لحماية تطبيق سطح المكتب
  // ---------------------------------------------------------------------------
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* https://*.saraya.local https://*.saraya.ly; img-src 'self' data:; font-src 'self' data:;",
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // أمان: منع التنقل إلى روابط خارجية أو فتح نوافذ غير مصرح بها
  // ---------------------------------------------------------------------------
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowed = ['localhost', '127.0.0.1', 'saraya.local'];
    const isAllowed = parsedUrl.protocol === 'file:' || allowed.some(h => parsedUrl.hostname.endsWith(h));
    if (!isAllowed) {
      event.preventDefault();
      console.warn(`[Security] Blocked navigation to: ${navigationUrl}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[Security] Blocked popup window to: ${url}`);
    return { action: 'deny' };
  });

  // محاولة الاتصال بسيرفر Vite (http://localhost:3050) أولاً مع الرجوع التلقائي لملفات web/dist
  const distPath = app.isPackaged
    ? path.join(app.getAppPath(), 'web-dist', 'index.html')
    : path.join(__dirname, '../../web/dist/index.html');
  const devUrl = 'http://localhost:3050';

  if (isProductionRuntime()) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL(devUrl).catch(() => {
      console.log('⚠️ تعذر الاتصال بـ Vite dev server على المنفذ 3050، جاري تحميل نسخة web/dist المبنية محلياً...');
      if (fs.existsSync(distPath)) {
        mainWindow?.loadFile(distPath);
      } else {
        console.error('❌ لم يتم العثور على web/dist/index.html. يرجى تشغيل npm run dev:web أو npm run build:web');
      }
    });
  }

  // إنشاء قائمة التطبيق باللغة العربية
  const systemMenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'إعادة تحميل الواجهة', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
    { label: 'ملء الشاشة', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
  ];
  if (!isProductionRuntime()) {
    systemMenu.push(
      { type: 'separator' },
      { label: 'أدوات المطور (DevTools)', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
    );
  }
  systemMenu.push(
    { type: 'separator' },
    { label: 'إغلاق المنظومة', accelerator: 'Alt+F4', click: () => app.quit() },
  );
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'النظام',
      submenu: systemMenu,
    },
    {
      label: 'المحطات والأجهزة',
      submenu: [
        {
          label: 'فحص اتصال الميزان الإلكتروني (RS232)',
          click: async () => {
            const res = await (mainWindow as any)?.webContents.executeJavaScript('window.electronAPI?.readSerialScale()');
            console.log('Scale Test:', res);
          },
        },
        { label: 'إعدادات الطابعة الحرارية', click: () => {} },
      ],
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'حول منظومة السرايا للماشية',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              title: 'منظومة السرايا لإدارة مزارع الماشية',
              message: 'Saraya Livestock & Dairy Farm ERP\nالإصدار: 1.0.0 Desktop Station\nحقوق التطوير محفوظة لمجموعة السرايا © 2026',
              type: 'info',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------
// معالجات جسر الهاردوير والمنافذ التسلسلية (Hardware IPC Handlers)
// ----------------------------------------------------

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import ThermalPrinter from 'node-thermal-printer';

// 1. قراءة الوزن من الميزان الإلكتروني للماشية (RS232 / USB Scale Listener)
ipcMain.handle('read-serial-scale', async () => {
  return new Promise((resolve) => {
    try {
      // افتراض أن الميزان موصول على COM3 أو /dev/ttyUSB0
      // في الإنتاج الحقيقي، يمكن قراءة اسم المنفذ من إعدادات محلية
      const portPath = process.platform === 'win32' ? 'COM3' : '/dev/ttyUSB0';
      
      const port = new SerialPort({ path: portPath, baudRate: 9600 }, (err) => {
        if (err) {
          console.error('SerialPort Error:', err.message);
          resolve({ success: false, error: `تعذر الاتصال بالميزان: ${err.message}` });
          return;
        }
      });

      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
      
      // مهلة زمنية للانتظار (5 ثوانٍ)
      const timeout = setTimeout(() => {
        if (port.isOpen) port.close();
        resolve({ success: false, error: 'انتهى وقت الانتظار ولم يتم استلام وزن من الميزان' });
      }, 5000);

      parser.on('data', (data) => {
        clearTimeout(timeout);
        port.close();
        
        // استخراج الوزن من السلسلة (مثال: "  + 452.5 KG ")
        const weightMatches = data.match(/[\d.]+/);
        const weightKg = weightMatches ? parseFloat(weightMatches[0]) : 0;
        
        resolve({
          success: true,
          weightKg,
          scaleModel: 'Mettler Toledo / Tru-Test',
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      resolve({ success: false, error: err.message });
    }
  });
});

// 2. طباعة إذن استلام الحليب أو ملصق الباركود (Direct Silent Printing)
ipcMain.handle('print-receipt', async (event, receiptData) => {
  try {
    const printer = new ThermalPrinter.printer({
      type: ThermalPrinter.types.EPSON,
      interface: 'tcp://192.168.1.100', // مثال لطابعة متصلة بالشبكة
      characterSet: ThermalPrinter.CharacterSet.PC864_ARABIC,
    });

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      return { success: false, error: 'الطابعة الحرارية غير متصلة' };
    }

    printer.alignCenter();
    printer.println('--- منظومة السرايا لإدارة الماشية ---');
    printer.println(receiptData.title || 'إيصال استلام');
    printer.drawLine();
    
    // محتوى الفاتورة أو الباركود
    printer.println(`التاريخ: ${new Date().toLocaleString('ar-SA')}`);
    if (receiptData.barcode) {
      printer.printBarcode(receiptData.barcode);
    }
    
    printer.cut();
    
    await printer.execute();
    return { success: true, message: 'تمت الطباعة بنجاح' };
  } catch (error: any) {
    console.error('Printing error:', error);
    return { success: false, error: `خطأ في الطباعة: ${error.message}` };
  }
});

// 3. معلومات المحطة المحلية
ipcMain.handle('get-station-info', async () => {
  const configured = loadDesktopConfiguration();
  return {
    stationId: configured.stationId,
    farmBranch: configured.farmBranch,
    isLanConnected: false,
  };
});

// 4. حفظ رمز التحديث طويل العمر خارج سياق الواجهة وباستخدام تشفير نظام التشغيل.
ipcMain.handle('session:get-refresh-token', async () => {
  try {
    const tokenPath = refreshTokenPath();
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(tokenPath)) return null;
    return safeStorage.decryptString(fs.readFileSync(tokenPath));
  } catch {
    return null;
  }
});

ipcMain.handle('session:set-refresh-token', async (_event, token: unknown) => {
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) {
    throw new Error('Invalid refresh token');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating-system encryption is unavailable');
  }
  fs.writeFileSync(refreshTokenPath(), safeStorage.encryptString(token));
  return true;
});

ipcMain.handle('session:clear-refresh-token', async () => {
  const tokenPath = refreshTokenPath();
  if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
  return true;
});

// ---------------------------------------------------------------------------
// التحديث التلقائي: فحص التحديثات عند بدء التشغيل (Electron Auto-Updater)
// ---------------------------------------------------------------------------
function initAutoUpdater() {
  if (!isProductionRuntime()) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdate] تحديث جديد متاح: v${info.version}`);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('saraya:update-available', { detail: { version: '${info.version}' } }))`
      );
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdate] تم تنزيل التحديث v${info.version}، سيُثبت عند إغلاق التطبيق.`);
    const { dialog } = require('electron');
    dialog.showMessageBox({
      type: 'info',
      title: 'تحديث جاهز للتثبيت',
      message: `تم تنزيل تحديث جديد (الإصدار ${info.version}). سيتم تثبيته تلقائياً عند إعادة تشغيل التطبيق.`,
      buttons: ['إعادة التشغيل الآن', 'لاحقاً'],
      defaultId: 0,
    }).then(({ response }: { response: number }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdate] خطأ في التحديث التلقائي:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
