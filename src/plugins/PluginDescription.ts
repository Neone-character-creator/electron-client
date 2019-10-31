import _ from "lodash";

export default class PluginDescription {
    readonly author:string;
    readonly system:string;
    readonly version:string;

    constructor(author: string, system: string, version: string) {
        if(_.isNil(author)) {
            throw new Error("Author cannot be null or undefined");
        }
        if(_.isNil(system)) {
            throw new Error("System cannot be null or undefined");
        }
        if(_.isNil(version)) {
            throw new Error("Version cannot be null or undefined");
        }
        this.author = author;
        this.system = system;
        this.version = version;
    }

}