var smugdata = {

	/******************************************************
	Time to create a seperate module to fetch and "deal" with retrieval of data
	from the SmugMug APIs.

	smugdata is a first step.  Eventually I would like to create a generic data structure
	that is used by the view layer, so most likely would be a seperate filter module
	that would call smugdata module to get the raw Smugmug data

	*******************************************************/


	/******* _expand option ******

	   Using the _expand option when calling SmugMug APIs to get a node or albums children
	   should speed up the application a lot.  The _expand option allows us to retrieve all of the
	   node's children along with their highlight image object, and the image sizes (i.e. urls) in
	   one call.  Without _expand we have to have make one call to get the list of children and then
	   2 calls per child to get the highlight image and image sizes.

	   When using the _expand option in SmugMug Apis the "expanded" result is put into an
	   Expanded Object with each member name the Uris to the expanded API

	*/
  bExpandImage : true,
  bRefresh : false,

  nodeExpand : "&_expand=HighlightImage.ImageSizes",
  childrenExpand : "&_expand=HighlightImage.ImageSizes",
  imagesExpand : "&_expand=ImageSizes",
  bFilterApi : true,

  childrenFilter : {
	  filter: ["IsVideo","IsRoot","Name","Type","UrlPath"],
	  filteruri: ["ChildNodes","HighlightImage","Album"],
	  expand:{
		  HighlightImage:{
			  filter:["OriginalWidth","OriginalHeight"],
			  filteruri:["ImageSizes"],
			  expand:{
			    ImageSizes:{
				    filter:["SmallImageUrl","LargestImageUrl"],
				    filteruri:[]
			    }
			  }
		  }
	  }
  },
  //childrenFilterEncodedStr : "&_config=" + encodeURI(JSON.stringify(smugdata.childrenFilter).replace(/\s/g,'')),
  childrenFilterEncodedStr : "",
  imagesFilter : {
	  filter: ["Date","Format","IsVideo","FileName","OriginalWidth","OriginalHeight","Title","UrlPath"],
	  filteruri: ["ImageSizes","LargestVideo"],
     expand: {
        ImageSizes: {
           filter: ["SmallImageUrl","LargestVideo","X2LargeImageUrl","LargestImageUrl"],
           filteruri:[]
        }
     }
  },
  imagesFilterEncodedStr : "",
  imageSizesFilter: {
 		     filter:["SmallImageUrl","MediumImageUrl","LargeImageUrl","XLargeImageUrl","X2LargeImageUrl","X3LargeImageUrl","X4LargeImageUrl","LargestImageUrl"],
           /* important to keep this filteruri list in order smallest to largest, it is used in the search for an image size that best fits the content area */
		     filteruri:["ImageSizeSmall","ImageSizeMedium","ImageSizeLarge","ImageSizeXLarge","ImageSizeX2Large","ImageSizeX3Large","ImageSizeX4Large","LargestImage"],
           expand: {
             ImageSizeSmall: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeMedium: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeLarge: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeXLarge: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeX2Large: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeX3Large: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             ImageSizeX4Large: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
             LargestImage: {
                filter: ["Ext","Width","Height","Size","Usable","Url"],
                filteruri: []
             },
          }
       },
  imageSizesFilterEncodedStr : "",

   albumFilter : {
	  filter: ["ImageCount","Title","UrlPath","Name"],
	  filteruri: ["HighlightImage","AlbumImages"]
  },
  //albumFilterEncodedStr : "&_config=" + encodeURI(JSON.stringify(smugdata.albumFilter).replace(/\s/g,'')),
  albumFilterEncodedStr : "",
  itemCount : "?count=",
  apiVerbosity : "&_verbosity=1",
  smugmugProtocol : "https:",
  smug_api : "\//86w9cd1n98.execute-api.us-east-1.amazonaws.com/smugmug/",
  debugLog : function(msg) { console.log(msg); },
  displayData : undefined,
  statechangeevent : undefined,
  currentState : 'init',
  currentStateData : undefined,
  currentUser : undefined,
  pageSize : 30,
  displaySize : {
     Width : 1280,
     Height : 720
  },

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
  init : function(displayDataCB, username, options) {

     if (displayDataCB === undefined) {
        smugdata.debugLog("[smugdata.init] Error display data callback is undefined");
        return false;
     }
     else {
        smugdata.displayDataCB = displayDataCB;
     }
     if (username === undefined) {
        smugdata.debugLog("[smugdata.init] Error display data callback is undefined");
        return false;
     }
     else {
        smugdata.username = username;
     }

     if (options !== undefined) {
        for (opt in options) {
           smugdata[opt] = options[opt];
        }
     }

     smugdata.childrenFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.childrenFilter).replace(/\s/g,''));
     smugdata.imagesFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.imagesFilter).replace(/\s/g,''));
     smugdata.imageSizesFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.imageSizesFilter).replace(/\s/g,''));
     smugdata.albumFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(smugdata.albumFilter).replace(/\s/g,''));
     smugdata.smugmugapi = smugdata.smugmugProtocol + smugdata.smug_api + smugdata.itemCount + smugdata.pageSize + smugdata.apiVerbosity + "&api=";

     if (smugdata.statechangeevent === undefined) {
        smugdata.statechangeevent = new Event('statechange');
        document.addEventListener('statechange',smugdata.stateChange);
     }
     document.dispatchEvent(smugdata.statechangeevent);

     return true;
  },
  stateChange : function (event) {
     /* something is not right here.
          probably has something to do with how I am creating smugdata...
             - there is only one instance
     */
     smugdata.debugLog("stateChange: " + smugdata.currentState);
     switch (smugdata.currentState) {
        case 'init':
           //getAuthUserInfo();
           /* Init could be used a hard "reset" if memory needed to be released
               - All data fetched from Smugmug is stored under the currentUser object
               - currentStateData acts as a pointer to the current location in the content tree
               - as more folders and albums are visited more data will accumulate in this tree
               - if memory was needed resetting to init would orphan this data and the GC would remove it
               - the impact to the user would be minimal, all data would need to be re-feteched from smugmug
           */
           smugdata.currentUser = new Object();
           smugdata.getUserContent(smugdata.smugmugapi + "user/"+smugdata.username,smugdata.currentUser,'getnodedata','unauthorized');
        break;

        /* future
        case 'unauthorized':
           smugdata.authorizeUser();
        break;

        case 'submitAuthCode':
           smugdata.submitCode();
        break;
        */

        case 'getnodedata':  /* is this only for the Node of the root? */
           if (smugdata.bRefresh || smugdata.currentUser.Node == undefined) {
              smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentUser.User.Uris.Node + smugdata.nodeExpand,smugdata.currentUser,'getnodechildren','init');
           }
  			  else {
              /* Already have the data, so no fetch, need to update the displayData */
  			     smugdata.currentState = 'displaycontent';
  			     smugdata.currentStateData = smugdata.currentUser.Node;
  			     smugdata.updateDisplayData(smugdata.currentStateData);
  			  }
  		  break;

        case 'getnodechildren': /* is this only for the Node of the root? */
           smugdata.currentStateData = smugdata.currentUser.Node;
           if (smugdata.bRefresh || smugdata.currentUser.Node.Children == undefined) {
              smugdata.currentUser.Node.Children = new Object();
              smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentUser.Node.Uris.ChildNodes + smugdata.childrenFilterEncodedStr,smugdata.currentUser.Node.Children,'displaycontent','init');
           }
           else {
              smugdata.currentState = 'displaycontent';
              smugdata.updateDisplayData(smugdata.currentStateData);
           }
        break;

        case 'getchildren':
           if (smugdata.bRefresh || smugdata.currentStateData.Children == undefined) {
              smugdata.currentStateData.Children = new Object();
              smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Uris.ChildNodes + smugdata.childrenFilterEncodedStr,smugdata.currentStateData.Children,'displaycontent','init');
           }
           else {
              smugdata.currentState = 'displaycontent';
              //document.dispatchEvent(smugdata.statechangeevent);  can't do this here, because we are already in the event handler.  What is the "right" way to do this?
              smugdata.updateDisplayData(smugdata.currentStateData);
           }
  		  break;

        case 'getalbumdata':
           if (smugdata.bRefresh || smugdata.currentStateData.Album == undefined) {
              smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Uris.Album + smugdata.albumFilterEncodedStr,smugdata.currentStateData,'getalbumimages','init');
           }
           else {
              smugdata.currentState = 'displaycontent';
              smugdata.currentStateData.Album.Parent = smugdata.currentStateData.Parent;
              smugdata.currentStateData = smugdata.currentStateData.Album;
              smugdata.updateDisplayData(smugdata.currentStateData);
           }
         break;

         case 'getalbumimages':
            if (smugdata.currentStateData.Type == 'Album') {
               smugdata.currentStateData.Album.Parent = smugdata.currentStateData.Parent;
               smugdata.currentStateData = smugdata.currentStateData.Album;
            }

            if (smugdata.bRefresh || smugdata.currentStateData.AlbumImages == undefined) {
               smugdata.currentStateData.AlbumImages = new Object();
               smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Uris.AlbumImages + smugdata.imagesFilterEncodedStr,smugdata.currentStateData.AlbumImages,'displaycontent','init');
            }
            else {
               smugdata.currentState = 'displaycontent';
               smugdata.updateDisplayData(smugdata.currentStateData);
            }
         break;

         case 'getimageurl':
  			   smugdata.currentStateData.imagesizes = new Object();
  			   smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Uris.ImageSizes.replace(/\?/g, "&") + smugdata.imageSizesFilterEncodedStr,smugdata.currentStateData.imagesizes,'displaycontent','init');
         break;

         case 'getvideourl':
            smugdata.currentStateData.largestvideo = new Object();
            smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Uris.LargestVideo.replace(/\?/g, "&"),smugdata.currentStateData.largestvideo,'displaycontent','init');
         break;

         case 'displaycontent':
            smugdata.updateDisplayData(smugdata.currentStateData);
         break;

         case 'getfolderNextPage':
            smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Children.Pages.NextPage.replace(/\?/g, "&") + smugdata.childrenFilterEncodedStr,smugdata.currentStateData.Children,'displaycontent','init');
         break;

         case 'getfolderPrevPage':
            smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.Children.Pages.PrevPage.replace(/\?/g, "&") + smugdata.childrenFilterEncodedStr,smugdata.currentStateData.Children,'displaycontent','init');
         break;

         case 'getalbumNextPage':
  	        /* Current paging model uses smugmug paging, so when the user moves to a new page or previous page
  	           I have to retrieve the data from Smugmug.  Not ideal.
  	             ToDo:  Implement separate data paging and screen paging
  	        */
            smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.AlbumImages.Pages.NextPage.replace(/\?/g, "&") + smugdata.imagesFilterEncodedStr,smugdata.currentStateData.AlbumImages,'displaycontent','init');
         break;

         case 'getalbumPrevPage':
            smugdata.getUserContent(smugdata.smugmugapi + smugdata.currentStateData.AlbumImages.Pages.PrevPage.replace(/\?/g, "&") + smugdata.imagesFilterEncodedStr,smugdata.currentStateData.AlbumImages,'displaycontent','init');
         break;
  	  }
  },
  updateDisplayData: function(Node) {
        var displayData = new Object();

        /* Node.Type only exists for folders, and Album nodes (which are called Albums), but not
           for Albums, which is the actual container for AlbumImages */
        if (Node.Type == undefined && Node.AlbumImages != undefined) {
            Node.Type = "AlbumImages";
        }
        else if (Node.Type == undefined && Node.Format != undefined) {
           Node.Type = "Media";  // not sure I like assuming media
        }

        if (Node.Type != "Media") {
           var offset = 0;
           displayData.username = smugdata.currentUser.User.Name;
           displayData.path = Node.UrlPath;  /* ??? */
           displayData.children = [];
           if (Node.IsRoot) {
              displayData.parent = null;
           }
           else {
              displayData.parent = Node.Parent;
              /* create link to parent container */
              offset = 1;
              displayData.children[0] = new Object();
              displayData.children[0].name = "Parent Directory...";
              displayData.children[0].type = Node.Parent.Type;
              displayData.children[0].action = smugdata.nodeAction;
              displayData.children[0].node = Node.Parent;
              /* In this section I am getting the image for the parent node which means that it will
                not be in the object pointed to by the expansion variable, that is the expansions (i.e. images) for the
                current node.  So I have to go and find the parent's node expansions which is in
                the data for the children of the parent's parent
              */
              var pimage;
              if ( Node.Parent != undefined && Node.Parent.IsRoot != undefined) {
                 if (!Node.Parent.IsRoot) {
                    displayData.children[0].parent = Node.Parent.Parent;
                    pimage = Node.Parent.Parent.Children.Expansions[Node.Parent.Uris.HighlightImage].Image;
                 }
                 else {
                    pimage = smugdata.currentUser.Expansions[Node.Parent.Uris.HighlightImage].Image;
                 }
              }
              if (pimage != undefined) {
                 if (!Node.Parent.IsRoot) {
                    displayData.children[0].thumbUrl = smugdata.adjustURL(Node.Parent.Parent.Children.Expansions[pimage.Uris.ImageSizes].ImageSizes.SmallImageUrl);
                 }
                 else {
                    displayData.children[0].thumbUrl = smugdata.adjustURL(smugdata.currentUser.Expansions[pimage.Uris.ImageSizes].ImageSizes.SmallImageUrl);
                 }
              }
           }
        }

        switch (Node.Type) {
           case "Folder" :
              displayData.type = "container";
              if (Node.Children && Node.Children.Pages) {
                 if (Node.Children.Pages.PrevPage !== undefined) {
                    displayData.previous = smugdata.getMoreData;
                 }
                 if (Node.Children.Pages.NextPage !== undefined) {
                    displayData.more = smugdata.getMoreData;
                 }
              }
              if (Node.Children && Node.Children.Node) {  /* could be an empty container */
                 Node.Children.Node.forEach(function (child,i) {
                    displayData.children[i+offset] = new Object();
                    displayData.children[i+offset].name = child.Name;
                    displayData.children[i+offset].type = ((child.Type == "Folder" || child.Type == "Album") ? "container" : child.Type);
                    displayData.children[i+offset].action = smugdata.nodeAction;
                    displayData.children[i+offset].node = child;
                    displayData.children[i+offset].parent = Node;
                    var image = Node.Children.Expansions[child.Uris.HighlightImage].Image
                    if (image != undefined) {  // it is possible for an empty folder or album to exist that would not have a highlight image
                       if (Node.Children.Expansions[image.Uris.ImageSizes].ImageSizes.SmallImageUrl != undefined) {
                          displayData.children[i+offset].thumbUrl = smugdata.adjustURL(Node.Children.Expansions[image.Uris.ImageSizes].ImageSizes.SmallImageUrl);
                       }
                       else {
                          /* if the original image is smaller than SmallImageUrl, SmallImageUrl will not exist
                             - I think that LargestImageUrl is always defined
                          */
                          displayData.children[i+offset].thumbUrl = smugdata.adjustURL(Node.Children.Expansions[image.Uris.ImageSizes].ImageSizes.LargestImageUrl);
                       }
                    }
                 });
              }
           break;

           case "AlbumImages" :
             displayData.type = "container";
             if (Node.AlbumImages && Node.AlbumImages.Pages) {
                if (Node.AlbumImages.Pages.PrevPage !== undefined) {
                   displayData.previous = smugdata.getMoreData;
                }
                if (Node.AlbumImages.Pages.NextPage !== undefined) {
                   displayData.more = smugdata.getMoreData;
                }
             }
             if (Node.AlbumImages && Node.AlbumImages.AlbumImage) {  /* could be an empty container */
                 Node.AlbumImages.AlbumImage.forEach(function (child,i) {
                    displayData.children[i+offset] = new Object();
                    displayData.children[i+offset].name = child.FileName;
                    displayData.children[i+offset].type = child.Format;
                    /*  How do I center the Name???
                       displayData.children[i].style
                    */
                    displayData.children[i+offset].action = smugdata.nodeAction;  /* really not sure about smugdata */
                    displayData.children[i+offset].node = child;
                    displayData.children[i+offset].parent = Node;
                    if (Node.AlbumImages.Expansions[child.Uris.ImageSizes].ImageSizes.SmallImageUrl != undefined) {
                       displayData.children[i+offset].thumbUrl = smugdata.adjustURL(Node.AlbumImages.Expansions[child.Uris.ImageSizes].ImageSizes.SmallImageUrl);
                    }
                    else {
                       /* if the original image is smaller than SmallImageUrl, SmallImageUrl will not exist
                          - I think that LargestImageUrl is always defined
                       */
                       displayData.children[i+offset].thumbUrl = smugdata.adjustURL(Node.AlbumImages.Expansions[child.Uris.ImageSizes].ImageSizes.LargestImageUrl);
                    }
                 });
             }
           break;

           case 'Media' :
              displayData.type = 'Media';
              displayData.username = smugdata.currentUser.User.Name;
              displayData.format = Node.Format;
              displayData.parent = Node.Parent;  // Need to parent to get back to the container
              displayData.node = Node.Parent;  // this gets us back on a nodeAction
              displayData.filename = Node.FileName;
              displayData.path = Node.FileName;
              displayData.title = Node.Title;
              displayData.action = smugdata.nodeAction;
              if (Node.IsVideo) {
                    displayData.url = smugdata.adjustURL(Node.largestvideo.LargestVideo.Url);
                    displayData.width = Node.OriginalWidth;
                    displayData.height = Node.OriginalHeight;
              }
              else {
                    /* Smugmug provides multiple image sizes we want to user the largest available image
                       that fits on the display.
                         - The Largest Image is probably too large and a waste of memory.
                         - Since this is supposed to be the data module, I don't like having to worry about
                           display size.
                         - I could provide the desired view size when initialzing this module, but what
                           is the size changes?  Probably won't happen on a TV, but could on laptop.

                    */
                    //displayData.url = smugdata.adjustURL(Node.imagesizes.ImageSizes.LargestImageUrl);
                    displayData.url = smugdata.adjustURL(smugdata.findImageSize(Node.OriginalWidth,Node.OriginalHeight,Node.imagesizes,smugdata.displaySize));
                    displayData.width = Node.OriginalWidth;
                    displayData.height = Node.OriginalHeight;
              }
           break;

           default:
               /* not sure what do to.  Should I use smugdata for displaying content?? */
               smugdata.debugLog("Unknown type: " + Node.Type);
           break;
        }

        smugdata.displayDataCB(displayData);
  },
  findImageSize : function(OriginalWidth, OriginalHeight, imageSizes, displaySize) {
     /* Find the url to the image that best matches the display size
        - determine the image direction i.e. landscape or portrait based on
          which is greater width or height.
        - compare each image longer side with the display width or height do this,
          in order from smallest to largest stop when you find an image
          that is larger than the display or you run our of images
        - to make sure I am comparing the image size in the correct order, I will
          use smugdata.imageSizesFilter.filteruri to determine the order to compare
     */
     var dim;
     if (displaySize && imageSizes && imageSizes.Expansions) {
        if (OriginalWidth >= OriginalHeight) {
           dim = "Width";
        }
        else {
           dim = "Height";
        }
        /* would like to use find, but might not be supported on TV */
        for (var i = 0; i < smugdata.imageSizesFilter.filteruri.length; i++) {
           var imgsize = smugdata.imageSizesFilter.filteruri[i];
           var uri = imageSizes.ImageSizes.Uris[imgsize];
           if ((imageSizes.Expansions[uri] && imageSizes.Expansions[uri][imgsize]) &&
               (imageSizes.Expansions[uri][imgsize][dim] > displaySize[dim])) {
              return imageSizes.Expansions[uri][imgsize].Url;
           }
        }
      }
      /* default, assume there is always a largest image */
      return imageSizes.Expansions[imageSizes.ImageSizes.Uris.LargestImage].LargestImage.Url;
  },
  getUserContent: function(smApi, destObj, state, errorstate) {

    /*
         for future use:
	        By default, fetch won't send or receive any cookies from the server,
	        resulting in unauthenticated requests if the site relies on maintaining
           a user session (to send cookies, the credentials init option must be set).
    */

     if (smApi) {
        fetch(smApi).then(function(response) {
           //smugdata.debugLog("getUserContent: response status = " + response.status + ":" + response.statusText);
	        //smugdata.debugLog("getUserContent: response text = " + response.responseText);
           if (response.ok) {
              return(response.json());
           }
           throw new Error(response.status)
        }).then(function(respjson) {
           //respobj = JSON.parse(respjson);

           for (var member in respjson.Response) {
              destObj[member] = respjson.Response[member];
           }

           if (respjson.Expansions != undefined) {
              destObj.Expansions = respjson.Expansions;
           }

           smugdata.currentState = state;
           document.dispatchEvent(smugdata.statechangeevent);
        }).catch(function(error) {
           if (error == 401) {
              smugdata.debugLog("Not Authorized for SmugMug");
              smugdata.currentState = 'unauthorized';
              document.dispatchEvent(smugdata.statechangeevent);
           }
           else {
              /* Error from SmugMug */
              smugdata.debugLog("Error connecting to " + smApi + " status: " + error);
              smugdata.currentState = errorstate;
              document.dispatchEvent(smugdata.statechangeevent);
           }
        });
     }
     else {
        smugdata.debugLog("Error: smApi or destObj not defined");
        smugdata.currentState = errorstate;
     }
  },
  getContent: function(targetnode) {

    /*
         New way to fetching content.  This is needed so that that display can fetch an
         album of background images and get everything it needs (i.e. all urls) to randomly display
         different images.

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
     if (targetnode) {
        var node = new Object();
        if (targetnode.Type == 'Album') {
           /* getalbumdata
              what if node.Album already exists?  */
           fetch(smugdata.smugmugapi + targetnode.Uris.Album + smugdata.albumFilterEncodedStr).then(function(response) {
              //smugdata.debugLog("getUserContent: response status = " + response.status + ":" + response.statusText);
	           //smugdata.debugLog("getUserContent: response text = " + response.responseText);
              if (response.ok) {
                 return(response.json());
              }
              throw new Error(response.status)
           }).then(function(respjson) {
              for (var member in respjson.Response) {
                 node[member] = respjson.Response[member];
              }

              if (respjson.Expansions != undefined) {
                 node.Expansions = respjson.Expansions;
              }

              /* getalbumimages
                  Figured out that using expansions correctly I can get all of the image
                  urls when get the albumimages.  I need to change this everywhere, reduces
                  the number of api calls and simplies the states.

                  For now use it to get everything for this node.

                  Not sure what is going to happen if I store this in the node...
                    - don't store in node for now, use a temporary object

                  ToDo: enlarge count for this call, or make it a parameter

              */
              node.Album.Parent = node.Parent;
              node.Album.AlbumImages = new Object();
              fetch(smugdata.smugmugapi + node.Album.Uris.AlbumImages + "&_expand=ImageSizeDetails").then(function(response) {
                 if (response.ok) {
                    return(response.json());
                 }
                 throw new Error(response.status)
              }).then(function(images) {
                 for (var member in images.Response) {
                    node.Album.AlbumImages[member] = images.Response[member];
                 }
                 if (images.Expansions != undefined) {
                    node.Album.AlbumImages.Expansions = images.Expansions;

                    /* Now I have all the Image Urls and image details for all AlbumImages...*/
                    var returnData = new Object();
                    returnData.name = node.Album.Name;
                    returnData.path = node.Album.UrlPath;
                    returnData.imagecount = node.Album.ImageCount;
                    returnData.children = [];
                    node.Album.AlbumImages.AlbumImage.forEach(function (child,i) {
                       returnData.children[i] = new Object();
                       returnData.children[i].name = child.FileName;
                       returnData.children[i].type = child.Format;
                       returnData.children[i].action = smugdata.nodeAction;
                       returnData.children[i].node = child;
                       returnData.children[i].parent = node;
                       /* what if SmallImage does not exist? */
                       //returnData.children[i].thumbUrl = smugdata.adjustURL(node.Album.AlbumImages.Expansions[child.Uris.ImageSizes.Uri].ImageSizes.SmallImageUrl);

                       /* I want to return all of the image sizes and image size details, but remove the smugmug specific
                          size descriptions, i.e. Small, Medium, Large, etc.  */
                       returnData.children[i].imagesizes = [];
                       var sizes = node.Album.AlbumImages.Expansions[child.Uris.ImageSizeDetails].ImageSizeDetails;
                       sizes.UsableSizes.forEach(function(size,index) {
                          returnData.children[i].imagesizes[index] = sizes[size];
                          returnData.children[i].imagesizes[index].Url = smugdata.adjustURL(returnData.children[i].imagesizes[index].Url);
                       });
                    });
                    resolve(returnData);
                 }
                 else {
                    /* if not expansions, then something went wrong */
                    smugdata.debugLog("Error: No Expansions");
                    reject("Error: No Expansions");
                 }
             });
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
           smugdata.debugLog("Not Album");
           reject("Not Album");
        }
     }
     else {
        smugdata.debugLog("Error: targetnode not defined");
        reject("Error: targetnode not defined")
     }}));
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
