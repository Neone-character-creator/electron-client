import {AxiosInstance} from "axios";
import PluginDescription from "./PluginDescription";
import * as _ from "lodash";
import path from "path";
import fs from "fs";

export default class Plugins {
    static CACHE_DIRTY_SECONDS:number = 1 * 60 * 60 * 1000;
    pluginDir: string;
    downloadClient:AxiosInstance;
    defaultRemoteUrl:string;
    localPluginDescriptionCache:Map<PluginDescription, String>;
    remotePluginDescriptionCache:Set<PluginDescription>;

    constructor(pluginDir: string, downloadClient: AxiosInstance, defaultRemoteUrl:string) {
        this.pluginDir = pluginDir;
        this.downloadClient = downloadClient;
        this.defaultRemoteUrl = defaultRemoteUrl;
        this.remotePluginDescriptionCache = new Set<PluginDescription>();
        this.localPluginDescriptionCache = new Map<PluginDescription, String>();
    }

    /**
     * Returns the plugin description for all locally stored plugin archives.
     */
    async getLocalPluginDescriptions(): Promise<Array<any>>{
        return [];
    }

    /**
     * Returns the plugin description for all remote plugin archives.
     */
    async getRemotePluginDescriptions(): Promise<Array<any>>{
        try {
            const lastUpdated = (this.remotePluginDescriptionCache as any).lastUpdateTime;
            if (!lastUpdated || (lastUpdated + Plugins.CACHE_DIRTY_SECONDS) < Date.now()) {
                const remote:Array<any> = (await (this.downloadClient.get(this.defaultRemoteUrl) as any)).data as Array<any>;
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
        const remotePlugins = await this.getRemotePluginDescriptions();
        const differenceBetweenRemoteAndLocal:Array<PluginDescription> = _.difference(remotePlugins, Array.from(await this.localPluginDescriptionCache.values()));
        if(differenceBetweenRemoteAndLocal.length) {
            differenceBetweenRemoteAndLocal.forEach(async plugin => {
                try {
                    const author = plugin.author;
                    const system = plugin.system;
                    const version = plugin.version;
                    const response = await this.downloadClient.get(`/plugins/${author}/${system}/${version}/`);
                    const targetFileName = path.resolve(this.pluginDir, `${author}-${system}-${version}.jar`);
                    fs.writeFile(targetFileName, response.data, err =>{
                        if(err) console.error(err);
                    });
                } catch (e) {
                    console.error(e);
                }
            })
        }
        return differenceBetweenRemoteAndLocal;
    }
}