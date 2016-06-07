var Class = require('./class.js');
var SRS = require('./srs.js');
module.exports = Class.extend({

        initialize: function(userVocab){
            this._userVocab = userVocab || localGet("User-Vocab")||[];
            this._wKSSItems = [];
            this._wKreview = $.jStorage.get("reviewQueue")||[];
            this._srsObject = new SRS();
        },

        makeWkReviews: function(){

            groupCollapsed("Loading Items");
            for (var i = 0, l = this._userVocab.length; i < l; i++){
                var dueNow = (this._userVocab[i].locked === "no" && this._userVocab[i].level < 9 && Date.now() > this._userVocab[i].due);

                if (dueNow){
                    if (this._userVocab[i].kanji.length && this._userVocab[i].meaning[0].length && this._userVocab[i].reading[0].length){
                        //We need all three to add to WK review, no kana only without readings etc.
                        log("item:" + this._userVocab[i].kanji + ", " + this._userVocab[i].locked +" === \"no\" && " + this._userVocab[i].level + " < 9 && " + Date.now() + " > " + this._userVocab[i].due);
                        log(dueNow);
                        this._wKSSItems.push(this.wKSS_to_WK(this._userVocab[i]));
                    }else{
                        log("Item " + this._userVocab[i].kanji + " could not be added, it is missing one or more of the essential fields for a WK vocabulary review");
                    }
                }
            }
            groupEnd();//That should be a lot neater.

            if (this._userVocab.length){
                log("first item regardless of being added to queue:", this.wKSS_to_WK(this._userVocab[0]), JSON.stringify(wKSS_to_WK(this._userVocab[0])));
            }
            //where the magic happens
            $.jStorage.listenKeyChange("reviewQueue", this._onReviewQueueChange);
        },

        _onReviewQueueChange: function(evt){
            $.jStorage.stopListening("reviewQueue", this._onReviewQueueChange);

            info("$.jStorage event listenKeyChange, evt->", evt, "this? ->", this);
            this.joinReviews();
        },

        joinReviews: function(){
            //TODO: combine vocab that is the same, track sources
            log("joining reviews");
            var wKcombined = this._wKreview.concat(this._wKSSItems);
            $.jStorage.set("reviewQueue", wKcombined);
        },

        /**
        * Converts a string like '   wani kani ' to 'Wani Kani' (trimming whitespace an capitalizing words)
        * @param {String} inString
        * @returns {String}
        */
        makeCamelCase: function(inString) {
            return inString.trim().replace(/\b\w/g , function(m){
                return m.toUpperCase();
            });
        },
        /**
        * Converts a string like '   wani kani ' to 'Wani Kani' (trimming whitespace an capitalizing words)
        * @param {String} inString
        * @returns {String}
        */
        containsBrackets: function(inString) {
            return (inString.indexOf("(") !== -1) && (inString.substr(inString.indexOf("(")).indexOf(")"));
        },
        /**
         * wKSS_to_WK
         * Convert a WKSS review object into a Wanikani review object
         */
        wKSS_to_WK: function(wKSSItem){
            var wKItem = {
                //aud: "";
                en: wKSSItem.meaning.map(this.makeCamelCase), //trim whitespace and capitalize words
                id: "WKSS" + WKSSItem.i,
                kana: wKSSItem.reading,
                srs: wKSSItem.level+1,//WK starts levels from 1, WKSS starts them from 0
                voc: wKSSItem.kanji,
                components: wKSSItem.components,
                syn: wKSSItem.meaning.filter(this.containsBrackets).map(function(s){ return s.substr(0, s.indexOf("(")); }) //returns substrings before the "(" when the string has a "(" followed by a ")"
            };
            return WKItem;
        },

        //{"level":"17","meaning_explanation":"This word consists of kanji with hiragana attached. Because the hiragana ends with an [ja]う[/ja] sound, you know this word is a verb. The kanji itself means [kanji]flourish[/kanji] or [kanji]prosperity[/kanji], so the verb vocab versions of these would be [vocabulary]to flourish[/vocabulary] or [vocabulary]to prosper[/vocabulary].","reading_explanation":"Since this word consists of a kanji with hiragana attached, you can bet that it will use the kun'yomi reading. You didn't learn that reading with this kanji, so here's a mnemonic to help you: What do you flourish at? You're an amazing [vocabulary]soccer[/vocabulary] ([ja]さか[/ja]) player who flourishes and prospers no matter where you go to play this wonderful (but not as good as baseball) sport.","en":"To Flourish, To Prosper","kana":"さかえる","sentences":[["中国には、覚せい剤の生産で栄えていた村がありました。","There was a village in China flourishing on their production of stimulants. "]],"parts_of_speech_ids":["4","19"],"part_of_speech":"Intransitive Verb, Ichidan Verb","audio":"2e194cbf194371cd478480d6ea67769da623e99a.mp3","meaning_note":null,"reading_note":null,"related":[{"kan":"栄","en":"Prosperity, Flourish","slug":"栄"}]}
        hijackRequests: function(){
            if (typeof $.mockjax === "function"){
                that = this;
                $.mockjax({
                    url: /^\/json\/progress\?vWKSS(.+)\[\]=(.+)&vWKSS.+\[\]=(.+)$/,
                    urlParams:["WKSSid", "MeaningWrong", "ReadingWrong"],
                    response: function(settings) {
                        // do any required cleanup
                        var id = Number(settings.urlParams.WKSSid);
                        var Mw = Number(settings.urlParams.MeaningWrong);
                        var Rw = Number(settings.urlParams.ReadingWrong);

                        log("is this your card?", that._userVocab[id]);
                        if (that._userVocab[id].due < Date.now()){//double check that item was due for review
                            if (Mw||Rw){
                                //drop levels if wrong

                                //Adapted from WaniKani's srs to authentically mimic level downs
                                var o = (Mw||0)+(Rw||0);
                                var t = that._userVocab[id].level;
                                var r=t>=5?2*Math.round(o/2):1*Math.round(o/2);
                                var n=t-r<1?1:t-r;//don't stay on 'started'

                                that._userVocab[id].level = n;
                            }else{
                                //increase level if none wrong
                                that._userVocab[id].level++;
                            }
                            //Put that._userVocab back in storage
                            that._userVocab[id].date = Date.now();
                            that._userVocab[id].due = Date.now() + that._srsObject.intervals[that._userVocab[id].level];
                            localSet("User-Vocab", that._userVocab);
                            log(that._userVocab[id].due +" > "+ Date.now() + " (" + ms2str(that._userVocab[id].due - Date.now())+")");

                        }else{
                            log("This item is not due for review yet, discarding results");
                        }
                        //uh oh
                        this.responseText = '{"vWKSS'+id.toString()+'":["'+Mw.toString()+'","'+Rw.toString()+'"]}';

                    }
                });

                $.mockjax({
                    url: /^\/json\/vocabulary\/WKSS(.+)/,
                    urlParams:["WKSSid"],
                    response: function(settings) {

                        // Investigate the `settings` to determine the response...
                        var id = settings.urlParams.WKSSid.toString();
                        var currentItem = $.jStorage.get("currentItem");
                        if (currentItem.id === "WKSS"+id){
                            console.log("as expected");
                        }
                        var related = '[';
                        for (i = 0; i < currentItem.components.length; i++){
                            related += '{"kan":"'+currentItem.components[i]+'","en":"","slug":"'+currentItem.components[i]+'"}';
                            related += (i+1<currentItem.components.length)?',':'';
                        }
                        related += ']';

                        var respText = JSON.stringify({"level":"U",
                                                       "meaning_explanation":"This is user-defined item. Meaning explanations are not supported at this time. [id: "+id+"]",
                                                       "reading_explanation":"This is user-defined item. Reading explanations are not supported at this time. [id: "+id+"]",
                                                       "en":currentItem.en.join(", "),
                                                       "kana":currentItem.kana.join(", "),
                                                       "sentences":[],
                                                       "parts_of_speech_ids":[],
                                                       "part_of_speech":[],
                                                       "audio":null,
                                                       "meaning_note":null,
                                                       "reading_note":null,
                                                       "related":JSON.parse(related)});
                        this.responseText = respText;
                    },
                    onAfterComplete: function() {
                        // do any required cleanup
                        $(".user-synonyms").remove();
                        // keeping the hooks for Community Mnemonics
                        $("#note-meaning, #note-reading").html("");
                    }
                });
            }
        }
    });