import { app, BrowserWindow, ipcMain, Menu, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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
    title: 'منظومة سرايا لإدارة مزارع الماشية والألبان والتسمين - Saraya Livestock ERP',
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
          label: 'حول منظومة سرايا للماشية',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              title: 'منظومة سرايا لإدارة مزارع الماشية',
              message: 'Saraya Livestock & Dairy Farm ERP\nالإصدار: 1.0.0 Desktop Station\nحقوق التطوير محفوظة لمجموعة سرايا © 2026',
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

// 1. قراءة الوزن من الميزان الإلكتروني للماشية (RS232 / USB Scale Listener)
ipcMain.handle('read-serial-scale', async () => {
  if (isProductionRuntime()) {
    return { success: false, error: 'الميزان الإلكتروني غير مهيأ على هذه المحطة' };
  }
  const simulatedScaleWeight = +(Math.random() * (650 - 450) + 450).toFixed(2);
  return {
    success: true,
    weightKg: simulatedScaleWeight,
    scaleModel: 'Mettler Toledo / Tru-Test Livestock Scale',
    timestamp: new Date().toISOString(),
  };
});

// 2. طباعة إذن استلام الحليب أو ملصق الباركود (Direct Silent Printing)
ipcMain.handle('print-receipt', async (event, receiptData) => {
  if (isProductionRuntime()) {
    return { success: false, error: 'الطابعة الحرارية غير مهيأة على هذه المحطة' };
  }
  console.log('محاكاة إرسال أمر الطباعة:', Boolean(receiptData));
  return { success: true, message: 'تمت محاكاة الطباعة في بيئة التطوير' };
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

app.whenReady().then(createWindow);

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
