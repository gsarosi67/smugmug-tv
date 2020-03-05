
/**********************
 *  This should not be that hard...
 *   1. Start App
 *   2. Check login status, do I have a cookie with a valid oauth token?
 *      a. Do this by calling the authuser API, if we are not authorized it will redirect
 *         to the authorize script.  I don't think I want this auto redirect.  It would be
 *         better just to return an unauthorized and let the client app call authorize.
 *   3. If not logged in, all Authorize, display URL and form for entering code.
 *   4. Once logged in, display folders, albums, etc.
 *      a.  Should we have the ability to browser a user public area?  I think Yes!
 *   5. Browsing should be similar to the dirlist app
 *
 *
 *  I need a state machine....
 *  States:
 		Init
 		wait for User info
 		have user info
 		unauthorized
 		authorized
 		waiting for data
 		have data
 		exit

 document.dispatchEvent
 datapostedevent = new Event('dataposted');



 */


/* Stop using global variables !!
 * How can I associate data with the event
 *  new CustomEvent('statechange', { detail: {type: blah, currentDir: blahblah } } );
 *
 * 	  Does CustomEvent work on the STB  (Qt or WPE)?
 *    Can I change the value of detail each time I dispatch the event if not, what are the
 *    impacts of creating a new event for every state change..seems bad

*/

var dbg;
var bDebug = 1;
var smUser;
var imageplayer = null;
var vid;
var containerid = 'filediv';
var gridid = 'grid';
var parentdirid = 'parentdir';
var headerid = 'header';
var topid = 'topinfo';
var bottomid = 'bottominfo';
var anchors = [];
var currentAnchor;
var tvScreen;
var topinfo;
var bottominfo;

var trickplay_incr = 10;  /* fast-forward and rewind jump length in seconds */

var statechangeevent = new Event('statechange');

var currentState;
var currentStateData;
var currentUser = new Object();
var userContent;

/*
    ToDo:
      - create dropdown list to select username
      - allow user to type in username (requires soft keyboard on X1)
      - store this list on the server, create API to get it and one to add new users (security??)
      - all users accounts must allow public access
*/
var userList = [
   'sarosi',
   'cmac',
   'accionfotos'
];
var username = userList[0];  /* set default user */

var thumbSizes= new Object();
var graphicsWidth = 1280;   //ToDo: make this more dynamic
var nonselectedColor = 'black';
var selectedColor = 'rgb(20,200,50)';

/* number of items in one row, calculated at the end of the rendering
    ToDo: when screen is resized, recalculate
*/
var ROWSIZE = 0;

/*  The max number of items to both fetch from Smugmug and to draw at one time. */
var PAGESIZE = 30;

var scrolldirection = 'next';
var anchordelta = 0;

/* Proxy Configuration
   Used for IPv6 to IPv4 proxy */

var bProxy = true;  //make this command line configurable
var proxyList  = [
   {
      hostname: "photos.smugmug.com",
      protocol: "https:",
      proxyhost: "dmsemxhxf1kba.cloudfront.net",
      pathname: ""
   }
];

/* ****** _expand option ******

   Using the _expand option when calling SmugMug APIs to get a node or albums children
   should speed up the application a lot.  The _expand option allows us to retrieve all of the
   node's children along with their highlight image object, and the image sizes (i.e. urls) in
   one call.  Without _expand we have to have make one call to get the list of children and then
   2 calls per child to get the highlight image and image sizes.

   When using the _expand option in SmugMug Apis the "expanded" result is put into an
   Expanded Object with each member name the Uris to the expanded API

*/
var bExpandImage = true;
var bRefresh = false;

var nodeExpand = "&_expand=HighlightImage.ImageSizes";
var childrenExpand = "&_expand=HighlightImage.ImageSizes";
var imagesExpand = "&_expand=ImageSizes";

var bFilterApi = true;

var childrenFilter = {
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
};
var childrenFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(childrenFilter).replace(/\s/g,''));

var imagesFilter = {
	 filter: ["Date","Format","IsVideo","FileName","OriginalWidth","OriginalHeight","Title","UrlPath"],
	 filteruri: ["ImageSizes","LargestVideo"],
	 expand:{
	     ImageSizes:{
		    filter:["SmallImageUrl","LargestVideo","X2LargeImageUrl","LargestImageUrl"],
		    filteruri:[]
	     }
	 }
};
var imagesFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(imagesFilter).replace(/\s/g,''));

/* ToDo: Should we expand and get the AlbumImages in one call? */
var albumFilter = {
	 filter: ["ImageCount","Title","UrlPath","Name"],
	 filteruri: ["HighlightImage","AlbumImages"],
};
var albumFilterEncodedStr = "&_config=" + encodeURI(JSON.stringify(albumFilter).replace(/\s/g,''));

var itemCount = "?count=" + PAGESIZE;
var apiVerbosity = "&_verbosity=1";
var smugmugProtocol = "https:";
var smug_api = "//86w9cd1n98.execute-api.us-east-1.amazonaws.com/smugmug/" + itemCount + apiVerbosity + "&api=";
var spinner;


function init() {
  window.onerror = function (msg, url, lineNo, columnNo, error) {
		var string = msg.toLowerCase();
		var substring = "script error";
		if (string.indexOf(substring) > -1){
			printDbgMessage('Script Error: See Browser Console for Detail');
		} else {
			var message = [
				'Message: ' + msg,
				'URL: ' + url,
				'Line: ' + lineNo,
				'Column: ' + columnNo,
				'Error object: ' + JSON.stringify(error)
			].join(' - ');

			printDbgMessage(message);
		}

		return false;
	};
    document.addEventListener('statechange',stateChange);

    processCommandline(document.URL);

    /* figure out the protocol.  If the inital page is http then we
       must call apis with http
    if (window.location && window.location.protocol) {
      smugmugProtocol = window.location.protocol;
    } */
    smugmugapi = smugmugProtocol + smug_api;

    gridContainer = document.getElementById(containerid);
    tvScreen = document.getElementById("tvscreen");
    topinfo = document.getElementById(topid);
    bottominfo = document.getElementById(bottomid);

    spinner = new Spinner({lines: 13, length: 30, width: 10, radius: 30, color: "#AAAAAA"});

    /* Preset the size of the thumbnail images */
    thumbSizes[graphicsWidth] = new Object();
    thumbSizes[graphicsWidth].landscape = new Object();
    thumbSizes[graphicsWidth].portrait = new Object();
    thumbSizes[graphicsWidth].landscape.width = 360;
    thumbSizes[graphicsWidth].landscape.height = 245;
    thumbSizes[graphicsWidth].portrait.width = 165;
    thumbSizes[graphicsWidth].portrait.height = 245;
    thumbSizes[graphicsWidth].portrait.offset = 97;

    document.addEventListener('keydown', KeyDown, false);

    createControls();

    //toggleDebug();  /* Turn debug on */

    currentState = 'init';
    document.dispatchEvent(statechangeevent);

}

function createControls()
{
	  var body = document.getElementById("body");

	/*
	  var tempBut = document.createElement("button");
	  body.appendChild(tempBut);
	  tempBut.className = "listbutt";
	  tempBut.setAttribute("id","listbutton");
	  tempBut.setAttribute("type","button");
	  tempBut.setAttribute("onclick","toggleFilegrid()");
	  tempBut.appendChild(document.createTextNode("List"));

	  var infoBut = document.createElement("button");
	  body.appendChild(infoBut);
	  infoBut.className = "infobutt";
	  infoBut.setAttribute("id","infoicon");
	  infoBut.setAttribute("type","button");
	  infoBut.setAttribute("onclick","toggleDebug()");

	  var imgBut = document.createElement("img");
	  infoBut.appendChild(imgBut);
	  imgBut.setAttribute("width","20");
	  imgBut.setAttribute("height","20");
	  imgBut.setAttribute("src","info-sm.png");
	*/

	  /* Create debug window - hidden to start */
	  var bugDiv = document.createElement("div");
	  body.appendChild(bugDiv);
	  bugDiv.className="debug";
	  bugDiv.setAttribute("id","debug");

}

