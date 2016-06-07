var Node = require('./node.js');
module.exports = Node.extend({
	options:{
		type: "button"
	},
	initialize:function(options){
		info("opt:", this.options);
		Node.prototype.initialize.call(this, "input", options);
		info("options:", this.options);
		this.setAttributes(this.options);
		info("here is the new button", this._container, "options", this.options);
	}
});