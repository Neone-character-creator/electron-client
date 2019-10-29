function getContentIframeWindow() {
    const contentIframe = $("#content");
    const contentDocument = contentIframe[0].contentWindow;
    return contentDocument;
}

function newCharacter() {
    window.bridge.send("create-new-character");
}

function loadCharacter() {
    window.bridge.send("get-character-list");
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
    $("#open-character").on("click", loadCharacter);
    $("#save-character").on("click", saveCharacter);

    window.bridge.on("character-saved", function (e, postSaveCharacter) {
        getContentIframeWindow().postMessage({
            action: "character-saved",
            character: postSaveCharacter
        });
    });

    window.bridge.on("character-loaded", function(e, loadedCharacter){
        getContentIframeWindow().postMessage({
            action: "character-loaded",
            character: loadedCharacter
        });
        console.log(loadedCharacter);
        $("#loading-modal").modal("hide");
    });

    window.bridge.on("get-character-list", function (e, characterList) {
        $("#modal-content").empty();
        if (characterList.length) {
            $.each(characterList, function (i, element) {
                var id = element.id;
                var row = $("<div>", {
                    "class": "row"
                });

                var nameCol = $("<div>", {
                    "class": "col-md-8"
                }).text(element.name ? element.name : (element._name ? element._name : "Unnamed Character"));
                row.append(nameCol);

                var loadButton = $("<button>", {
                    "class": "btn btn-primary load-character",
                    "data-characterid": id
                }).text("Open");
                loadButton.on("click", function () {
                    const idToLoad = id;
                    window.bridge.send("load-character", id);
                });
                row.append(loadButton);

                // var deleteButton = $("<button>", {
                //     "class": "btn btn-warning delete-character",
                //     "data-url": url + id
                // }).text("Delete")
                //     .click(function () {
                //         $.ajax({
                //             url: deleteButton.attr("url"),
                //             type: "GET",
                //             headers: headers,
                //             accept: "application/json;charset=UTF-8"
                //         })
                //     });
                // row.append(deleteButton);

                $("#modal-content").append(row)
            })
        } else {
            $("#modal-content").text("No characters loaded");
        }
    });
});