var smugdata = {

   /************************************************************************************************************
	Time to create a seperate module to fetch and "deal" with retrieval of data
	from the SmugMug APIs.

	smugdata is a first step.  Eventually I would like to create a generic data structure
	that is used by the view layer, so most likely would be a seperate filter module
	that would call smugdata module to get the raw Smugmug data

        2/1/2020
        Rewrite the data layer.

         I should be able to fetch all data using the following 3 calls and expansions:

           /api/v2/user
             "Node" : {
               "expand" : {
                  "ChildNodes" : {
                     "expand" : {
                        "HighlightImage" : {
                           "expand" : {
                              "ImageSizeDetails" : { }

           /api/v2/children
              "expand" : {
                 "HighlightImage" : {
                    "expand" : {
                       "ImageSizeDetails" : { }

           /api/v2/Album
              "expand" : {
                 "AlbumImages" : {
                    "expand" : {
                       "ImageSizeDetails" : { }

        I should be able to do away with the state machine and just implement the calls.

    **************************************************************************************************************/


	/******* _expand option ******

	   Using the _expand option when calling SmugMug APIs to get a node or albums children
	   should speed up the application a lot.  The _expand option allows us to retrieve all of the
	   node's children along with their highlight image object, and the image sizes (i.e. urls) in
	   one call.  Without _expand we have to have make one call to get the list of children and then
	   2 calls per child to get the highlight image and image sizes.

	   When using the _expand option in SmugMug Apis the "expanded" result is put into an
	   Expanded Object with each member name the Uris to the expanded API

	*/
  bRefresh : false,

  childrenExpand : {
    expand:{
       HighlightImage:{
         expand:{
            ImageSizeDetails:{ }
         }
       }
    }
  },
  userExpand : {
    expand : {
      Node : { }
    }
  },
  albumExpand : {
    expand : {
      AlbumImages : {
         args : {
            count : 100
         },
         expand : {
            ImageSizeDetails : { }
         }
      }
    }
  },
  itemCount : "?count=",
  apiVerbosity : "?_verbosity=3",
  smugmugProtocol : "https:",
  smug_api : "\//86w9cd1n98.execute-api.us-east-1.amazonaws.com/smugmug/",
  debugLog : function(msg) { console.log(msg); },
  displayData : undefined,
  userData : undefined,
  pageSize : 100,

  /* Proxy Configuration
     Used for IPv6 to IPv4 proxy */

  bProxy : true,  //make smugdata command line configurable
  proxyList : [ {
        hostname: "photos.smugmug.com",
        protocol: "https:",
        proxyhost: "dmsemxhxf1kba.cloudfront.net",
        pathname: ""
     }
  ],
  getUserNode: function(username, logger) {
       /*
           Fetch the user and the root node
           - does not provide any content to display, except user info
       */

       if (logger) {
          smugdata.debugLog = logger;
       }

       return (new Promise(function(resolve, reject) {
          smugdata.smugmugapi = smugdata.smugmugProtocol + smugdata.smug_api + smugdata.apiVerbosity + "&api=";

          if (username) {
             var userencodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.userExpand));
             fetch(smugdata.smugmugapi + "user/" + username + userencodedStr).then(function(response) {
                //smugdata.debugLog("getUserContent: response status = " + response.status + ":" + response.statusText);
                //smugdata.debugLog("getUserContent: response text = " + response.responseText);
                if (response.ok) {
                   return(response.json());
                }
                throw new Error(response.status)
             }).then(function(respjson) {
                if (respjson.Response != undefined) {
                   smugdata.userData = respjson.Response.User;

                   if (respjson.Expansions !== undefined) {
                      smugdata.userData.rootnode = respjson.Expansions[smugdata.userData.Uris.Node.Uri].Node;
                      smugdata.userData.rootnode.Parent = undefined;

                      var returnData = new Object();
                      returnData.name = smugdata.userData.Name;
                      returnData.node = smugdata.userData.rootnode;
                      returnData.parent = null;
                      returnData.type = "Root";
                      returnData.path = smugdata.userData.rootnode.UrlPath;

                      resolve(returnData);
                   }
                }
                else {
                   smugdata.debugLog("Response undefined");
                   reject("Response undefined");
                }
             }).catch(function(error) {
                if (error == 401) {
                   smugdata.debugLog("Not Authorized for SmugMug");
                   reject("Not Authorized for SmugMug");
                }
                else {
                   /* Error from SmugMug */
                   smugdata.debugLog("Error connecting to SmugMug status: " + error);
                   reject("Error connecting to SmugMug status: " + error);
                }
             });
          }
          else {
             smugdata.debugLog("Error username undefined");
             reject("Error username undefined");
          }
       }));
  },
  getContent: function(node,pageSize) {

     /*
         New way to fetching content.

         I will use fetch and a promise to call the correct apis, and not use the state model.

         - The fetched data will be put under the node object, which should already be in the userdata tree
         - The returned data (via Promise) will be in the displayData format

         This could lead to a complete re-architecture of the smugdata.

         for future use:
	        By default, fetch won't send or receive any cookies from the server,
	        resulting in unauthenticated requests if the site relies on maintaining
           a user session (to send cookies, the credentials init option must be set).
     */
     return (new Promise(function(resolve, reject) {

        smugdata.smugmugapi = smugdata.smugmugProtocol + smugdata.smug_api + smugdata.apiVerbosity + "&api=";

        if (node) {
           if (node.Type == 'Album') {
              smugdata.albumExpand.expand.AlbumImages.args.count = pageSize;
              var albumencodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.albumExpand));

              fetch(smugdata.smugmugapi + node.Uris.Album.Uri + albumencodedStr).then(function(response) {
                 //smugdata.debugLog("getUserContent: response status = " + response.status + ":" + response.statusText);
   	           //smugdata.debugLog("getUserContent: response text = " + response.responseText);
                 if (response.ok) {
                    return(response.json());
                 }
                 throw new Error(response.status)
              }).then(function(respjson) {
                 if (respjson.Response != undefined) {
                    node.Album = respjson.Response;
                    node.Count = node.Album.Album.ImageCount;
                 }

                 if (respjson.Expansions != undefined) {
                    node.Expansions = respjson.Expansions;
                 }

                 node.Album.Parent = node.Parent;  /* set the parent to be the container above, i.e. this nodes parent */

                 /* Now I have all the Image Urls and image details for all AlbumImages...*/
                 var returnData = new Object();
                 returnData.name = node.Album.Album.Name;
                 returnData.path = node.Album.Album.UrlPath;
                 returnData.type = "Container";
                 returnData.count = node.Count;
                 returnData.node = node;
                 returnData.parent = node.Parent;
                 returnData.children = [];

                 if (node.Expansions != undefined) {
                    //node.Album.Album.Uris.AlbumImages.Uri   // this gives me the expansion key for AlbumImages
                    node.Expansions[node.Album.Album.Uris.AlbumImages.Uri].AlbumImage.forEach(function(child,i) {
                       returnData.children[i] = new Object();
                       returnData.children[i].name = child.FileName;
                       returnData.children[i].type = child.Type = "Media"; // not sure this will work
                       returnData.children[i].format = child.Format;
                       returnData.children[i].node = child;
                       returnData.children[i].parent = node;
                       returnData.children[i].path = child.FileName;
                       returnData.children[i].originalwidth = child.OriginalWidth;
                       returnData.children[i].originalheight = child.OriginalHeight;
                       returnData.children[i].latitude = child.Latitude;
                       returnData.children[i].longitude = child.Longitude;
                       returnData.children[i].altitude = child.Altitude;
                       returnData.children[i].date = child.Date;

                       /* I want to return all of the image sizes and image size details,
                          but remove the smugmug specific
                          size descriptions, i.e. Small, Medium, Large, etc.  */
                       returnData.children[i].imagesizes = [];
                       returnData.children[i].videosizes = [];
                       var sizes = node.Expansions[child.Uris.ImageSizeDetails.Uri].ImageSizeDetails;
                       var index = 0;
                       sizes.UsableSizes.forEach(function(size) {
                          if (size.includes("ImageSize")) {  //ES6
                             returnData.children[i].imagesizes[index] = sizes[size];
                             returnData.children[i].imagesizes[index].Url = smugdata.adjustURL(returnData.children[i].imagesizes[index].Url);
                             index++;
                          } else if (size.includes("VideoSize")) {
                             returnData.children[i].videosizes[index] = sizes[size];
                             returnData.children[i].videosizes[index].Url = smugdata.adjustURL(returnData.children[i].videosizes[index].Url);
                             index++;
                          }
                       });

                       /* make sure imagesizes array is sorted smallest to largest */
                       returnData.children[i].imagesizes.sort(function(s1,s2) {
                          if (s1.Width > s2.Width) {
                             return 1;
                          } else if (s1.Width < s2.Width) {
                             return -1;
                          } else {
                             return 0;
                          }
                       });

                       /* make sure videosizes array is sorted smallest to largest */
                       returnData.children[i].videosizes.sort(function(s1,s2) {
                          if (s1.Width > s2.Width) {
                             return 1;
                          } else if (s1.Width < s2.Width) {
                             return -1;
                          } else {
                             return 0;
                          }
                       });
                    });
                    resolve(returnData);
                 }
                 /*
                 else {
                       // if not expansions, then something went wrong
                       smugdata.debugLog("Error: No Expansions");
                       reject("Error: No Expansions");
                 }
                 */
              }).catch(function(error) {
                 if (error == 401) {
                    smugdata.debugLog("Not Authorized for SmugMug");
                    reject("Not Authorized for SmugMug");
                 }
                 else {
                    /* Error from SmugMug */
                    smugdata.debugLog("Error connecting to SmugMug status: " + error);
                    reject("Error connecting to SmugMug status: " + error);
                 }
              });
           }
           else if (node.Type === 'Folder') {
              var childrenencodedStr = "&count=" + pageSize + "&_config=" + encodeURI(JSON.stringify(smugdata.childrenExpand));

              fetch(smugdata.smugmugapi + node.Uris.ChildNodes.Uri + childrenencodedStr).then(function(response) {
                 //smugdata.debugLog("getUserContent: response status = " + response.status + ":" + response.statusText);
                 //smugdata.debugLog("getUserContent: response text = " + response.responseText);
                 if (response.ok) {
                    return(response.json());
                 }
                 throw new Error(response.status)
              }).then(function(respjson) {
                 if (respjson.Response.Node != undefined) {
                    node.Children = respjson.Response.Node;
                    node.Count = respjson.Response.Pages.Total;
                 }

                 if (respjson.Expansions != undefined) {
                    node.Expansions = respjson.Expansions;
                 }

                 /* Now I have all the folder details and highlight images and sizes...*/
                 var returnData = new Object();
                 returnData.name = node.Name;
                 returnData.path = node.UrlPath;
                 returnData.type = "Container";
                 returnData.count = node.Count;
                 returnData.node = node;
                 returnData.parent = node.Parent;  // fix this shit
                 returnData.children = [];

                 if (node.Children != undefined && node.Expansions != undefined) {
                    node.Children.forEach(function(child,i) {
                       returnData.children[i] = new Object();
                       returnData.children[i].name = child.Name;
                       returnData.children[i].type = "Container";  //Folder can only contain Folders and Albums
                       returnData.children[i].node = child;
                       returnData.children[i].parent = node;
                       returnData.children[i].path = child.UrlPath;
                       var image = node.Expansions[child.Uris.HighlightImage.Uri].Image;
                       returnData.children[i].highlightimagefilename = image.FileName;
                       returnData.children[i].originalheight = image.OriginalHeight;
                       returnData.children[i].originalwidth = image.OriginalWidth;
                       var sizes = node.Expansions[image.Uris.ImageSizeDetails.Uri].ImageSizeDetails;
                       returnData.children[i].imagesizes = [];
                       var index = 0;
                       sizes.UsableSizes.forEach(function(size) {
                          if (size.includes("ImageSize")) {  //ES6
                             returnData.children[i].imagesizes[index] = sizes[size];
                             returnData.children[i].imagesizes[index].Url = smugdata.adjustURL(returnData.children[i].imagesizes[index].Url);
                             index++;
                          }
                       });

                       /* make sure imagesizes array is sorted smallest to largest */
                       returnData.children[i].imagesizes.sort(function(s1,s2) {
                          if (s1.Width > s2.Width) {
                             return 1;
                          } else if (s1.Width < s2.Width) {
                             return -1;
                          } else {
                             return 0;
                          }
                       });
                    });
                 }
                 resolve(returnData);
              });
           }
           else {
              smugdata.debugLog("Unknown Type: " + node.Type);
              reject("Unknown Type: " + node.Type);
           }
        }
        else {
           smugdata.debugLog("Error: node not defined");
           reject("Error: node not defined")
        }
     }));
  },
  nodeAction : function() {
      /* Key function that is called whenever a item is selected...
         Must determine the next state and data to fetch
         node could be an node that is a folder or an album
         or node could be an image or video that is not a node */

      var node = this.node;
      if (node.Type === undefined && node.Format != undefined) {
      	/* not sure about this, Type should be set by now */
         smugdata.debugLog("[smugdata.nodeAction] Setting node.Type = Media");
      	node.Type = 'Media';
      }
      if (!node.Parent) {
         node.Parent = smugdata.currentStateData;
      }

      switch (node.Type) {
     		case 'Album':
     		   /* Sigh...Albums don't have children
     		   		Node->Uris->Albums
     		   		Album->AlbumImages
     		   */
     		   smugdata.currentState = 'getalbumdata';
     		   smugdata.currentStateData = node;
     		   document.dispatchEvent(smugdata.statechangeevent);
     		break;

         case 'AlbumImages':
           smugdata.currentState = 'getalbumimages';
           smugdata.currentStateData = node;
           document.dispatchEvent(smugdata.statechangeevent);
         break;

     		case 'Folder':
     		   if (node.IsRoot) {
     		   	  smugdata.currentState = 'getnodedata';
     		   }
     		   else {
     		   	  smugdata.currentState = 'getchildren';
     		   }
     		   smugdata.currentStateData = node;
     		   document.dispatchEvent(smugdata.statechangeevent);
     		break;

     		case 'Media':
     		   /* Current node is a single media item, get the URL */
     		   if (node.IsVideo) {
     		   	   smugdata.currentState = 'getvideourl';
     		   	   smugdata.currentStateData = node;
     		   	   document.dispatchEvent(smugdata.statechangeevent);
     		   }
     		   else {
     		   	   smugdata.currentState = 'getimageurl';
     		   	   smugdata.currentStateData = node;
     		   	   document.dispatchEvent(smugdata.statechangeevent);
     		   }
     		break;

         default:
            smugdata.debugLog("[smugdata.nodeAction] Unknown Type: " + node.Type);
         break;
  	   }
   },
   getMoreData : function(direction) {
      if (direction == "PrevPage" || direction == "NextPage") {
         if ( (smugdata.currentStateData.Type == "Folder") && (smugdata.currentStateData.Children.Pages[direction] != undefined) ) {
            smugdata.currentState = 'getfolder' + direction;
            document.dispatchEvent(smugdata.statechangeevent);
         }
         else if ( (smugdata.currentStateData.Type = "AlbumImages") && (smugdata.currentStateData.AlbumImages.Pages[direction] != undefined) ) {
            smugdata.currentState = 'getalbum' + direction;
            document.dispatchEvent(smugdata.statechangeevent);
         }
         else {
	         /* don't do anything */
            smugdata.debugLog("[smugdata.getMoreData] No " + direction);
         }
      }
   },
   adjustURL : function(stUrl) {
       if (smugdata.bProxy) {
         /* get host from url */
         var url = new URL(stUrl);
         for (var i = 0; i < smugdata.proxyList.length; i++) {
            if (url.hostname == smugdata.proxyList[i].hostname) {
               var newurl = smugdata.proxyList[i].protocol + "//" + smugdata.proxyList[i].proxyhost + smugdata.proxyList[i].pathname + url.pathname;
               //smugdata.debugLog("[adjustURL] Old Url: " + stUrl);
               //smugdata.debugLog("[adjustURL] New Url: " + newurl + "\n");
               return(newurl);
            }
         }
       }
       return stUrl;  /* if proxy is disabled or no match just return unmodified url */
   }
}
