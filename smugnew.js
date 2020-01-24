
var watch = {

   displayData : function() {
      /* Get the list of anchors to navigate
         Not sure where to do this?
         is there a better way?
      */
   	this.anchors = document.getElementsByTagName("a");
   },
   currentAnchor : function() {
       this.changeFocus()
   }
}

var smugvue = new Vue({
   el: '#smugvue',
   data : {
      displayData : {username: "sarosi", path: "/"},
      anchors : [],
      currentAnchor : -1,
      previousAnchor : -1,
      spinner : undefined,
      bDebug : true,
      scrolldirection : 'next',
      pageSize : 30, /*  The max number of items to both fetch from Smugmug and to draw at one time. */
      rowSize : 0,   /* number of items in one row, calculated at the end of the rendering */
      graphicsWidth : 1280,
      nonselectedColor : 'black',
      selectedColor : 'rgb(20,200,50)',
      userList : [
         'sarosi',
         'cmac',
         'accionfotos'
      ],
      username : 'sarosi',
      trickplay_incr : 10,  /* fast-forward and rewind jump length in seconds */
      bRefresh : false, /* ??? */
      imageFormats : ["JPG","JPEG","PNG","GIF","SVG","BMP"],
      videoFormats : ["MP4","MOV","OGG"],
      contentareaId : "contentsection",
      headerId : "header"
   },
   computed : {

   },
   created: function() {
      var self = this
      this.setErrorFunction()
      document.addEventListener('keydown', this.keyDown, false)
      //document.addEventListener('statechange',this.stateChange)
      this.processCommandline(document.URL)

      this.initData(smugdata)


      /* Is there a better way to do this in vue.js */
      //this.spinner = new Spinner({lines: 13, length: 30, width: 10, radius: 30, color: "#AAAAAA"});

      //self.calcImageSize(self)
      window.addEventListener('resize', _.debounce(function() {
           //self.calcImageSize(self)
          self.$forceUpdate()
      },200), false)

      //document.dispatchEvent(statechangeevent)  The state machine should be in the dataSource
   },
   methods : {
      initData : function(dataSource) {
         if (dataSource) {
            var ca = document.getElementById(this.contentareaId)
            dataSource.init(this.updateDisplay, this.username, {debugLog: this.printDbgMessage, pageSize: this.pageSize, displaySize: {Width: ca.clientWidth, Height: ca.clientHeight}})
         }
      },
      usernameStyle : function() {
         var head = document.getElementById(this.headerId)
         var offset = ((head.clientWidth - this.visualLength(this.username.toUpperCase(),'userlist')) / 2)
         return {
            paddingLeft : offset + 'px',
            paddingRight: offset  + 'px'
         }
      },
      updateDisplay : function(data) {
         /* ES6
            Object.assign is needed to create a new object which will trigger the
            Vue.js reactivity system
             - this might be an issue on some TVs, what is the alternative??
         */
         this.displayData = Object.assign({}, this.displayData, data)
      },
      processCommandline : function(url) {
         var query = url.slice(url.indexOf("?")+1)
         if (query) {
     		   var params = query.split("&")
     		   for (var i = 0; i < params.length; i++) {
     			   var equal = params[i].indexOf("=")
     			   if (params[i].substring(0,equal) == "username") {
     			      username = params[i].substring(equal+1)
     			   }
               else if (params[i].substring(0,equal) == "proxy") {
                  if (params[i].substring(equal+1) == "true") {
                     bProxy = true
                  }
                  else if (params[i].substring(equal) == "false") {
                     bProxy = false
                  }
               }
     		   }
     	   }
      },
      isImage : function(format) {
          if (format) {
             return (this.imageFormats.find(function(ele) {
                return (ele === format.toUpperCase())
             }) !== undefined)
          }
          return false
      },
      isVideo : function(format) {
         if (format) {
           return (this.videoFormats.find(function(ele) {
               return (ele === format.toUpperCase())
           }) !== undefined)
         }
         return false
      },
      mediaended : function(e) {
         this.printDbgMessage("Media ended")
         this.displayData.action()
      },
      printDbgMessage : function(msg) {
         console.log(msg)
      },
      /*
      printDbgMessage : function(msg) {
         if (bDebug == 1) {
      		if (dbg != undefined) dbg.innerHTML = dbg.innerHTML + msg + "</br>"
      		console.log(msg);

      		/* try to auto scroll
      		if (dbg != undefined) {
      			if (dbg.scrollHeight > dbg.clientHeight) {
      				dbg.scrollTop = (dbg.scrollHeight - dbg.clientHeight);
      			}
      		}
      	}
      },
      */
      setErrorFunction : function() {
         var self = this
         window.onerror = function (msg, url, lineNo, columnNo, error) {
             var string = msg.toLowerCase();
             var substring = "script error";
             if (string.indexOf(substring) > -1) {
                self.printDbgMessage('Script Error: See Browser Console for Detail');
             } else {
                var message = [
                   'Message: ' + msg,
                   'URL: ' + url,
                   'Line: ' + lineNo,
                   'Column: ' + columnNo,
                   'Error object: ' + JSON.stringify(error)
                ].join(' - ');

                self.printDbgMessage(message);
             }
             return false;
         };
     },
     visualLength : function(str,strClass) {
        var ruler = document.getElementById("ruler");
        if (ruler != undefined) {
           ruler.className = "ruler " + strClass
           ruler.innerHTML = str
           return ruler.offsetWidth
        }
        else {
           return 0
        }
     },
     keyDown : function(event) {
          var EKC = event.keyCode;
          this.printDbgMessage("keyCode= " + EKC);

         /* The browser on the Samsung TV does not pass the arrow keys (or much else)
            through to the application.   It does pass the number keys, so use these keys
            to implement the star (up,down,left,right,select) functions.  The TV Does
            have a pointer but the navigation is a little awkward so also include these keys.
            Use the #7 button as a back button.
         */
         var bHandled = false;
         switch (EKC) {
             case 48: /* 0 digit */
                toggleDebug();
                bHandled = true;
             break;

             case 55: /* 7 digit */
             case 8: /* Xfinity Last Key / Keyboard backspace key */
                //printDbgMessage("EKC: " + EKC + " Last key");
                //if (!isActive('authinfo'))
                if (currentState != 'authurldisplayed') {
                /* Last key should go to previous directory or if playing video bring
                   up content grid
                   if (isActive(containerid)) {
                     /* Grid is displayed, so go to the parent folder, if root do nothing
                       - ToDo: if root display menu */
                      //activateChild(gridid,parentdirid);
                   //}
                   //else {
                         /* currentStateData is currently pointing to a AlbumImage (image or video)
                            it needs to be set back to the containing Album */
                       currentStateData = currentStateData.Parent;
                       currentState = 'displaycontent';
                       //toggleFilegrid();
                       //gainFocusandScroll(anchors[currentAnchor]);
                   //
                   bHandled = true;
                }
             break;

             case 57: /* 9 digit */
             break;

             case 52: /* 4 digit (left) */
             case 37: /* Left arrow */
             case 50: /* 2 digit (up) */
             case 38: /* Up arrow */
              /*
                if (document.getElementById(gridid)) {
                   var newAnchor;
                   if (EKC == 37 || EKC == 52) {
                      newAnchor = currentAnchor - 1;
                   }
                   else {
                      newAnchor = currentAnchor - ROWSIZE;
                   }
                   if (newAnchor < 0) {
                   /* SmugMug APIs automatically limit the response size.
                      At this point we have reached the top of the current list of anchors so
                      check to see if there are more and if there are, set the state to
                      get the next page of content and redraw.
                           ToDo option: don't destroy current list, just add to it (becareful of memory)
                   */
                     /*  ToDo:
                         Need to figure out a way to allow navigable components in the header area.
                         This will allow for a dropdown of user names, etc.
                         this is a little squirrelly...don't like using the globals
                       I want to be able to select the correct item when moving to the previous page (i.e. not the top)

                   scrolldirection = 'previous';
                   anchordelta = newAnchor;
                     getPrevious();
                }
                else
                {
                   loseFocus(anchors[currentAnchor]);
                   currentAnchor = newAnchor;
                   gainFocusandScroll(anchors[currentAnchor]);
                     if (!isActive(containerid)) {
                       anchors[currentAnchor].click();
                     }
                }
                bHandled = true;
              }
              */
             break;

             case 54: /* 6 digit (right) */
             case 39: /* Right arrow */
             case 56: /* 8 digit (down) */
             case 40: /* Down arrow
                 if (document.getElementById(gridid))
                 {
                var newAnchor;
                if (EKC == 39 || EKC == 54)
                {
                   newAnchor = currentAnchor+1;
                }
                else
                {
                   newAnchor = currentAnchor + ROWSIZE;
                }

                if (newAnchor >= anchors.length)
                {
                   /* Need to implement paging.  SmugMug APIs automatically limit the response
                      size.

                      At this point we have reached the end of the current list of anchors so
                      check to see if there are more and if there are, set the state to
                      get the next page of content and redraw.

                   scrolldirection = 'next';
                   anchordelta = newAnchor - anchors.length;
                     getNext();
                }
                else
                {
                   loseFocus(anchors[currentAnchor]);
                   currentAnchor = newAnchor;
                   gainFocusandScroll(anchors[currentAnchor]);
                     if (!isActive(containerid)) {
                       anchors[currentAnchor].click();
                     }
                }
                bHandled = true;
             } */
             break;

             case 51: /* 3 digit */
             case 190: /* >/. key on keyboard */
             case 228:  /* Forward Xfinity
                   if (vid)
                   {
                      if (vid.currentTime < (vid.duration-trickplay_incr))
                      {
                         vid.currentTime += trickplay_incr;
                      }
                      else
                      {
                         vid.currentTime = vid.duration;
                      }
                      bHandled = true;
                   }
                   */
             break;

             case 49: /* 1 digit */
             case 188:  /* </, key on keyboard */
             case 227:  /* Rewind Xfinity
                  if (vid)
                   {
                      if (vid.currentTime > trickplay_incr)
                      {
                         vid.currentTime -= trickplay_incr;
                      }
                      else
                      {
                         vid.currentTime = 0;
                      }
                      bHandled = true;
                   } */
             break;

            /* Overload the select key, the 5 digit, spacebar, and play/pause
               to select the currenly highlighted anchor and to play/pause video */
             case 13: /* select */
             case 53: /* 5 digit */
             case 32: /* space key */
             case 179: /* play/pause Xfinity
                  if (vid) {
                      playpause();
                  }
                  else {
                     if (isActive(containerid)) {
                       anchors[currentAnchor].click();
                     }
                  }
                   bHandled = true;
                   */
             break;

             case 33: /* xfinity Page up */
             break;

             case 34: /* xfinity Page down */
             break;

             /***********************************************************
                Xfinity function keys don't work, well at least the C key
                does not work.  Lanuches sports app
                     *** DON'T USE ****
             *************************************************************/

             case 403: /* xfinity A button */
             case 65:  /* 'A' key on keyboard */
             break;

             case 404: /* xfinity B button */
             case 66:  /* 'B' key on keyboard */
             break;

             case 405: /* xfinity C button */
             case 67:  /* 'C' key on keyboard */
             break;

             case 406: /* xfinity D button */
             case 68:  /* 'D' key on keyboard */
             break;
          }
          if (bHandled && event.preventDefault) {
            //printDbgMessage("preventDefault");
            event.preventDefault();
         }
      }
  }

})
