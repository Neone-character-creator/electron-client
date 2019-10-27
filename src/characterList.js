const renderProcess = require("ipcRenderer");

const loadCharacter = function(characterId){
    console.log("Loading character " + characterId);
};

const saveCharacter = function(characterData){
    console.log("Save character " + JSON.stringify(characterData));
};

const deleteCharacter = function(characterId){
    console.log("Deleting character " + characterId);
};

$(document).on("ready", function(){
    $("#")
});