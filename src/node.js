var Class = require('./class.js');
var Util = require('./util.js');

module.exports = Class.extend({
	options:{},
	initialize: function(type, options){
		groupCollapsed("o.Node.prototype.initialize", arguments);
		this.options = Util.setOptions(this, options);
		//this.options = options;
		//Util.extend(this.options, options);
		this._container = document.createElement(type);
		log("options", this.options);
		this._defaultTextString = options && options.text || "";
		this._textNode = document.createTextNode(this._defaultTextString);
		this.setText(this._defaultTextString);
		this._childNodes = [];
		groupEnd();
	},
	setAttribute: function(attribute, dataString){
		this._container.setAttribute(attribute, dataString);
		return this;
	},
	setAttributes: function(keyValuePairs){
		for(var k in keyValuePairs) if (keyValuePairs.hasOwnProperty(k)){
			this._container.setAttribute(k, keyValuePairs[k]);
		}
		return this;
	},
	addjQueryHandlers: function(handlers){
		for (var evt in handlers) if (handlers.hasOwnProperty(evt)){
			info("adding some handlers to: ", $(this._container));
			info("this is what we're adding: ", handlers);
			$(this._container).on(evt, handlers[evt]);
		}
		return this;
	},
	addTo: function(node){
		node instanceof this.constructor && (node = node._container);
		info("#");
		node.appendChild(this._container);
		return this;
	},
	addNode:function(node){
		node instanceof this.constructor && (this._childNodes.push(node), node = node._container);
		info("#");
 //       this._container.appendChild(node);
		return this;
	},
	addNodes:function(){
		var node, textNode;
		for (var arg in arguments) if (arguments.hasOwnProperty(arg)){
			node = arguments[arg] instanceof this.constructor ? (this._childNodes.push(arguments[arg]),arguments[arg]._container) : arguments[arg];
		info("#");
   //         this._container.appendChild(node);
		}
		return this;
	},
	reset: function(){
		this.setText(this._defaultTextString);
		this.removeClass("error");
		this._childNodes.forEach(function(n){n.reset();});
		return this;
	},
	setId: function(idString){
		if (this._container){
			this._container.id = idString;
		}else{
			error("undefined???", this);
		}
		return this;
	},
	addClass: function(classString){
		this._container.className = this._container.className? this._container.className + " " + classString : classString;
		return this;
	},
	removeClass: function(classString){
		var a = this._container.className.split(" ");
		var i = a.indexOf(classString);
		if(i >= 0){
			a.splice(i, 1);
			this._container.className = a.join(" ");
		}
	},
	addStyles: function(jsStylesObject){
		info("here", this, jsStylesObject);
		for (var st in jsStylesObject) if (jsStylesObject.hasOwnProperty(st)){
			this._container.style[st] = jsStylesObject[st];
		}
		return this;
	},
	getContainer: function(){
		return this._container;
	},
	setText: function(textString){
		this._textNode.nodeValue = textString;
		info("#");
	//    this._container.appendChild(this._textNode);
		return this;
	}
});