function stateChange(event)
{
  spinner.spin(tvScreen); // lazy
	switch (currentState)
	{
		case 'init':
			//getAuthUserInfo();
			getUserContent(smugmugapi + "user/"+username,currentUser,'getnodedata','unauthorized');
		break;

		case 'unauthorized':
			authorizeUser();
		break;

		case 'submitAuthCode':
			submitCode();
		break;

		case 'getnodedata':

		    //currentStateData = currentUser;
		    if (bRefresh || currentUser.Node == undefined) {
		    	/* Set user in header */
				  var user = document.getElementById("user");
				  if (user) {
               var userlist = document.getElementById("userlist");
               if (!userlist) {
                  userlist = document.createElement("select");
                  userlist.setAttribute("id","userlist");
                  userlist.className = "userlist";
                  user.appendChild(userlist);

                  userList.forEach (function (uname) {
                     var opt = document.createElement("option");
                     opt.setAttribute("value",uname);

                     if ( (username == uname) && (currentUser.User.Name != undefined) ) {
                        /* Set the current selected username to the Display name */
                        opt.appendChild(document.createTextNode(currentUser.User.Name.toUpperCase()));
                     }
                     else {
                        opt.appendChild(document.createTextNode(uname.toUpperCase()));

                     }
                     userlist.appendChild(opt);
                  });
            	   /* Center Username */
                  if (currentUser.User.Name != undefined) {
                     var head = document.getElementById(headerid);
            	       var offset = ( (head.clientWidth - visualLength(currentUser.User.Name.toUpperCase(),'userlist')) / 2);
            	       user.style.paddingLeft = offset;
                     user.style.paddingRight = offset;
                  }
               }
				 }
             if (bExpandImage) {
                 getUserContent(smugmugapi + currentUser.User.Uris.Node + nodeExpand,currentUser,'getnodechildren','init');
             }
             else {
				     getUserContent(smugmugapi + currentUser.User.Uris.Node,currentUser,'getnodechildren','init');
             }
			}
			else {
			    currentState = 'displaycontent';
			    currentStateData = currentUser.Node;
			    displayContent(currentStateData);
			}
		break;

		case 'getnodechildren':
		    currentStateData = currentUser.Node;

			/* I do not want to refresh the data with Smugmug when moving through directories.  Smugmug data
			   changes very infrequently.
			    -ToDo: Add UI method to refresh data - worst case, restart app
			*/
		    if (bRefresh || currentUser.Node.Children == undefined)
		    {
				   currentUser.Node.Children = new Object();
				   if (bFilterApi)
				   {
					    getUserContent(smugmugapi + currentUser.Node.Uris.ChildNodes + childrenFilterEncodedStr,currentUser.Node.Children,'displaycontent','init');
				   }
				   else if (bExpandImage)
				   {
					    getUserContent(smugmugapi + currentUser.Node.Uris.ChildNodes + childrenExpand,currentUser.Node.Children,'displaycontent','init');
				   }
				   else
				   {
					    getUserContent(smugmugapi + currentUser.Node.Uris.ChildNodes,currentUser.Node.Children,'displaycontent','init');
				   }
			  }
			  else
			  {
				   currentState = 'displaycontent';
				   displayContent(currentStateData);
			  }
		break;


		case 'getchildren':
			/* I do not want to refresh the data with Smugmug when moving through directories.  Smugmug data
			   changes very infrequently.
			    -ToDo: Add UI method to refresh data - worst case, restart app
			*/
		    if (bRefresh || currentStateData.Children == undefined)
		    {
				  currentStateData.Children = new Object();

				  if (bFilterApi) {
					  getUserContent(smugmugapi + currentStateData.Uris.ChildNodes + childrenFilterEncodedStr,currentStateData.Children,'displaycontent','init');
				  }
				  else if (bExpandImage) {
					  getUserContent(smugmugapi + currentStateData.Uris.ChildNodes + childrenExpand,currentStateData.Children,'displaycontent','init');
				  }
				  else {
					  getUserContent(smugmugapi + currentStateData.Uris.ChildNodes,currentStateData.Children,'displaycontent','init');
				  }
			}
			else {
				currentState = 'displaycontent';
				displayContent(currentStateData);
			}
		break;

		case 'getalbumdata':
			//currentStateData.Album = new Object();
			/* I do not want to refresh the data with Smugmug when moving through directories.  Smugmug data
			   changes very infrequently.
			    -ToDo: Add UI method to refresh data - worst case, restart app
			*/
		    if (bRefresh || currentStateData.Album == undefined)
		    {
				if (bFilterApi)
				{
					getUserContent(smugmugapi + currentStateData.Uris.Album + albumFilterEncodedStr,currentStateData,'getalbumimages','init');
				}
				else
				{
					getUserContent(smugmugapi + currentStateData.Uris.Album,currentStateData,'getalbumimages','init');
				}
			}
			else
			{
			    currentState = 'displaycontent';
			    currentStateData.Album.Parent = currentStateData.Parent;
		      currentStateData = currentStateData.Album;
			    displayContent(currentStateData);
			}
		break;

		case 'getalbumimages':
		    /* this seems weird, but we want the Parent of the Album to be the containing Folder */
		    currentStateData.Album.Parent = currentStateData.Parent;
		    currentStateData = currentStateData.Album;

		    if (bRefresh || currentStateData.AlbumImages == undefined)
		    {
				   currentStateData.AlbumImages = new Object();

				   if (bFilterApi) {
					   getUserContent(smugmugapi + currentStateData.Uris.AlbumImages + imagesFilterEncodedStr,currentStateData.AlbumImages,'displaycontent','init');
				   }
				   else if (bExpandImage) {
					   getUserContent(smugmugapi + currentStateData.Uris.AlbumImages + imagesExpand,currentStateData.AlbumImages,'displaycontent','init');
				   }
				   else {
					   getUserContent(smugmugapi + currentStateData.Uris.AlbumImages,currentStateData.AlbumImages,'displaycontent','init');
				   }
			  }
			  else {
			     currentState = 'displaycontent';
			     displayContent(currentStateData);
			  }
		break;

		case 'getimageurl':
			currentStateData.imagesizes = new Object();
			getUserContent(smugmugapi + currentStateData.Uris.ImageSizes.replace(/\?/g, "&"),currentStateData.imagesizes,'playimage','init');
		break;

		case 'getvideourl':
			currentStateData.largestvideo = new Object();
			getUserContent(smugmugapi + currentStateData.Uris.LargestVideo.replace(/\?/g, "&"),currentStateData.largestvideo,'playvideo','init');
		break;

		case 'displaycontent':
			displayContent(currentStateData);
		break;

		case 'getfoldernextpage':
			if (bFilterApi)
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.NextPage.replace(/\?/g, "&") + childrenFilterEncodedStr,currentStateData.Children,'displaycontent','init');
			}
			else if (bExpandImage)
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.NextPage.replace(/\?/g, "&") + childrenFilterEncodedStr,currentStateData.Children,'displaycontent','init');
			}
			else
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.NextPage.replace(/\?/g, "&"),currentStateData.Children,'displaycontent','init');
			}
		break;

		case 'getfolderpreviouspage':
			if (bFilterApi)
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.PrevPage.replace(/\?/g, "&") + childrenFilterEncodedStr,currentStateData.Children,'displaycontent','init');
			}
			else if (bExpandImage)
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.PrevPage.replace(/\?/g, "&") + childrenExpand,currentStateData.Children,'displaycontent','init');
			}
			else
			{
				getUserContent(smugmugapi + currentStateData.Children.Pages.PrevPage.replace(/\?/g, "&"),currentStateData.Children,'displaycontent','init');
			}
		break;

		case 'getalbumnextpage':
	        /* Current paging model uses smugmug paging, so when the user moves to a new page or previous page
	           I have to retrieve the data from Smugmug.  Not ideal.
	             ToDo:  Implement separate data paging and screen paging
	        */
		  if (bFilterApi)
			{
				 getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.NextPage.replace(/\?/g, "&") + imagesFilterEncodedStr,currentStateData.AlbumImages,'displaycontent','init');
			}
			else if (bExpandImage)
			{
				 getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.NextPage.replace(/\?/g, "&") + imagesExpand,currentStateData.AlbumImages,'displaycontent','init');
			}
			else
			{
				 getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.NextPage.replace(/\?/g, "&"),currentStateData.AlbumImages,'displaycontent','init');
			}
		break;

		case 'getalbumpreviouspage':
			if (bFilterApi)
			{
				getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.PrevPage.replace(/\?/g, "&") + imagesFilterEncodedStr,currentStateData.AlbumImages,'displaycontent','init');
			}
			else if (bExpandImage)
			{
				getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.PrevPage.replace(/\?/g, "&") + imagesExpand,currentStateData.AlbumImages,'displaycontent','init');
			}
			else
			{
				getUserContent(smugmugapi + currentStateData.AlbumImages.Pages.PrevPage.replace(/\?/g, "&"),currentStateData.AlbumImages,'displaycontent','init');
			}
		break;

		case 'playimage':
		    /* should use the image size based of the current view size */
		    if (bExpandImage || bFilterApi)
		    {
		        if (currentStateData.imagesizes.ImageSizes.X2LargeImageUrl != undefined)
		        {
					  playimage(currentStateData.imagesizes.ImageSizes.X2LargeImageUrl,currentStateData.OriginalWidth,currentStateData.OriginalHeight);
				  }
				  else
				  {
		    		  /* if the original image is smaller than X2LargeImageUrl, X2LargeImageUrl will not exist
					     - I think that LargestImageUrl is always defined
					  */
					  playimage(currentStateData.imagesizes.ImageSizes.LargestImageUrl,currentStateData.OriginalWidth,currentStateData.OriginalHeight);
				  }
		    }
		    else
		    {
				playimage(currentStateData.imagesizes.ImageSizes.X2LargeImageUrl,currentStateData.OriginalWidth,currentStateData.OriginalHeight);
			}
		break;

		case 'playvideo':
			playvideo(currentStateData.largestvideo.LargestVideo.Url,currentStateData.OriginalWidth,currentStateData.OriginalHeight);
		break;
	}
}

