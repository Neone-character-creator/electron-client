const { ipcRenderer } = require("electron");

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

window.bridge.on("plugin-list", (event, list) => console.log(list));
setTimeout(()=>{
    bridge.send("plugin-list");
}, 2500);