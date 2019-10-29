function newCharacter(){
    const contentIframe = $("#content");
    const contentDocument = contentIframe[0].contentDocument;
    contentDocument.window;
}

function loadCharacter(){

}

$().ready(function(){
    let loadedPluginInfo;
    window.bridge.on("get-plugin-info", function(e, pluginInfo, iframeUrl){
        loadedPluginInfo = pluginInfo;
        $("#content").attr("src", iframeUrl);
    });
    window.bridge.send("get-plugin-info", );
    $("#new-character").on("click", newCharacter);
    $("#load-character").on("click", loadCharacter);
});