function authorizeUser()
{
	var xmlhttp=new XMLHttpRequest();
	var smUrl = "authorize.php";

	xmlhttp.open( "GET", smUrl, true );

	xmlhttp.onreadystatechange = function ()
	{
		if ( xmlhttp.readyState == XMLHttpRequest.DONE)
		{
			if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
			{
				printDbgMessage("PostData: response status = " + xmlhttp.status);
				printDbgMessage("PostData: response text = " + xmlhttp.responseText);

				var authinfo = JSON.parse(xmlhttp.responseText);

				createAuthDialog(authinfo);
				currentState = 'authurldisplayed';
		        //document.dispatchEvent(statechangeevent);
		    }
		    else
		    {
				/* Error from SmugMug */
				printDbgMessage("Error connecting to " + smUrl + " status: " + xmlhttp.status);
				currentState = 'init'; /* I guess try again */
				document.dispatchEvent(statechangeevent);

		    }
		}
	}
	xmlhttp.send();
}

function createAuthDialog(authinfo)
{
		var authDiv = document.createElement("div");
		 tvScreen.appendChild(authDiv);
		 authDiv.setAttribute('id','authinfo');
		 authDiv.className = "authinfo";
		var authTextDiv1 = document.createElement("div");
		 authDiv.appendChild(authTextDiv1);
		 authTextDiv1.setAttribute('id','authtextdiv1');
		 authTextDiv1.className = "authtext";
		var authText1 = document.createTextNode("In a browser, navigate to the Smugmug Authorization link below, or use the QR code to navigate a mobile browser to the SmugMug Authorizaton link.");
		 authTextDiv1.appendChild(authText1);

		/* Create the anchor to the authorization url */
		var authAnchor = document.createElement("a");
		 authDiv.appendChild(authAnchor);
		 authAnchor.setAttribute("href",decodeURIComponent(authinfo.auth_url));

		var urlDiv = document.createElement("div");
		 authAnchor.appendChild(urlDiv);
		 urlDiv.setAttribute("id","urldiv");
		 urlDiv.className = "authurl";
		 urlDiv.appendChild(document.createTextNode(decodeURIComponent(authinfo.auth_url)));

		/* Create an image for the QR code */
	    var qrDiv = document.createElement("div");
		 authAnchor.appendChild(qrDiv);
		 qrDiv.setAttribute("id","qrdiv");
		 qrDiv.className = "qrcode";

		 var authQR = document.createElement("img");
		  qrDiv.appendChild(authQR);
		  authQR.setAttribute("src",authinfo.auth_url_qrcode);

		  /* Center qr code image */
		 qrDiv.style.paddingLeft = (authDiv.clientWidth - authinfo.auth_url_qrcode_width)/2;

		var authTextDiv2 = document.createElement("div");
		 authDiv.appendChild(authTextDiv2);
		 authTextDiv2.setAttribute('id','authtextdiv2');
		 authTextDiv2.className = "authtext";
		var authText2 = document.createTextNode("After logging into Smugmug and authorizing this application, return here to enter the Smugmug Authorization Code.");
		 authDiv.appendChild(authText2);


		/* Create text input for code */
		var authCodeDiv = document.createElement("div");
		 authDiv.appendChild(authCodeDiv);
		 authCodeDiv.setAttribute('id','authcodediv');
		 authCodeDiv.className = "authcode";

		var authCodelabel = document.createElement("label");
		 authCodeDiv.appendChild(authCodelabel);
		 authCodelabel.setAttribute("for","authcode");
		 authCodelabel.appendChild(document.createTextNode("Authorization Code:"));

		var authCode = document.createElement("input");
		 authCodeDiv.appendChild(authCode);
		 authCode.setAttribute("id","authcode");
		 authCode.setAttribute("type","text");
		 authCode.setAttribute("name","authcode");
		 authCode.setAttribute("autofocus","autofocus");

		/* Create submit button */
		var authButt = document.createElement("input");
		 authCodeDiv.appendChild(authButt);
		 authButt.setAttribute("id","authbutton");
		 authButt.setAttribute("type","button");
		 authButt.setAttribute("value","Submit");
		 authButt.setAttribute("onclick","submitCode()");

		/* Need to be able to navigate to the submit button after entering code

            the key handler uses the anchors array to navigate between items, so this should work
              - don't include the authorization link because if the user navigated to it on the STB, it would not work.
		*/
		spinner.stop();
		anchors = [authCode, authButt];
		currentAnchor = 0;

		showElement('authinfo');

}

function deleteAuthDialog()
{
	/* Should probably just delete the authinfo object and create it above

	var authDiv = document.getElementById('authinfo');
	hideElement('authinfo');

	for (var i = authDiv.childNodes.length-1; i >= 0; i--)
	{
	   authDiv.removeChild(authDiv.childNodes[i]);
	}
	*/
	var authDiv = document.getElementById('authinfo');
	tvScreen.removeChild(authDiv);

}

function submitCode()
{
	/*********************************
	 *  User Authentication

	 *  All access to SmugMug APIs should be done from the server...
	 *
	 *  1. Obtain a request token (server)
	 *  2. Show the authorization URL to the user (client)
	 *  3. The user goes to the authorization URL in a web browser and logs in to SmugMug
	 *  4. The user is presented with a request to authorize your app
	 *  5. If the user accepts, they will be given a six-digit verification code to enter into your app (client)
	 *  6. The user enters the verification code into your app (client)
	 *  7. Use the verification code to obtain an access token (client and server)
	 */
	 var smVerificationUrl = "authorize.php";

	 /* get code from input */
	 var codeInput = document.getElementById('authcode');

	 if (codeInput)
	 {
	 	var xmlhttp=new XMLHttpRequest();

	 	/* use post to provide verification code */
	 	xmlhttp.open( "POST", smVerificationUrl, true );
	    xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");

	 	xmlhttp.onreadystatechange = function ()
	 	{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
		  		if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
		  		{

            		printDbgMessage("PostData: response status = " + xmlhttp.status);
            		//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

            		smUser = JSON.parse(xmlhttp.responseText);

            		printDbgMessage("Username: " + smUser.username);

            		currentState = 'init';

        		}
			  	else
			  	{
					/* Error from SmugMug */
				    printDbgMessage("Error connecting to " + smVerificationUrl + " status: " + xmlhttp.status);

				    currentState = 'init'; /* I guess try again - ToDo: add error states */
			  	}
			  	deleteAuthDialog();
			  	document.dispatchEvent(statechangeevent);
      		}
		 };
		 xmlhttp.send("&oauth_verifier=" + codeInput.value);
	}
}


