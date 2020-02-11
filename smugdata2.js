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
  getContent: function(node, pageSize, start) {
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
           if (node.Type === 'Album') {
              if (node.Album === undefined || node.Start !== start) {
                 smugdata.albumExpand.expand.AlbumImages.args.count = pageSize;
                 smugdata.albumExpand.expand.AlbumImages.args.start = start;
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
                       node.Start = node.Expansions[node.Album.Album.Uris.AlbumImages.Uri].Pages.Start;
                    }

                    var rd = smugdata.generateReturnData(node);
                    if (rd.status) {
                       resolve(rd.data);
                    } else {
                       reject(rd.data);
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
              } else {
                 /* node.Album is defined so we don't refetch the data
                  - this is how we cache
                  - with a large image repository we could endup using a lot of memory
                  - need a method to delete nodes if memory is needed
                 */
                 var rd = smugdata.generateReturnData(node);
                 if (rd.status) {
                    resolve(rd.data);
                 } else {
                    reject(rd.data);
                 }
              }
           }
           else if (node.Type === 'Folder') {
              if (node.Children === undefined || node.Start !== start) {
                 var childrenencodedStr = "&count=" + pageSize + "&start=" + start + "&_config=" + encodeURI(JSON.stringify(smugdata.childrenExpand));
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
                       node.Start = respjson.Response.Pages.Start;
                    }
                    if (respjson.Expansions != undefined) {
                       node.Expansions = respjson.Expansions;
                    }
                    /* Now I have all the folder details and highlight images and sizes...*/
                    var rd = smugdata.generateReturnData(node);
                    if (rd.status) {
                       resolve(rd.data);
                    } else {
                       reject(rd.data);
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
              } else {
                 /* node.children is defined so we don't refetch the data
                  - this is how we cache
                  - with a large image repository we could endup using a lot of memory
                  - need a method to delete nodes if memory is needed
                 */
                 var rd = smugdata.generateReturnData(node);
                 if (rd.status) {
                    resolve(rd.data);
                 } else {
                    reject(rd.data);
                 }
              }
           } else {
               smugdata.debugLog("Unknown Type: " + node.Type);
               reject("Unknown Type: " + node.Type);
           }
        } else {
           smugdata.debugLog("Error: node not defined");
           reject("Error: node not defined")
        }
     }));
  },
  generateReturnData : function(node) {
     if (node) {
        var returnData = new Object();
        if (node.Type == 'Album') {
           returnData.name = node.Album.Album.Name;
           returnData.path = node.Album.Album.UrlPath;
           returnData.type = "Container";
           returnData.count = node.Count;
           returnData.start = node.Start;
           returnData.node = node;
           returnData.parent = node.Parent;
           returnData.children = [];

           if (node.Expansions != undefined) {
              //node.Album.Album.Uris.AlbumImages.Uri   // this gives me the expansion key for AlbumImages
              node.Expansions[node.Album.Album.Uris.AlbumImages.Uri].AlbumImage.forEach(function(child,i) {
                 child.Parent = node;
                 returnData.children[i] = new Object();
                 returnData.children[i].name = child.FileName;
                 returnData.children[i].type = child.Type = "Media"; // not sure this will work
                 returnData.children[i].format = child.Format;
                 returnData.children[i].node = child;
                 returnData.children[i].parent = returnData;  // not sure I need this?
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
                 var vindex = 0;
                 sizes.UsableSizes.forEach(function(size) {
                    if (size.includes("ImageSize")) {  //ES6
                       returnData.children[i].imagesizes[index] = sizes[size];
                       returnData.children[i].imagesizes[index].Url = smugdata.adjustURL(returnData.children[i].imagesizes[index].Url);
                       index++;
                    } else if (size.includes("VideoSize")) {
                       returnData.children[i].videosizes[vindex] = sizes[size];
                       returnData.children[i].videosizes[vindex].Url = smugdata.adjustURL(returnData.children[i].videosizes[vindex].Url);
                       vindex++;
                    }
                 });

                 /* make sure sizes arrays are sorted smallest to largest */
                 smugdata.sortSizes(returnData.children[i].imagesizes);
                 smugdata.sortSizes(returnData.children[i].videosizes);
              });
              return({status: true, data: returnData});
           }
           else {
              // if no expansions, then something went wrong
              smugdata.debugLog("Error: No Expansions");
              return({status: false, data: "Error: No Expansions"});
           }
        }
        else if (node.Type === 'Folder') {
           returnData.name = node.Name;
           returnData.path = node.UrlPath;
           returnData.type = "Container";
           returnData.count = node.Count;
           returnData.start = node.Start;
           returnData.node = node;
           returnData.parent = node.Parent;  // fix this shit
           returnData.children = [];

           if (node.Children != undefined && node.Expansions != undefined) {
              node.Children.forEach(function(child,i) {
                 child.Parent = node;
                 returnData.children[i] = new Object();
                 returnData.children[i].name = child.Name;
                 returnData.children[i].type = "Container";  //Folder can only contain Folders and Albums
                 returnData.children[i].node = child;
                 returnData.children[i].parent = returnData; // not sure I need this?
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
                 smugdata.sortSizes(returnData.children[i].imagesizes);
              });
              return({status: true, data: returnData});
           }
           else {
              // if no expansions, then something went wrong
              smugdata.debugLog("Error: No Expansions");
              return({status: false, data: "Error: No Expansions"});
           }
        }
        else {
           smugdata.debugLog("Unknown Type: " + node.Type);
           return({status: false, data: "Unknown Type: " + node.Type});
        }
     } else {
        smugdata.debugLog("Error: Node not defined");
        return({status: false, data: "Error: Node not defined"});
     }
  },
  sortSizes : function(sizes) {
     sizes.sort(function(s1,s2) {
        if (s1.Width > s2.Width) {
           return 1;
        } else if (s1.Width < s2.Width) {
           return -1;
        } else {
           return 0;
        }
     });
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
