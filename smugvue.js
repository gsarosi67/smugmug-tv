Vue.component('info-tree', {
    template: '#info-tree',
    props: [ 'data', 'datakey'],
});


var smugvue = new Vue({
   el: '#smugvue',
   data : {
      displayData : {username: "sarosi", path: "/"},
      mediaPlayerData : undefined,
      logScreen : {
         logs : []   /* this could get kind of big, how can we limit the size? */
      },
      anchors : [],
      currentItem : -1,
      previousAnchor : -1,
      spinner : undefined,
      bDebug : false,
      pageSize : 50,
      startNum : 1,
      rowsize : 0,   /* number of items in one row, calculated at the end of the rendering */
      graphicsWidth : 1280,
      nonselectedColor : 'black',
      selectedColor : 'rgb(20,200,50)',
      userList : [
         'sarosi',
         'cmac',
         'accionfotos'
      ],
      defaultImageWidth : 233,
      defaultImageHeight : 170,
      imageMargin : 1,
      imageborderWidth : 5,
      imagePadding : 0,
      imageWidth : 233,
      imageHeight : 170,
      username : 'sarosi',
      trickplay_incr : 10,  /* fast-forward and rewind jump length in seconds */
      bRefresh : false, /* ??? */
      imageFormats : ["JPG","JPEG","PNG","GIF","SVG","BMP"],
      videoFormats : ["MP4","MOV","OGG"],
      screenId : "smugvue",
      contentareaId : "contentsection",
      headerId : "header",
      direction : "NewPage",
      videotagId : "video",
      imagetagId : "image",
      //bkgContainerName : "Backgrounds",
      bkgContainerName : undefined,  /* not that great of a look */
      bkgImages : undefined,
      bkgUrl : undefined
   },
   watch : {
      displayData : function() {
         /* Get the list of anchors to navigate */
         var self=this;
         this.printDbgMessage("displayData changed")
         Vue.nextTick(function() {
            
            if (self.direction) {
               if (self.direction != 'PlayMedia' && self.direction != 'MediaEnd') {
                  /*
                      The HTMLCollection of anchors is live! Which means that it will update
                      as the DOM changes.  
                      Impact:
                        - don't really need to call this repeatedly
                        - when a media is playing and the container is replace with a video or image tag,
                          the list of anchors is gone, and we can't navigate
                            - so either I need to somehow save this list of anchors, but only when playing media
                            - or I figure out a way for the media to not replace the container of anchors
                            - the method document.querySelectorAll() will return a static list
                  */
                  //self.anchors = document.getElementsByTagName("a")
                  self.rowsize = self.calcrowsize(self.anchors)
               }
               switch (self.direction) {
                  case 'PrevPage':
                     if (self.anchors.length > 0) {
                        self.currentItem = self.anchors.length - 1
                     }
                     else {
                        self.currentItem = 0;
                     }
                  break;

                  case 'NextPage':
                  case 'NewPage':
                     /*
                     if (self.anchors.length > 0) {
                        self.currentItem = 1;
                     }
                     else {
                     */
                        self.currentItem = 0;
                     //}
                  break;

                  case 'MediaEnd':
                  case 'PlayMedia':
                     /* leave current item the same */
                  break;
               }
            }
            //if ((self.anchors && self.anchors.length > 0) && (self.direction != 'PlayMedia' && self.direction != 'MediaEnd')) {
            if (self.anchors && self.anchors.length > 0) {
               self.scroll(self.anchors[self.currentItem].parentNode,document.getElementById(self.contentareaId))
            }
            if (self.mediaPlayerData !== undefined) {
               self.itemaction(self.displayData.children[self.currentItem])
            }
        })
      }
   },
   computed : {

   },
   created: function() {
      var self = this
      this.setErrorFunction()
      document.addEventListener('keydown', this.keyDown, false)
      document.addEventListener('mousemove', this.mouseMove, false)
      this.processCommandline(document.URL)
     
      window.addEventListener("popstate", function(event) {
          self.printDbgMessage("popstate event: ")
          state = event.state;
          if (state) {
            self.printDbgMessage("[popstate] path: " + state.path + ": " + self.pathSize(state.path) 
                                 + " name: " + state.name 
                                 + " current path: " + self.displayData.path + ": " + self.pathSize(self.displayData.path)
                                 + " History Size: " + window.history.length
                                 + " History State: " + JSON.stringify(window.history.state))
            if (self.pathSize(state.path) < self.pathSize(self.displayData.path)) {
               // Back button, so simply go back
               self.printDbgMessage("[popstate] Go Back")
               self.goBack()
            }
            else {
               // Forward Button, doesn't really make sense, so ignore
               self.printDbgMessage("[popstate] Forward Button ignored")
            }
          }
      },true)

      self.printDbgMessage("Screen Size: Width: " + Math.floor(document.getElementById(self.screenId).getBoundingClientRect().width) + ", Height: " + Math.floor(document.getElementById(self.screenId).getBoundingClientRect().height))
      this.initData(smugdata)

      // I think I only need to set this once and it will update...
      self.anchors = document.getElementsByTagName("a")

      window.addEventListener('resize', _.debounce(function() {
          self.printDbgMessage("Screen Size: Width: " + Math.floor(document.getElementById(self.screenId).getBoundingClientRect().width) + ", Height: " + Math.floor(document.getElementById(self.screenId).getBoundingClientRect().height))
          if (self.displayData.children) {
             self.calcImageSize(Math.floor(document.getElementById(self.screenId).getBoundingClientRect().width),
                                Math.floor(document.getElementById(self.screenId).getBoundingClientRect().height),
                                self.pageSize, self.displayData.children.length)
          }
      },200), false)

      document.addEventListener('fullscreenchange', function(event) {
         self.printDbgMessage("fullscreenchange event, fullscreenElement: " + document.fullscreenElement)
      })
   },
   methods : {
      initData : function(dataSource) {
         var self=this;
         if (dataSource) {
             dataSource.getUserNode(this.username, this.printDbgMessage).then(function(data) {
                self.startNum = 1
                dataSource.getContent(data.node,self.pageSize,self.startNum).then(self.updateDisplay).catch(function(error) {
                self.printDbgMessage(error)
             })
           });
         }
      },
      usernameStyle : function() {
         var head = document.getElementById(this.headerId)
         if (head) {
            var offset = ((head.clientWidth - this.visualLength(this.username.toUpperCase(),'userlist')) / 2)
            return {
               paddingLeft : offset + 'px',
               paddingRight: offset  + 'px'
            }
         }
         else {
            return {
               paddingLeft : 0 + 'px',
               paddingRight: 0  + 'px'
            }

         }
      },
      selected : function(index) {
         return {
            width : this.imageWidth + 'px',
            height : this.imageHeight + 'px',
            margin : this.imageMargin + 'px',
            padding : this.imagePadding + 'px',
            borderWidth : this.imageborderWidth + 'px',
            borderColor : (index === this.currentItem ? this.selectedColor : this.nonselectedColor)
         }
      },
      updateDisplay : function(data) {
         /* ES6
            Object.assign is needed to create a new object which will trigger the
            Vue.js reactivity system
             - this might be an issue on some TVs, what is the alternative??
         */
         currPath = this.displayData.path
         currNavNum = this.displayData.NavNum
         newPath = data.path
         newNavNum = data.NavNum
         this.displayData = Object.assign({}, data)

         
         /* 
            Can I add each new "page" display to the history?
              - instead of having some index, can I use the path length?
                - I can count the number of "directory levels", by spliting the path by the "/"
              - we are also coming through here when retrieving "more" items from a large container

         */
         if (this.displayData.name){
             document.title = this.displayData.name
         }

         this.printDbgMessage("[updateDisplay before pushState] History Size: " + window.history.length 
            + " History State: " + JSON.stringify(window.history.state))

         if (this.displayData.path != window.history.state.path) {
            window.history.pushState({"path":this.displayData.path,"name":this.displayData.name},this.displayData.name)
         }

         this.printDbgMessage("[updateDisplay] Count: " + this.displayData.count + " Start: " + this.displayData.start 
                               + " displayData.path: " + this.displayData.path)
         this.printDbgMessage("[updateDisplay after pushState] History Size: " + window.history.length 
                              + " History State: " + JSON.stringify(window.history.state))

         if (this.displayData.children) {
           this.calcImageSize(Math.floor(document.getElementById(this.screenId).getBoundingClientRect().width),
                              Math.floor(document.getElementById(this.screenId).getBoundingClientRect().height),
                              this.pageSize, this.displayData.children.length)
         }

         /* not sure if this the best place for this */
         if (this.bkgContainerName !== undefined) {
            var self=this
            if (this.bkgImages === undefined && this.displayData.parent == null && this.displayData.children) {
                var bkgNode = this.displayData.children.find(function(ch) {
                   return (ch.name === self.bkgContainerName)
                });
                if (bkgNode !== undefined) {
                   smugdata.getContent(bkgNode.node).then(function(data) {
                      self.bkgImages = data
                      self.setbackgroundimage(self)
                   })
                   .catch(function(err) {
                      self.printDbgMessage("Error getting background images")
                   })
                }
            }
            else {
               /* Set the background image */
               this.setbackgroundimage(this)
            }
        }
      },
      setbackgroundimage : function(self) {
         if (self.bkgImages.children) {
            var screendiv = document.getElementById(self.screenId)
            if (screendiv) {
               var index = self.getRandomInt(0,self.bkgImages.children.length-1)
               self.bkgUrl = "url('" + self.findImageSize(self.bkgImages.children[index].node.OriginalWidth,
                                    self.bkgImages.children[index].node.OriginalHeight,
                                    self.bkgImages.children[index].imagesizes,
                                    {Width: screendiv.clientWidth, Height: screendiv.clientHeight}) + "')"
            }
         }
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
         this.direction = "MediaEnd"
         this.printDbgMessage(this.direction)
         this.mediaPlayerData = undefined
      },
      itemaction : function(item) {
         if (item) {
            var self=this;
            if (item.type == "Container") {
               self.getNodeContent(item.node)
            }
            else {
               self.direction = "PlayMedia"
               self.mediaPlayerData = item
            }
            self.printDbgMessage(self.direction)
         }
      },
      getNodeContent : function(node) {
         var self=this
         self.direction = "NewPage"   //should this be something else ??
         self.startNum = 1  //should be able to use this to return to the correct page
         smugdata.getContent(node,self.pageSize,self.startNum).then(self.updateDisplay).catch(function(error) {
              self.printDbgMessage(error)
         })
         self.printDbgMessage(self.direction)
      },
      isMore : function() {
         return ((this.displayData.start + this.pageSize) < this.displayData.count)
      },
      isPrev : function() {
         return (this.displayData.start > 1)
      },
      containermore : function(direction) {
         this.direction = direction
         this.printDbgMessage(direction)
         if (direction === 'PrevPage') {
            if ( this.isPrev() ) {
               this.startNum = this.displayData.start - this.pageSize
               if (this.startNum < 0) this.startNum = 1
               this.printDbgMessage("Fetching Prev: Count: " + this.displayData.count + " Start: " + this.startNum)
               smugdata.getContent(this.displayData.node,this.pageSize,this.startNum).then(this.updateDisplay).catch(function(error) {
                  this.printDbgMessage(error)
               })
            }
         }
         else if (direction === 'NextPage') {
            if ( this.isMore() ) {
               this.startNum = this.displayData.start + this.pageSize
               this.printDbgMessage("Fetching More: Count: " + this.displayData.count + " Start: " + this.startNum)
               smugdata.getContent(this.displayData.node,this.pageSize,this.startNum).then(this.updateDisplay).catch(function(error) {
                  this.printDbgMessage(error)
               })
            }
         }
      },
      getRandomInt: function(min, max) {
         return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
      },
      calcImageSize : function(width, height, pagesize, imagecount) {
        /* We will set a default image size and use that to determine the
           number of columns.  The actual image size will be adjusted to fill the screen */

        //this.printDbgMessage("[calcImageSize] width: " + width + " height: " + height + " imagecount: " + imagecount)
        var totalImagewidth = this.defaultImageWidth + (2 * this.imageMargin) + (2 * this.imageborderWidth)
        //this.printDbgMessage("[calcImageSize] totalImagewidth: " + totalImagewidth)
        var columns = Math.floor(width / totalImagewidth)
        columns = (columns < 1 ? 1 : columns)
        //this.printDbgMessage("[calcImageSize] columns: " + columns)

        this.imageWidth = Math.floor(width / columns) - (2 * this.imageMargin) - (2 * this.imageborderWidth)
        /* to get imageHeight use the default image size aspect ratio */
        this.imageHeight = Math.floor(parseFloat(this.imageWidth) * (this.defaultImageHeight / this.defaultImageWidth))
        this.printDbgMessage("[calcImageSize] imageWidth: " + this.imageWidth + " imageHeight: " + this.imageHeight)

         /* what if the number of images to display is less than the pagesize?  we should make the image
            size larger to fill the screen */
      },
      displayImageUrl : function() {
         /* find the url to the image size that closest matches the calcuated image size for the current view.
         */
         return this.findImageSize(this.mediaPlayerData.originalwidth, this.mediaPlayerData.originalheight, this.mediaPlayerData.imagesizes,{
                                      Width: Math.floor(document.getElementById(this.screenId).getBoundingClientRect().width),
                                      Height: Math.floor(document.getElementById(this.screenId).getBoundingClientRect().height)
                                   })
      },
      displayVideoUrl : function(entry) {
         /* find the url to the image size that closest matches the calcuated image size for the current view.
            - not sure what about this one, need to figure out the video formats supported
         */
         return this.findImageSize(this.mediaPlayerData.originalwidth, this.mediaPlayerData.originalheight, this.mediaPlayerData.videosizes,{
                                      Width: Math.floor(document.getElementById(this.screenId).getBoundingClientRect().width),
                                      Height: Math.floor(document.getElementById(this.screenId).getBoundingClientRect().height)
                                   })
      },
      contentEntryImage : function(entry) {
         /* find the url to the image size that closest matches the calcuated image size for the current view.
             - I am using the default image width and height as the orignal width and height, because that is only
               used to determine which dimension to use for the Search
         */
         if (entry.imagesizes) {
            return this.findImageSize(this.defaultImageWidth, this.defaultImageHeight, entry.imagesizes, {Width: this.imageWidth, Height: this.imageHeight})
         }
         return undefined
      },
      findImageSize : function(OriginalWidth, OriginalHeight, imageSizes, displaySize) {
         /* Find the url to the image that best matches the display size
            - determine the image direction i.e. landscape or portrait based on
              which is greater width or height.
            - compare each image longer side with the display width or height do this,
              in order from smallest to largest stop when you find an image
              that is larger than the display or you run our of images
            - assumes that imageSizes is sorted, smallest to largest
         */
         var dim;
         if (displaySize && imageSizes) {
            if (OriginalWidth >= OriginalHeight) {
               dim = "Width";
            }
            else {
               dim = "Height";
            }
            /* would like to use find, but might not be supported on TV */
            for (var i = 0; i < imageSizes.length; i++) {
                if (imageSizes[i][dim] > displaySize[dim]) {
                  return imageSizes[i].Url;
               }
            }
          }
          return imageSizes[imageSizes.length-1].Url;
      },
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
     scroll : function (ele, container) {
        /* this will be called on every navigation key press
            - is this too heavy?
            - is there a better way?
        */
        if (ele != undefined && container != undefined) {
           var rect = ele.getBoundingClientRect();
           var contrect = container.getBoundingClientRect();
           var eleStyle = window.getComputedStyle(ele);

           /* Check if we need to scroll the container */
           if ((rect.bottom) > (contrect.bottom - (parseInt(eleStyle.marginBottom) + parseInt(eleStyle.borderWidth)))) {
              //this.printDbgMessage("Scroll Up: " + container.scrollTop);
               container.scrollTop += rect.bottom - (contrect.bottom - (parseInt(eleStyle.marginBottom) + parseInt(eleStyle.borderWidth)));
              //container.scrollTop += rect.height;
              //this.printDbgMessage("Scroll Top: " + container.scrollTop);
           }
           else if (rect.top < (contrect.top+parseInt(eleStyle.marginTop))) {
              //this.printDbgMessage("Scroll Down: " + container.scrollTop);
              container.scrollTop -= (contrect.top+parseInt(eleStyle.marginTop)) - rect.top;
              //this.printDbgMessage("Scroll Top: " + container.scrollTop);
           }
        }
     },
     playpause : function() {
        this.printDbgMessage("play/pause");

        var vid = document.getElementById(this.videotagId)
        if (vid) {
           if (vid.paused) {
              this.printDbgMessage("video.paused true, calling play()");
              vid.play();
           }
           else {
              this.printDbgMessage("video.paused false, calling pause()");
              vid.pause();
           }
        }
     },
     fastforward : function() {
        /* lame version of video fast-forward, just jump ahead. Changing the
           speed does not work on a lot of platforms */
        var vid = document.getElementById(this.videotagId)
        if (vid) {
           if (vid.currentTime < (vid.duration - this.trickplay_incr)) {
              vid.currentTime += this.trickplay_incr
           }
           else {
              vid.currentTime = vid.duration
           }
        }
     },
     rewind : function() {
        var vid = document.getElementById(this.videotagId)
        if (vid) {
           if (vid.currentTime > this.trickplay_incr) {
               vid.currentTime -= this.trickplay_incr
           }
           else {
               vid.currentTime = 0
           }
        }
     },
     openFullscreen : function(elem) {
        this.printDbgMessage("openFullscreen")
        try {
           if (elem.requestFullscreen) {
               elem.requestFullscreen()
           } else if (elem.mozRequestFullScreen) { /* Firefox */
               elem.mozRequestFullScreen();
           } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
               elem.webkitRequestFullscreen();
           } else if (elem.msRequestFullscreen) { /* IE/Edge */
               elem.msRequestFullscreen();
           } else {
              this.printDbgMessage("Fullscreen not supported")
           }
        } catch(err) {
           this.printDbgMessage("request Fullscreen error: " + err)
        }

     },
     closeFullscreen : function() {
        this.printDbgMessage("closeFullscreen")
        if (document.exitFullscreen) {
           document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
           document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
           document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
           document.msExitFullscreen();
        } else {
           this.printDbgMessage("Exit FullScreen not supported")
        }
     },
     mouseMove : function(event) {
        var x = event.clientX
        var y = event.clientY
        var moveX = event.movementX
        var moveY= event.movementY
        this.printDbgMessage("x,y: " + x + "," + y)
        this.printDbgMessage("movex,movey: " + moveX + "," + moveY)
     },
     itementer : function(item,index) {
        //this.printDbgMessage("itementer: index = " + index)
        this.currentItem = index
        this.scroll(this.anchors[this.currentItem].parentNode,document.getElementById(this.contentareaId))
     },
     pathSize : function(path) {
        size = 0
        if (path) {
           for (entry of path.split('/')) {
              if (entry.length > 0) {
                 size++
              }
           }
        }
        return(size)
     },
     goBack : function() {
         if (this.mediaPlayerData === undefined) {
            if (this.displayData.parent) {
               /* container that is not root, move to the previous container
                  - ToDo: keep some additional context about each data node
                     so that we can go back to the select item
                     - For example if I select item 15 in a container and that opens
                     another container, when I go back to the original container item
                     15 should be selected.
               */
               this.getNodeContent(this.displayData.parent)
            }
         }
         else {
            /* must be a media item */
            this.mediaended()
            this.scroll(this.anchors[this.currentItem].parentNode,document.getElementById(this.contentareaId))
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
                this.bDebug = (this.bDebug ? false : true)
                bHandled = true;
           break;

           case 55:      /* 7 digit */
           case 8:       /* Xfinity Last Key / Keyboard backspace key */
              this.goBack()
              bHandled = true;
           break;

           case 57: /* 9 digit */
               if (this.mediaPlayerData === undefined) {
                   /* the fullscreenElement does not seem to exist on the Samsung TV

                      - how can I tell if the display is in fullscreenmode or not??
                      - also the fullscreenchange events does not fire

                  */
                   if (document.fullscreenElement == null)  {
                      this.openFullscreen(document.documentElement)
                   } else {
                      this.closeFullscreen()
                   }
                }
                else {
                   if (document.fullscreenElement == null)  {
                      if (this.isVideo(this.mediaPlayerData.format)) {
                         this.openFullscreen(document.getElementById(this.videotagId))
                      } else {
                         this.openFullscreen(document.getElementById(this.imagetagId))
                      }
                   } else {
                      this.closeFullscreen()
                   }
                }
           break;

           case 13: /* select / return */
           case 53: /* 5 digit */
           case 32: /* space key */
           case 179: /* play/pause Xfinity */
              if (this.mediaPlayerData === undefined) {
                this.itemaction(this.displayData.children[this.currentItem])
              }
              else {
                 if (this.isVideo(this.mediaPlayerData.format)) {
                    this.playpause()
                 }
                 else {
                    this.mediaended()
                    // I think this will work...
                    this.scroll(this.anchors[this.currentItem].parentNode,document.getElementById(this.contentareaId))
                 }
              }
              bHandled = true;
           break;

           case 52: /* 4 digit (left) */
           case 37: /* Left arrow */
           case 50: /* 2 digit (up) */
           case 38: /* Up arrow */
                 var newItem;
                 if (EKC == 37 || EKC == 52) {
                    newItem = this.currentItem - 1;   /* 4 digit or left */
                 }
                 else {
                    newItem = this.currentItem - this.rowsize;
                 }

                 if (newItem < 0) {
                    if ( this.isPrev() ) {
                       this.containermore("PrevPage")
                    }
                    else {
                       this.currentItem = 0
                    }
                 }
                 else {
                    this.currentItem = newItem
                    if (this.mediaPlayerData === undefined) {
                       /* scroll */
                       var self=this
                       self.scroll(self.anchors[self.currentItem].parentNode,document.getElementById(self.contentareaId))
                    } else {
                       this.itemaction(this.displayData.children[this.currentItem])
                    }
                 }
                 bHandled = true;
             break;

             case 54: /* 6 digit (right) */
             case 39: /* Right arrow */
             case 56: /* 8 digit (down) */
             case 40: /* Down arrow */
                var newItem;
                if (EKC == 39 || EKC == 54) {
                   newItem = this.currentItem+1;      /* 6 digit or right */
                }
                else {
                   newItem = this.currentItem + this.rowsize;  /* 8 digit or down */
                }

                if (newItem >= this.anchors.length) {
                   /*
                      At this point we have reached the end of the current list of anchors so
                      check to see if there are more and if there are, set the state to
                      get the next page of content and redraw. */
                   if ( this.isMore() ) {
                      this.containermore('NextPage')
                   }
                   else {
                      /* no more items make sure currentItem is at the end of the list */
                      this.currentItem = this.anchors.length - 1
                   }
                }
                else {
                   this.currentItem = newItem;
                   if (this.mediaPlayerData === undefined) {
                      /* scroll */
                      var self=this
                      self.scroll(self.anchors[self.currentItem].parentNode,document.getElementById(self.contentareaId))
                   } else {
                      this.itemaction(this.displayData.children[this.currentItem])
                   }
                }
                bHandled = true;
             break;

             case 51: /* 3 digit */
             case 190: /* >/. key on keyboard */
             case 228:  /* Forward Xfinity */
                this.fastforward()
                bHandled = true
             break;

             case 49: /* 1 digit */
             case 188:  /* </, key on keyboard */
             case 227:  /* Rewind Xfinity */
                this.rewind()
                bHandled = true;
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
      },
      /*
      printDbgMessage_simple : function(msg) {
         console.log(msg)
      },
      */
      printDbgMessage : function (msg) {
   		if (this.bDebug) {
   			if (this.logScreen != undefined) {
               this.logScreen.logs.push(msg)
               Vue.nextTick(function() {
                  /*  kinda hacky - auto scroll */
                  var logs = document.getElementById('logs')
                  if (logs && (logs.scrollHeight > logs.clientHeight)) {
                     logs.scrollTop = logs.scrollHeight - logs.clientHeight
                  }
               })
            }
         }
         console.log(msg)
      },
      calcrowsize : function(anchors) {
         var rows = new Array();
         var rownum = 0;
         var i = 0;

         if (anchors !== undefined && anchors[0] !== undefined) {
            var curY = anchors[0].getBoundingClientRect().top;
            rows[0] = 0;
            while (i < anchors.length) {
      	      if (anchors[i].getBoundingClientRect().top > curY) {
      		      rownum++;
      		      rows[rownum] = 0;
      		      curY = anchors[i].getBoundingClientRect().top;
      	      }
      	      rows[rownum]++;
      	      i++;
            }
            return(rows[0])
        }
        else {
           return 0;
        }
     }
  }
})
