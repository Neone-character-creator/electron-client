window.index = function(){
	var spinner = $("#spinner");
	window.bridge.send("rendered");
};
$(document).ready(window.index);