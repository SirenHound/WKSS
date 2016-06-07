var Class = require('./class.js');
var Node = require('./node.js');
module.exports = Class.extend({

	initialize: function(idString, options){
		idString && (this._id = "#" + idString);
		info("handler?", {click: options.closeHandler||this.close});
		this.closeButton = new Node("button").addjQueryHandlers({click: options.closeHandler || $.proxy(this.close, this)}).setAttributes({type:"button", class:"wkss-close"}).addNode(new Node("i").addClass("icon-remove"));


		this._windowIds = ["#add", "#export", "#import", "#edit", "#selfstudy", "#resultwindow"];

		this._height = options.windowHeight;
		this._width = options.windowWidth;
		this._elem = new Node("div")
			.addStyles({height: options.windowHeight + "px", width: options.windowWidth + "px", marginLeft: -options.windowWidth/2 + "px"})
			.setId(idString)
			.addClass("WKSS");
		this._elem.addNodes(
			this.closeButton
		);
		this._elem.addNodes.apply(this._elem, options.nodes);
		log("this._elem",this._elem);

		//$(this.closeButton._container).click(options.closeHandler);

		info("Just created a window", this);
	},

	addTo: function(elem){
		$(elem).append(this._elem._container);
	},
	
	reset: function(){
		this._elem._childNodes.forEach(function(node){node.reset();});
	},

	close: function(){
		info("hiding window", this);
		//hide the window
		$(this._elem._container).hide();
		//clear all forms
		Array.prototype.forEach.call(this._elem._container.getElementsByTagName("form"), function(form){form.reset();});
		//reset status to default
		

  /*$("#addStatus").text('Ready to add..');
	$("#addKanji").removeClass("error");
	$("#addMeaning").removeClass("error");

	$("#exportForm")[0].reset();
	$("#exportArea").text("");
	$("#exportStatus").text('Ready to export..');
*/
	},

	show: function(){
		log("id?", this);
		$(this._elem._container).show();
		for (var id = 0, l = this._windowIds.length; id < l; id++){
			if (this._windowIds[id] !== this._id){
				$(this._windowIds[id]).hide();
			}
		}
	}
});