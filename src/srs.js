var Class = require('./class.js');
module.exports = Class.extend({

	//srs 4h, 8h, 24h, 3d (guru), 1w, 2w (master), 1m (enlightened), 4m (burned)
	levels: ["Started", "Apprentice", "Apprentice", "Apprentice", "Apprentice", "Guru", "Guru", "Master", "Enlightened", "Burned"],

	intervals: (function(){
		var hrs = 60*60*1000,
			days = 24*hrs,
			weeks = 7*days;
		return [0,4*hrs,8*hrs,1*days,3*days,1*weeks,2*weeks,730*hrs,2922*hrs];
	})()
});