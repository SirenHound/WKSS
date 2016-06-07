module.exports = {
	getSetApi: function(APIkey){
		groupCollapsed("ApiUtils.getSetApi", arguments);
		var storedAPI = localGet('WaniKani-API');
		if (!APIkey){
			if (storedAPI !== null){
				APIkey = localGet('WaniKani-API');
				info("Retrieving APIkey", APIkey);
			}
		}else{
			//API has been provided for storage
			if (storedAPI !== APIkey){
				localSet('WaniKani-API', APIkey);//overwrite with new API
				info("Setting APIkey", APIkey);
			}
		}
		groupEnd();
		return APIkey;
	},

	saveApiFromPage: function(){
		groupCollapsed("ApiUtils.getSetApi", arguments);
		$.get("https://www.wanikani.com/account",
		function(data){
			var dom = new DOMParser().parseFromString(data, 'text/html');
			var inputs = dom.getElementsByTagName("input");
			for (var a = 0; a < inputs.length; a++){
				if (inputs[a].getAttribute("placeholder") === "Key has not been generated"){
					var api = inputs[a].getAttribute("value");
					this.getSetApi(api);
				}
			}
		});
		groupEnd();
	},
};