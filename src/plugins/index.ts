import {AxiosInstance} from "axios";
import PluginDescription from "./PluginDescription";
import * as _ from "lodash";
import path from "path";
import fs from "fs";
import StreamZip from "node-stream-zip";
import {app} from "electron";
import PluginEventEmitter from "./PluginEventEmitter";
import {EventEmitter} from "events";
import {promisify} from "util";

export default class Plugins implements EventEmitter {
    static CACHE_DIRTY_SECONDS: number = 1 * 60 * 60 * 1000;
    private readonly appDataDir: string;
    private readonly pluginDir: string;
    private readonly downloadClient: AxiosInstance;
    private readonly defaultRemoteUrl: string;
    private readonly localPluginDescriptionCache: Map<PluginDescription, String>;
    private readonly remotePluginDescriptionCache: Set<PluginDescription>;
    private readonly eventEmitter: PluginEventEmitter;

    constructor(pluginDir: string, downloadClient: AxiosInstance, defaultRemoteUrl: string) {
        this.pluginDir = pluginDir;
        this.downloadClient = downloadClient;
        this.defaultRemoteUrl = defaultRemoteUrl;
        this.remotePluginDescriptionCache = new Set<PluginDescription>();
        this.localPluginDescriptionCache = new Map<PluginDescription, String>();
        this.appDataDir = path.join(app.getPath("appData"), "neone");
        this.eventEmitter = new PluginEventEmitter(this);
    }

    /**
     * Returns the plugin description for all locally stored plugin archives.
     */
    async getLocalPluginDescriptions(): Promise<Array<any>> {
        return Array.from(this.localPluginDescriptionCache.keys());
    }

    /**
     * Returns the plugin description for all remote plugin archives.
     */
    async getRemotePluginDescriptions(): Promise<Array<any>> {
        console.info("Getting remote plugin descriptions");
        const lastUpdated = (this.remotePluginDescriptionCache as any).lastUpdateTime;
        if (!lastUpdated || (lastUpdated + Plugins.CACHE_DIRTY_SECONDS) < Date.now()) {
            const remote: Array<any> = (await (this.downloadClient.get(this.defaultRemoteUrl) as any)).data as Array<any>;
            remote.forEach(remotePlugin => {
                this.remotePluginDescriptionCache.add(new PluginDescription(remotePlugin.author, remotePlugin.system, remotePlugin.version));
            });
            (this.remotePluginDescriptionCache as any).lastUpdateTime = Date.now();
        }
        return Array.from(this.remotePluginDescriptionCache.values());
    }

    /**
     * Refresh the local cache of plugins and return an array of local plugins.
     *
     * @return promise of array of PluginDescriptions of all downloaded plugins
     */
    async updateLocalPluginCacheFromRemote(): Promise<Array<any>> {
        console.info("Refreshing plugin cache from remote at " + this.defaultRemoteUrl);
        console.info("Initializing local plugins from cache");
        await this.ensureDirectoryExists(this.pluginDir);
        const localPluginsFromDisk = Array.from(await this.loadPluginsFromLocalCache());
        localPluginsFromDisk.forEach(localPlugin => {
            this.localPluginDescriptionCache.set(localPlugin.description, localPlugin.location);
        });
        try {
            console.info("Downloading remote plugin list");
            const remotePlugins = await this.getRemotePluginDescriptions();
            console.info(`Remote plugins: ${remotePlugins.map(rp => JSON.stringify(rp))}`);
            console.info(`Local plugins: ${localPluginsFromDisk.map(lp => JSON.stringify(lp.description))}`);
            const differenceBetweenRemoteAndLocal: Array<PluginDescription> = _.differenceWith(remotePlugins, localPluginsFromDisk.map(lp => lp.description), _.isEqual);
            if (differenceBetweenRemoteAndLocal.length) {
                console.debug(`${differenceBetweenRemoteAndLocal.length} remote plugin(s) were not found locally.`);
                differenceBetweenRemoteAndLocal.forEach(async plugin => {
                    try {
                        await this.downloadAndUnpackRemotePlugin(plugin);
                    } catch (e) {
                        console.error(e);
                    }
                })
            }
            const localPlugins = await this.getLocalPluginDescriptions();

            this.emit(PluginEventEmitter.Events.PLUGIN_LOAD, localPlugins);
            return differenceBetweenRemoteAndLocal;
        } catch (e) {
            this.emit(PluginEventEmitter.Events.REMOTE_PLUGIN_LOAD_FAILED, "Something went wrong trying to download the remote plugins");
            this.emit(PluginEventEmitter.Events.PLUGIN_LOAD, await this.getLocalPluginDescriptions());
            return localPluginsFromDisk;
        }
    }

    private async downloadAndUnpackRemotePlugin(plugin: PluginDescription) {
        const author = plugin.author;
        const system = plugin.system;
        const version = plugin.version;
        console.info(`Downloading remote plugin ${author} ${system} ${version}`);
        const response = await this.downloadClient.get(this.defaultRemoteUrl + `${author}/${system}/${version}/`, {
            responseType: 'arraybuffer'
        });
        const targetFileName = path.resolve(this.pluginDir, encodeURIComponent(`${author}-${system}-${version}.jar`));
        const dataBuffer = Buffer.from(response.data);
        fs.writeFile(targetFileName, dataBuffer, err => {
            if (err) {
                console.error(err)
            } else {
                console.info(`Download ${author} ${system} ${version} finished`);
                this.unpackArchive(targetFileName);
            }
        });
    }

