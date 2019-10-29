function getContentIframeWindow() {
    const contentIframe = $("#content");
    const contentDocument = contentIframe[0].contentWindow;
    return contentDocument;
}

function newCharacter() {
    window.bridge.send("create-new-character");
}

function loadCharacter() {
    const contentIframe = $("#content");
}

function saveCharacter() {
    getContentIframeWindow().postMessage({action: "get-character"});
}

$().ready(function () {
    let loadedPluginInfo;
    window.bridge.on("get-plugin-info", function (e, pluginInfo, iframeUrl) {
        loadedPluginInfo = pluginInfo;
        $("#content").attr("src", iframeUrl);
    });
    window.bridge.send("get-plugin-info");
    window.addEventListener("message", function (event) {
        console.log(event.data);
        window.bridge.send("save-character", event.data);
    });
    $("#new-character").on("click", newCharacter);
    $("#load-character").on("click", loadCharacter);
    $("#save-character").on("click", saveCharacter);

    window.bridge.on("character-saved", function (e, postSaveCharacter) {
        getContentIframeWindow().postMessage({
            action: "character-saved",
            character: postSaveCharacter
        });
    });
});