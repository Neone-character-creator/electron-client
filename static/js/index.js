function hideList() {
    availablePlugins.hide();
}
window.bridge.on("plugin-list", (event, list) => {
    $("#spinner").show();
    const availablePlugins = $("#available-plugins");
    availablePlugins.empty();
    list.forEach(ap => {
        console.log(ap);
        const newElement = $("<li>");
        newElement.text(ap.system + " " + ap.version);
        newElement.on("click", function () {
            const pluginToLoad = ap;
            window.bridge.send("load-plugin", pluginToLoad);
        });
        availablePlugins.append(newElement);
    });
    $("#spinner").hide();
});
$(document).ready(function(){
    window.bridge.send("plugin-list");
});