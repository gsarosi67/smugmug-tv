# Smugmug-TV

* HTML5 implementation of a simple image/video browser for the SmugMug services, specifically focused on working on a SmartTV platform.
* Uses the SmugMug v2 APIs (https://api.smugmug.com/api/v2/doc)
* Works best with arrow/select keys on a TV remote, but will work with a mouse or touch
* Configured to use a proxy for all api calls and to retrieve content.  This is mainly for platforms that only support IPv6.

## ToDo

* Implement authorization, currently only works for publicly available Smugmug sites
* Rewrite the UI using vue.js and/or React or anything else
* implement a websocket connection that allows for remote navigation using a phone, this will help with the Samsung TV that only support mouse navigation
* 
