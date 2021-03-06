const PluginDescription = require("./plugins/PluginDescription").default;

const {app, BrowserWindow, ipcMain, protocol} = require('electron');
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const loadConfig = require("./loadConfig");
const config = loadConfig(process.env.NODE_ENV);
const axios = require("axios");
const Plugins = require("./plugins").default;
const PluginEventEmitter = require("./plugins/PluginEventEmitter").default;
const url = require("url");
const Store = require("electron-store");
const GoogleOAuth2 = require("@getstation/electron-google-oauth2").default;

const googleOauthClient = new GoogleOAuth2(
    config.services.auth.google.clientId,
    config.services.auth.google.clientSecret,
    ["https://www.googleapis.com/auth/userinfo.profile"],
    {
        successRedirectURL: "https://google.com",
        refocusAfterSuccess: true
    }
);

const Data = require("./data").default;
const data = new Data(new Store());

const plugins = new Plugins(path.resolve(path.join(app.getPath("appData"), "neone", "plugins")), axios, config.api.url + config.api.pluginPath);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
    app.quit();
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

let googleAuthToken;

const createWindow = () => {
    let activePlugin;
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "index.js")
        }
    });

    function notifyOfAuthStatusChange(newStatus) {
        if (!_.isBoolean(newStatus)) {
            throw new Error("Must be a boolean.");
        }
        mainWindow.webContents.send("get-is-authenticated-status", newStatus);
    }

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/../static/index.html`);

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    console.log("Create window");

    mainWindow.webContents.on("dom-ready", function () {
        mainWindow.webContents.send("get-enabled-features", _.get(config, "features", {}));
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
    plugins.on(PluginEventEmitter.Events.PLUGIN_LOAD, list =>{
        mainWindow.webContents.send("plugin-list", list);
    });
    plugins.on(PluginEventEmitter.Events.REMOTE_PLUGIN_LOAD_FAILED, reason => {
        mainWindow.webContents.send(PluginEventEmitter.Events.REMOTE_PLUGIN_LOAD_FAILED, reason);
    });
    ipcMain.on("plugin-list", async () => {
        let retrievedPlugins = await plugins.getLocalPluginDescriptions();
        mainWindow.webContents.send("plugin-list", retrievedPlugins);
    });

    ipcMain.on("load-plugin", async (event, plugin) => {
        activePlugin = plugin;
        mainWindow.loadURL(path.join(__dirname, "..", "static", "templates", "plugin-character-page.html"));
    });
    ipcMain.on("get-plugin-info", async () => {
        const pluginConfiguration = await plugins.getPluginConfiguration(activePlugin);
        const rawPath = await plugins.getPluginResource(activePlugin, pluginConfiguration.resources.character);
        const pluginCharacterTemplateFileName = url.pathToFileURL(rawPath);
        mainWindow.webContents.send("get-plugin-info", activePlugin,
            pluginCharacterTemplateFileName.toString()
        );
    });

    ipcMain.on("create-new-character", async () => {
        mainWindow.webContents.reload();
    });

    ipcMain.on("save-character", async (e, characterData) => {
        console.info(`Saving character to local with id ${characterData.id}`);
        const postSaveCharacter = data.saveCharacter(characterData);
        mainWindow.webContents.send("character-saved", JSON.stringify(postSaveCharacter));
    });

    ipcMain.on("get-character-list", async ()=>{
        const mappedList = data.getAllCharacters();
        mainWindow.webContents.send("get-character-list", mappedList);
    });

    ipcMain.on("load-character", async (e, idToLoad) => {
        console.info("loading character with id " + idToLoad);
        const existingCharacter = data.getCharacter(idToLoad);
        mainWindow.webContents.send("character-loaded", existingCharacter);
    });

    ipcMain.on("start-login", async (e, provider)=>{
        googleOauthClient.openAuthWindowAndGetTokens().then(async token =>{
            googleAuthToken = token;
            notifyOfAuthStatusChange(true);
        });
    });
    ipcMain.on("start-logout", async e => {
        googleAuthToken = null;
        notifyOfAuthStatusChange(false);
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

const pluginResourceRequestPattern = path.sep === "\\" ? /\\games\\(.+?)\\(.+?)\\(.+?)\\(.*)/ :
    /\/games\/(.+?)\/(.+?)\/(.+?)\/(.*)/;
app.on("ready", ()=>{
    protocol.interceptFileProtocol("file", async (request, cb)=>{
        const fileUrl = path.resolve(url.fileURLToPath(request.url)).replace(/ /g, "_");
        const isPluginResourceRequest = pluginResourceRequestPattern.exec(fileUrl);
        if (isPluginResourceRequest) {
            console.log("plugin resource", fileUrl);
            const plugin = new PluginDescription(isPluginResourceRequest[1], isPluginResourceRequest[2], isPluginResourceRequest[3]);
            const pluginResourcePath = await plugins.getPluginResource(plugin, isPluginResourceRequest[4]);
            return cb(pluginResourcePath);
        } else {
            fs.readFile(path.resolve(url.fileURLToPath(request.url)), (err, content) => {
                if(err) {
                    console.error(fileUrl, err);
                    return cb();
                }
                return cb(content);
            })
        }
    });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
plugins.updateLocalPluginCacheFromRemote().catch(e => console.error(e.message));