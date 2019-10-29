import {AxiosInstance} from "axios";
import PluginDescription from "./PluginDescription";
import * as _ from "lodash";
import path from "path";
import fs from "fs";
import StreamZip from "node-stream-zip";
import {app} from "electron";

export default class Plugins {
    static CACHE_DIRTY_SECONDS: number = 1 * 60 * 60 * 1000;
    private readonly appDataDir: string;
    private readonly pluginDir: string;
    private readonly downloadClient: AxiosInstance;
    private readonly defaultRemoteUrl: string;
    private readonly localPluginDescriptionCache: Map<PluginDescription, String>;
    private readonly remotePluginDescriptionCache: Set<PluginDescription>;

    constructor(pluginDir: string, downloadClient: AxiosInstance, defaultRemoteUrl: string) {
        this.pluginDir = pluginDir;
        this.downloadClient = downloadClient;
        this.defaultRemoteUrl = defaultRemoteUrl;
        this.remotePluginDescriptionCache = new Set<PluginDescription>();
        this.localPluginDescriptionCache = new Map<PluginDescription, String>();
        this.appDataDir = path.join(app.getPath("appData"), "neone");
    }

    /**
     * Returns the plugin description for all locally stored plugin archives.
     */
    async getLocalPluginDescriptions(): Promise<Array<any>> {
        return [];
    }

    /**
     * Returns the plugin description for all remote plugin archives.
     */
    async getRemotePluginDescriptions(): Promise<Array<any>> {
        try {
            const lastUpdated = (this.remotePluginDescriptionCache as any).lastUpdateTime;
            if (!lastUpdated || (lastUpdated + Plugins.CACHE_DIRTY_SECONDS) < Date.now()) {
                const remote: Array<any> = (await (this.downloadClient.get(this.defaultRemoteUrl) as any)).data as Array<any>;
                remote.forEach(remotePlugin => {
                    this.remotePluginDescriptionCache.add(remotePlugin);
                });
                (this.remotePluginDescriptionCache as any).lastUpdateTime = Date.now();
            }
            return Array.from(this.remotePluginDescriptionCache.values());
        } catch (e) {
            throw e;
        }
    }

    /**
     * Refresh the local cache of plugins and return an array of local plugins.
     *
     * @return promise of array of PluginDescriptions of all downloaded plugins
     */
    async updateLocalPluginCache(): Promise<Array<any>> {
        console.info("Refreshing plugin cache from remote at " + this.defaultRemoteUrl);
        const remotePlugins = await this.getRemotePluginDescriptions();
        const differenceBetweenRemoteAndLocal: Array<PluginDescription> = _.difference(remotePlugins, Array.from(await this.localPluginDescriptionCache.values()));
        if (differenceBetweenRemoteAndLocal.length) {
            differenceBetweenRemoteAndLocal.forEach(async plugin => {
                try {
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
                            this.unpackArchive(new PluginDescription(author, system, version));
                        }
                    });
                } catch (e) {
                    console.error("Failed to refresh plugin cache", e);
                }
            })
        }
        return differenceBetweenRemoteAndLocal;
    }

    private async unpackArchive(pluginId: PluginDescription): Promise<any> {
        const encodedArchiveId = this.getEncodedPluginFilename(pluginId);
        const archivePath = path.resolve(path.join(this.pluginDir, `${encodedArchiveId}.jar`));
        console.log(`Unpacking archive for ${pluginId.author}-${pluginId.system}-${pluginId.version} at ${archivePath}`);
        return new Promise((resolve, reject) => {
            fs.mkdir(this.appDataDir, '0777', (err) => {
                if (err && err.code !== 'EEXIST') {
                    return reject(err);
                }
                const archive = new StreamZip({
                    file: archivePath,
                    storeEntries: true
                });
                archive.on('ready', () => {
                    const unpackDir = path.join(this.appDataDir, encodedArchiveId);
                    console.log(`Begin unpack to ${unpackDir} ${archive.entriesCount}`);
                    fs.mkdir(unpackDir, function (err) {
                        // If the directory already exists, we don't care, that's normal.
                        if (err && err.code !== 'EEXIST') {
                            return reject(err);
                        }
                        archive.extract(null, unpackDir,
                            (err: any, extractedCount: number) => {
                                if (err) {
                                    return reject(err);
                                }
                                archive.close();
                                console.log(`Unpack complete: ${extractedCount} entries`);
                                resolve();
                            });
                    });
                });

            })
        });
    }

    public async getPluginResource(plugin: PluginDescription, resourcePath: string) {
        return path.resolve(path.join(this.appDataDir, this.getEncodedPluginFilename(plugin), resourcePath));
    }

    public async getPluginConfiguration(plugin: PluginDescription) {
        return new Promise(((resolve, reject) => {
            const configurationPath = path.join(this.appDataDir, this.getEncodedPluginFilename(plugin), "plugin.json");
            fs.readFile(configurationPath, {
                encoding: "UTF-8"
            }, function (err, data) {
                if(err) {
                    return reject(err)
                }
                resolve(JSON.parse(data));
            })
        }))
    }

    private getEncodedPluginFilename(plugin: PluginDescription) {
        if(!plugin) {
            throw new Error("plugin cannot be null or undefined");
        }
        return encodeURIComponent(`${plugin.author}-${plugin.system}-${plugin.version}`);
    }
}