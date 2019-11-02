import {EventEmitter} from "events";
import Plugins from "./index";

export default class PluginEventEmitter implements EventEmitter{
    public static readonly Events = {
        PLUGIN_LOAD: "plugin-load",
        REMOTE_PLUGIN_LOAD_FAILED: "plugin-load-failed"
    };
    private _listeners:any;
    private plugins: Plugins;

    constructor(plugins: Plugins) {
        this.plugins = plugins;
        this._listeners = {};
    }

    private notify(listeners: Array<(...args: any[]) => void>, ...data:any[]) {
        listeners.forEach(listener => listener(data));
    }

    addListener(event: string | symbol, listener: (...args: any[]) => void): this {
        this._listeners[event] = this._listeners[event] || [];
        (this._listeners[event] as Array<any>).push(listener);
        if(this._listeners[event]) {
            console.info(`Publishing to already registered listeners for event ${String(event)}`);
        }
        switch (event) {
            case PluginEventEmitter.Events.PLUGIN_LOAD:
                this.plugins.getLocalPluginDescriptions().then(pluginList => {
                    this.notify(this._listeners[event], pluginList);
                });
                break;
        }
        return this;
    }

    on(event: string | symbol, listener: (...args: any[]) => void): this {
        return this.addListener(event, listener);
    }
    once(event: string | symbol, listener: (...args: any[]) => void): this {
        throw new Error("Method not implemented.");
    }
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
        throw new Error("Method not implemented.");
    }
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
        throw new Error("Method not implemented.");
    }
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
        throw new Error("Method not implemented.");
    }
    off(event: string | symbol, listener: (...args: any[]) => void): this {
        throw new Error("Method not implemented.");
    }
    removeAllListeners(event?: string | symbol | undefined): this {
        throw new Error("Method not implemented.");
    }
    setMaxListeners(n: number): this {
        throw new Error("Method not implemented.");
    }
    getMaxListeners(): number {
        throw new Error("Method not implemented.");
    }
    listeners(event: string | symbol): Function[] {
        throw new Error("Method not implemented.");
    }
    rawListeners(event: string | symbol): Function[] {
        throw new Error("Method not implemented.");
    }
    emit(event: string | symbol, ...args: any[]): boolean {
        const listeners = (this._listeners[event] as any[]);
        listeners.forEach(listener => {
            listener(...args);
        });
        return listeners.length > 0;
    }
    eventNames(): (string | symbol)[] {
        throw new Error("Method not implemented.");
    }
    listenerCount(type: string | symbol): number {
        throw new Error("Method not implemented.");
    }


}