    private async ensureDirectoryExists(directoryPath: string) {
        return new Promise(((resolve, reject) => {
            fs.mkdir(directoryPath, {
                recursive: true,
                mode: 0o777
            }, (err => {
                if (err && err.code !== 'EEXIST') {
                    return reject(err)
                }
                resolve();
            }))
        }));
    }

    private async unpackArchive(archivePath: string): Promise<any> {
        console.log(`Unpacking archive at ${archivePath}`);
        return new Promise(async (resolve, reject) => {
            await this.ensureDirectoryExists(this.appDataDir);
            const archive = new StreamZip({
                file: archivePath,
                storeEntries: true
            });
            archive.on('ready', async () => {
                const pluginDescription: PluginDescription = (await this.extractPluginDescriptionFromArchive(archive) as any);
                const encodedTargetDir = path.resolve(this.appDataDir, `${pluginDescription.author}-${pluginDescription.system}-${pluginDescription.version}`)
                    .replace(/ /g, "_");
                const unpackDir = encodedTargetDir;
                console.log(`Begin unpack to ${unpackDir} ${archive.entriesCount}`);
                await this.ensureDirectoryExists(unpackDir);
                archive.extract(null, unpackDir,
                    (err: any, extractedCount: number) => {
                        if (err) {
                            return reject(err);
                        }
                        archive.close();
                        console.log(`Unpack complete: ${extractedCount} entries`);
                        fs.readFile(path.resolve(unpackDir, "plugin.json"), async (err, fileContent) => {
                            if (err) {
                                console.error(err);
                                return resolve();
                            }
                            console.log(`Loaded plugin.json from ${unpackDir}`);
                            return resolve(pluginDescription);
                        });
                    });
            });
        });
    }

    public async getPluginResource(plugin: PluginDescription, resourcePath: string) {
        const pluginRootPath = path.join(this.appDataDir, this.getEncodedPluginFilename(plugin));
        console.log("plugin root", pluginRootPath);
        const finalResourcePath = path.join(pluginRootPath, resourcePath).replace(/ /g, "_");
        console.log("plugin resource full path", finalResourcePath);
        return finalResourcePath;
    }

    private async loadPluginsFromLocalCache(): Promise<Array<{ description: PluginDescription, location: string }>> {
        console.info(`Loading plugins on local disk`);
        const files: Array<string> = await new Promise((resolve, reject) => {
            fs.readdir(this.pluginDir, promisify((err: any, files: any[]) => {
                if (err) {
                    return reject(err);
                }
                resolve(files);
            }));
        });
        console.info(`${files.length} local plugins found`);
        return (await Promise.all(files.map(async file => {
            console.info(`Loading local plugin ${file}`);
            try {
                return {
                    location: file,
                    description: await this.unpackArchive(path.resolve(path.join(this.pluginDir, file)))
                };
            } catch (e) {
                console.error(e);
                return undefined;
            }
        }))).filter(x => x) as Array<{ description: PluginDescription, location: string }>;
    }

    private async extractPluginDescriptionFromArchive(archive: any) {
        return new Promise((resolve, reject) => {
            const dataBuffer = archive.entryDataSync("plugin.json");
            const data = JSON.parse(dataBuffer.toString());
            console.log(data);
            return resolve(new PluginDescription(data.description.author, data.description.system, data.description.version));
        });
    }

    public async getPluginConfiguration(plugin: PluginDescription) {
        return new Promise(((resolve, reject) => {
            const configurationPath = path.join(this.appDataDir, this.getEncodedPluginFilename(plugin), "plugin.json").replace(/ /g, "_");
            fs.readFile(configurationPath, {
                encoding: "UTF-8"
            }, function (err, data) {
                if (err) {
                    return reject(err)
                }
                resolve(JSON.parse(data));
            })
        }))
    }

    private getEncodedPluginFilename(plugin: PluginDescription) {
        if (!plugin) {
            throw new Error("plugin cannot be null or undefined");
        }
        return `${plugin.author}-${plugin.system}-${plugin.version}`;
    }

    addListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.addListener(event, listener);
        return this;
    }

    emit(event: string | symbol, ...args: any[]): boolean {
        return this.eventEmitter.emit(event, ...args);
    }

    eventNames(): Array<string | symbol> {
        return this.eventEmitter.eventNames();
    }

    getMaxListeners(): number {
        return this.eventEmitter.getMaxListeners();
    }

    listenerCount(type: string | symbol): number {
        return this.eventEmitter.listenerCount(type);
    }

    listeners(event: string | symbol): Function[] {
        return this.eventEmitter.listeners(event);
    }

    off(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.off(event, listener);
        return this;
    }

    on(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.on(event, listener);
        return this;
    }

    once(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.once(event, listener);
        return this;
    }

    prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.prependListener(event, listener);
        return this;
    }

    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.prependOnceListener(event, listener);
        return this;
    }

    rawListeners(event: string | symbol): Function[] {
        return this.eventEmitter.rawListeners(event);
    }

    removeAllListeners(event?: string | symbol): this;
    removeAllListeners(event?: string | symbol): this;
    removeAllListeners(event?: string | symbol): this {
        this.eventEmitter.removeAllListeners(event);
        return this;
    }

    removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this.eventEmitter.removeListener(event, listener);
        return this;
    }

    setMaxListeners(n: number): this {
        this.eventEmitter.setMaxListeners(n);
        return this;
    }


}