function hideLoginPrompt(){
    $("#signin-warning").hide();
}

function showLoginPrompt(){
    $("#signin-warning").show();
}

function hideLogoutPrompt(){
    $("#logout").hide();
}

function showLogoutPrompt(){
    $("#logout").show();
}

$().ready(function(){
    showLoginPrompt();
    hideLogoutPrompt();
    window.bridge.on("get-is-authenticated-status", (e, loggedIn) => {
        if(loggedIn) {
            hideLoginPrompt();
            showLogoutPrompt();
        } else {
            showLoginPrompt();
            hideLogoutPrompt();
        }
    });
    $("#login").on("click", function(){
        window.bridge.send("start-login", "google");
    });
    $("#logout").on("click", function(){
        window.bridge.send("start-logout");
    });
});