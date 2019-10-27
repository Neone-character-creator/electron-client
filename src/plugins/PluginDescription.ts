export default class PluginDescription {
    _author:string;
    _system:string;
    _version:string;

    constructor(author: string, system: string, version: string) {
        this._author = author;
        this._system = system;
        this._version = version;
    }

    get author(){
        return this._author;
    }

    get system(){
        return this._system;
    }

    get version(){
        return this._version;
    }
}