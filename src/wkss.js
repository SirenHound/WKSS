// ==UserScript==
// @name        Wanikani Self-Study Plus Beta
// @namespace   wkselfstudyplus
// @description Adds an option to add and review your own custom vocabulary
// @require     ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js
// @include     *.wanikani.com/*
// @include     *.wanikani.com/chat/*
// @exclude     *.wanikani.com
// @include     *.wanikani.com/dashboard*
// @include     *.wanikani.com/community*
// @include     file://
// @version     0.2.0
// @author      shudouken and Ethan
// @run-at      document-end
// @grant       none
// @license     http://creativecommons.org/licenses/by-nc/3.0/
// ==/UserScript==
(function(){
    "use strict";
try{

    /*
     *  This script is licensed under the Creative Commons License
     *  "Attribution-NonCommercial 3.0 Unported"
     *
     *  More information at
     *  http://creativecommons.org/licenses/by-nc/3.0/
     */


    // shut up JSHint
    /* jshint multistr: true , jquery: true, expr: true, indent:2 */
    /* global window, wanakana, XDomainRequest */

    var o = {};
    window.o = o;

    o.VersionData = {
        v: "0.2.1",
        propertyType: {meaning: "array", reading: "array", kanji: "string", i:"number", components: "array", date: "number", due: "number", locked: "string", manualLock: "string"},
        propertyDesc: {meaning: "list of meanings", reading: "list of readings", kanji: "item prompt", i:"item index", components: "kanji found in word", date: "timestamp of new level", due: "timestamp of item's next review", locked: "indicator of whether components are eligible", manualLock: "latch for 'locked' so failing components don't re-lock the item"}
    };


    /*
     * L.Class powers the OOP facilities of the library.
     * Thanks to John Resig and Dean Edwards for inspiration!
     */

    /*
     * Code credit link: https://raw.githubusercontent.com/Leaflet/Leaflet/master/src/core/Class.js
     */
    o.Util = require('./util.js');
    o.extend = o.Util.extend;

    o.Class = require('./class.js');
    /*
     * End Credit Leaflet Class Object
     */


    /**
    * @todo Making settings visible on page
    */
    o.extend({
        locksOn: true, //Disable vocab locks (unlocked items persist until deleted)
        lockDB: false, //Set to false to unlock Kanji is not available on WaniKani (ie. not returned by API)
        reverse: false, //Include English to ひらがな reading reviews
        asWK: false, //Push user reviews into the main WK review queue
        APIkey: "YOUR_API_HERE"
    });

    o.setOptions = function(t,e){
        return t.options = o.extend({}, t.options, e), t.options;
    };

    o.debugging = true;
    /**
    * conOps - Inserts css string and namespace prefix into argument list for use in console operations
    * @param {ArgumentList} input - List of arguments to pass to function
    * @param {String} css - css string to apply to first argument if it is a string
    * @returns {ArgumentList} - new set of arguments to apply to console operation
    */
    var conOps = function(input, css){
        var args = Array.prototype.slice.apply(input); 
        typeof args[0] === "string"? args[0] = "WKSS+: " + (css ? "%c" : "") + args[0] : args.unshift("WKSS+:");
        css && args.splice(1, 0, css);
        return args;
    };

    //console functions info, warn, log, groupCollapsed, groupEnd, error
    var info =           function(){var args = conOps(arguments, "color:blue;"); o.debugging&&console.info.apply(console, args);},
        warn =           function(){var args = conOps(arguments);                o.debugging&&console.warn.apply(console, args);},
        trace =          function(){var args = conOps(arguments);                o.debugging&&console.trace.apply(console, args);},
        log =            function(){var args = conOps(arguments);                o.debugging&&console.log.apply(console, args);},
        group =          function(){var args = conOps(arguments);                o.debugging&&console.group.apply(console, args);},
        groupCollapsed = function(){var args = conOps(arguments);                o.debugging&&console.groupCollapsed.apply(console, args);},
        groupEnd =       function(){var args = conOps(arguments);                o.debugging&&console.groupEnd.apply(console, args);},
        error =          function(){var args = conOps(arguments);                o.debugging&&console.error.apply(console, args);};

    //unless the user navigated from the review directory, they are unlikely to have unlocked any kanji
    o.noNewStuff = /^https:\/\/.*\.wanikani\.com\/.*/.test(document.referrer)&&!(/https:\/\/.*\.wanikani\.com\/review.*/.test(document.referrer));
    o.usingHTTPS = /^https:/.test(window.location.href);
    log("o.usingHTTPS",o.usingHTTPS);
    var localGet = function(strName){
        var strObj = localStorage.getItem(strName);
        //    return parseString(strObj);
        return $.jStorage.get(strName);
    };

    o.ApiUtil = require('./apiutil.js');

    o.users = {
        current:{
            apiKey: o.ApiUtil.getSetApi()
        }
    };

    if (!o.users.current.apiKey){
        info("populating api");
        o.ApiUtil.saveApiFromPage(); //--
    }

    /**
     * @param {String} APIkey - Users WaniKani API key (for setting)
     * @requires {Function} localGet
     * @requires {Function} localSet
     * @returns {String} APIkey
     */
    o.Node = require('./node.js');

    o.Button = require('./button.js');

    o.Form = o.Node.extend({
        initialize:function(options){
            o.Node.prototype.initialize.call(this, "form", options);
            this.setAttributes(this.options);

        }
    });
    //addItemBtn
    var addItemBtn = new o.Button({id:"AddItemBtn", value:"Add New Item"});
    var addForm = new o.Form({id:"addForm"}).addNodes();

    var handleAddClose = function() {
        $("#add").hide();
        $("#addForm")[0].reset();
        $("#addStatus").text('Ready to add..');
        $("#addKanji").removeClass("error");
        $("#addMeaning").removeClass("error");
    };
    var handleExportClose = function () {
        $("#export").hide();
        $("#exportForm")[0].reset();
        $("#exportArea").text("");
        $("#exportStatus").text('Ready to export..');
    };
    var handleImportClose = function () {
        $("#import").hide();
        $("#importForm")[0].reset();
        $("#importArea").text("");
        $("#importStatus").text('Ready to import..');
    };
    var handleSelfstudyClose = function () {
        $("#selfstudy").hide();
        $("#rev-input").val("");
        reviewActive = false;
    };
    var handleResultClose = function () {
        $("#resultwindow").hide();
        document.getElementById("stats-a").innerHTML = "";
    };

    // add Window, standard 300 x 300
    o.Window = require('./window.js');

    var handleWindowClose = function(){
        log("close me", this);
    };

    var settingsWindow = new o.Window("settings", {
		windowHeight:300, windowWidth:300,
		nodes:[
			new o.Node("h1").setText("User Settings"),
			new o.Node("label").setText("API key"),
			new o.Node("input").setAttributes({type: "text", placeholder: o.users.current.apiKey}).addStyles({width:"90%"})
		]
	});
	log(settingsWindow);

    var addWindow = new o.Window("add", {
		windowHeight:300, windowWidth:300,
		nodes:[new o.Node("form").setAttributes({id: "addForm"}).addNodes(
			new o.Node("h1", {text: "Add a new Item"}),
			new o.Node("input").setAttributes({type: "text", id:"addKanji", placeholder:"Enter 漢字, ひらがな or カタカナ"}),
			new o.Node("input").setAttributes({type: "text", id:"addReading", title: "Leave empty to add vocabulary like する (to do)", placeholder:"Enter reading"}),
			new o.Node("input").setAttributes({type: "text", id:"addMeaning", placeholder:"Enter meaning"}),
			new o.Node("p", {text: "Ready to add.."}),
			new o.Node("button").setAttributes({id:"AddItemBtn", type:"button"}).setText("Add new Item")
		)]
	});
    log("addWindow",addWindow);
    warn("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

    var exportWindow = new o.Window("export", {windowHeight:275, windowWidth:390});


    info("_container", exportWindow._elem._container,addWindow._elem, addWindow._elem._container.firstChild, exportWindow === addWindow);
    //var addWindowHeight = 300;
    //   var addWindowWidth = 300;
    warn("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

    // export and import Window, standard 275 x 390
    info("importwindow._elem._coontainer",exportWindow._elem._container.firstChild, addWindow);

    info("c",addWindow === exportWindow);
    var importWindow = new o.Window("import", {windowHeight:275, windowWidth:390});
    var exportImportWindowHeight = 275;
    var exportImportWindowWidth = 390;
    warn("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

    // edit Window, standard 380 x 800
    var editWindow = new o.Window("edit", {windowHeight:380, windowWidth:800});
    var editWindowHeight = 380;
    var editWindowWidth = 800;

    // study(review) Window, standard 380 x 600
    var studyWindow = new o.Window("selfstudy", {windowHeight:380, windowWidth:600});
    var studyWindowWidth = 600;

    // result Window, standard 500 x 700
    var resultWindow = new o.Window("results", {windowHeight:500, windowWidth:700});
    var resultWindowHeight = 500;
    var resultWindowWidth = 700;

    ///###############################################

    var errorAllowance = 4; //every x letters, you can make one mistake when entering the meaning

    o.SRS = require('./srs.js');
    var srsObject = new o.SRS();



    //convert localstorage User-Vocab for updates
    var convertStorage = function(vocab){
        vocab = vocab || localGet("User-Vocab") || [];
        var v = vocab.length;
        while (v--){
            if (typeof vocab[v].due === "undefined" ||
                vocab[v].due !== vocab[v].date + srsObject.intervals[vocab[v].level]
               ){
            }
        }
        localSet("User-Vocab", vocab);
    };

    //GM_addStyle shim for compatibility
    var gM_addStyle = function(cssString){
        //get DOM head
        var head = document.getElementsByTagName('head')[0];
        if (head) {
            //build style tag
            var style = document.createElement('style');
            style.setAttribute('type', 'text/css');
            style.textContent = cssString;
            //insert DOM style into head
    info("#");
        //    head.appendChild(style);
        }
    };


    //--------------Start Insert Into WK Review Functions--------------
    o.Reviews = require('./reviews.js');
    //--------------End Insert Into WK Review Functions--------------

    /*
         * populate reviews when menu button pressed
         */

    window.generateReviewList = function() {
        //if menu is invisible, it is about to be visible
        if ( $("#WKSS_dropdown").is(":hidden") ){
            //This is really the only time it needs to run
            //unless we want to start updating in realtime by keeping track of the soonest item
            generateReviewList();
        }
    };

    /*
         *  Add Item
         */
    // event function to open "add window" and close any other window that might be open at the time.


    //'add window' html text
    //var addHtml = addWindow.htmlTemplate;

    o.AddButton = o.Button.extend({
        _onClick: function(){

            var kanji = $("#addKanji").val().toLowerCase();
            var reading = $("#addReading").val().toLowerCase().split(/[,、]+\s*/); //split at , or 、followed by 0 or any number of spaces
            var meaning = $("#addMeaning").val().toLowerCase().split(/[,、]+\s*/);
            var success = false; //initalise values
            var meanlen = 0;

            var i = meaning.length;
            while (i--){
                meanlen += meaning[i].length;
            }

            //input is invalid: prompt user for valid input
            var item = {};
            if (kanji.length === 0 || meanlen === 0) {
                $("#addStatus").text("One or more required fields are empty!");
                if (kanji.length === 0) {
                    $("#addKanji").addClass("error");
                } else {
                    $("#addKanji").removeClass("error");
                }
                if (meanlen === 0) {
                    $("#addMeaning").addClass("error");
                } else {
                    $("#addMeaning").removeClass("error");
                }
            } else {
                log("building item: "+kanji);
                item.kanji = kanji;
                item.reading = reading; //optional
                item.meaning = meaning;

                success = true;
                log("item is valid");
            }

            //on successful creation of item
            if (success) {
                //clear error layout to required fields
                $("#addKanji").removeClass("error");
                $("#addMeaning").removeClass("error");



                //if there are already user items, retrieve vocabList
                // var vocabList = [];
                var vocabList = getFullList();

                log("vocabList retrieved, length: "+vocabList.length);
                //check stored user items for duplicates ****************** to do: option for editing duplicate item with new input
                if(checkForDuplicates(vocabList,item)) {
                    $("#addStatus").text("Duplicate Item detected!");
                    $("#addKanji").addClass("error");
                    return;
                }

                setVocItem(item);

                log("clear form");
                $("#addForm")[0].reset();

                //--------------------------------------------------------------------------------------------------------
                if (item.manualLock === "yes" || item.manualLock === "DB" && o.lockDB){
                    $("#addStatus").html("<i class=\"icon-lock\"></i> Added locked item");
                } else {
                    $("#addStatus").html("<i class=\"icon-unlock\"></i>Added successfully");
                }
                //--------------------------------------------------------------------------------------------------------
            }
        }
    });

    var addButton = new o.AddButton();

    var setSrsItem = function(srsitem,srsList){
        var index = srsitem.i;
        log("setSrsItem: ");

        if(srsList){
            if(srsList[index].kanji===srsitem.kanji){// try search by index

                log("success: "+srsitem.kanji+" found at index "+ index);
                //replace only the srs parts of the item
                srsList[index].date = srsitem.date;
                srsList[index].level = srsitem.level;
                srsList[index].locked = srsitem.locked;
                srsList[index].manualLock = srsitem.manualLock;
            }else{ //backup plan (cycle through list?)
                log("SRS Kanji not found in vocablist, needs work");

            }
            log("item: ");
            return srsList;
        }
    };

    var getSrsList = function(){
        var srsList = getVocList();
        return srsList;
    };

    var getVocList = function(){
        var vocList = JSON.parse(localGet('User-Vocab'))||[];
        if (vocList){
            var v=vocList.length;
            while(v--){
                vocList[v].i = v; //set index for item (->out)
            }
        }
        log("getVocList: ");
        return vocList;
    };

    var setVocItem = function(item){

        //Assumption: item comes only with kanji, reading and meaning

        item.level = 0;
        item.date = Date.now();
        item.manualLock = "";
        item = setLocks(item);
        item.due = item.date + srsObject.intervals[item.level]; //0.1.9 adding in 'due' property to make review building simpler

        var found = false;
        var vocList = localGet('User-Vocab')||[];

        var v = vocList.length;
        while(v--){
            if (vocList[v].kanji === item.kanji){
                found = true;
                log("duplicate found, skipping item (give options in future)");

                //add meaning and reading to existing item
                //        vocList[v].meaning = item.meaning;
                //      vocList[v].reading = item.reading;
            }
        }
        if (!found) {
            //provide index for faster searches
            log(item.kanji +" not found in vocablist, adding now");
            item.i = vocList.length;
            vocList.push(item);

            localSet('User-Vocab',vocList);
        }
    };

    var getFullList = function(){
        var fullList = JSON.parse(localGet('User-Vocab')) || [];
        return fullList;
    };

    //checks if an item is present in a list
    var checkForDuplicates = function(list, item) {
        log("Check for dupes with:" + item.kanji);

        var i = list.length;
        while(i--){
            list[i].i = i; //set index property for quick lookup
            if(list[i].kanji == item.kanji)

                return true;
        }
        return false;
    };

    //manages .locked property of srsitem
    /*This function manages the .locked and manualLock properties of srsitem
         .locked is a real time evaluation of the item (is any of the kanji in the word locked?)
         .manualLock will return 'no' if .locked has ever returned 'no'.
         This is to stop items being locked again after they have been unlocked if any
         of the kanji used falls below the unlock threshold
         (eg. if the 勉 in 勉強 falls back to apprentice, we do not want to lock up 勉強 again.)
         */
    var setLocks = function(item){
        //functions:
        //    isKanjiLocked(srsitem)

        //-----------------------]

        //once manualLock is "no" it stays "no"
        if (item.manualLock !== "no" && item.manualLock !== "n"){

            var kanjiList = localGet('User-KanjiList')||[];

            item.components = getComponents(item.kanji);

            var kanjiLockedResult = isKanjiLocked(item, kanjiList);
            item.locked = kanjiLockedResult[0];

            item.manualLock = item.locked;
        }else{
            item.manualLock = 'no';
        }

        log("setting locks for "+ item.kanji +": locked: "+item.locked+", manualLock: "+ item.manualLock);

        return item;
    };

    var isKanjiLocked = function(srsitem, kanjiList){
        //functions:
        //    getCompKanji(srsitem.kanji, kanjiList)

        //item unlocked by default
        //may have no kanji, only unlocked kanji will get through the code unflagged

        var locked = "no";
        if (o.locksOn){


            //get the kanji characters in the word.
            var componentList = getCompKanji(srsitem, kanjiList);
            // eg: componentList = getCompKanji("折り紙", kanjiList);
            // componentList = [{"kanji": "折", "srs": "guru"}, {"kanji": "紙", "srs": "apprentice"}]


            var c = componentList.length;
            while(c--){
                //look for locked kanji in list
                if (componentList[c].srs == "apprentice" ||
                    componentList[c].srs == "noServerResp"||
                    componentList[c].srs == "unreached"
                   ){

                    //----could be apprentice etc.
                    //Simple: lock is 'yes'
                    locked = "yes";
                    // "yes":   item will be locked while there is no database connection.
                    //          if the server response indicates that it has been unlocked, only then will it be available for review

                    log("test srs for apprentice etc. 'locked': "+ locked);

                    log(componentList[c].kanji +": "+componentList[c].srs +" -> "+ locked);

                    break; // as soon as one kanji is locked, the whole item is locked
                }

                //DB locks get special state
                if (componentList[c].srs == "noMatchWK" || componentList[c].srs == "noMatchGuppy"){

                    locked = "DB";
                    //"DB"  : database limitations, one of two things
                    //a. the kanji isn't in the database and the user is a guppy --could change if user subscribes or first two levels change/expand
                    //b. the kanji isn't in the database and the user is a turtle --could change if more kanji added.

                    log("test srs for unmatched kanji. 'locked': "+ locked);

                    log(componentList[c].kanji +": "+componentList[c].srs +" -> "+ locked);


                }

            } //for char in componentList
            log("out of character loop");
        }
        //locked will be either "yes","no", or "DB"
        return [locked];
    };
    //--------

    /*
         *  Edit Items
         */
    window.WKSS_edit = function () {
        generateEditOptions();
        $("#edit").show();
        //hide other windows
        $("#export").hide();
        $("#import").hide();
        $("#add").hide();
        $("#selfstudy").hide();
    };

    //retrieve values from storage to populate 'editItems' menu
    var generateEditOptions = function() {
        var select = document.getElementById('editWindow');

        //clear the menu (blank slate)
        while (select.firstChild) {
            select.removeChild(select.firstChild);
        }

        //check for items to add
        if (localGet('User-Vocab')) {

            //retrieve from local storage
            var vocabList = getVocList();
            var srslist =  getSrsList();
            var options = [];
            //build option string
            var i = vocabList.length;
            while (i--){
                //form element to save string
                var opt = document.createElement('option');

                //dynamic components of string

                //when is this item up for review
                var due = srslist[i].due||srslist[i].date + srsObject.intervals[srslist[i].level];
                var review = "";

                //no future reviews if burned
                if(srslist[i].level >= 9) {
                    review = "Never";
                }

                //calculate next relative review time
                //current timestamp is past due date.
                else if(Date.now() >= due) {
                    review = "Now" ;
                }

                else {//turn number (milliseconds) into relatable string (hours, days, etc)
                    review = ms2str(due - Date.now());
                }//end if review is not 'never' or 'now'

                var text = vocabList[i].kanji + " & " +
                    vocabList[i].reading + " & " +
                    vocabList[i].meaning + " (" +
                    srsObject.levels[srslist[i].level] + " - Review: " +
                    review + ") Locked: " +
                    srslist[i].manualLock;

                opt.value = i;
                opt.innerHTML = text;
                options.push(opt);//for future use (sorting data etc)
            info("#");
           //     select.appendChild(opt);//export item to option menu
            }
        }
    };

    var updateEditGUI = function(){

        generateEditOptions();
        document.getElementById("editItem").value = "";
        document.getElementById("editItem").name = "";

    };

    var ms2str = function(milliseconds){
        var num; //number of months weeks hours etc
        //more time has elapsed than required for the level
        switch (true){
            case (milliseconds <= 0) :
                return "Now" ;

            case (milliseconds > 2628000000) : //About a month
                num = Math.floor(milliseconds/2628000000).toString()+" month";
                if (num !== "1 month"){
                    return num+"s";
                }else{
                    return num;
                }
                break;
            case (milliseconds > 604800000) : //A week
                num = Math.floor(milliseconds/604800000).toString()+" week";
                if (num !== "1 week"){
                    return num+"s";
                }else{
                    return num;
                }
                break;
            case (milliseconds > 86400000) : //A day
                num = Math.floor(milliseconds/86400000).toString()+" day";
                if (num !== "1 day"){
                    return num+"s";
                }else{
                    return num;
                }
                break;
            case (milliseconds > 3600000) : //An hour
                num = Math.floor(milliseconds/3600000).toString()+" hour";
                return num !== "1 hour" ? num + "s" : num;
            case (milliseconds > 60000) : //A minute
                num = Math.floor(milliseconds/60000).toString()+" minute";
                if (num !== "1 minute"){
                    return num+"s";
                }else{
                    return num;
                }
                break;
            case (milliseconds > 0) : //A second is 1000, but need to return something for less than one too
                num = Math.floor(milliseconds/1000).toString()+" second";
                if (num !== "1 second"){
                    return num+"s";
                }else{
                    return num;
                }
        }
    };

    /*
         *  Export
         */
    window.WKSS_export = function () {
        $("#export").show();
        //hide other windows
        $("#add").hide();
        $("#import").hide();
        $("#edit").hide();
        $("#selfstudy").hide();
    };

    /*
         *  Import
         */
    window.WKSS_import = function () {
        $("#import").show();
        //hide other windows
        $("#add").hide();
        $("#export").hide();
        $("#edit").hide();
        $("#selfstudy").hide();
    };

    var fileUpload = function(ev){
        var csvHeader = true;        //first row contains stuff like "Kanji/Vocab, Reading, Meaning" etc
        var tsvfile;          //tabs separate fields, commas seperate values? or false for vice versa
        var CSVs = ev.target.files;
        var name =CSVs[0].name;
        var colsplit, vsplit;
        if (name.substr(name.lastIndexOf("."),4)===".csv"){
            tsvfile = false;
            colsplit = ",";
            vsplit = "\t";
        }else{
            tsvfile = true;
            colsplit = "\t";
            vsplit = ",";
        }

        log("tsvfile: ");
        log("file uploaded: "+CSVs[0].name);
        var reader = new FileReader();
        reader.readAsText(CSVs[0]);
        reader.onload = function(ev){
            var csvString = ev.target.result;
            var csvRow = csvString.split("\n");
            //default column rows
            var k = 0;
            var r = 1;
            var m = 2;

            var i = csvRow.length;
            //process header, changing k,r,m if necessary
            var JSONimport = [];
            while(i--){
                var row = csvRow[i];
                if ((csvHeader === true && i === 0)||  //  Skip header
                    (row === "") // Skip empty rows
                   ){
                    log("Skipping row #"+i);

                }else{
                    log(row);


                    var elem = row.split(colsplit);
                    var item = {};
                    var c;

                    if (elem[k]){
                        item.kanji = elem[k].trim();

                        if (elem[r]){

                            if (elem[r].indexOf(vsplit)>-1){
                                // eg 'reading 1[tab]reading 2[tab]reading 3'

                                item.reading = elem[r].split(vsplit);
                            }else{ //no tabs in string, single value
                                item.reading=[elem[r]];
                            }

                        }else{
                            item.reading=[""];
                        }

                        if (elem[m]){

                            if (elem[m].indexOf(vsplit)>-1){
                                // eg 'meaning 1[tab]meaning 2[tab]meaning 3'

                                item.meaning = elem[m].split("\t");
                            }else{ //no tabs in string, single value
                                item.meaning=[elem[m]];
                            }

                            c = item.meaning.length;

                            while(c--){
                                log("item.meaning["+c+"]: "+item.meaning[c]);
                            }
                        }else{//todo: provide overwrite option on forced meaning
                            item.meaning=[""];
                        }

                        JSONimport.push(item);
                    }else{ // corrupt row ('kanji' is mandatory (can be kana-only word), is not present on row, skip
                    }
                }
            }
            var JSONstring = JSON.stringify(JSONimport);
            log(JSONimport);

            if (JSONstring.length !== 0) {
                try {
                    var add = JSON.parse(JSONstring.toLowerCase());
                    /*//---------/-------------
                         if (!checkAdd(add)) {
                         $("#importStatus").text("No valid input (duplicates?)!");
                         return;
                         }
                         //----------------------*/

                    var a = add.length;
                    while(a--){
                        setVocItem(add[a]);
                    }

                    $("#importStatus").text("Import successful!");

                    $("#importForm")[0].reset();
                    $("#importArea").text("");

                }
                catch (e) {
                    $("#importStatus").text("Parsing Error!");
                    log(e);
                }

            }
            else {
                $("#importStatus").text("Nothing to import :( Please paste your stuff first");
            }

        };
    };

    /*
         *  Review Items
         */
    window.WKSS_review = function () {

        //is there a session waiting in storage?
        if(sessionStorage.getItem('User-Review')) {

            //show the selfstudy window
            $("#selfstudy").show();

            //hide other windows
            $("#add").hide();
            $("#export").hide();
            $("#edit").hide();
            $("#import").hide();

            startReview();
        }
    };

    //---------
    var binarySearch = function(values, target, start, end) {
        //log("binarySearch(values: ,target: , start: "+start+", end: "+end+")");

        if (start > end) {
            //start has higher value than target, end has lower value
            //item belongs between
            // need to return 'start' with a flag that it hasn't been found
            //invert sign :)
            return -(start);


            //for testing truths
            //    return String(end)+" < "+item.index+" < "+String(start);

        } //does not exist


        var middle = Math.floor((start + end) / 2);
        var value = values[middle];
        /*log("start.index: "+values[start].index);
             log("middle.index: "+values[middle].index);
             log("end.index: "+values[end].index);
             */
        if (Number(value.index) > Number(target.index)) { return binarySearch(values, target, start, middle-1); }
        if (Number(value.index) < Number(target.index)) { return binarySearch(values, target, middle+1, end); }
        return middle; //found!
    };

    var findIndex = function(values, target) {
        return binarySearch(values, target, 0, values.length - 1);
    };

    // save to list based on .index property
    var saveToSortedList = function(eList,eItem){
        var get = findIndex(eList,eItem);
        if (Math.sign(1/get) === -1){
            eList.splice(-get,0,eItem);
            return eList;
        }
    };

    var openInNewTab = function(url) {
        var win=window.open(url, '_blank');
        win.focus();
    };

    var playAudio = function() {

        var kanji = document.getElementById('rev-kanji').innerHTML;
        var kana = (document.getElementById('rev-solution').innerHTML.split(/[,、]+\s*/))[0];

        document.getElementById('rev-audio').innerHTML = "";
        document.getElementById('audio-form').action = "";
        //document.getElementById('AudioButton').disabled = true;

        if( !kanji.match(/[a-zA-Z]+/i) && !kana.match(/[a-zA-Z]+/i)) {

            kanji = encodeURIComponent(kanji);
            kana = encodeURIComponent(kana);
            var i;

            var newkanji = "";
            for(i = 1; i < kanji.length; i = i+3) {
                newkanji = newkanji.concat(kanji[i-1]);
                newkanji = newkanji.concat('2');
                newkanji = newkanji.concat('5');
                newkanji = newkanji.concat(kanji[i]);
                newkanji = newkanji.concat(kanji[i+1]);
            }

            var newkana = "";
            for(i = 1; i < kana.length; i = i+3) {
                newkana = newkana.concat(kana[i-1]);
                newkana = newkana.concat('2');
                newkana = newkana.concat('5');
                newkana = newkana.concat(kana[i]);
                newkana = newkana.concat(kana[i+1]);
            }

            var url = "http://www.csse.monash.edu.au/~jwb/audiock.swf?u=kana=" + newkana + "%26kanji=" + newkanji;

            log("Audio URL: " + url);

            document.getElementById('AudioButton').disabled = false;

            document.getElementById('rev-audio').innerHTML = url;

        }

    };

    var Rev_Item = function(prompt, kanji, type, solution, index){
        this.prompt = prompt;
        this.kanji = kanji;
        this.type = type;
        this.solution = solution;
        this.index = index;
    };

    var generateReviewList = function() {
        //don't interfere with an active session
        if (reviewActive){
            document.getElementById('user-review').innerHTML = "Review in Progress";
            return;
        }

        log("generateReviewList()");
        // function generateReviewList() builds a review session and updates the html menu to show number waiting.
        var numReviews = 0;
        var soonest;
        var next;

        var reviewList = [];

        //check to see if there is vocab already in offline storage
        if (localGet('User-Vocab')) {
            var vocabList = getFullList();
            log(vocabList);
            var now = Date.now();

            //for each vocab in storage, get the amount of time vocab has lived
            var i = vocabList.length;
            while(i--){
                var due = vocabList[i].date + srsObject.intervals[vocabList[i].level];


                // if tem is unlocked and unburned
                if (vocabList[i].level < 9 &&
                    (vocabList[i].manualLock === "no" || vocabList[i].manualLock === "n" ||
                     vocabList[i].manualLock ==="DB" && !o.lockDB )){
                    // if it is past review time
                    if(now >= due) {
                        // count vocab up for review
                        numReviews++;

                        // add item-meaning object to reviewList
                        // have made this optional for surname lists etc.
                        if (vocabList[i].meaning[0] !== "") {
                            //Rev_Item object args: prompt, kanji, type, solution, index
                            var revItem = new Rev_Item(vocabList[i].kanji, vocabList[i].kanji, "Meaning", vocabList[i].meaning, i);
                            reviewList.push(revItem);
                        }

                        // reading is optional, if there is a reading for the vocab, add its object.
                        if (vocabList[i].reading[0] !== "") {
                            //Rev_Item object args: prompt, kanji, type, solution, index
                            var revItem2 = new Rev_Item(vocabList[i].kanji, vocabList[i].kanji, "Reading", vocabList[i].reading, i);
                            reviewList.push(revItem2);
                        }

                        //if there is a meaning and reading, and reverse flag is true, test reading from english
                        if (vocabList[i].reading[0] !== "" && vocabList[i].meaning[0] !== "" && o.reverse){
                            //Rev_Item object args: prompt, kanji, type, solution, index
                            var revItem3 = new Rev_Item(vocabList[i].meaning.join(", "), vocabList[i].kanji, "Reverse", vocabList[i].reading, i);
                            reviewList.push(revItem3);
                        }

                    }else{//unlocked/unburned but not time to review yet
                        log("setting soonest");
                        next = due - now;
                        if(soonest){
                            soonest = Math.min(soonest, next);
                        }else{
                            soonest = next;
                        }

                    }
                }//end if item is up for review
            }// end iterate through vocablist
        }// end if localStorage

        if (reviewList.length !== 0){

            //store reviewList in current session
            sessionSet('User-Review', JSON.stringify(reviewList));
            log(reviewList);

        }else{
            log("reviewList is empty: "+JSON.stringify(reviewList));
            if (typeof soonest !== "undefined"){
                document.getElementById('user-review').innerHTML = "Next Review in "+ms2str(soonest);
            }else{
                document.getElementById('user-review').innerHTML = "No Reviews Available";
            }
        }

        var strReviews = numReviews.toString();

        /* If you want to do the 42+ thing.
             if (numReviews > 42) {
             strReviews = "42+"; //hail the crabigator!
             }
             //*/

        // return the number of reviews
        log(numReviews.toString() +" reviews created");
        if (numReviews > 0){
            var reviewString = (soonest !== undefined)? "<br/>\
More to come in "+ms2str(soonest):"";
            document.getElementById('user-review').innerHTML = "Review (" + strReviews + ")" + reviewString;
        }
    };

    //global to keep track of when a review is in session.
    var reviewActive = false;

    var startReview = function() {
        log("startReview()");
        submit = true;
        reviewActive = true;
        //get the review 'list' from session storage, line up the first item in queue
        var reviewList = sessionGet('User-Review')||[];
        nextReview(reviewList);
    };

    var nextReview = function(reviewList) {
        //sets up the next item for review
        //uses functions:
        //    wanakana.bind/unbind

        var rnd = Math.floor(Math.random()*reviewList.length);
        var item = reviewList[rnd];
        sessionSet('WKSS-item', JSON.stringify(item));
        sessionSet('WKSS-rnd', rnd);
        if (sessionStorage.getItem('User-Stats')){
            $("#RevNum").html(sessionGet('User-Stats').length);
        }
        document.getElementById('rev-kanji').innerHTML = item.prompt;
        document.getElementById('rev-type').innerHTML = item.type;
        var typeBgColor = 'grey';
        if (item.type.toLowerCase() == 'meaning'){
            typeBgColor = 'blue';
        } else if (item.type.toLowerCase() == 'reading'){
            typeBgColor = 'orange';
        } else if (item.type.toLowerCase() == 'reverse'){
            typeBgColor = 'orange';
        }
        document.getElementById('wkss-type').style.backgroundColor = typeBgColor;
        $("#rev-solution").removeClass("info");
        document.getElementById('rev-solution').innerHTML = item.solution;
        document.getElementById('rev-index').innerHTML = item.index;

        //initialise the input field
        $("#rev-input").focus();
        $("#rev-input").removeClass("caution");
        $("#rev-input").removeClass("error");
        $("#rev-input").removeClass("correct");
        $("#rev-input").val("");

        //check for alphabet letters and decide to bind or unbind wanakana
        if (item.solution[0].match(/[a-zA-Z]+/i)) {
            wanakana.unbind(document.getElementById('rev-input'));
            $('#rev-input').attr('placeholder','Your response');
            $('#rev-input').attr('lang','en');

        }
        else {
            wanakana.bind(document.getElementById('rev-input'));
            $('#rev-input').attr('placeholder','答え');
            $('#rev-input').attr('lang','ja');

        }

        playAudio();
    };

    var markAnswer = function(item) {
        //evaluate 'item' against the question.
        // match by index
        // get type of question
        // determine if right or wrong and return result appropriately

        //get the question
        //var prompt = document.getElementById('rev-kanji').innerHTML.trim();
        //get the answer
        var answer = $("#rev-input").val().toLowerCase();
        //get the index
        var index = document.getElementById('rev-index').innerHTML.trim();
        //get the question type
        var type  = document.getElementById('rev-type').innerHTML.trim();

        //var vocab = localGet("User-Vocab");

        //get the item if it is in the current session
        var storedItem = sessionGet(item.index);
        if (storedItem){

            item.numCorrect = storedItem.numCorrect;
            item.numWrong = storedItem.numWrong;
        }

        if (index == item.index){//-------------
            if (inputCorrect()){
                log(answer+"/"+item.solution[0]);
                if (!item.numCorrect){
                    log("initialising numCorrect");
                    item.numCorrect={};
                }

                log("Correct: "+ type);
                if (type == "Meaning"){
                    if (!item.numCorrect.Meaning)
                        item.numCorrect.Meaning = 0;

                    item.numCorrect.Meaning++;

                }
                if (type == "Reading"){
                    if (!item.numCorrect.Reading)
                        item.numCorrect.Reading = 0;

                    item.numCorrect.Reading++;
                }

                if (type == "Reverse"){
                    if (!item.numCorrect.Reverse)
                        item.numCorrect.Reverse = 0;

                    item.numCorrect.Reverse++;
                }

            }else{
                log(answer+"!="+item.solution);
                if (!item.numWrong){
                    log("initialising numCorrect");
                    item.numWrong={};
                }

                log("Wrong: "+ type);
                if (type == "Meaning"){
                    if (!item.numWrong.Meaning)
                        item.numWrong.Meaning = 0;

                    item.numWrong.Meaning++;

                }
                if (type == "Reading"){
                    if (!item.numWrong.Reading)
                        item.numWrong.Reading = 0;

                    item.numWrong.Reading++;

                }
                if (type == "Reverse"){
                    if (!item.numWrong.Reverse)
                        item.numWrong.Reverse = 0;

                    item.numWrong.Reverse++;
                }
            }

        } else {
            console.error("Error: indexes don't match");
        }

        return item;

    };

    var showResults = function() {

        var statsList = sessionGet('User-Stats')||[];
        sessionStorage.clear();

        console.log("statslist", statsList);
        var i =  statsList.length;
        var voclist = getVocList();
        while(i--){

            //slist[statsList[i].index].level;
            log("b");
            log("statslist[i]",statsList[i]);
            var altText = voclist[statsList[i].index].level;//+statsList[i].type;
            log("a");

            if (!statsList[i].numWrong) {
                if (statsList[i].numCorrect){
                    if (statsList[i].numCorrect.Meaning)
                        altText = altText + " Meaning Correct x"+statsList[i].numCorrect.Meaning +"\n";
                    if (statsList[i].numCorrect.Reading)
                        altText = altText + " Reading Correct x"+statsList[i].numCorrect.Reading +"\n";
                    if (statsList[i].numCorrect.Reverse)
                        altText = altText + " Reverse Correct x"+statsList[i].numCorrect.Reverse +"\n";
                }

                document.getElementById("stats-a").innerHTML +=
                    "<span class=\"rev-correct\"  title='"+altText+" +'>" + statsList[i].kanji + "</span>";
            } else {
                if (statsList[i].numWrong.Meaning)
                    altText = altText + " Meaning Wrong x"+statsList[i].numWrong.Meaning +"\n";
                if (statsList[i].numWrong.Reading)
                    altText = altText + " Reading Wrong x"+statsList[i].numWrong.Reading +"\n";
                if (statsList[i].numWrong.Reverse)
                    altText = altText + " Reverse Wrong x"+statsList[i].numWrong.Reverse +"\n";
                if (statsList[i].numCorrect){
                    if (statsList[i].numCorrect.Meaning)
                        altText = altText + " Meaning Correct x"+statsList[i].numCorrect.Meaning +"\n";
                    if (statsList[i].numCorrect.Reading)
                        altText = altText + " Reading Correct x"+statsList[i].numCorrect.Reading +"\n";
                    if (statsList[i].numCorrect.Reverse)
                        altText = altText + " Reverse Correct x"+statsList[i].numCorrect.Reverse +"\n";
                }


                //TODO sort into apprentice, guru, etc
                document.getElementById("stats-a").innerHTML +=
                    "<span class=\"rev-error\"  title='"+altText+"'>" + statsList[i].kanji + "</span>";
            }
            console.log(statsList[i]);
            statsList[i] = updateSRS(statsList[i], voclist);

        }
        sessionSet("User-Stats",statsList);
        localSet("User-Vocab", voclist);

    };

    //declare global values for keyup event
    //is an answer being submitted?
    var submit = true;

    var updateSRS = function(stats, voclist) {
        var now = Date.now();
        if (voclist[stats.index].due < now){ //double check that the item was really up for review.
            if(!stats.numWrong && voclist[stats.index].level < 9) {//all correct (none wrong)
                voclist[stats.index].level++;
            }
            else {
                stats.numWrong = {};
                //Adapted from WaniKani's srs to authentically mimic level downs
                var o = (stats.numWrong.Meaning||0)+(stats.numWrong.Reading||0)+(stats.numWrong.Reverse||0);
                var t = voclist[stats.index].level;
                var r=t>=5?2*Math.round(o/2):1*Math.round(o/2);
                var n=t-r<1?1:t-r;

                voclist[stats.index].level = n;//don't stay on 'started'

            }


            voclist[stats.index].date = now;
            voclist[stats.index].due = now + srsObject.intervals[voclist[stats.index].level];
            console.log("Next review in "+ms2str(srsObject.intervals[voclist[stats.index].level]));

            return voclist;
        }
    };

    var localSet = function(strName, obj){
        log(strName + " is of type " + typeof obj);
        if (typeof obj === "object")
            obj=JSON.stringify(obj);
        //localStorage.setItem(strName, obj);
        return $.jStorage.set(strName, obj);
    };
    


var sessionSet = function(strName, obj){
    log(strName + " is of type " + typeof obj);
    if (typeof obj === "object")
        obj=JSON.stringify(obj);
    sessionStorage.setItem(strName, obj);
};

var sessionGet = function(strName){
    var strObj = sessionStorage.getItem(strName);
    return parseString(strObj);
};

var parseString = function(strObj){
    //avoids duplication of code for sesssionGet and localGet
    var obj;
    try {
        obj = JSON.parse(strObj);
        log("Variable is of type " + typeof obj);
    }catch(e){
        if (e.name === "SyntaxError"){
            log(strObj + " is an ordinary string that cannot be parsed.");
            obj = strObj;
        }else{
            console.error("Could not parse " + strObj + ". Error: ", e);
        }
    }
    return obj;

};

var unbracketSolution = function(solution){
    //takes an arry of strings and returns the portions before left brackets
    var unbracketed = [];
    i = solution.length;
    while(i--){
        var openBracket = solution[i].indexOf("(");
        if (openBracket !== -1){ //string contains a bracket
            unbracketed.push(solution[i].toLowerCase().substr(0, openBracket));
        }
    }
    return unbracketed;
};

var inputCorrect = function() {

    var input = $("#rev-input").val().toLowerCase().trim();
    var solution = document.getElementById('rev-solution').innerHTML.split(/[,、]+\s*/);
    var correctCharCount = 0;
    var returnvalue = false;

    log("Input: " + input);

    var append = unbracketSolution(solution);
    solution = solution.concat(append);
    var i = solution.length;
    while(i--){

        var threshold = 0;//how many characters can be wrong
        if(document.getElementById('rev-type').innerHTML == "Meaning") {
            threshold = Math.floor(solution[i].length / errorAllowance);
        }

        log("Checking " + solution[i] + " with threshold: " + threshold);

        var j;
        var lengthDiff = Math.abs(input.length - solution[i].length);
        if (lengthDiff > threshold){
            returnvalue = returnvalue || false;
            log("false at if branch " + input.length + " < " + JSON.stringify(solution[i]));//.length );//- threshold));
        } else { //difference in response length is within threshold
            j = input.length;
            while (j--) {
                if (input[j] == solution[i][j]) {
                    log (input[j] +" == "+ solution[i][j]);
                    correctCharCount++;
                }
            }
            if (correctCharCount >= solution[i].length - threshold){
                returnvalue = true;
            }
        }

    }

    log("Returning " + returnvalue);
    return returnvalue;
};

/*
         *  Adds the Button
         */



o.CSS = o.Class.extend({
    /**
        * @param {String} classString - used for when outputting as style textNode
        */
    initialize: function(classString, styleObject){
        this._string = classString + " {";
        this._object = {};
        styleObject && this.addStyle(styleObject);
    },
    /**
        * @param {String} jsKey - style key in JavaScript format, eg. 'fontFamily'
        * @returns {String} - corresponding css key, eg.'font-family'
        */
    JStoCSS: function(jsKey){
        var cssKey;
        var cap = /[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/;
        while (jsKey.search(cap) > -1){
            jsKey = jsKey.replace(cap, "-" + jsKey[jsKey.search(cap)].toLowerCase());
        }
        return jsKey;
    },
    addStyle: function(styleObject){
        this._object = o.extend(this._object, styleObject);
        for (var k in styleObject) if (styleObject.hasOwnProperty(k)){
            this._string += this.JStoCSS(k) + ": " + styleObject[k] + "; ";
        }
    },
    getTextNode: function(){
        return document.createTextNode(this._string + "}");
    },
    getObject: function(){
        return this._object;
    }
});

o.wkUtil = {
    addUserVocabButton: function() {
        groupCollapsed("o.wkUtil.addUserVocabButton");
        //Functions (indirect)
        //    WKSS_add()
        //    WKSS_edit()
        //    WKSS_export()
        //    WKSS_import()
        //    WKSS_lock()
        //    WKSS_review()

        var nav = document.getElementsByClassName('nav');
        info("nav", nav);
        log("generating review list because: initialising script and populating reviews");


        if (nav&&nav.length>2) {

            var dropdownMenu = new o.Node("li").addClass("dropdown custom").addNodes(
                new o.Node("a", {text: "Self-Study"}).addClass("dropdown-toggle custom").setAttributes({dataToggle: "dropdown", "href": "#", "onclick": "generateReviewList();"}).addNode(
                    new o.Node("span").setAttribute("lang", "ja").setText("自習")
                ).addNode(
                    new o.Node("i").addClass("icon-chevron-down")
                ),
                new o.Node("ul").addClass("dropdown-menu").setId("WKSS_dropdown").addNodes(
                    new o.Node("li").addClass("nav-header").setText("Settings"),
                    new o.Node("li").addNode(new o.Node("a").setId("click").addjQueryHandlers({click: $.proxy(settingsWindow.show, settingsWindow)}).setAttributes({"href": "#"}).setText("User Settings")),
                    //new o.Node("li").addNode(new o.Node("a").addjQueryHandlers({click: $.proxy(settingsWindow.show, settingsWindow)}).setAttributes({"href": "#"}).setText("Change")),
                    new o.Node("li").addClass("nav-header").setText("Customize"),
                    new o.Node("li").addNode(new o.Node("a").setId("click").addjQueryHandlers({click: $.proxy(addWindow.show, addWindow)}).setAttributes({"href": "#"}).setText("Add")),
                    new o.Node("li").addNode(new o.Node("a").setAttributes({"href": "#", "onclick": "WKSS_edit();"}).setText("Edit")),
                    new o.Node("li").addNode(new o.Node("a").setAttributes({"href": "#", "onclick": "WKSS_export();"}).setText("Export")),
                    new o.Node("li").addNode(new o.Node("a").setAttributes({"href": "#", "onclick": "WKSS_import();"}).setText("Import")),
                    new o.Node("li").addClass("nav-header").setText("Learn"),
                    new o.Node("li").addNode(new o.Node("a").setId("user-review").setAttributes({"href": "#", "onclick": "WKSS_review();"}).setText("Please Wait..."))
                )
            ).addTo(nav[2]);
            info("_container", addWindow._elem._container,addWindow._elem, addWindow._elem._container.firstChild);

        }else{
            //    console.error("could not find nav", nav);
        }
        groupEnd();
    }
};

/**
    * Adds a <style> tag with properties for the extension, should get smaller as styles get baked into class definitions
    */
var appendStyle = function(){
    log("is it here?");
    new o.Node("style").addNodes(
        new o.CSS(".custom .dropdown-menu", {backgroundColor: '#DBA901 !important'}).getTextNode(),
        new o.CSS(".custom .dropdown-menu:after, .custom .dropdown-menu:before", {borderBottomColor: '#DBA901 !important'}).getTextNode(),
        new o.CSS(".open .dropdown-toggle.custom", {backgroundColor: '#FFC400 !important'}).getTextNode(),
        new o.CSS(".custom .dropdown-menu a:hover", {backgroundColor: '#A67F00 !important'}).getTextNode(),
        new o.CSS(".custom:hover, .custom:focus", {color: '#FFC400 !important'}).getTextNode(),
        new o.CSS(".custom:hover span, .custom:focus span", {borderColor: '#FFC400 !important'}).getTextNode(),
        new o.CSS(".open .custom span", {borderColor: '#FFFFFF !important'}).getTextNode(),
        new o.CSS(".open .custom", {color: '#FFFFFF !important'}).getTextNode(),
        new o.CSS(".WKSS", {
            position:'fixed',
            zIndex: 2,
            top: '125px',
            left: '50%',
            margin:'0px',
            background: '#FFF',
            padding: '5px',
            font: '12px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif',
            color: '#888',
            textShadow: '1px 1px 1px #FFF',
            border: '1px solid #DDD',
            borderRadius: '5px',
            WebkitBorderRadius: '5px',
            MozBorderRadius: '5px',
            boxShadow: '10px 10px 5px #888888'
        }).getTextNode(),
        new o.CSS(".WKSS h1", {
            font: '25px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif',
            paddingLeft: '5px',
            display: 'block',
            borderBottom: '1px solid #DADADA',
            margin: '0px',
            color: '#888'
        }).getTextNode(),
        new o.CSS(".WKSS h1>span", {
            display: 'block',
            fontSize: '11px'
        }).getTextNode(),
        new o.CSS(".WKSS label", {
            display: 'block',
            margin: '0px 0px 5px'
        }).getTextNode(),
        new o.CSS(".WKSS label>span", {
            float: 'left',
            width: '80px',
            textAlign: 'right',
            paddingRight: '10px',
            marginTop: '10px',
            color: '#333',
            fontFamily: '\"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif',
            fontWeight: 'bold'
        }).getTextNode(),
        new o.CSS(".WKSS input[type=\"text\"], .WKSS input[type=\"email\"], .WKSS textarea", {
            border: '1px solid #CCC',
            color: '#888',
            height: '20px',
            marginBottom: '16px',
            marginRight: '6px',
            marginTop: '2px',
            outline: '0 none',
            padding: '6px 12px',
            width: '80%',
            lineHeight: 'normal !important',
            borderRadius: '4px',
            WebkitBorderRadius: '4px',
            MozBorderRadius: '4px',
            font: 'normal 14px/14px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif',
            WebkitBoxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
            boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
            MozBoxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)'
        }).getTextNode(),
        new o.CSS(".WKSS select", {
            border: '1px solid #CCC',
            color: '#888',
            outline: '0 none',
            padding: '6px 12px',
            height: '160px !important',
            width: '95%',
            borderRadius: '4px',
            WebkitBorderRadius: '4px',
            MozBorderRadius: '4px',
            font: 'normal 14px/14px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif',
            WebkitBoxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
            boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
            MozBoxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.075)',
            background: '#FFF url(\'down-arrow.png\') no-repeat right',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            textIndent: '0.01px',
            textOverflow: '\'\''
        }).getTextNode(),
        new o.CSS(".WKSS textarea", {height:'100px'}).getTextNode(),
        new o.CSS(".WKSS button, .button", {
            position: 'relative',
            background: '#FFF',
            border: '1px solid #CCC',
            padding: '10px 25px 10px 25px',
            color: '#333',
            borderRadius: '4px',
            display: 'inline !important'
        }).getTextNode(),
        new o.CSS(".WKSS button:disabled", {
            backgroundColor: '#EBEBEB',
            border: '1px solid #CCC',
            padding: '10px 25px 10px 25px',
            color: '#333',
            borderRadius: '4px'
        }).getTextNode(),
        new o.CSS(".WKSS .button:hover, button:hover:enabled", {
            color: '#333',
            backgroundColor: '#EBEBEB',
            borderColor: '#ADADAD'
        }).getTextNode(),
        new o.CSS(".WKSS button:hover:disabled", {cursor: 'default'}).getTextNode(),
        new o.CSS(".error", {borderColor: '#F00 !important', color: '#F00 !important'}).getTextNode(),
        new o.CSS(".caution", {borderColor: '#F90 !important', color: '#F90 !important'}).getTextNode(),
        new o.CSS(".correct", {borderColor: '#0F0 !important', color: '#0F0 !important'}).getTextNode(),
        new o.CSS(".info", {borderColor:'#696969 !important', color: '#696969 !important'}).getTextNode(),
        new o.CSS(".rev-error", {
            textShadow: 'none',
            border: '1px solid #F00 !important',
            borderRadius: '10px',
            backgroundColor: '#F00',
            padding: '4px',
            margin: '4px',
            color: '#FFFFFF',
            font: 'normal 18px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif'
        }).getTextNode(),
        new o.CSS(".rev-correct", {
            textShadow: 'none',
            border: '1px solid #088A08 !important',
            borderRadius: '10px',
            backgroundColor: '#088A08',
            padding: '4px',
            margin: '4px',
            color: '#FFFFFF',
            font: 'normal 18px \"ヒラギノ角ゴ Pro W3\", \"Hiragino Kaku Gothic Pro\",Osaka, \"メイリオ\", Meiryo, \"ＭＳ Ｐゴシック\", \"MS PGothic\", sans-serif'
        }).getTextNode(),
        new o.CSS("#add", {
            //      width: addWindowWidth + 'px',
            //      height: addWindowHeight + 'px',
            //      marginLeft: -addWindowWidth/2 + 'px'
        }).getTextNode(),
        new o.CSS("#export, #import", {
            background: '#fff',
            width: exportImportWindowWidth + 'px',
            height: exportImportWindowHeight + 'px',
            marginLeft: -exportImportWindowWidth/2 + 'px'
        }).getTextNode(),
        new o.CSS("#edit", {
            width: editWindowWidth + 'px',
            height: editWindowHeight + 'px',
            marginLeft: -editWindowWidth/2 + 'px'
        }).getTextNode(),
        new o.CSS("#selfstudy", {
            left: '50%',
            width: studyWindowWidth + 'px',
            height: 'auto',
            marginLeft: -studyWindowWidth/2 + 'px'
        }).getTextNode(),
        new o.CSS("#resultwindow", {
            left:'50%',
            width: resultWindowWidth + 'px',
            height: resultWindowHeight + 'px',
            marginLeft: -resultWindowWidth/2 + 'px'
        }).getTextNode(),
        new o.CSS("#AudioButton", {
            marginTop: '35px',
            position: 'relative',
            display: 'inline !important',
            WebkitMarginBefore: '50px'
        }).getTextNode(),
        new o.CSS("button.wkss-close", {
            float: 'right',
            backgroundColor: '#ff4040',
            color: '#fff',
            padding: '0px',
            height: '27px',
            width: '27px'
        }).getTextNode(),
        new o.CSS(".wkss-close", {
            float: 'right',
            backgroundColor: '#ff4040',
            color: '#fff',
            padding: '0px',
            height: '27px',
            width: '27px'
        }).getTextNode(),
        new o.CSS("#wkss-kanji, #rev-kanji", {
            textAlign: 'center !important',
            fontSize: '50px !important',
            backgroundColor: '#9400D3 !important',
            color: '#FFFFFF !important',
            borderRadius: '10px 10px 0px 0px'
        }).getTextNode(),
        new o.CSS("#wkss-solution, #rev-solution", {
            textAlign: 'center !important',
            fontSize: '30px !important',
            color: '#FFFFFF',
            padding: '2px'
        }).getTextNode(),
        new o.CSS("#wkss-type", {
            textAlign: 'center !important',
            fontSize: '24px !important',
            backgroundColor: '#696969',
            color: '#FFFFFF !important',
            borderRadius: '0px 0px 10px 10px'
        }).getTextNode(),
        new o.CSS("#rev-type", {
            textAlign: 'center !important',
            fontSize: '24px !important',
            color: '#FFFFFF !important',
            borderRadius: '0px 0px 10px 10px'
        }).getTextNode(),
        new o.CSS("#wkss-input", {
            textAlign: 'center !important',
            fontSize: '40px !important',
            height: '80px !important',
            lineHeight: 'normal !important'
        }).getTextNode(),
        new o.CSS("#rev-input", {
            textAlign: 'center !important',
            fontSize: '40px !important',
            height: '60px !important',
            lineHeight: 'normal !important'
        }).getTextNode()
    ).addTo(document.head);
};

/*
         *  Prepares the script
         */
var scriptInit = function() {
    groupCollapsed("scriptInit");

    appendStyle();

    // Set up buttons
    try {
        if (typeof localStorage !== "undefined") {
            o.wkUtil.addUserVocabButton();
        }
        else{
            error("No localStorage");
        }
    }
    catch (err) {
        error(err);
    }
    groupEnd();
};

/*
         * Helper Functions/Variables
         */


var isEmpty = function(value) {
    return (typeof value === "undefined" || value === null);
};

var select_all = function(str) {
    var text_val = document.getElementById(str);
    log(text_val);
    text_val.focus();
    text_val.select();
};

var checkAdd = function(add) {
    //take a JSON object (parsed from import window) and check with stored items for any duplicates
    // Returns true if each item in 'add' array is valid and
    //at least one of them already exists in storage
    var i = add.length;
    if(localGet('User-Vocab')) {
        var vocabList = getVocList();
        while(i--){
            if (isItemValid(add[i]) &&
                checkForDuplicates(vocabList,add[i]))
                return true;
        }
    }
    return false;
};


var isItemValid = function(add) {
    //validates an object representing vocab
    return (!isEmpty(add.kanji) && //kanji property exists
            !isEmpty(add.meaning) && //meaning property exists
            !isEmpty(add.reading)&& //reading property exists
            Object.prototype.toString.call(add.meaning) === '[object Array]'&&//meaning is an array
            Object.prototype.toString.call(add.reading) === '[object Array]');//reading is an array
};



//*****Ethan's Functions*****
var handleReadyStateFour = function(xhrk, requestedItem){

    var localkanjiList = [];
    log("readystate: "+ xhrk.readyState);
    var resp = JSON.parse(xhrk.responseText);
    log("about to loop through requested information");
    var i;
    if (resp.requested_information)
        i=resp.requested_information.length||0;
    if (requestedItem === "kanji"){
        while(i--){
            //push response onto kanjilist variable
            if (resp.requested_information[i].user_specific !== null){
                localkanjiList.push({"character": resp.requested_information[i].character,
                                     "srs": resp.requested_information[i].user_specific.srs,
                                     "reading": resp.requested_information[i][resp.requested_information[i].important_reading].split(",")[0],
                                     "meaning": resp.requested_information[i].meaning.split(",")[0]
                                    });
            }else{
                localkanjiList.push({"character": resp.requested_information[i].character,
                                     "srs": "unreached"});
            }
        }
    }else if(requestedItem === "vocabulary"){
        while(i--){
            //push response onto kanjilist variable
            if (resp.requested_information[i].user_specific !== null||true){
                //build vocablist
                localkanjiList.push({"kanji": resp.requested_information[i].character,
                                     "reading": resp.requested_information[i].kana.split(","),
                                     "meaning": resp.requested_information[i].meaning.split(",")});
            }
        }
    }
    //return kanjiList
    //  log("Server responded with new kanjiList: \n"+JSON.stringify(kanjiList));
    return localkanjiList;

};

var dummyResponse = function () {
    var kanjiList = [];
    log("creating dummy response");
    kanjiList.push({"character": "猫", "srs": "noServerResp"});
    var SRS = "apprentice"; //prompt("enter SRS for 子", "guru");
    kanjiList.push({"character": "子", "srs": SRS});
    kanjiList.push({"character": "品", "srs": "guru"});
    kanjiList.push({"character": "供", "srs": "guru"});
    kanjiList.push({"character": "本", "srs": "guru"});
    kanjiList.push({"character": "聞", "srs": "apprentice"});
    kanjiList.push({"character": "人", "srs": "enlightened"});
    kanjiList.push({"character": "楽", "srs": "burned"});
    kanjiList.push({"character": "相", "srs": "guru"});
    kanjiList.push({"character": "卒", "srs": "noMatchWK"});
    kanjiList.push({"character": "無", "srs": "noMatchGuppy"});

    log("Server responded with dummy kanjiList: \n"+JSON.stringify(kanjiList));

    localSet('User-KanjiList', kanjiList);

    //update locks in localStorage
    refreshLocks();


};
info("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

var getServerResp = function(APIkey, requestedItem){
    info(APIkey);
    requestedItem = requestedItem ? requestedItem : 'kanji';

    //functions:
    //    refreshLocks()
    //    generateReviewList()

    if (APIkey !== "test"){
        var levels = (requestedItem ==="kanji")? "/1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50":
        "/1,2,3,4,5,6,7,8,9,10";
        var xhrk = createCORSRequest("get", "https://www.wanikani.com/api/user/" + APIkey + "/" + requestedItem + levels);


        if (!isEmpty(xhrk)){

            xhrk.onreadystatechange = function() {
                if (xhrk.readyState == 4){

                    var kanjiList = handleReadyStateFour(xhrk,requestedItem);

                    if (requestedItem === 'kanji'){
                        localSet('User-KanjiList', kanjiList);
                        log("kanjiList from server", kanjiList);
                        //update locks in localStorage
                        //pass kanjilist into this function
                        //(don't shift things through storage unecessarily)
                        refreshLocks();
                    }else{
                        var v = kanjiList.length;
                        log(v + " items found, attempting to import");
                        while (v--){
                            setVocItem(kanjiList[v]);
                        }
                    }
                    //------
                }
            };

            xhrk.send();
            log("below");
        }
    } else {
        //dummy server response for testing.
        setTimeout(dummyResponse, 10000);
    }
};

var getComponents = function(kanji){
    log("getComponents(kanji)");
    //functions:
    //    none

    //takes in a string and returns an array containing only the kanji characters in the string.
    var components = [];

    for (var c = 0; c < kanji.length; c++){
        if(/^[\u4e00-\u9faf]+$/.test(kanji[c])) {
            components.push(kanji[c]);
        }
    }
    return components;
};

var refreshLocks = function(){
    //functions:
    //    setLocks(srsitem)

    //log("refreshLocks()");
    if (localGet('User-Vocab')) {

        var vocList = getSrsList();
        var i = vocList.length;
        var srsList2 = JSON.parse(localGet('User-Vocab'));
        console.groupCollapsed("Setting Locks");
        while(i--){
            log("vocList[i] = setLocks(vocList[i]);");
            vocList[i] = setLocks(vocList[i]);
            log("setSrsItem(srsList[i]);");
            //Pull out list (whole thing)

            srsList2 = setSrsItem(vocList[i],srsList2);

        }
        console.groupEnd();
        localSet('User-Vocab', srsList2);
        //      log("Setting new locks: "+JSON.stringify(srsList));
    }else{
        log("no srs storage found");
    }
};

var getCompKanji = function(item, kanjiList){
    if (!kanjiList){
        kanjiList = [];
    }
    log("getCompKanji(item, kanjiList)");

    var compSRS = [];
    var kanjiReady = false; //indicates if the kanjiList has been populated
    var userGuppy = false; //indicates if kanjiList has less than 100 items
    var kanjiObj = {};

    //has the server responded yet
    if (kanjiList.length > 0){
        log("kanjiList is > 0");
        kanjiReady = true;

        //create lookup object
        for (var k=0;k<kanjiList.length;k++){
            kanjiObj[kanjiList[k].character] = kanjiList[k];
        }

        //is there less than 100 kanji in the response
        if (kanjiList.length < 100){
            log("kanjiList is < 100");
            userGuppy = true;
        }
    }

    var components = item.components;
    //for each kanji character component
    //    this is the outer loop since there will be far less of them than kanjiList
    for(var i = 0; i < components.length; i++){

        var matched = false;
        //for each kanji returned by the server
        // for(var j=0; j<kanjiList.length; j++){

        //if the kanji returned by the server matches the character in the item
        if (typeof kanjiObj[components[i]] !== 'undefined'){
            //      if (kanjiList[j].character == components[i]){
            compSRS[i] = {"kanji": components[i], "srs": kanjiObj[components[i]].srs};
            matched = true;

            // break; //kanji found: 'i' is its position in item components; 'j' is its postion in the 'kanjiList' server response
        }
        //}

        if (matched === false){ // character got all the way through kanjiList without a match.
            if (kanjiReady){ //was there a server response?
                if (userGuppy){ //is the user a guppy (kanji probably matches a turtles response)
                    log("matched=false, kanjiList.length: "+kanjiList.length);
                    compSRS[i] = {"kanji": components[i], "srs": "noMatchGuppy"};
                }else{ //user is a turtle, kanji must not have been added to WK (yet)
                    log("matched=false, kanjiList.length: "+kanjiList.length);
                    compSRS[i] = {"kanji": components[i], "srs": "noMatchWK"};
                }
            }else{
                log("matched=false, kanjiReady=false, noServerResp");
                compSRS[i] = {"kanji": components[i], "srs": "noServerResp"};
            }
        }
    }
    return compSRS; // compSRS is an array of the kanji with SRS values for each kanji component.
    // eg. 折り紙:
    // compSRS = [{"kanji": "折", "srs": "guru"}, {"kanji": "紙", "srs": "apprentice"}]
};

var createCORSRequest = function(method, url){
    var xhr = new XMLHttpRequest();
    if ("withCredentials" in xhr){
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined"){
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        xhr = null;
    }
    return xhr;
};

var createCSV = function(JSONstring){
    var JSONobject = (typeof JSONstring === 'string') ? JSON.parse(JSONstring) : JSONstring;
    var key;
    var CSVarray = [];
    var header = [];
    var id = JSONobject.length;
    if (id){//object not empty
        for (key in JSONobject[0]){
            if (JSONobject[0].hasOwnProperty(key)){
                header.push(key);
            }
        }
    }
    CSVarray.push(header.join(','));

    while(id--){
        var line = [];
        var h = header.length;
        while(h--){// only do keys in header, in the header's order. //JSONobject[id]){
            key = header[h];
            if(JSONobject[id][key] !== undefined){
                if (Array.isArray(JSONobject[id][key])){
                    //parse array here
                    line.push(JSONobject[id][key].join("\t"));
                }else{
                    line.push(JSONobject[id][key]);
                }
            }
        }line = line.reverse();
        CSVarray.push(line.join(','));
    }
    var CSVstring = CSVarray.join("\r\n");

    return encodeURI("data:text/csv;charset=utf-8," + CSVstring);
};

var handleResetLevelsClick = function () {
    //var srslist = getSrsList();
    var srsList = JSON.parse(localGet('User-Vocab'))||[];

    if (srsList) {
        var i = srsList.length;
        while(i--){
            srsList[i].level = 0;
            log("srsList[i].i before: "+srsList[i].i);
            srsList[i].i=i;
            log("srsList[i].i after: "+srsList[i].i);
            var srsList2 = localGet('User-Vocab')||[];

            srsList2 = setSrsItem(srsList[i],srsList2);
            localSet('User-Vocab', srsList2);

        }
    }
};

//html strings
var editWindowHtml = "                                                          \
<div id=\"edit\" class=\"WKSS\">                                               \
<form id=\"editForm\">                                                                    \
<button id=\"EditCloseBtn\" class=\"wkss-close\" type=\"button\"><i class=\"icon-remove\"></i></button>\
<h1>Edit your Vocab</h1>                                                \
<select id=\"editWindow\" size=\"8\"></select>\
<input type=\"text\" id=\"editItem\" name=\"\" size=\"40\" placeholder=\"Select vocab, click edit, change and save!\">\
\
<p id=\"editStatus\">Ready to edit..</p>\
<button id=\"EditEditBtn\" type=\"button\">Edit</button>\
<button id=\"EditSaveBtn\" type=\"button\">Save</button>         \
<button id=\"EditDeleteBtn\" type=\"button\" title=\"Delete selected item\">Delete</button>         \
<button id=\"EditDeleteAllBtn\" type=\"button\" title=\"本当にやるの？\">Delete All</button>   \
<button id=\"ResetLevelsBtn\" type=\"button\">Reset levels</button>         \
</form>                                                                   \
</div>";
var exportWindowHtml = '                                                          \
<div id="export" class="WKSS">                                               \
<form id="exportForm">                                                                    \
<button id="ExportCloseBtn" class="wkss-close" type="button"><i class="icon-remove"></i></button>\
<h1>Export Items</h1>                                                \
<textarea cols="50" rows="18" id="exportArea" placeholder="Export your stuff! Sharing is caring ;)"></textarea>                           \
\
<p id="exportStatus">Ready to export..</p>                                        \
<button id="ExportItemsBtn" type="button">Export Items</button>\
<button id="ExportSelectAllBtn" type="button">Select All</button>\
<button id="ExportCsvBtn" type="button">Export CSV</button>\
</form>                                                                   \
</div>';
var importWindowHtml = '                                                          \
<div id="import" class="WKSS">                                               \
<form id="importForm">                                                                    \
<button id="ImportCloseBtn" class="wkss-close" type="reset"><i class="icon-remove"></i></button>\
<h1>Import Items</h1>\
<textarea cols="50" rows="18" id="importArea" placeholder="Paste your stuff and hit the import button! Use with caution!"></textarea>                     \
\
<p id="importStatus">Ready to import..</p>                                        \
<label class="button" id="ImportItemsBtn" style="display:inline;">Import Items</label>\
<label id="ImportCsvBtn" class="button" style="display:inline;cursor: pointer;">Import CSV         \
<input type="file" id="upload" accept=".csv,.tsv" style="height:0px;width:0px;background:red;opacity:0;filter:opacity(1);" />\
</label>\
<label class="button" id="ImportWKBtn" style="display:inline;"><i class="icon-download-alt"></i> WK</label>\
</form>                                                                   \
</div>';
var reviewWindowHtml = '                                                          \
<div id="selfstudy" class="WKSS">\
<button id="SelfstudyCloseBtn" class="wkss-close" type="button"><i class="icon-remove"></i></button>\
<h1>Review<span id="RevNum"></span></h1>\
<div id="wkss-kanji">\
<span id="rev-kanji"></span>\
</div><div id="wkss-type">\
<span id="rev-type"></span><br />\
</div><div id="wkss-solution">\
<span id="rev-solution"></span>\
</div><div id="wkss-input">\
<input type="text" id="rev-input" size="40" placeholder="">\
</div><span id="rev-index" style="display: block;"></span>\
\
<form id="audio-form">\
<label id="AudioButton" class="button">Play audio</label>\
<label id="WrapUpBtn"   class="button">Wrap Up</label>\
</form>\
<div id="rev-audio" style="display:none;"></div>\
</div>';
var resultWindowHtml = '                                                          \
<div id="resultwindow" class="WKSS">                                    \
<button id="ReviewresultsCloseBtn" class="wkss-close" type="button"><i class="icon-remove"></i></button>\
<h1>Review Results</h1>\
<h2>All</h2>\
<div id="stats-a"></div>\
</div>';
var handleEditClick = function () {
    //get handle for 'select' area
    var select = document.getElementById("editWindow");

    //get the index for the currently selected item
    var index = select.selectedIndex; //select.options[select.selectedIndex].value is not required, option values are set to index
    var vocabList = getVocList();
    vocabList = vocabList.reverse();
    document.getElementById("editItem").value = JSON.stringify(vocabList[index]);
    document.getElementById("editItem").name = index; //using name to save the index
    $("#editStatus").text('Loaded item to edit');
};
info("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

var handleEditSave = function () {
    if ($("#editItem").val().length !== 0) {
        //-- be aware
        //deleting one item may cause mismatch if i is property of item in list
        try {
            var index = document.getElementById("editItem").name;
            var item = JSON.parse(document.getElementById("editItem").value.toLowerCase());
            var m = item.meaning.length;
            while(m--){
                if (item.meaning[m] === ""){
                    delete item.meaning[m];
                }
            }
            var fullList = getFullList().reverse();


            if (isItemValid(item) &&//item is valid
                !(checkForDuplicates(fullList,item) && //kanji (if changed) is not already in the list
                  fullList[index].kanji !== item.kanji)) {//unless it is the item being edited


                var srslist = getSrsList().reverse();
                //get srs components of item(list)

                fullList[index] = item;//does not have srs stuff, re-add it now

                log(fullList[index]);
                log(srslist[index]);
                fullList[index].date = srslist[index].date;
                fullList[index].level = srslist[index].level;
                fullList[index].locked = srslist[index].locked;
                fullList[index].manualLock = srslist[index].manualLock;

                fullList = fullList.reverse(); //reset order of array

                localSet('User-Vocab', fullList);

                generateEditOptions();
                $("#editStatus").html('Saved changes!');
                document.getElementById("editItem").value = "";
                document.getElementById("editItem").name = "";

            }else{
                $("#editStatus").text('Invalid item or duplicate!');
                alert(isItemValid(item).toString() +" && ！("+ checkForDuplicates(fullList,item).toString()+" && !("+fullList[index].kanji+" !== "+item.kanji+")");

            }
        }
        catch (e) {
            $("#editStatus").text(e);
        }
    }
};
var handleEditDelete = function () {
    //select options element window
    var select = document.getElementById("editWindow");

    //index of selected item
    var item = select.options[select.selectedIndex].value;

    //fetch JSON strings from storage and convert them into Javascript literals
    var vocabList = getFullList();

    //starting at selected index, remove 1 entry (the selected index).
    if (item > -1) {
        if (vocabList !== null){
            vocabList.splice(item, 1);
        }
    }

    //yuck
    if (vocabList.length !== 0) {
        localSet('User-Vocab', vocabList);
    }
    else {
        localStorage.removeItem('User-Vocab');
    }

    updateEditGUI();

    $("#editStatus").text('Item deleted!');
};
var handleEditDeleteAll = function () {
    var deleteAll = confirm("Are you sure you want to delete all entries?");
    if (deleteAll) {

        //drop local storage
        localStorage.removeItem('User-Vocab');


        updateEditGUI();

        $("#editStatus").text('All items deleted!');
    }
};
var handleEditClose = function () {
    $("#edit").hide();
    $("#editForm")[0].reset();
    $("#editStatus").text('Ready to edit..');
};
var handleExportClick = function () {
    if (localGet('User-Vocab')) {
        $("#exportForm")[0].reset();
        var vocabList = getVocList();
        $("#exportArea").text(JSON.stringify(vocabList));
        $("#exportStatus").text("Copy this text and share it with others!");
    }
    else {
        $("#exportStatus").text("Nothing to export yet :(");
    }
};
var handleExportSelectAll = function () {
    if ($("#exportArea").val().length !== 0) {
        select_all("exportArea");
        $("#exportStatus").text("Don't forget to CTRL + C!");
    }
};
var handleExportCsv = function () {
    var vocabList = getFullList();
    var CsvFile = createCSV(vocabList);
    window.open(CsvFile);
};
var handleImportWK = function(){
    getServerResp(APIkey,"vocabulary");
    log("maybe?");
};
var handleImportClick = function () {
    if ($("#importArea").val().length !== 0) {
        try {
            var add = JSON.parse($("#importArea").val().toLowerCase());
            alert(JSON.stringify(add));
            if (checkAdd(add)) {
                $("#importStatus").text("No valid input (duplicates?)!");
                return;
            }

            var newlist;
            var srslist = [];
            if (localGet('User-Vocab')) {
                var vocabList = getVocList();
                srslist = getSrsList();
                newlist = vocabList.concat(add);
            }
            else {
                newlist = add;


            }
            var i = add.length;
            while(i--){
                setVocItem(add[i]);
            }

            $("#importStatus").text("Import successful!");

            $("#importForm")[0].reset();
            $("#importArea").text("");

        }
        catch (e) {
            $("#importStatus").text("Parsing Error!");
            log(e);
        }

    }
    else {
        $("#importStatus").text("Nothing to import :( Please paste your stuff first");
    }
};
var handleWrapUp = function() {
    var sessionList = sessionGet('User-Review')||[];
    var statsList = sessionGet('User-Stats')||[];
    //if an index in sessionList matches one in statsList, don't delete
    var sessionI = sessionList.length;
    var item = sessionGet('WKSS-item')||[];
    var arr2 = [];
    //for every item in sessionList, look for index in statsList,
    //if not there (-1) delete item from sessionList
    while (sessionI--){
        var index = findIndex(statsList,sessionList[sessionI]);
        if ((Math.sign(1/index) !== -1)||(sessionList[sessionI].index == item.index)){

            arr2.push(sessionList[sessionI]);
        }
    }


    log(arr2);
    sessionSet('User-Review', JSON.stringify(arr2));
};
info("addwindow._elem._coontainer",addWindow._elem._container.firstChild);

var handleAudioClick = function () {
    openInNewTab(document.getElementById('rev-audio').innerHTML);
};
var handleAnswerSubmit = function (e) {
    //functions:
    //  inputCorrect()

    //check if key press was 'enter' (keyCode 13) on the way up
    //and keystate true (answer being submitted)
    //and cursor is focused in reviewfield
    if (e.keyCode == 13 && submit === true) {
        var input = $("#rev-input").val();
        var reviewList = sessionGet('User-Review')||[];
        var rnd = sessionStorage.getItem('WKSS-rnd')||0;

        var item = sessionGet('WKSS-item');

        //-- starting implementation of forgiveness protocol

        item.forgive = [];//"ゆるす"]; //placeholder (許す to forgive)


        if (item === null){
            alert("Item Null??");
            reviewList.splice(rnd, 1);
        }else{
            //handle grading and storing solution

            //check for input, do nothing if none
            if(input.length === 0){
                return;
            }

            //disable input after submission
            //document.getElementById('rev-input').disabled = true;


            //was the input correct?
            var correct = inputCorrect();

            //was the input forgiven?
            var forgiven = (item.forgive.indexOf(input) !== -1);

            if (correct) {
                //highlight in (default) green
                $("#rev-input").addClass("correct");
                //show answer
                $("#rev-solution").addClass("info");
            } else if (forgiven){
                $("#rev-input").addClass("caution");
            } else {
                //highight in red
                $("#rev-input").addClass("error");
                //show answer
                $("#rev-solution").addClass("info");
            }

            //remove from sessionList if correct
            if (correct) {
                log("correct answer");
                if (reviewList !== null){
                    var oldlen = reviewList.length;

                    reviewList.splice(rnd, 1);
                    log("sessionList.length: "+ oldlen +" -> "+reviewList.length);

                    //replace shorter (by one) sessionList to session
                    if (reviewList.length !== 0) {
                        log("sessionList.length: "+ reviewList.length);
                        sessionSet('User-Review', JSON.stringify(reviewList));

                    } else {
                        //reveiw over, delete sessionlist from session
                        sessionStorage.removeItem('User-Review');
                    }
                }else{
                    console.error("Error: no review session found");
                }
            }else{
                //   if(forgiven){
                //     log(input +" has been forgiven. "+item.type);
                //   return;
                //}
                log("wrong answer");
            }

            item = markAnswer(item);

            sessionSet(item.index, item);


            var list = JSON.parse(sessionStorage.getItem("User-Stats"))||[];
            var found = false;

            if (list){
                var i = list.length;
                while(i--){
                    if (list[i].index == item.index) {
                        list[i] = item;                             //replace item if it exists
                        found = true;
                        break;
                    }
                }
                if(!found){
                    list = saveToSortedList(list,item);
                }

            } else {
                list = [item];
            }

            sessionSet("User-Stats", JSON.stringify(list));
            //playAudio();

            //answer submitted, next 'enter' proceeds with script
            submit = false;
        }//null garbage collection
    }
    else if (e.keyCode == 13 && submit === false) {
        log("keystat = " + submit);

        //there are still more reviews in session?
        if (sessionStorage.getItem('User-Review')) {
            // log("found a 'User-Review': " + sessionStorage.getItem('User-Review'));

            setTimeout(function () {
                log("refreshing reviewList from storage");
                var reviewList = JSON.parse(sessionStorage.getItem('User-Review'));

                //cue up first remaining review
                nextReview(reviewList);
                log("checking for empty reviewList");
                if (reviewList.length === 0){

                    log("session over. reviewList: "+JSON.stringify(reviewList));
                    sessionStorage.removeItem("User-Review");
                }

                //         document.getElementById('rev-input').disabled = true;
                $("#rev-solution").removeClass("info");
                $("#selfstudy").hide().fadeIn('fast');

            }, 1);
        }
        else {
            // no review stored in session, review is over
            setTimeout(function () {

                $("#selfstudy").hide();
                //document.getElementById('rev-input').disabled = false;
                $("#rev-solution").removeClass("info");
                log("showResults");
                showResults();
                $("#resultwindow").show();
                log("showResults completed");

                //*/  //clear session
                sessionStorage.clear();
                reviewActive = false;


            }, 1);
        }
        submit = true;

    }
};


var main = function(evt) {
    groupCollapsed("main", arguments);
    console.log($);
    var WK = window.WK || ("undefined" !== typeof $) && $.jStorage.get("WK");
    console.log("WK is ", WK);



    var api = evt.target.api;
    console.log("api ApiKey", api, o.APIkey);
    /*//--
         *  JQuery fixes
         */
    $("[placeholder]").focus(function () {
        var input = $(this);
        if (input.val() == input.attr("placeholder")) {
            input.val("''");
            input.removeClass("'placeholder'");
        }
    }).blur(function () {
        var input = $(this);
        if (input.val() == "''" || input.val() == input.attr("placeholder")) {
            input.addClass("placeholder");
            input.val(input.attr("placeholder"));
        }
    }).blur();

    $("[placeholder]").parents("form").submit(function () {
        $(this).find("[placeholder]").each(function () {
            var input = $(this);
            if (input.val() == input.attr("placeholder")) {
                input.val("");
            }
        });
    });




    //prepend required scripts
    //    $("head").prepend("<script src='https://cdn.jsdelivr.net/jquery.mockjax/1.6.1/jquery.mockjax.js'></script>");

    $("head").prepend('<script src="https://rawgit.com/WaniKani/WanaKana/master/lib/wanakana.js" type="text/javascript"></script>');


    convertStorage(); //--
    if (o.asWK)
        makeWkReviews();//--

    info("addwindow._elem._coontainer",addWindow._elem._container.firstChild);
    $("body").append(settingsWindow._elem._container);
    settingsWindow.close();
    $("body").append(addWindow._elem._container);
    $("#add").hide();
    $("#AddItemBtn").click(addButton._onClick);

    $("body").append(editWindowHtml);
    $("#edit").hide();
    $("#ResetLevelsBtn").click(handleResetLevelsClick);
    $("#EditEditBtn").click(handleEditClick);
    $("#EditSaveBtn").click(handleEditSave);
    $("#EditDeleteBtn").click(handleEditDelete);
    $("#EditDeleteAllBtn").click(handleEditDeleteAll);
    $("#EditCloseBtn").click(handleEditClose);

    $("body").append(exportWindowHtml);
    $("#export").hide();
    $("#ExportItemsBtn").click(handleExportClick);
    $("#ExportSelectAllBtn").click(handleExportSelectAll);
    $("#ExportCsvBtn").click(handleExportCsv);
    $("#ExportCloseBtn").click(handleExportClose);

    $("body").append(importWindowHtml);
    $("#import").hide();
    document.getElementById("upload") && document.getElementById("upload").addEventListener('change', fileUpload, false);
    //    $("#ImportCsvBtn").click(function () {});
    $("#ImportWKBtn").click(handleImportWK);
    $("#ImportItemsBtn").click(handleImportClick);
    $("#ImportCloseBtn").click(handleImportClose);

    $("body").append(reviewWindowHtml);
    $("#selfstudy").hide();
    $("#SelfstudyCloseBtn").click(handleSelfstudyClose);
    $("#WrapUpBtn").click(handleWrapUp);
    $("#AudioButton").click(handleAudioClick);

    $("body").append(resultWindowHtml);
    $("#resultwindow").hide();
    $("#ReviewresultsCloseBtn").click(handleResultClose);

    $("#rev-input").keyup(handleAnswerSubmit);
    //document.addEventListener("DOMContentLoaded",
    //                        function() { hijackRequests(); });
    // Check for file API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
    } else {
        alert('The File APIs are not fully supported in this browser.');
    }
    /*
         * Start the script
         */
    console.warn("Script starting!!!");
    if (o.usingHTTPS){

        if (!o.noNewStuff){  //Don't waste time if user is browsing site
            getServerResp(o.APIkey);
            info("Initialising WaniKani Self-Study Plus");
            scriptInit();
        }
        else{
            //need to add the button dummy!
            info("Initialising WaniKani Self-Study Plus");
            scriptInit();
        }

    }else{
        warn("It appears that you are not using https protocol. Attempting to redirect to https now.");
        window.location.href = window.location.href.replace(/^http/, "https");
    }

    localSet("WKSSdata", o.VersionData);
groupEnd();
};



//-- conflicts with wysihtml5 if loaded at interactive stage????

if (document.readyState === 'complete' || document.readyState === 'interactive'){
    console.log("I think its interactive...", document.readyState);
    main({target: window});
} else {
    document.addEventListener('readystatechange', function(){console.log(document.readyState);});

    if (document.readyState !== "loading" &&  document.readyState !== 'interactive'){
        console.log("loading script...");
        console.log(document.readyState, $("body"));
        main({target: window});

    }

    //        info("waiting for page to load");
    //        window.addEventListener("load", main, false);
}
}    catch(e){
        e.stack ? error(e.stack, e) : error(e);
    }

})();