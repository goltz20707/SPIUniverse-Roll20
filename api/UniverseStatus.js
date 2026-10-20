// $Id: UniverseStatus.js,v 1.5 2026/08/30 16:47:42 goltz Exp $
//
// Roll20 API script to handle Universe status markers.

function processStatusChange(attr) {
    // log('EVENT FIRED!');
    var aName = attr.get("name");
    var aCurrent = attr.get("current");
    var charid = attr.get("_characterid");
    // log("attribute " + aName + " for " + charid + " changed (" + aCurrent + ")");
    // log("working with character ID " + charid);

    // get matching tokens on current map
    var tokens = findObjs({
        _pageid: Campaign().get("playerpageid"),
        _type: "graphic",
        represents: charid,
    });


    for (i = 0; i < tokens.length; i++) {
	var character = getObj('character', charid);
	var name = tokens[i].get("name") || character.get('name') || "huh?"
	var marker = "ABORT";
	// log(name + " status " + aName + " now " + aCurrent);
	switch (aName) {
	case "status_prone":
	    marker = "status_Prone::7084084"; // Prone
	    break;
	case "status_unconscious":
	    marker = "status_Unconscious::7084089"; // Unconscious
	    break;
	case "status_stunned":
	    marker = "status_Stunned::7084087";	// Stunned
	    break;
	case "status_shock":
	    marker = "status_Frightened::7084073";  // Frightened
	    break;
	case "status_dead":
	    marker = "status_dead"; // dead
	    break;
	case "status_reloading":
	    marker = "status_yellow";
	    break;
	case "status_immobile":
	    marker = "status_Paralyzed::7084079"; // Paralyzed
	    break;
	default:
	   break;
	}
	
	// log("changing marker " + marker);
	if (marker != "ABORT") {
	    if (aCurrent == 0) {
		// Remove marker if present
		tokens[i].set(marker, false);
	    } else {
	     	// Add marker if not already present
		tokens[i].set(marker, true);
	    }
	}
	// log("status markers for " + name + ": " + tokens[i].get("statusmarkers"));
    }
};

on('change:attribute', processStatusChange);

on("ready", function () {
    "use strict";
    log("-=> UniverseStatus $Revision: 1.5 $ <=-");
});
