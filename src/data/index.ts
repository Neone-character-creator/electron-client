import Store from "electron-store";
import { ObjectId } from "mongodb";
import PluginDescription from "../plugins/PluginDescription";

export default class Data {
    private store:Store;
    public static CHARACTER_KEY = "characters";

    constructor(backingStore: Store) {
        this.store = backingStore;
    }

    getAllCharacters(forPlugin: PluginDescription): Array<any>{
        const characterData = this.store.get("characters");
        return Object.keys(characterData[forPlugin.toString()]).map(id => characterData[id]);
    }

    getCharacter(forPlugin: PluginDescription, id: string): any {
        const existingCharacter = this.store.get(Data.CHARACTER_KEY)[forPlugin.toString()];
        return existingCharacter[id];
    }
    
    saveCharacter(forPlugin: PluginDescription, character: any) {
        character = {...character};
        const existingCharacters = this.store.get("characters");
        console.log(character.id ? "data has existing id" : "data has no existing id");
        let id = character.id || new ObjectId();
        character.id = id.toString();
        existingCharacters[forPlugin.toString()][id] = character;
        this.store.set("characters", existingCharacters);
        return character;
    }
}