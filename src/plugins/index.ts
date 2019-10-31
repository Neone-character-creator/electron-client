import {AxiosInstance} from "axios";
import PluginDescription from "./PluginDescription";
import * as _ from "lodash";
import path from "path";
import fs from "fs";
import StreamZip from "node-stream-zip";
import {app} from "electron";
import {file} from "@babel/types";

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
        console.info("Getting remote plugin descriptions");
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
        return new Promise(((resolve, reject) => {
            fs.mkdir(this.pluginDir, {
                recursive: true
            }, async (err) => {
                if (err) {
                    return reject(err);
                }
                const remotePlugins = await this.getRemotePluginDescriptions();
                const localPluginsFromDisk = await this.loadPluginsFromLocalCache();
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
                                    this.unpackArchive(targetFileName);
                                }
                            });
                        } catch (e) {
                            console.error("Failed to refresh plugin cache", e);
                        }
                    })
                }
                return resolve(differenceBetweenRemoteAndLocal);
            })
        }));
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
                const pluginDescription = (await this.extractPluginDescriptionFromArchive(archive) as any).description;
                const unpackDir = path.join(this.appDataDir, `${pluginDescription.creator}-${pluginDescription.game}-${pluginDescription.version}`);
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
                            return resolve((fileContent.toJSON()));
                        });
                    });
            });
        });
    }

    public async getPluginResource(plugin: PluginDescription, resourcePath: string) {
        return path.resolve(path.join(this.appDataDir, this.getEncodedPluginFilename(plugin), resourcePath));
    }

    private async loadPluginsFromLocalCache() {
        return new Promise((resolveAll, rejectAll) => {
            fs.readdir(this.pluginDir, async (err, files) => {
                if (err) {
                    return rejectAll(err);
                }
                const resolvedFiles = await Promise.all(files.map(file => {
                    const loadedPluginDescription = this.unpackArchive(path.resolve(path.join(this.pluginDir, file)));
                }));
            });
        })
    }

    private async extractPluginDescriptionFromArchive(archive: any) {
        return new Promise((resolve, reject) => {
            const dataBuffer = archive.entryDataSync("plugin.json");
            return resolve(JSON.parse(dataBuffer.toString()));
        });
    }

    public async getPluginConfiguration(plugin: PluginDescription) {
        return new Promise(((resolve, reject) => {
            const configurationPath = path.join(this.appDataDir, this.getEncodedPluginFilename(plugin), "plugin.json");
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
        return encodeURIComponent(`${plugin.author}-${plugin.system}-${plugin.version}`);
    }
}