function getUserContent(smApi, destObj, state, errorstate)
{
	if (smApi)
	{
		var xmlhttp=new XMLHttpRequest();
		/*  Should really get the api from the user data
		 *    Folders /api/v2/folder/user/sarosi!folders
		 */
		//var smFolderUrl = "smugapi.php?api=folder/user/" + username + "!folders";

		xmlhttp.open( "GET", smApi, true );
		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("getUserContent: response status = " + xmlhttp.status);
					//printDbgMessage("getUserContent: response text = " + xmlhttp.responseText);

					var response = JSON.parse(xmlhttp.responseText);

					for (var member in response.Response)
	            {
						destObj[member] = response.Response[member];
					}

					if (response.Expansions != undefined)
					{
						destObj.Expansions = response.Expansions;
					}

					/* Don't set this here for every request, only set this explicitly
					   when there really is a parent */
					currentState = state;
					document.dispatchEvent(statechangeevent);
				}
				else if (xmlhttp.status == 401)
				{
					printDbgMessage("Not Authorized for SmugMug");
					currentState = 'unauthorized';
					document.dispatchEvent(statechangeevent);
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
					currentState = errorstate;
					document.dispatchEvent(statechangeevent);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or destObj not defined");
		currentState = errorstate;
	}
}


function nodeAction(parentid,parentnode,nodes,index)
{
    /* node could be an node that is a folder or an album
       or node could be an image or video that is not a node */
	var node;

	if (index == -1)
	{
		node = parentnode;

	}
	else
	{
	    node = nodes[index];
	    node.Parent = parentnode;
	}

    if (node.Type == undefined)
    {
    	/* not sure about this */
    	node.Type = 'AlbumImage';
    }

    /* not sure the right place to do this */
    scrolldirection = 'next';

	switch (node.Type)
	{
		case 'Album':
		   /* Sigh...Albums don't have children
		   		Node->Uris->Albums

		   		Album->AlbumImages
		   */

		   destroyGrid();
		   currentState = 'getalbumdata';
		   currentStateData = node;
		   document.dispatchEvent(statechangeevent);
		break;

		case 'Folder':
		   destroyGrid();
		   if (node.IsRoot)
		   {
		   	  currentState = 'getnodedata';
		   }
		   else
		   {
		   	  currentState = 'getchildren';
		   }
		   currentStateData = node;
		   document.dispatchEvent(statechangeevent);
		break;

		case 'AlbumImage':
		   /* Display the image or the video */
		   if (node.IsVideo)
		   {
		   	   currentState = 'getvideourl';
		   	   currentStateData = node;
		   	   document.dispatchEvent(statechangeevent);
		   }
		   else
		   {
		   	   /* Need to get the Url...  node.Uris.LargestImage
		   	      Do Not get the largest image... should get a custom size to match
		   	      window
		   	   */
		   	   currentState = 'getimageurl';
		   	   currentStateData = node;
		   	   document.dispatchEvent(statechangeevent);
		   }
		break;
	}
}

function destroyGrid()
{
	/* Destroy the Grid object
		**** Important ***
		For this version when navigating to a different folder or albums we are destroying all of the
		DOM objects for the currently displayed folder or album and creating new ones.
		 - ToDo:  Create a version that creates the DOM nodes once and changes the content, compare
		           the memory and performance impacts.

		Note:  how will current code handle going back to a folder or albums that the data has already
		       been fetched?  I think it will fetch again and simply replace.  This should be smarter...

		       ToDo: Make fetching smarter and add the ability to page content (i.e. only fetch a subset)

	 */
	hideFilegrid();
	var grid = document.getElementById(gridid);
	var parent = document.getElementById(containerid);
	if (parent && grid)
	{
		printDbgMessage("Removing grid");
		parent.removeChild(grid);
	}
	else
	{
		printDbgMessage("***ERROR*** grid not removed");
		if (!parent) ("***ERROR*** parent not valid");
		if (!grid) ("***ERROR*** grid not valid");
	}

	var path = document.getElementById("path");
	if (path != undefined)
	{
		/* remove the last child added */
		if (path.childNodes.length > 0)
		{
			path.removeChild(path.childNodes[path.childNodes.length-1]);
		}
	}

   var tmore = document.getElementById("topinfo");
   if (tmore != undefined) {
      if (tmore.childNodes.length > 0) {
         tmore.removeChild(tmore.childNodes[tmore.childNodes.length-1]);
      }
   }

   var bmore = document.getElementById("bottominfo");
   if (bmore != undefined) {
      if (bmore.childNodes.length > 0) {
         bmore.removeChild(bmore.childNodes[bmore.childNodes.length-1]);
      }
   }

}


