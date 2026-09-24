const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, Authenticator } = require('minecraft-launcher-core');

// === CONFIGURACIÓN ===
const CARPETA_NEXIS = path.join(app.getPath('appData'), 'NexisLauncher');
const CARPETA_MODS = path.join(CARPETA_NEXIS, 'mods');

if (!fs.existsSync(CARPETA_NEXIS)) fs.mkdirSync(CARPETA_NEXIS, { recursive: true });
if (!fs.existsSync(CARPETA_MODS)) fs.mkdirSync(CARPETA_MODS, { recursive: true });

const clienteMinecraft = new Client();
let ventanaPrincipal;

// === VENTANA PRINCIPAL ===
function crearVentana() {
  ventanaPrincipal = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'images', 'icon_transparent.png'),
    title: 'Nexis Launcher',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true
    },
    backgroundColor: '#0F172A',
    autoHideMenuBar: true
  });

  // ✅ CORRECTO: Tu index.html está en build/
  const rutaHtml = path.join(__dirname, 'build', 'index.html');
  
  if (fs.existsSync(rutaHtml)) {
    ventanaPrincipal.loadFile(rutaHtml);
    console.log('✅ Cargado:', rutaHtml);
  } else {
    console.error('❌ No encontrado en:', rutaHtml);
    console.log('📂 Tu carpeta tiene:', fs.readdirSync(__dirname));
  }
}

app.whenReady().then(crearVentana);
app.on('window-all-closed', () => app.quit());

// === RESTO IGUAL ===
ipcMain.handle('iniciar-minecraft', async (event, datos) => {
  try {
    console.log('🎮 Iniciando:', datos.version, '| Tipo:', datos.tipo || 'vanilla');
    
    let versionCompleta = datos.version;
    if (datos.tipo === 'forge' && datos.forgeVersion) {
      versionCompleta = `forge-${datos.version}-${datos.forgeVersion}`;
    }
    if (datos.tipo === 'fabric' && datos.fabricVersion) {
      versionCompleta = `fabric-loader-${datos.fabricVersion}-${datos.version}`;
    }

    const configJuego = {
      version: versionCompleta,
      directory: CARPETA_NEXIS,
      username: datos.usuario || 'JugadorNexis',
      authorization: datos.token ? datos.token : Authenticator.getAuth(datos.usuario || 'JugadorNexis'),
      memory: { min: '512', max: '4096' },
      javaPath: undefined,
      downloadHTTP: { retries: 5, timeout: 60000 }
    };

    if (['mods', 'forge', 'fabric'].includes(datos.tipo)) {
      const carpetaVersion = path.join(CARPETA_NEXIS, 'versions', datos.version, 'mods');
      if (!fs.existsSync(carpetaVersion)) fs.mkdirSync(carpetaVersion, { recursive: true });
      
      if (fs.existsSync(CARPETA_MODS)) {
        fs.readdirSync(CARPETA_MODS).forEach(mod => {
          try {
            fs.copyFileSync(
              path.join(CARPETA_MODS, mod),
              path.join(carpetaVersion, mod)
            );
          } catch (err) {
            console.log('⚠️ No copiado:', mod, err.message);
          }
        });
      }
    }

    clienteMinecraft.on('download-status', info => {
      event.sender.send('progreso', {
        tipo: 'descarga', nombre: info.name, porcentaje: Math.round(info.progress || 0)
      });
    });
    clienteMinecraft.on('progress', info => {
      event.sender.send('progreso', {
        tipo: 'proceso', tarea: info.task, porcentaje: Math.round(info.progress || 0)
      });
    });
    clienteMinecraft.on('data', t => console.log(`[MC] ${t}`));
    clienteMinecraft.on('close', c => event.sender.send('cerrado', c));

    await clienteMinecraft.launch(configJuego);
    return { exito: true };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { exito: false, error: error.message };
  }
});

ipcMain.handle('listar-mods', async () => {
  try {
    if (!fs.existsSync(CARPETA_MODS)) return [];
    return fs.readdirSync(CARPETA_MODS)
      .filter(f => f.endsWith('.jar'))
      .map(nombre => ({
        nombre,
        tamaño: (fs.statSync(path.join(CARPETA_MODS, nombre)).size / 1024 / 1024).toFixed(2) + ' MB'
      }));
  } catch { return []; }
});

ipcMain.handle('eliminar-mod', async (_, nombre) => {
  try { fs.unlinkSync(path.join(CARPETA_MODS, nombre)); return { exito: true }; }
  catch { return { exito: false }; }
});

ipcMain.handle('abrir-carpeta-mods', async () => {
  shell.openPath(CARPETA_MODS);
  return { exito: true };
});

ipcMain.handle('versiones-disponibles', async () => ({
  vanilla: [
    { id: '1.21.1', nombre: '1.21.1 — Recomendada ✅' },
    { id: '1.21', nombre: '1.21' },
    { id: '1.20.6', nombre: '1.20.6' },
    { id: '1.20.4', nombre: '1.20.4' },
    { id: '1.19.4', nombre: '1.19.4' }
  ],
  forge: [
    { mc: '1.21.1', loader: '52.0.20', nombre: 'Forge 52.0.20' },
    { mc: '1.20.6', loader: '51.0.20', nombre: 'Forge 51.0.20' },
    { mc: '1.20.4', loader: '49.0.30', nombre: 'Forge 49.0.30' },
    { mc: '1.19.4', loader: '45.3.0', nombre: 'Forge 45.3.0' }
  ],
  fabric: [
    { mc: '1.21.1', loader: '0.16.5', nombre: 'Fabric 0.16.5' },
    { mc: '1.20.6', loader: '0.16.5', nombre: 'Fabric 0.16.5' },
    { mc: '1.20.4', loader: '0.16.5', nombre: 'Fabric 0.16.5' },
    { mc: '1.19.4', loader: '0.15.11', nombre: 'Fabric 0.15.11' }
  ]
}));