const {ipcRenderer} = require("electron");

const listeners = {};
const bridge = {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (id, callback) => {
        if (listeners[id]) {
            console.warn("Replacing listener with id " + id);
            ipcRenderer.removeListener(id, callback);
        }
        listeners[id] = callback;
        ipcRenderer.on(id, callback);
    }
};

window.bridge = bridge;