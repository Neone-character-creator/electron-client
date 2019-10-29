import Store from "electron-store";
import { ObjectId } from "mongodb";

export default class Data {
    private store:Store;
    public static CHARACTER_KEY = "characters";

    constructor(backingStore: Store) {
        this.store = backingStore;
    }

    getAllCharacters(): Array<any>{
        const characterData = this.store.get("characters");
        return Object.keys(characterData).map(id => characterData[id]);
    }

    getCharacter(id: string): any {
        const existingCharacter = this.store.get(Data.CHARACTER_KEY);
        return existingCharacter[id];
    }
    
    saveCharacter(character: any) {
        character = {...character};
        const existingCharacters = this.store.get("characters");
        console.log(character.id ? "data has existing id" : "data has no existing id");
        let id = character.id || new ObjectId();
        character.id = id.toString();
        existingCharacters[id] = character;
        this.store.set("characters", existingCharacters);
        return character;
    }
}