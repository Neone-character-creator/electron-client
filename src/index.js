const {ipcRenderer} = require("electron");

const listeners = {};
const bridge = {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (id, callback) => {
        if (listeners[id]) {
            console.warn("Replacing listener with id " + id);
        }
        listeners[id] = callback;
        ipcRenderer.on(id, callback);
    }
};

window.bridge = bridge;

function hideList(){
    availablePlugins.hide();
}

let availablePlugins;
window.bridge.on("plugin-list", (event, list) => {
    availablePlugins = $("#available-plugins");
    list.forEach(ap => {
        console.log(ap);
        const newElement = $("<li>");
        newElement.text(ap.system + " " + ap.version);
        newElement.on("click", function(){
            hideList();
        });
        availablePlugins.append(newElement);
    });
    $("#spinner").hide();
});