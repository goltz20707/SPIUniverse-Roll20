/*
  Global variables for a Universe campaign for current environ,
  gravity, etc., along with methods for getting and setting them.

  $Id: UniverseEnvironment.js,v 1.6 2026/10/18 20:23:42 goltz Exp $

  API Commands:
  !environ: show current environ
  !date: show current date

  GM only:
  !date: whisper current date to GM
  !setyear NNNN: set game year to NNNN
  !setorddate NNN: set game day of year to NNN
  !setdate YYYY/DDD: set game date; equivalent to !setyear YYYY and !setorddate DDD
  !setfeature XX: set terrain feature to XX
  !setcontour YY: set terrain contour to YY
  !pushenv: push all variables out to character sheets
*/

var Environment = Environment || (function() {
    'use strict';
    
    var version = '$Revision: 1.6 $',
        handoutName = 'Events Log',
	
	// A few tables.
	featureAbbrev = [
	    "VO",
	    "CR",
	    "BN",
	    "LV",
	    "WD",
	    "FT",
	    "JU",
	    "MA",
	    "IC"
	],
	featureName = [
	    "volcanic",
	    "cratered",
	    "barren",
	    "lightly-vegetated",
	    "wooded",
	    "forested",
	    "jungle",
	    "marshy",
	    "icy"
	],
	contourAbbrev = [
	    "PK",
	    "MN",
	    "HL",
	    "FL",
	    "IN",
	    "SF",
	    "SB"
	],
	contourName = [
	    "peaks",
	    "mountains",
	    "hills",
	    "flat",
	    "inland water",
	    "surface water",
	    "underwater"
	],
	gravityAbbrev = [
	    "NW",
	    "LT",
	    "HY",
	    "EX"
	],
	gravityName = [
	    "near weightless",
	    "light",
	    "heavy",
	    "extreme"
	],
	// This table is indexed by numeric environ code (10*feature + contour).
	// Elements are arrays of environ name, terrain value, ARMM, and creature value.
	terrainEffects = [
	    ["VO-PK", 4, -8, 6],
	    ["VO-MN", 3, -6, 6],
	    ["VO-HL", 2, -4, 6],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["CR-PK", 4, -8, 6],
	    ["CR-MN", 3, -6, 6],
	    ["CR-HL", 2, -4, 6],
	    ["CR-FL", 1.5, -2, 6],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["BN-PK", 3, -6, 5],
	    ["BN-MN", 2, -4, 5],
	    ["BN-HL", 1.5, -2, 5],
	    ["BN-FL", 1, 0, 5],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["LV-PK", 3, -6, 4],
	    ["LV-MN", 2, -4, 4],
	    ["LV-HL", 1.5, -2, 4],
	    ["LV-FL", 1, 0, 4],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["WD-PK", 4, -8, 3],
	    ["WD-MN", 3, -6, 3],
	    ["WD-HL", 2, -4, 3],
	    ["WD-FL", 1.5, -2, 3],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["FT-PK", 5, -10, 2],
	    ["FT-MN", 4, -8, 2],
	    ["FT-HL", 3, -6, 2],
	    ["FT-FL", 2, -4, 2],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["JU-MN", 5, -10, 1],
	    ["JU-HL", 4, -8, 1],
	    ["JU-FL", 3, -6, 1],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    [],
	    ["MA-HL", 2, -6, 2],
	    ["MA-FL", 1.5, -4, 2],
	    ["IN", 2, -10, 2], 	// terrain value depends on choppiness of water
	    ["SF", 2, -10, 2], 	// terrain value depends on choppiness of water
	    ["SB", 3, -10, 2], 	// terrain value depends on depth amd opacity
	    [],
	    [],
	    [],
	    [],
	    ["IC-HL", 3, -6, 5],
	    ["IC-FL", 1, -4, 5]
	],

	// Index is world size.  Elements are arrays of gravity, gravity class index, and ARMM.
	worlds = [
	    [0.05, 0,  8],
	    [0.1,  0,  8],
	    [0.2,  0,  8],
	    [0.4,  0,  4],
	    [0.7,  1,  2],
	    [1.0,  1,  0],
	    [1.3,  2, -2],
	    [1.7,  2, -4],
	    [2.0,  3, -6],
	    [2.5,  3, -8]
	],
	
	// Month names.
	months = [
	    "January",
	    "February",
	    "March",
	    "April",
	    "May",
	    "June",
	    "July",
	    "August",
	    "September",
	    "October",
	    "November",
	    "December",
	],
	
	// Days of each month.  Note that leap years have an additional date after month 6.
	monthDays = [
	    31, 30, 30,
	    31, 30, 30,
	    31, 30, 30,
	    31, 30, 30,
	],
    
	// Initialization functions.
	setDefaults = function() {
	    // sendChat("Environ","/w gm DEBUG 191: setDefaults running");
            state.Environment = {
		version: '$Revision: 1.6 $',
		year: 2410,
		ordDate: 183,
		month: 7,
		day: 1,
		feature: 2,
		contour: 3,
		environ: 23,
		envName: "barren flat",
		envSkillName: "envsk_bn_fl",
		envTV: 1,
		envARMM: 0,
		worldSize: 5,
		gravity: 1.0,
		gravClass: 1,
		gravARMM: 0
	    };
	},
    
	checkDefaults = function() {
	    if( ! state.Environment.version){state.Environment.version = '$Revision: 1.6 $'};
	    if( ! state.Environment.year){state.Environment.year = 2410};
	    if( ! state.Environment.ordDate){state.Environment.ordDate = 183};
	    if( ! state.Environment.month){state.Environment.month = 7};
	    if( ! state.Environment.day){state.Environment.day = 1};
	    if( ! state.Environment.feature){state.Environment.feature = 2};
	    if( ! state.Environment.contour){state.Environment.contour = 3};
	    if( ! state.Environment.environ){state.Environment.environ = 23};
	    if( ! state.Environment.envName){state.Environment.envName = "barren flat"};
	    if( ! state.Environment.envSkillName){state.Environment.envSkillName = "envsk_bn_fl"};
	    if( ! state.Environment.envTV){state.Environment.envTV = 1};
	    if( ! state.Environment.envARMM){state.Environment.envARMM = 0};
	    if( ! state.Environment.worldSize){state.Environment.worldSize = 5};
	    if( ! state.Environment.gravity){state.Environment.gravity = 1.0};
	    if( ! state.Environment.gravClass){state.Environment.gravClass = 1};
	    if( ! state.Environment.gravARMM){state.Environment.gravARMM = 0};	
	},

	// Push an attribute value out to all character sheets.
	pushValue = function(attribute,newValue) {
	    // sendChat("Environ", "/w gm DEBUG 225: setting " + attribute + " to " + newValue);
	    sendChat("GM", "!setattr --all --silent --" + attribute + "|" + newValue);
	},
	
	// Push all global values to all character sheets.
	pushValuesAll = function() {
	    pushValue("globYear", state.Environment.year);
	    // sendChat("Environ","/w gm DEBUG 232: Setting globYear to " + state.Environment.year);
	    pushValue("globOrdDate", state.Environment.ordDate);
	    pushValue("globFeature", state.Environment.feature);
	    pushValue("globContour", state.Environment.contour);
	    pushValue("globEnviron", state.Environment.environ);
	    pushValue("globEnvName", state.Environment.envName);
	    pushValue("globEnvSkillName", state.Environment.envSkillName);
	    pushValue("globEnvTV", state.Environment.envTV);
	    pushValue("globEnvARMM", state.Environment.envARMM);
	    pushValue("globWorldSize", state.Environment.worldSize);
	    pushValue("globGravity", state.Environment.gravity);
	    pushValue("globGravClass", state.Environment.gravClass);
	    pushValue("globGravARMM", state.Environment.gravARMM);
	    sendChat("Environ", "/w gm All global variables pushed");
	},
	
	showEnviron = function() {
	    sendChat("Environ", "/w gm Current environ: "
		     + featureName[state.Environment.feature] + " " + contourName[state.Environment.contour]
		     + " (" + featureAbbrev[state.Environment.feature] + "-" + contourAbbrev[state.Environment.contour] + ")");
	},
	
	getEnviron = function() {
	    return featureAbbrev[state.Environment.feature] + "-" + contourAbbrev[state.Environment.contour];
	},

	setFeature = function(feature) {
	    var curFeature = state.Environment.feature;
	    switch(feature) {
	    case 'VO':
		state.Environment.feature = 0;
		break;
	    case 'CR':
		state.Environment.feature = 1;
		break;
	    case 'BN':
		state.Environment.feature = 2;
		break;
	    case 'LV':
		state.Environment.feature = 3;
		break;
	    case 'WD':
		state.Environment.feature = 4;
		break;
	    case 'FT':
		state.Environment.feature = 5;
		break;
	    case 'JU':
		state.Environment.feature = 6;
		break;
	    case 'MA':
		state.Environment.feature = 7;
		break;
	    case 'IC':
		state.Environment.feature = 8;
		break;
	    default:
		sendChat("Environ", "/w gm Invalid value for feature: " + feature);
	    }
	    state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    // Certain feature-contour combinations are not allowed.
	    if ((state.Environment.contour == 0 && state.Environment.feature > 5)
		|| (state.Environment.contour == 1 && state.Environment.feature > 6)
		|| (state.Environment.contour == 3 && state.Environment.feature == 0)
		|| (state.Environment.contour > 3 && state.Environment.feature != 7)) {
		sendChat("Environ", "/w gm Environ of "
			 + featureAbbrev[state.Environment.feature] + "-" + contourAbbrev[state.Environment.contour]
			 + " is not allowed");
		state.Environment.feature = curFeature;
		state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    }
	    // sendChat("Environ", "/w gm Current environ is " + terrainEffects[state.Environment.environ][0]);
	    newEnviron();
	},
	
	setContour = function(contour) {
	    var curContour = state.Environment.contour;
	    switch(contour) {
	    case 'PK':
		state.Environment.contour = 0;
		break;
	    case 'MN':
		state.Environment.contour = 1;
		break;
	    case 'HL':
		state.Environment.contour = 2;
		break;
	    case 'FL':
		state.Environment.contour = 3;
		break;
	    case 'IN':
		state.Environment.contour = 4;
		break;
	    case 'SF':
		state.Environment.contour = 5;
		break;
	    case 'SB':
		state.Environment.contour = 6;
		break;
	    default:
		sendChat("Environ", "/w gm Invalid value for contour: " + contour);
	    }
	    state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    // Certain feature-contour combinations are not allowed.
	    if ((state.Environment.contour == 0 && state.Environment.feature > 5)
		|| (state.Environment.contour == 1 && state.Environment.feature > 6)
		|| (state.Environment.contour == 3 && state.Environment.feature == 0)
		|| (state.Environment.contour > 3 && state.Environment.feature != 7)) {
		sendChat("Environ", "/w gm Environ of "
			 + featureAbbrev[state.Environment.feature] + "-" + contourAbbrev[state.Environment.contour]
			 + " is not allowed");
		state.Environment.contour = curContour;
		state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    }
	    // sendChat("Environ", "/w gm Current environ is " + terrainEffects[state.Environment.environ][0]);
	    newEnviron();
	},

	// Because some combinations of feature and contour are illegal,
	// setting the environ all at once requires a new function.  Trust
	// me on this.
	setEnviron = function(environ) {
	    var envArray = environ.split("-");
	    var feature = envArray[0];
	    var contour = envArray[1];
	    var curFeature = state.Environment.feature;
	    var curContour = state.Environment.contour;
	    switch(feature) {
	    case 'VO':
		state.Environment.feature = 0;
		break;
	    case 'CR':
		state.Environment.feature = 1;
		break;
	    case 'BN':
		state.Environment.feature = 2;
		break;
	    case 'LV':
		state.Environment.feature = 3;
		break;
	    case 'WD':
		state.Environment.feature = 4;
		break;
	    case 'FT':
		state.Environment.feature = 5;
		break;
	    case 'JU':
		state.Environment.feature = 6;
		break;
	    case 'MA':
		state.Environment.feature = 7;
		break;
	    case 'IC':
		state.Environment.feature = 8;
		break;
	    default:
		sendChat("Environ", "/w gm Invalid value for feature: " + feature + "; needs to be VO|CR|BN|LV|WD|FT|JU|MA|IC");
	    }
	    switch(contour) {
	    case 'PK':
		state.Environment.contour = 0;
		break;
	    case 'MN':
		state.Environment.contour = 1;
		break;
	    case 'HL':
		state.Environment.contour = 2;
		break;
	    case 'FL':
		state.Environment.contour = 3;
		break;
	    case 'IN':
		state.Environment.contour = 4;
		break;
	    case 'SF':
		state.Environment.contour = 5;
		break;
	    case 'SB':
		state.Environment.contour = 6;
		break;
	    default:
		sendChat("Environ", "/w gm Invalid value for contour: " + contour + "; needs to be PK|MN|HL|FL|IN|SF|SB");
	    }
	    state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    // Certain feature-contour combinations are not allowed.
	    if ((state.Environment.contour == 0 && state.Environment.feature > 5)
		|| (state.Environment.contour == 1 && state.Environment.feature > 6)
		|| (state.Environment.contour == 3 && state.Environment.feature == 0)
		|| (state.Environment.contour > 3 && state.Environment.feature != 7)) {
		sendChat("Environ", "/w gm Environ of "
			 + featureAbbrev[state.Environment.feature] + "-" + contourAbbrev[state.Environment.contour]
			 + " is not allowed");
		state.Environment.feature = curFeature;
		state.Environment.contour = curContour;
		state.Environment.environ = 10*state.Environment.feature + state.Environment.contour;
	    }
	    // sendChat("Environ", "/w gm Current environ is " + terrainEffects[state.Environment.environ][0]);
	    newEnviron();
	},

	newEnviron = function() {
	    // Call this whenever the current environ has changed.
	    state.Environment.envName = featureName[state.Environment.feature] + " " + contourName[state.Environment.contour];
	    state.Environment.envSkillName = "envsk_" + featureAbbrev[state.Environment.feature].toLowerCase() + "_" + contourAbbrev[state.Environment.contour].toLowerCase(); 
	    state.Environment.envTV = terrainEffects[state.Environment.environ][1];
	    state.Environment.envARMM = terrainEffects[state.Environment.environ][2];
	    sendChat("Environ", "/w gm Environ changed to " + terrainEffects[state.Environment.environ][0] + " (" + state.Environment.envName + ")");
	    sendChat("Environ", "/w gm New terrain value is " + state.Environment.envTV);
	    sendChat("Environ", "/w gm New ARMM value is " + state.Environment.envARMM);
	},
	
	setWorldSize = function(newSize) {
	    if (newSize < 0 || newSize > 9) {
		sendChat("Environ", "/w gm Invalid world size " + newSize);
	    } else {		// size is valid
		state.Environment.worldSize = newSize;
		state.Environment.gravity = worlds[newSize][0];
		state.Environment.gravClass = worlds[newSize][1];
		state.Environment.gravARMM = worlds[newSize][2];
		sendChat("Environ","/w gm World size set to " + newSize);
		sendChat("Environ","/w gm Gravity is " + worlds[newSize][0] + " g (" + gravityName[worlds[newSize][1]] + ")");
	    }
	},
	
	// We don't do bounds checking for setGravity.  You're on your own.
	// It's best to use setWorldSize and then use setGravity to "fine tune".
	setGravity = function(newGrav) {
	    state.Environment.gravity = newGrav;
	    sendChat("Environ","/w gm Gravity set to " + newGrav + " g");
	},

	// Convert a "year/day" combo to "mday month".
	yearOrdDate2MdayMonth = function(ordDate) {
	    const dateArray = ordDate.split("/");
	    let dateYear = parseInt(dateArray[0], 10);
	    let dateOrdDay = parseInt(dateArray[1], 10);
	    // log("dateOrdDay now " + dateOrdDay);
	    if (dateYear % 4 == 0) { // leap year
		// log("leap year");
		if (dateOrdDay == 183) {
		    return "Leap Day";
		} else if (dateOrdDay > 183) {
		    dateOrdDay--;
		}
	    }
	    // log("dateOrdDay now " + dateOrdDay);
	    if (dateOrdDay == 365) {
		return "Federation Day";
	    } else {
		var month = 0;
		while (dateOrdDay > monthDays[month]) {
		    dateOrdDay -= monthDays[month];
		    month++;
		}
		// log(dateOrdDay + " " + months[month]);
		return dateOrdDay + " " + months[month];
	    }
	},

	setDate = function(date) {
	    const dateArray = date.split("/");
	    let dateYear = parseInt(dateArray[0], 10);
	    let dateOrdDay = parseInt(dateArray[1], 10);
	    if (dateYear % 4 == 0) { // leap year
		if (dateOrdDay > 366) {
		    dateYear++;
		    dateOrdDay -= 366;
		}
	    }
	    while (dateOrdDay > 365) {
		dateYear++;
		dateOrdDay-= 365;
	    }
	    state.Environment.year = dateYear;
	    state.Environment.ordDate = dateOrdDay;
	},

	// Advance date by one day.
	advanceDate = function() {
	    state.Environment.ordDate++;
	    if (state.Environment.year % 4 == 0) { // leap year
		if (state.Environment.ordDate > 366) {
		    state.Environment.year++;
		    state.Environment.ordDate -= 366;
		}
	    } else {
		if (state.Environment.ordDate > 365) {
		    state.Environment.year++;
		    state.Environment.ordDate -= 365;
		}
	    }
	},

	printCurrentDate = function(playerid) {
	    if(playerIsGM(playerid)){
		sendChat("Environ","/w gm Today is " + state.Environment.year + "/" + state.Environment.ordDate + " (" + yearOrdDate2MdayMonth(state.Environment.year + "/" + state.Environment.ordDate) + ")");
	    } else {
		sendChat("Environ","Today is " + state.Environment.year + "/" + state.Environment.ordDate + " (" + yearOrdDate2MdayMonth(state.Environment.year + "/" + state.Environment.ordDate) + ")");
	    }
	},

	handleInput = function(msg) {
            var args = msg.content.split(" ");
            
            if (msg.type !== "api") {
		return;
	    }
	    
	    if(playerIsGM(msg.playerid)){
		// sendChat("Environ","/w gm DEBUG 254: checking command " + args[0]);
		switch(args[0]) {
		case '!environ':
		    showEnviron();
		    break;
		case '!date':
		    printCurrentDate(msg.playerid);
		    break;
		case '!setyear':
		    // sendChat("Environ","/w gm DEBUG 260: Setting year to " + args[1]);
		    state.Environment.year=args[1];
		    sendChat("Environ","/w gm Year set to " + args[1]);
		    break;
		case '!setorddate':
		    state.Environment.ordDate=args[1];
		    sendChat("Environ","/w gm Date set to " + args[1]);
		    break;
		case '!setdate':
!		    setDate(args[1]);
		    printCurrentDate(msg.playerid);
		    break;
		case '!tomorrow':
		    advanceDate();
		    sendChat("Environ","/w gm Tomorrow and tomorrow and tomorrow / Creeps in this petty pace from day to day");
		    break;
		case '!setfeature':
		    setFeature(args[1]);
		    break;
		case '!setcontour':
		    setContour(args[1]);
		    break;
		case '!setenviron':
		    setEnviron(args[1]);
		    break;
		case '!setworldsize':
		    setWorldSize(args[1]);
		    break;
		case '!setgravity':
		    setGravity(args[1]);
		    break;
		case '!pushenv':
		    // sendChat("Environ","/w gm DEBUG 559: pushenv invoked");
		    pushValuesAll();
		    break;
    		}
	    } else {
		switch(args[0]) {
		case '!environ':
		    showEnviron();
		    break;
		case '!date':
		    printCurrentDate(msg.playerid);
		    break;
		}
	    }
	},
	
	checkInstall = function() {
            if(typeof state.Environment == "undefined"){
		setDefaults();
            }
	    setDefaults();
	    checkDefaults();
	    // sendChat("Environ","/w gm DEBUG 343: setting defaults");
	},
	
	registerEventHandlers = function() {
            on('chat:message', handleInput);
	};

    return {
	CheckInstall: checkInstall,
	RegisterEventHandlers: registerEventHandlers
    };
    
}());

on("ready",function(){
    'use strict';
    Environment.CheckInstall();
    Environment.RegisterEventHandlers();
    log("-=> UniverseEnvironment $Revision: 1.6 $ <=-");
});