function displayContent(node)
{
	var parent = document.getElementById(containerid);

	/* is this div really needed...I don't think so */
	var gridDiv = document.createElement("div");
	parent.appendChild(gridDiv);
	gridDiv.setAttribute("id",gridid);

	//gridDiv.className = "filegrid";

	/* Create entry for parent directory, unless we are in the basedir
	    - still needs work, something is not right..

	*/

	/* Need to figure out if node is one of the following:

	    - Root node: node.data.Node
	    		type at node.data.Node.Type
	    		isRoot at node.data.Node.IsRoot
	    	  	children at node.children.data.Node (array of Nodes)
	    	  	parent at node.parent (this should not have a parent)
	    - Folder node, not root:
	    		type at node.Type
	    		IsRoot at node.IsRoot
	    		children at node.children.data.Node (array of Nodes)
	    		if parent is root node then
	    		   parent at node.parent.data.Node
	    		else if parent is non root folder
	    		   parent at node.parent
	    - Album:
	    		type does not exist
	    		IsRoot does not exist
	    		children at node.albumimages.data.AlbumImage
	    		parent at node.parent.parent  (node.parent is the Album object, node.parent.parent is the folder containing the album)
	*/

	var bRootfolder = false;
	var bFolder = false;
	var bAlbum = false;
	var parentnode;
	var children;
	var expansion;

  if (node.Children != undefined)
  {
	    children = node.Children.Node;
	    parentnode = node.Parent;
	    expansion = node.Children.Expansions;
	    bRootfolder = node.IsRoot;
	}
	else if (node.AlbumImages != undefined)
	{
		bAlbum = true;
		children = node.AlbumImages.AlbumImage;
		parentnode = node.Parent;
		expansion = node.AlbumImages.Expansions;
		bRootfolder = (node.IsRoot != undefined && node.IsRoot); /* since it is an album I don't think it can be root */
	}
	else
	{
		printDbgMessage("Error: No children or Album Images to display");
		return;
	}

	if (!bRootfolder)
	{
		/* Create an entry in the grid */
		var fileDiv = document.createElement("div");

		if (fileDiv)
		{
			gridDiv.appendChild(fileDiv);
			fileDiv.setAttribute("id",parentdirid);
			fileDiv.className = "contententry";

			/* Create the anchor to the file */
			var fileAnchor = document.createElement("a");
			fileDiv.appendChild(fileAnchor);

			fileAnchor.setAttribute("href","javascript:void(0);");
			   fileAnchor.addEventListener("click", function(e) {
					/* is there really no other way to pass the correct object in the children array??
					    - passing the array, plus the array index value (which is set as the anchor id */
					nodeAction(containerid,parentnode,children,-1);
			   },false);

			   var thumbDiv = document.createElement("div");
			   fileAnchor.appendChild(thumbDiv);
			   thumbDiv.className="thumb";

				var thumbImg = document.createElement("img");
				thumbDiv.appendChild(thumbImg);
            thumbImg.className="thumbimg";

				if (bExpandImage)
				{
					/* Highlight image URLs should already exist in the expansion object
						The syntax to the object member name is painful!
						 - need to get the node name from the highlight image
						 - using the node name get the image id to get the URL

					expansion['/api/v2/image/'+expansion['/api/v2/highlight/node/'+children[i].NodeID+'?_shorturis='].Image.ImageKey+'-0!sizes?_shorturis='].ImageSizes.SmallImageUrl

					expansion[expandImageStr+expansion[expandHighlightStr+children[i].NodeID+expandEndStr].Image.ImageKey+expandSizesStr+expandEndStr].ImageSizes.SmallImageUrl

			        var imagekey = expansion[expandHighlightStr+children[i].NodeID+expandEndStr].Image.ImageKey;

			        expansion[expandImageStr+imagekey+expandSizesStr+expandEndStr].ImageSizes.SmallImageUrl;

			        - the Uris.HighlightImage or Uris.ImageSizes are used as the object member name, no need to build it

			        Plot Twist: at this section I am getting the image for the parent node which means that it will
			        not be in the object pointed to by the expansion variable, that is the expansions (i.e. images) for the
			        current node.  So I have to go and find the parent's node expansions which is in
			        the data for the children of the parents parents....sigh
					*/
					var image;
					if ( (parentnode != undefined) && (parentnode.IsRoot != undefined) ) {
                  if (!parentnode.IsRoot) {
                     image = parentnode.Parent.Children.Expansions[parentnode.Uris.HighlightImage].Image;
                  }
                  else {
                     /* feels like this should be in the parent node for the root, but its not */
                     image = currentUser.Expansions[parentnode.Uris.HighlightImage].Image;
                  }
					}

					if (image != undefined)
					{
						/* Based on the image original size, figure out the of the image is
						   landscape or portrait, and center it in container */
						//var wh = calcImageSize(thumbDiv,image.OriginalWidth,image.OriginalHeight);
                  if (!parentnode.IsRoot) {
                     thumbImg.setAttribute("src",adjustURL(parentnode.Parent.Children.Expansions[image.Uris.ImageSizes].ImageSizes.SmallImageUrl));
                  }
                  else {
                     thumbImg.setAttribute("src",adjustURL(currentUser.Expansions[image.Uris.ImageSizes].ImageSizes.SmallImageUrl));
                  }
                  //thumbImg.setAttribute("width",wh.width);
						//thumbImg.setAttribute("height",wh.height);
						//thumbDiv.style.height=wh.height+"px";
					}
					else
					{
						/* for some reason the image is not in the expansion, probably a root folder
               9/5/19 - should never get here getting image url from the currentUser Expansions
            */
						getHighLightImage(parentnode.Uris.HighlightImage,thumbDiv,'SmallImageUrl');
					}
				}
				else
				{
					getHighLightImage(parentnode.Uris.HighlightImage,thumbDiv,'SmallImageUrl');
				}

				var labelDiv = document.createElement("div");
				fileAnchor.appendChild(labelDiv);
					labelDiv.className = "contentlabel";
					labelDiv.appendChild(document.createTextNode("parent directory.."));

				/* Center Label */
				var offset = ( (fileDiv.clientWidth - visualLength("parent directory..",'contentlabel')) / 2);
				labelDiv.style.paddingLeft = offset;
            labelDiv.style.paddingRight = offset;

		}
	}

	/*  I want to loop thought all of the content is this current directory (Container)
	    the content could be more Folders, Albums, or content (images or video) and
	    create and entry in the grid.

	      Each grid entry will have a thumbnail and title

	      / Helpful members of Node:

	      	Type	Folder
			UrlName	empty string
			UrlPath	/
			IsRoot	true

		Not so fast....

		Nodes can be Folders or Albums but Albums don't have children, they have an Album
		object that we have to get the information for.  The Album object has an array of
		Album Images...

		Need to limit the number of items displayed at one time...

		thoughts...
		 - should I limit the number of items fetched from Smugmug?  is this possible.
		    if using the optimized response size (i.e. use the _filter and _filteruri parameters
		    how big is the json response?  Each items generates more and more DOM objects
		 - I need to at least start by limiting how many items are created below.  Which includes
		   the fetch of the image.
		   	 - how do I manage the drawing of more items as the user scrolls?
		   	 - for a very large list, I should keep X number of items and as the user scrolls
		   	   I will need to fetch missing items, and destroy unneeded items.
		   	 - I need a window or paging system...
    */

	for (i = 0; i < children.length; i++)
	{
	    if (children[i].Type != "System Album")
	    {
			if (children[i].IsVideo) { /* will this work if this node is a folder??? */
				/* if the file is a video file, check to see if there is a
				   video element and if not create it */
				createVideoPlayer();
			}

		   var fileDiv = document.createElement("div");

			if (fileDiv)
			{
				gridDiv.appendChild(fileDiv);
				fileDiv.setAttribute("id","file" + i);
				fileDiv.className = "contententry";

				/* Create the anchor to the file */
				var fileAnchor = document.createElement("a");
				fileDiv.appendChild(fileAnchor);
				fileAnchor.setAttribute("id",i);

				fileAnchor.setAttribute("href","javascript:void(0);");
				fileAnchor.addEventListener("click", function(e) {
						/* is there really no other way to pass the correct object in the children array??
							- passing the array, plus the array index value (which is set as the anchor id */
						nodeAction(containerid,node,children,this.id);
				},false);

				var thumbDiv = document.createElement("div");
				fileAnchor.appendChild(thumbDiv);
				thumbDiv.className = "thumb";

				var thumbImg = document.createElement("img");
				thumbDiv.appendChild(thumbImg);
            thumbImg.className="thumbimg";

				if (bExpandImage || bFilterApi)
				{
					var image;
					if (bAlbum)
					{
						image = children[i];
					}
					else
					{
						image = expansion[children[i].Uris.HighlightImage].Image;
					}

					if (image != undefined)  // it is possible for an empty folder or album to exist that would not have a highlight image
					{
						//var wh = calcImageSize(thumbDiv,image.OriginalWidth,image.OriginalHeight);
						if (expansion[image.Uris.ImageSizes].ImageSizes.SmallImageUrl != undefined)
						{
							thumbImg.setAttribute("src",adjustURL(expansion[image.Uris.ImageSizes].ImageSizes.SmallImageUrl));
						}
						else
						{
							/* if the original image is smaller than SmallImageUrl, SmallImageUrl will not exist
								- I think that LargestImageUrl is always defined
							*/
							thumbImg.setAttribute("src",adjustURL(expansion[image.Uris.ImageSizes].ImageSizes.LargestImageUrl));
						}
						//thumbImg.setAttribute("width",wh.width);
						//thumbImg.setAttribute("height",wh.height);
						//thumbDiv.style.height=wh.height+"px";
					}
				}
				else
				{
					/* To get the URL to the thumbnail image, you must call a SmugMug API */
					if (bAlbum)
					{
						/* Based on the image original size, figure out the of the image is
						   landscape or portrait */
						var wh = calcImageSize(thumbDiv,children[i]);

						getImageSizesUrls(children[i].Uris.ImageSizes,thumbDiv,'SmallImageUrl',wh.width,wh.height);
					}
					else
					{
						getHighLightImage(children[i].Uris.HighlightImage,thumbDiv,'SmallImageUrl');
					}
				}

				var labelDiv = document.createElement("div");
				fileAnchor.appendChild(labelDiv);
				labelDiv.className = "contentlabel";

				var label;
				if (bAlbum)
				{
					label = children[i].FileName;
				}
				else
				{
					label= children[i].Name;
				}
				labelDiv.appendChild(document.createTextNode(label));

				/* Center Label */
				var offset = ( (fileDiv.clientWidth - visualLength(label,'contentlabel')) / 2);
				labelDiv.style.paddingLeft = offset;
            labelDiv.style.paddingRight = offset;
			}
		}
	}

   /* Determine if we need to draw get more buttons */
	if ( ((currentStateData.Type == "Folder") && (currentStateData.Children.Pages.NextPage != undefined)) ||
        ((currentStateData.AlbumImages != undefined) && (currentStateData.AlbumImages.Pages.NextPage != undefined)) ) {

       /* Create bottom more button */
       if (bottominfo) {
			 /* Create the button  */
			 var moreButton = document.createElement("input");
          if (moreButton) {
			    bottominfo.appendChild(moreButton);
			    moreButton.setAttribute("id","bottommorebutton");
             moreButton.className = "morebutton";
             moreButton.setAttribute("type","button");
             moreButton.setAttribute("value","Show More...");
			    moreButton.addEventListener("click", getNext, false);
				 /* Center button */
				 var offset = ( (bottominfo.clientWidth - visualLength("Show More...",'morebutton')) / 2);
				 moreButton.style.paddingLeft = offset;
             moreButton.style.paddingRight = offset;

          }
       }
   }

	if ( ((currentStateData.Type == "Folder") && (currentStateData.Children.Pages.PrevPage != undefined)) ||
        ((currentStateData.AlbumImages != undefined) && (currentStateData.AlbumImages.Pages.PrevPage != undefined)) ) {
       /* Create top more button */
        if (topinfo) {
			 var moreButton = document.createElement("input");
          if (moreButton) {
			    topinfo.appendChild(moreButton);
			    moreButton.setAttribute("id","topmorebutton");
             moreButton.className = "morebutton";
             moreButton.setAttribute("type","button");
             moreButton.setAttribute("value","Show Previous...");
			    moreButton.addEventListener("click", getPrevious, false);
				 /* Center button */
				 var offset = ( (topinfo.clientWidth - visualLength("Show Previous...",'morebutton')) / 2);
				 moreButton.style.paddingLeft = offset;
             moreButton.style.paddingRight = offset;
          }
       }
   }

	/* Set path in header */
	var path = document.getElementById("path");
	if (path)
	{
		if (node.Parent != undefined)
		{
			if (node.UrlPath != undefined)
			{
				path.appendChild(document.createTextNode(node.UrlPath.replace(/\//g," | ")));
			}
		}
	}

	/* Get the list of anchors to navigate */
	anchors = document.getElementsByTagName("a");

	/*
	if (scrolldirection == 'previous')
	{
	   /* move the grid so that it animates in from the top
	   topElement(containerid);
	}
	*/

	/* By default put up the filegrid to start */
	showFilegrid();
	ROWSIZE = calcrowsize();

	/* Hack, Hack
        Cannot get the browser to allow me to scroll enough to see the bottom
        of the last row.
        If I add a row of dummy entries into the grid it should fix the problem...ick
	*/
	for (i = 0; i < ROWSIZE; i++)
	{
		var fileDiv = document.createElement("div");
		if (fileDiv)
		{
			gridDiv.appendChild(fileDiv);
			fileDiv.setAttribute("id","pad" + i);
			fileDiv.className = "contententry";
		}
	}

	if (scrolldirection == 'next')
	{
		currentAnchor = 0;
		gainFocus(anchors[currentAnchor]);
	}
	else if (scrolldirection == 'previous')
	{
	    /* anchordelta should be negative */
		currentAnchor = anchors.length-1;
		gainFocus(anchors[currentAnchor]);
	}
	spinner.stop();
}

function calcImageSize(contDiv,origWidth,origHeight)
{
	/* Based on the image original size, figure out the of the image is
	   landscape or portrait */
	var width;
	var height;
	var rect = contDiv.getBoundingClientRect();
	var contAR = parseFloat(rect.height) / parseFloat(rect.width);

	if (origWidth > origHeight)
	{
		/* landscape */
		var imgAR = parseFloat(origHeight) / parseFloat(origWidth);
      var padding = 0;

		if (imgAR > contAR)
		{
			height = rect.height;
			width = height * (parseFloat(origWidth) / parseFloat(origHeight));
			//contDiv.style.paddingLeft = (rect.width - width)/2;
         padding = (rect.width - width)/2;
		}
		else
		{
			width = rect.width;
			height = width * imgAR;
		}
	}
	else
	{
		/* portrait or square */
		var imgAR = parseFloat(origWidth) / parseFloat(origHeight);
		height = rect.height;
		width = height * imgAR;
		//contDiv.style.paddingLeft = (rect.width - width)/2;
      padding = (rect.width - width)/2;
	}

	return ( {'width': width, 'height': height, 'padding': padding} );

}


/* given a url check to see if there is a proxy configured
   this can be used for running on X1 STB that only support IPv6 and
   services that only support IPv4 */
function adjustURL(stUrl)
{
    if (bProxy) {
      /* get host from url */
      var url = new URL(stUrl);
      for (var i = 0; i < proxyList.length; i++) {
         if (url.hostname == proxyList[i].hostname) {
            var newurl = proxyList[i].protocol + "//" + proxyList[i].proxyhost + proxyList[i].pathname + url.pathname;
            printDbgMessage("[adjustURL] Old Url: " + stUrl);
            printDbgMessage("[adjustURL] New Url: " + newurl + "\n");
            return(newurl);
         }
      }
    }
    return stUrl;  /* if proxy is disabled or no match just return unmodified url */
}

function redirect(url)
{
   window.location = url;
}

function calcrowsize()
{
   var rows = new Array();
   var rownum = 0;
   var i = 0;

   var curY = anchors[i].getBoundingClientRect().top;
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
   return(rows[0]);
}

function getHighLightImage(smApi, imgDiv, imagesize)
{
	if (smApi && imgDiv)
	{
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open( "GET", smugmugapi + smApi, true );

		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("PostData: response status = " + xmlhttp.status);
					//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

					/* The highlight image object contains multiple images at different sizes
					   now we have to get the URLs to each size */
					var highlightImage = JSON.parse(xmlhttp.responseText);

					/* Use the SmallImageUrl, the thumbnails is too small for TV
						- ToDo: choose the image size based on the display size (i.e. bigger for TV, smaller for phone)
					*/

					/* Based on highlight image original size, figure out the of the image is
					   landscape or portrait */

					var wh = calcImageSize(imgDiv,highlightImage.Response.Image.OriginalWidth,highlightImage.Response.Image.OriginalHeight);

					getImageSizesUrls(highlightImage.Response.Image.Uris.ImageSizes,imgDiv,imagesize,
					                  wh.width,wh.height);
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or imgObj undefined");
	}
}

function getImageSizesUrls(smApi, imgDiv, imagesize, width, height)
{
	if (smApi && imgDiv)
	{
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open( "GET", smugmugapi + smApi, true );

		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("PostData: response status = " + xmlhttp.status);
					//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

				    if (imgDiv.childNodes.length > 0)
				    {
				       var imgObj =  imgDiv.childNodes[0];  // should only have an image child
					   var imgSizes = JSON.parse(xmlhttp.responseText);
					   imgObj.setAttribute("src",adjustURL(imgSizes.Response.ImageSizes[imagesize]));
					   imgObj.setAttribute("width",width);
					   imgObj.setAttribute("height",height);
					}
					else
					{
						printDbgMessage("Image <div> missing image");
					}
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or imgObj undefined");
	}
}

function getHighLightImageCustomSize(smApi, imgDiv)
{
	if (smApi && imgDiv)
	{
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open( "GET", smugmugapi + smApi, true );

		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("PostData: response status = " + xmlhttp.status);
					//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

					/* The highlight image object contains multiple images at different sizes
					   now we have to get the URLs to each size */
					var highlightImage = JSON.parse(xmlhttp.responseText);

					/* Based on highlight image original size, figure out the of the image is
					   landscape or portrait */
					var direction;
					if (highlightImage.Image.OriginalWidth > highlightImage.Image.OriginalHeight)
					{
						direction = 'landscape';
					}
					else
					{
						direction = 'portrait';
						//imgDiv.style.paddingLeft = thumbSizes[graphicsWidth]['portrait'].offset;
					}

				    /* this call is to get the Urls to the api to get the image urls */
					getImageSizesUrlsCustomSize(highlightImage.Image.Uris.ImageSizes,imgDiv,
												thumbSizes[graphicsWidth][direction].width,
												thumbSizes[graphicsWidth][direction].height);
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or imgObj undefined");
	}
}

function getImageSizesUrlsCustomSize(smApi, imgDiv, width, height)
{
	/* Just getting the Urls to api to get the Urls to the images...ugh */

	if (smApi && imgDiv)
	{
		var xmlhttp=new XMLHttpRequest();
		xmlhttp.open( "GET", smugmugapi + smApi, true );

		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("PostData: response status = " + xmlhttp.status);
					//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

					var imgSizes = JSON.parse(xmlhttp.responseText);
					getImageSizeCustom(imgSizes.ImageSizes.ImageSizeCustom,imgDiv,width,height);
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or imgObj undefined");
	}
}

function getImageSizeCustom(smApi, imgDiv, width, height)
{
	if (smApi && imgDiv)
	{
		var xmlhttp=new XMLHttpRequest();

		/* this will not work, need to figure out the right way to pass parameters in the query string */
		xmlhttp.open( "GET", smugmugapi + smApi + "?width=" + width + "&height=" + height, true );

		xmlhttp.onreadystatechange = function ()
		{
			if ( xmlhttp.readyState == XMLHttpRequest.DONE)
			{
				if (xmlhttp.status >= 200 && xmlhttp.status < 400 )
				{
					printDbgMessage("PostData: response status = " + xmlhttp.status);
					//printDbgMessage("PostData: response text = " + xmlhttp.responseText);

				  /* Its a miracle, we now have the Url to the custom sized image, so set to src of the image node */
				    if (imgDiv.childNodes > 0)
				    {
				       var imgObj =  imgDiv.childNodes[0];  // should only have an image child

					   var imgCustomSize = JSON.parse(xmlhttp.responseText);
					   imgObj.setAttribute("src",adjustURL(imgCustomSize.ImageSizeCustom.Url));
					   imgObj.setAttribute("width",width);  // probably not necessary, but can't hurt
					   imgObj.setAttribute("height",height);
					}
					else
					{
						printDbgMessage("Image <div> missing image");
					}
				}
				else
				{
					/* Error from SmugMug */
					printDbgMessage("Error connecting to " + smApi + " status: " + xmlhttp.status);
				}
			}
		};
		xmlhttp.send();
	}
	else
	{
		printDbgMessage("Error: smApi or imgObj undefined");
	}
}


function createVideoPlayer()
{
	/* Video file, add video element and set source */
	vid = document.getElementById("video");
	if (!vid)
	{
		/* Create video element */
		var vidplaydiv = document.createElement("div");
		if (vidplaydiv)
		{
			vidplaydiv.setAttribute("id","videoplayer");
			vidplaydiv.className = "player";
			tvScreen.appendChild(vidplaydiv);
			var vidtitleDiv = document.createElement("div");
			vidplaydiv.appendChild(vidtitleDiv);
			vidtitleDiv.className = "vidtitle";
			vidtitleDiv.setAttribute("id","vidname");

			vid = document.createElement("video");
			vidplaydiv.appendChild(vid);
			vid.className = "playerimg";
			vid.setAttribute("id","video");
			vid.setAttribute("controls","true");
			vid.setAttribute("autoplay","autoplay");
			vid.addEventListener("ended", function mediaended(e)
		    {
				printDbgMessage("Media ended: " + e.timeStamp);
				/* currentStateData is currently pointing to a AlbumImage (image or video)
				   it needs to be set back to the containing Album */
			    currentStateData = currentStateData.Parent;
			    currentState = 'displaycontent';
			    toggleFilegrid();
		    },false);

			showElement("videoplayer");
		}
	}
}


function playvideo(path,origWidth,origHeight)
{
	printDbgMessage("playvideo: " + path);
	if (!vid)
	{
		/* Create video element */
		createVideoPlayer();
	}

	if (vid)
	{
		var vidplayerdiv = document.getElementById("videoplayer");

      showElement("videoplayer");

      /*
		var wh = calcImageSize(vidplayerdiv,origWidth,origHeight);
	   vid.setAttribute("width",wh.width);
	   vid.setAttribute("height",wh.height);
      */
		vid.setAttribute("src", adjustURL(path));

		/* Set title */
		var name = document.getElementById("vidname");
		if (name)
		{
			name.innerHTML = path;
		}

		vid.addEventListener("playing", function playing(e)
	    {
	    	spinner.stop();
			printDbgMessage("Media playing: " + e.timeStamp);
	    },false);

		vid.load();
		vid.play();
		currentSpeed = vid.playbackRate;

		hideImagePlayer();
		hideFilegrid();
	}
}

function playpause()
{
	printDbgMessage("play/pause");

	if (vid)
	{
		if (vid.paused)
		{
			printDbgMessage("video.paused true, calling play()");
			vid.play();
		}
		else
		{
			printDbgMessage("video.paused false, calling pause()");
			vid.pause();
		}
	}
}


function playimage(url,origWidth,origHeight)
{
	if (!imageplayer)
	{
		imageplayer = document.createElement("img");
      imageplayer.className = "playerimg";
		imageplayerdiv = document.createElement("div");
		imageplayerdiv.appendChild(imageplayer);
		imageplayerdiv.setAttribute("id","imageplayerdiv");
		imageplayerdiv.className = "player";
		tvScreen.appendChild(imageplayerdiv);
	}

	/* The size of the image is depends on the image direction (landscape or portrait)
	   and the aspect ratio.
		 - calcImageSize also returns the paddingLeft of the container for center the
		   image in the container.
	*/
   showElement("imageplayerdiv");
   /*
   var wh = calcImageSize(imageplayerdiv,origWidth,origHeight);
   imageplayerdiv.style.paddingLeft = wh.padding;
	imageplayer.setAttribute("width",wh.width);
	imageplayer.setAttribute("height",wh.height);
   */
	imageplayer.setAttribute("src",adjustURL(url));
	imageplayer.addEventListener("load",function () { spinner.stop(); },false);

	hideVideoPlayer();
	hideFilegrid();
}

  function KeyDown(event)
  {
    	var EKC = event.keyCode;

    	//printDbgMessage("keyCode= " + EKC);

      /* The browser on the Samsung TV does not pass the arrow keys (or much else)
         through to the application.   It does pass the number keys, so use these keys
         to implement the star (up,down,left,right,select) functions.  The TV Does
         have a pointer but the navigation is a little awkward so also include these keys.
         Use the #7 button as a back button.
      */

      var bHandled = false;
    	switch (EKC)
      {
          case 48: /* 0 digit */
             toggleDebug();
             bHandled = true;
          break;

          case 55: /* 7 digit */
        	 case 8: /* Xfinity Last Key / Keyboard backspace key */
        	    //printDbgMessage("EKC: " + EKC + " Last key");

				//if (!isActive('authinfo'))
				if (currentState != 'authurldisplayed')
				{
					/* Last key should go to previous directory or if playing video bring
					   up content grid */

					   if (isActive(containerid))
					   {
						  /* Grid is displayed, so go to the parent folder, if root do nothing
							 - ToDo: if root display menu */
						   activateChild(gridid,parentdirid);
					   }
					   else
					   {
					   	   /* currentStateData is currently pointing to a AlbumImage (image or video)
					   	      it needs to be set back to the containing Album */
					       currentStateData = currentStateData.Parent;
					       currentState = 'displaycontent';
						    toggleFilegrid();
                      gainFocusandScroll(anchors[currentAnchor]);
					   }
					   bHandled = true;
				}
        	 break;

          case 57: /* 9 digit */
          break;

          case 52: /* 4 digit (left) */
        	 case 37: /* Left arrow */
          case 50: /* 2 digit (up) */
        	 case 38: /* Up arrow */
        	    if (document.getElementById(gridid))
        	    {
					var newAnchor;
					if (EKC == 37 || EKC == 52)
					{
						newAnchor = currentAnchor - 1;
					}
					else
					{
						newAnchor = currentAnchor - ROWSIZE;
					}
					if (newAnchor < 0)
					{
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
						*/
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
			break;

          case 54: /* 6 digit (right) */
        	 case 39: /* Right arrow */
          case 56: /* 8 digit (down) */
        	 case 40: /* Down arrow */
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
						*/
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
				}
			 break;

          case 51: /* 3 digit */
			 case 190: /* >/. key on keyboard */
          case 228:  /* Forward Xfinity */
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
        	 break;

          case 49: /* 1 digit */
			 case 188:  /* </, key on keyboard */
          case 227:  /* Rewind Xfinity */
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
             	}
        	 break;

         /* Overload the select key, the 5 digit, spacebar, and play/pause
            to select the currenly highlighted anchor and to play/pause video */
          case 13: /* select */
          case 53: /* 5 digit */
        	 case 32: /* space key */
          case 179: /* play/pause Xfinity */
               if (vid) {
             	   playpause();
               }
               else {
                  if (isActive(containerid)) {
                     anchors[currentAnchor].click();
                  }
               }
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
    }

function getPrevious() {
		if ( (currentStateData.Type == "Folder") && (currentStateData.Children.Pages.PrevPage != undefined) )
		{
			destroyGrid();
			currentState = 'getfolderpreviouspage';  /* not sure if I need folder vs album */
			document.dispatchEvent(statechangeevent);
		}
		else if ( (currentStateData.AlbumImages != undefined) && (currentStateData.AlbumImages.Pages.PrevPage != undefined) )
		{
			destroyGrid();
			currentState = 'getalbumpreviouspage';  /* not sure if I need folder vs album */
			document.dispatchEvent(statechangeevent);
		}
		else
		{
			/* don't do anything */
			printDbgMessage("No scroll at top of list");
		}
}

function getNext() {
		if ( (currentStateData.Type == "Folder") && (currentStateData.Children.Pages.NextPage != undefined) )
		{
			destroyGrid();
			currentState = 'getfoldernextpage';  /* not sure if I need folder vs album */
			document.dispatchEvent(statechangeevent);
		}
		else if ( (currentStateData.AlbumImages != undefined) && (currentStateData.AlbumImages.Pages.NextPage != undefined) )
		{
			destroyGrid();
			currentState = 'getalbumnextpage';  /* not sure if I need folder vs album */
			document.dispatchEvent(statechangeevent);
		}
		else
		{
			/* don't do anything */
			printDbgMessage("No scroll at bottom of list");
		}
}

function loseFocus(ele)
{
	if (ele != undefined)
	{
		ele.parentNode.style.borderColor=nonselectedColor;
	}

}

function gainFocusandScroll(ele)
{
	if (ele != undefined)
	{
		scroll(ele.parentNode, gridContainer);
		gainFocus(ele);
	}
}

function gainFocus(ele)
{
	if (ele != undefined)
	{
		ele.focus();
		ele.parentNode.style.borderColor=selectedColor;
	}
}


function scroll(ele, container)
{
    /* Is there a scroll method that I should use */

    if (ele != undefined && container != undefined)
    {
		var rect = ele.getBoundingClientRect();
		var contrect = container.getBoundingClientRect();
		var eleStyle = window.getComputedStyle(ele);

		/* Check if we need to scroll the container */
		if ( (rect.bottom) > (window.innerHeight-parseInt(eleStyle.marginBottom)) )
		{
			printDbgMessage("Scroll Up: " + container.scrollTop);
			container.scrollTop += rect.bottom - (window.innerHeight-parseInt(eleStyle.marginBottom));
			printDbgMessage("Scroll Top: " + container.scrollTop);
		}
		else if (rect.top < (contrect.top+parseInt(eleStyle.marginTop)))
		{
			printDbgMessage("Scroll Down: " + container.scrollTop);
			container.scrollTop -= (contrect.top+parseInt(eleStyle.marginTop)) - rect.top;
			printDbgMessage("Scroll Top: " + container.scrollTop);

		}
	}
}


function activateChild(cid, pfid)
{
	var cidDiv = document.getElementById(cid);

	if (cidDiv)
	{
		/* Search for the pfid */
		for (i = 0; i < cidDiv.childNodes.length; i++)
		{
			var child = cidDiv.childNodes[i];
			if (child.id == pfid)
			{
				/* Found the pfid, so "click" the link
					- search all children for anchor, will only activate first anchor in list
				*/
				for (j = 0; j < child.childNodes.length; j++)
				{
					if (child.childNodes[j].tagName == "A")
					{
						child.childNodes[j].click();
						break;
					}
				}
				break;
			}
		}
	}
}

function debugScrollUp()
{
	if (dbg.scrollTop > scrollIncr)
	{
		dbg.scrollTop -= scrollIncr;
	}
	else
	{
		dbg.scrollTop = 0;
	}
}

function debugScrollDown()
{
	dbg.scrollTop += scrollIncr;
}

function gridScrollUp()
{
	if (grid.scrollTop > scrollIncr)
	{
		grid.scrollTop -= scrollIncr;
	}
	else
	{
		grid.scrollTop = 0;
	}
}

function gridScrollDown()
{
	grid.scrollTop += scrollIncr;
}

function hideVideoPlayer()
{
	if (vid)
	{
		vid.pause();
		hideElement("videoplayer");

		if (vid.parentNode)
		{
			vid.parentNode.parentNode.removeChild(vid.parentNode);
			vid = null;
		}
	}

}

function hideImagePlayer()
{
	if (imageplayer)
	{
		hideElement("imageplayerdiv");

		/* Large images take up memory, remove it */
		if (imageplayer.parentNode)
		{
			imageplayer.parentNode.parentNode.removeChild(imageplayer.parentNode);
			imageplayer = null;
		}
	}
}

function toggleFilegrid()
{
	hideImagePlayer();
	hideVideoPlayer();
	toggleElement(containerid);
   toggleElement(headerid);
   toggleElement(topid);
   toggleElement(bottomid);
}

function hideFilegrid()
{
   hideElement(topid);
   hideElement(bottomid);
	hideElement(containerid);
   hideElement(headerid);
}

function hideHeader()
{
	hideElement(headerid);
}

function showFilegrid()
{
	hideImagePlayer();
	hideVideoPlayer();
	showElement(containerid);
   showElement(headerid);
   showElement(topid);
   showElement(bottomid);
}

function isActive(ele_id)
{
	var ele  = document.getElementById(ele_id);

	if (ele != undefined)
	{
		return (classie.has(ele, "activeX") || classie.has(ele, "activeY") || classie.has(ele, "active") );
	}
	else
	{
		return false;
	}
}

function toggleElement(ele_id)
{
    if (isActive(ele_id))
    {
   	    hideElement(ele_id);
    }
    else
    {
        showElement(ele_id);
    }
}

function hideElement(ele_id)
{
	var ele  = document.getElementById(ele_id);

	/* hide element */
	if (ele != undefined)
	{
		if (classie.has(ele,"activeX"))
		{
	    	classie.remove(ele,"activeX");
	    }
	    else if (classie.has(ele,"activeY"))
	    {
	    	classie.remove(ele,"activeY");
	    }
	    else if (classie.has(ele,"active"))
	    {
	    	classie.remove(ele,"active");
	    }
	    printDbgMessage(ele_id + " Hidden");
	}
}

function showElement(ele_id)
{
	var ele  = document.getElementById(ele_id);

	/* show element */
	if (ele != undefined)
	{
		if (classie.has(ele, "left") || classie.has(ele, "right"))
		{
	   	classie.add(ele, "activeX");
	   }
	   else if (classie.has(ele, "top") || classie.has(ele, "bottom"))
	   {
	   	classie.add(ele, "activeY");
	   }
	   else
	   {
	   	classie.add(ele, "active");
	   }

	   printDbgMessage(ele_id + " Displayed");
	}
}

function topElement(ele_id)
{
	var ele  = document.getElementById(ele_id);

	/* move element offscreen at top */
	if (ele != undefined)
	{
		if (classie.has(ele,"left"))
		{
	    	classie.remove(ele,"left");
	    }
	    else if (classie.has(ele,"right"))
	    {
	    	classie.remove(ele,"right");
	    }
	    else if (classie.has(ele,"bottom"))
	    {
	    	classie.remove(ele,"bottom");
	    }

	    classie.add(ele,"top");
	}
}

function processCommandline(url)
{
    var query = url.slice(url.indexOf("?")+1);
    if (query)
    {
		var params = query.split("&");
		for (var i = 0; i < params.length; i++)
		{
			var equal = params[i].indexOf("=");
			if (params[i].substring(0,equal) == "username")
			{
			    username = params[i].substring(equal+1);
			}
         else if (params[i].substring(0,equal) == "proxy")
         {
            if (params[i].substring(equal+1) == "true") {
                bProxy = true;
            }
            else if (params[i].substring(equal) == "false"){
                bProxy = false;
            }
         }
		}
	}
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function toggleDebug()
{
	dbg = document.getElementById("debug");
	if (bDebug == 0)
	{
		/* Enable Debug window */
		bDebug = 1;
		if (dbg != undefined) dbg.style.display = "inline";
		printDbgMessage("Debug On");
	}
	else
	{
		/* Disable Debug Window */
		bDebug = 0;
		if (dbg != undefined) dbg.style.display = "none";
	}
}

function printDbgMessage(msg)
{
	if (bDebug == 1)
	{
		if (dbg != undefined) dbg.innerHTML = dbg.innerHTML + msg + "</br>" ;
		console.log(msg);

		/* try to auto scroll */
		if (dbg != undefined)
		{
			if (dbg.scrollHeight > dbg.clientHeight)
			{
				dbg.scrollTop = (dbg.scrollHeight - dbg.clientHeight);
			}
		}
	}
}

function visualLength(str,strClass)
{
	var ruler = document.getElementById("ruler");
	if (ruler != undefined)
	{
		ruler.className = "ruler " + strClass;
		ruler.innerHTML = str;
		return ruler.offsetWidth;
	}
	else
	{
		return 0;
	}
}


function printObject(obj,indent)
{
	var member;

	if (obj)
	{
		for (member in obj)
		{
			var spaces="";
			for (i = 0; i < indent; i++)
			{
				spaces += " ";
			}
			console.log(spaces + member + ": " + obj[member]);

			if (member !== 'parent' && obj[member] !== null && typeof obj[member] === 'object')
			{
				printObject(obj[member],indent+3);
			}
		}
	}
}
