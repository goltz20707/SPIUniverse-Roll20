/*
  API to resolve attacks in Universe.

  $Id: UniverseCombat.js,v 1.18 2026/10/18 20:27:14 goltz Exp $

  API Commands:

  !closeCombatTargetSelect attacker target weaponIdx hitStrength usingArmor
  
  !closeCombat attacker target weaponIdx hitStrength usingArmor

  !fireWeapon attacker target weaponIdx range0strike range2strike range4strike range6strike range8strike hitStrength
  !fireGrenade attacker target weaponIdx range0strike range2strike range4strike range6strike range8strike hitStrength

  !hitTableRoll modDmgRoll

  !shockCheck target MP shock

  !willpowerCheck target AG MP

  !damage target stat points [stat points...]
  
  attacker:     character (NOT token) ID of attacking character
  target:       token ID of target of attack
  weaponIdx:    index of weapon in closeWeaponTable or rangedWeaponTable
  hitStrength:  hit strength of weapon
  usingArmor:   close combat using armor (as opposed to unarmed or a weapon)
  range0strike: strike chance for range of 0 hexes
  range2strike: strike chance for range of 1-4 hexes
  range4strike: strike chance for range of 5-13 hexes
  range6strike: strike chance for range of 14-25 hexes
  range8strike: strike chance for range of 26-40 hexes
  modDmgRoll:   modified roll on hit table
  MP:           mental power stat
  shock:        "status_shock" stat
  stat:         physical stat (ST, EN, DX, AY)
  points:       points of damage

  There are a number of options that can be set (see setDefaults below):

  opt_auto_shock:      automatically apply "shock" status (default: true)
  opt_auto_damage:     automatically apply damage (default: true)
  opt_grenade_no_size: grenade strike chance not dependent on target size or immobility (default: false)

*/

var UniverseCombat = UniverseCombat || (function() {
    'use strict';
    
    var version = '$Revision: 1.18 $',

	// Fields of hitTable in order:
	//  0 roll result
	//  1 points lost
	//  2 characteristic
	//  3 secondary characteristic
	//  4 tertiary characteristic
	//  5 armor_1
	//  6 armor_2
	//  7 armor_3
	//  8 armor_4
	//  9 armor_5
	// 10 equipment damage (none, superficial, light, heavy, partially destroyed, totally destroyed)
	hitTable = [
	    // <1 same as 1
	    [ 0,  0, 'NA', 'NA', 'NA', 0, 0, 0, 0, 0, 0],
	    [ 1,  0, 'NA', 'NA', 'NA', 0, 0, 0, 0, 0, 0],
	    [ 2,  1, 'ST', 'DX', 'EN', 0, 0, 0, 0, 0, 0],
	    [ 3,  1, 'DX', 'EN', 'AY', 0, 0, 0, 0, 0, 0],
	    [ 4,  2, 'EN', 'AY', 'ST', 1, 0, 0, 0, 0, 0],
	    [ 5,  2, 'AY', 'EN', 'ST', 1, 0, 0, 0, 0, 0],
	    [ 6,  3, 'EN', 'ST', 'AY', 1, 1, 0, 0, 0, 0],
	    [ 7,  3, 'ST', 'EN', 'AY', 2, 1, 0, 0, 0, 1],
	    [ 8,  4, 'EN', 'AY', 'ST', 2, 1, 1, 1, 0, 1],
	    [ 9,  4, 'AY', 'EN', 'ST', 2, 1, 1, 1, 0, 1],
	    [10,  5, 'EN', 'ST', 'DX', 2, 1, 1, 1, 0, 1],
	    [11,  5, 'ST', 'EN', 'DX', 2, 1, 1, 1, 1, 1],
	    [12,  6, 'EN', 'DX', 'AY', 3, 2, 1, 1, 1, 1],
	    [13,  6, 'DX', 'EN', 'AY', 3, 2, 1, 1, 1, 1],
	    [14,  7, 'EN', 'AY', 'ST', 3, 2, 1, 1, 1, 1],
	    [15,  7, 'AY', 'EN', 'ST', 3, 2, 1, 1, 1, 2],
	    [16,  8, 'EN', 'ST', 'AY', 3, 2, 2, 2, 1, 2],
	    [17,  8, 'ST', 'EN', 'AY', 4, 3, 2, 2, 1, 2],
	    [18,  9, 'EN', 'AY', 'ST', 4, 3, 2, 2, 2, 2],
	    [19,  9, 'AY', 'EN', 'ST', 4, 3, 2, 2, 2, 2],
	    [20, 10, 'EN', 'ST', 'DX', 4, 3, 3, 3, 2, 2],
	    [21, 10, 'ST', 'EN', 'DX', 4, 3, 3, 3, 2, 2],
	    [22, 11, 'EN', 'DX', 'ST', 5, 4, 3, 3, 2, 2],
	    [23, 11, 'DX', 'EN', 'ST', 5, 4, 3, 3, 2, 3],
	    [24, 12, 'EN', 'ST', 'AY', 5, 4, 3, 3, 2, 3],
	    [25, 13, 'ST', 'EN', 'AY', 5, 4, 3, 3, 3, 3],
	    [26, 13, 'ST', 'EN', 'AY', 5, 4, 3, 3, 3, 3],
	    [27, 14, 'EN', 'AY', 'ST', 5, 4, 4, 4, 3, 3],
	    [28, 14, 'EN', 'AY', 'ST', 5, 4, 4, 4, 3, 3],
	    [29, 15, 'AY', 'EN', 'ST', 5, 4, 4, 4, 3, 3],
	    [30, 15, 'AY', 'EN', 'ST', 5, 4, 4, 4, 3, 3],
	    [31, 16, 'EN', 'ST', 'AY', 6, 5, 5, 5, 4, 4],
	    [32, 16, 'EN', 'ST', 'AY', 6, 5, 5, 5, 4, 4],
	    [33, 16, 'EN', 'ST', 'AY', 6, 5, 5, 5, 4, 4],
	    [34, 17, 'ST', 'EN', 'AY', 6, 5, 5, 5, 4, 4],
	    [35, 17, 'ST', 'EN', 'AY', 6, 5, 5, 5, 4, 4],
	    [36, 17, 'ST', 'EN', 'AY', 6, 5, 5, 5, 4, 4],
	    [37, 17, 'ST', 'EN', 'AY', 6, 5, 5, 5, 4, 4],
	    [38, 18, 'EN', 'ST', 'AY', 6, 6, 6, 6, 5, 5],
	    // >38 same as 38
	],

	// IMPORTANT: if you change this here, you must change it in USheet.html
	// Fields of closeWeapontable in order:
	// 0 hit strength
	// 1 weapon name
	// 2 weapon skill
	// 3 mass (kg)
	// 4 price (T)
	closeWeaponTable = [
	    [ 6, 'Dagger', 'blades', 0.2, 0.01],
	    [10, 'Sword',  'blades', 2,   0.3 ]
	],
	
	// IMPORTANT: if you change this here, you must change it in USheet.html
	// Fields of rangedWeapontable in order:
	//  0 rate of fire
	//  1 hit strength
	//  2 civ level
	//  3 weapon name
	//  4 weapon skill
	//  5 range_0
	//  6 range_2
	//  7 range_4
	//  8 range_6
	//  9 range_8
	// 10 mass (kg)
	// 11 price (T)
	// 12 damage type (0=projectile, 1=beam, 2=stun)
	// 13 display name
	// 14 recoil
	rangedWeaponTable = [
	    [ 2,  8, 6, 'Paint gun (CL 6)', 'paintgun',      35,   25,   10,  -10,  -25, 12,   7,    1, 'CL6 paint gun', 0],
	    [ 6,  8, 8, 'Paint gun (CL 8)', 'paintgun',      35,   25,   10,  -10,  -25,  3,   9,    1, 'CL8 paint gun', 0],
	    [ 4, 10, 8, 'Arc gun',          'arcgun',        20,   15,    5,  -10,  -25,  4,  12,    1, 'arc gun', 0],
	    [ 4,  5, 5, 'Pistol',           'handguns',      60,   40,    0, -999, -999,  2,   0.08, 0, 'pistol', 1],
	    [ 4,  5, 6, 'Plastic pistol',   'handguns',      60,   40,    0, -999, -999,  1,   0.2,  0, 'plastic pistol', 1],
	    [ 2,  1, 8, 'Needle pistol',    'handguns',      55,   35,  -10, -999, -999,  2,   2,    0, 'needle pistol', 1],
	    [ 1,  6, 6, 'Laser pistol (CL6)',     'lsp_handgun',   60,   40,   20,    0,  -20,  4,   1,    1, 'laser pistol', 0],
	    [ 3,  6, 8, 'Laser pistol (CL8)',     'lsp_handgun',   60,   40,   20,    0,  -20,  2,   2,    1, 'laser pistol', 0],
	    [ 1,  8, 7, 'Stun pistol (CL7)',      'lsp_handgun',   65,   30, -999, -999, -999,  2,   1,    2, 'stun pistol', 0],
	    [ 2,  9, 8, 'Stun pistol (CL8)',      'lsp_handgun',   65,   30, -999, -999, -999,  1,   2,    2, 'stun pistol', 0],
	    [15,  7, 5, 'Machine gun',      'machineguns', -999,   40,   20,    0,  -20, 12,   3,    0, 'machine gun', 0],
	    [10,  5, 6, 'Submachine gun',   'machineguns',   40,   35,   10,    0, -999,  5,   2,    0, 'submachine gun', 1],
	    [ 2,  4, 2, 'Musket',           'longarms',    -999,   0, -  20,  -40, -999,  5,   0.3,  0, 'musket', 1],
	    [ 6,  7, 6, 'Rifle',            'longarms',      30,   35,   20,    0,  -15,  3,   0.8,  0, 'rifle', 1],
	    [ 4,  6, 5, 'Carbine',          'longarms',      45,   35,   15,   -5,  -25,  3,   0.6,  0, 'carbine', 1],
	    [ 1,  1, 5, 'Needle rifle (CL5)',     'longarms',      40,   30,   10,  -20, -999,  5,   2,    0, 'needle rifle', 1],
	    [ 2,  1, 7, 'Needle rifle (CL7)',     'longarms',      40,   30,   10,  -20, -999,  3,   3,    0, 'needle rifle', 1],
	    [ 3,  4, 1, 'Short bow',        'bows',          15,   25,    0, -999, -999,  1,   0.2,  0, 'short bow', 1],
	    [ 2,  6, 1, 'Long bow',         'bows',        -999,   20,   10,    5,  -55,  3,   0.6,  0, 'long bow', 1],
	    [ 1,  1, 3, 'Crossbow',         'bows',           0,   30,   10,  -15, -999,  4,   0.5,  0, 'crossbow', 0],
	    [ 1, 25, 4, 'Frag. grenade',    'grenades',    -999,   50,  -10,  -60, -999,  0.5, 0.1,  0, 'fragmentation grenade', 0],
	    [ 1,  4, 4, 'Smoke grenade',    'grenades',    -999,   50,  -10,  -60, -999,  0.5, 0.1,  0, 'smoke grenade', 0],
	    [ 1,  4, 4, 'Illum. grenade',   'grenades',    -999,   50,  -10,  -60, -999,  0.5, 0.1,  0, 'illumination grenade', 0],
	    [ 1,  4, 4, 'Gas grenade',      'grenades',    -999,   50,  -10,  -60, -999,  0.5, 0.1,  0, 'gas grenade', 0],
	    [ 1,  3, 1, 'Dagger',           'blades',      -999,   10,  -30, -999, -999,  0.2, 0.01, 0, 'dagger', 0],
	],
	
	// IMPORTANT: if you change this here, you must change it in USheet.html
	// Fields of armorTable in order:
	// 0 type
	// 1 civ level
	// 2 partial_start
	// 3 partial_end
	// 4 mass
	// 5 air
	// 6 encum
	// 7 augmented?
	// 8 projdef
	// 9 beamdef
	// 10 hit
	armorTable = [
	    ['Reflective (CL6)',        6, 1, 10,  11, 12,   2, 0, 1, 3,  2],
	    ['Reflective (CL8)',        8, 1, 10,   9, 24,   1, 0, 2, 5,  5],
	    ['Impact (CL5)',            5, 1, 10,  22,  0,   5, 0, 2, 1,  9],
	    ['Impact (CL7)',            7, 1, 10,  18, 18,   3, 1, 4, 2, 18],
	    ['Reflective/Impact (CL7)', 7, 1, 10,  20, 18,   4, 1, 3, 4, 11],
	    ['Reflective/Impact (CL8)', 8, 1, 10,  16, 24,   2, 1, 5, 5, 20],
	    ['Armor Vest',              6, 4,  7,  2,   0,   0, 0, 2, 2,  0],
	    ['Respirator Helmet (CL6)', 6, 8, 10,  6,  12,   0, 0, 2, 2,  0],
	    ['Respirator Helmet (CL8)', 8, 8, 10,  4,  24,   0, 0, 4, 4,  0],
	    ['Battle Sleeve',           8, 1,  2,  4,   0,   0, 0, 5, 5, 25],
	    ['Force Field (On)',        8, 1, 10,   2,  0, 999, 0, 6, 0,  0],
	    ['Force Field (Off)',       8, 1, 10,   2,  0,   0, 0, 0, 0,  0],
	    ['Expedition Suit (CL6)',   6, 1, 10,  11, 12,   2, 0, 1, 1,  0],
	    ['Expedition Suit (CL7)',   7, 1, 10,   7, 24,   1, 0, 1, 1,  0]
	],

	// Initialization functions.
	setDefaults = function() {
	    // sendChat("UniverseCombat","/w gm Setting defaults");
            state.UniverseCombat = {
		api_script: 'UniverseCombat',
		version: '$Revision: 1.18 $',
		debug: 0,
		opt_auto_shock:      true,
		opt_auto_damage:     true,
		opt_grenade_no_size: true,
	    };
	    if (state.UniverseCombat.opt_auto_damage || state.UniverseCombat.opt_auto_shock) {
		sendChat("GM", "!setattr-config useWorkers");
	    }
	},
    
	checkDefaults = function() {
	    if( ! state.UniverseCombat.version){state.UniverseCombat.version = '$Revision: 1.18 $'};
	},

	debug = function(msg) {
	    if (state.UniverseCombat.debug) {
		sendChat(state.UniverseCombat.api_script, msg);
	    }
	},

	//** Utility functions **
	// Source - https://stackoverflow.com/a/1026087
	// Posted by Steve Harrison, modified by community. See post 'Timeline' for change history
	// Retrieved 2026-08-03, License - CC BY-SA 4.0
	capitalizeFirstLetter = function(val) {
	    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
	},
	// Based on above.
	downcaseFirstLetter = function(val) {
	    return String(val).charAt(0).toLowerCase() + String(val).slice(1);
	},

	// Return array of all selected tokens.
	getSelectedTokens = function(msg) {
	    if (!msg.selected || msg.selected.length === 0) {
		return [];
	    }

	    const tokens = [];
	    msg.selected.forEach(selection => {
		if (selection._type === 'graphic') {
		    const token = getObj('graphic', selection._id);
		    if (token) {
			tokens.push(token);
		    }
		}
	    });
	    return tokens;
	},
	
	// Returns coordinates of a token
	tokenCoords = function(target) {
	    const token = getObj("graphic", target);
	    var page = getObj('page', token.get('pageid'));
	    var gridType = page.get('grid_type');
	    var coords;
	    switch(gridType) {
	    case 'hex':
		coords = [token.get("left"), token.get("top")];
		break;
            case 'hexr':
		coords = [token.get("left"), token.get("top")];
		break;
	    }
	    return coords;
	},

	// Computes the distances between 2 tokens by ID
	tokenDistance = function(attacker, defender) {
	    const token1 = getObj("graphic", attacker);
	    const token2 = getObj("graphic", defender);
	    if (token1.get('pageid') != token2.get('pageid')) {
		log('Cannot measure distance between tokens on different pages');
		return;
	    }
	    var distance;
	    var page = getObj('page', token1.get('pageid'));
	    var gridType = page.get('grid_type');
	    switch(gridType) {
	    case 'hex':
		distance = hexVDistance([token1.get("left"), token1.get("top")], [token2.get("left"), token2.get("top")]);
		break;
            case 'hexr':
		distance = hexHDistance([token1.get("left"), token1.get("top")], [token2.get("left"), token2.get("top")]);
		break;
	    }
	    return distance;
	},

	// Helper functions for tokenDistance.
	hexHDistance = function(unit1, unit2) {
	    var q1, q2, r1, r2;
	    q1 = Math.round((unit1[0] - 46.48512749037782) / 69.58512749037783);
	    r1 = Math.round((unit1[1] - 39.8443949917523) / 39.8443949917523);
	    r1 = Math.floor(r1 / 2);
	    q2 = Math.round((unit2[0] - 46.48512749037782) / 69.58512749037783);
	    r2 = Math.round((unit2[1] - 39.8443949917523) / 39.8443949917523);
	    r2 = Math.floor(r2 / 2);
	    return cubeDistance(oddQToCube(q1, r1), oddQToCube(q2, r2));
	},
	hexVDistance = function(unit1, unit2) {
	    var q1, q2, r1, r2;
	    q1 = Math.round((unit1[0] - 37.59928099223013) / 37.59928099223013);
	    r1 = Math.round((unit1[1] - 43.86582782426834) / 66.96582782426833);
	    q1 = Math.floor(q1 / 2);
	    q2 = Math.round((unit2[0] - 37.59928099223013) / 37.59928099223013);
	    r2 = Math.round((unit2[1] - 43.86582782426834) / 66.96582782426833);
	    q2 = Math.floor(q2 / 2);
	    return cubeDistance(oddRToCube(q1, r1), oddRToCube(q2, r2));
	},
	oddRToCube = function(q, r) {
	    var x, y, z;
	    x = q - (r - (r & 1)) / 2;
	    z = r;
	    y = -x - z;
	    return [x, y, z];
	},
	oddQToCube = function(q, r) {
	    var x, y, z;
	    x = q;
	    z = r - (q - (q & 1)) / 2;
	    y = -x - z;
	    return [x, y, z];
	},
	cubeDistance = function(cube1, cube2) {
	    return Math.max(Math.abs(cube1[0] - cube2[0]), Math.abs(cube1[1] - cube2[1]), Math.abs(cube1[2] - cube2[2]));
	},

	// Return a result in [1..10].
	rollD10 = function() {
	    return Math.floor(Math.random() * 10) + 1;
	},
    
	// Return a result in [1..12].
	rollD12 = function() {
	    return Math.floor(Math.random() * 12) + 1;
	},

	// Given a number, a singular, and a plural, return the number
	// plus the proper form.
	plural = function(number, singular, plural) {
	    if (number > 1) {
		return number + " " + plural;
	    } else {
		return number + " " + singular;
	    }
	},
    
	// Given a character ID, return the corresponding token (on the current page).
	getTokenForCharacter = function(characterId) {
	    var pageId = Campaign().get('playerpageid');
	    // log("playerpageid = " + pageId);
	    // log("looking for token for character ID " + characterId + " on page ID " + pageId)
	    const tokens = findObjs({
		_type: 'graphic',
		represents: characterId,
		_pageid: pageId
	    });

	    if (tokens.length == 0) {
		log(`No token found for character ${characterId} on page ${pageId}`);
		return null;
	    }
	    
	    if (tokens.length > 1) {
		log(`Warning: ${tokens.length} tokens found for character ${characterId}. Returning the first.`);
	    }

	    return tokens[0]; // Returns the Graphic object itself
	},

	// Determine damage based on a die roll.
	hitTableRoll = function(modDmgRoll) {
	    if (modDmgRoll < 1) {
		modDmgRoll = 1;
	    } else if (modDmgRoll > 38) {
		modDmgRoll = 38;
	    }
	    var damageResult = hitTable[modDmgRoll];
	    return damageResult;
	},

	//** Callable functions **

	// Target selection for the closeCombat() function.
	// IMPORTANT: if you change the parameters here, change them in handleInput as well.
	closeCombatTargetSelect = function(sourceCharId, weaponIdx, hitStrength, usingArmor) {
	    // log("using armor: " + usingArmor);
	    var weaponName;
	    if (weaponIdx < 0) { // unarmed combat
		weaponName = "unarmed combat";
	    } else if (usingArmor > 0) { // attacking with hit strength of armor
		weaponName = armorTable[weaponIdx][0];
	    } else {
		weaponName = closeWeaponTable[weaponIdx][1];
	    }
	    // log("attack with " + weaponName);
	    // log("hitStrength = " + hitStrength);
	    if (hitStrength <= 0) { // can't attack with all armor types
		log("invalid armor type " + weaponName);
		sendChat("character|" + sourceCharId, "\&{template:default} {{name=Close combat with " + weaponName + "}} {{Result=Cannot attack with " + weaponName + "}}");
		return;
	    }
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for attacking character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    // debug("sourceTokenId === " + sourceTokenId);
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    // debug("Close combat, " + sourceCharName + " attacking with " + weaponName);
	    // To find the target, we first generate a list of all tokens in the same hex as the attacker.
	    const pageid = sourceToken.get('pageid');
	    var allTokens = findObjs({
		_pageid: pageid,
	    });
	    var targetTokenIDs = [];
	    _.each(allTokens, function(obj) {
		var targetID = obj.get('_id');
		// log("on page " + pageid + ": " + targetID + " (type: " + obj.get('_type') + ")");
		if ((tokenDistance(sourceTokenId, targetID) < 1) && (sourceTokenId != targetID)) {
		    targetTokenIDs.push(obj.get('_id'));
		}
	    });
	    // debug("target IDs: " + targetTokenIDs);
	    // Abort if there are no valid targets
	    if (targetTokenIDs.length == 0) {
		sendChat(state.UniverseCombat.api_script, "No valid targets for close combat!")
		return;
	    }
	    // If there's only one valid target, there's no target selection needed.
	    if (targetTokenIDs.length == 1) {
		sendChat("character|" + sourceCharId, "!closeCombat " + sourceCharId + " " + targetTokenIDs[0] + " " + weaponIdx + " " + hitStrength + " " + usingArmor);
		return;
	    }
	    var selectMenu = "&{template:default} {{name=Select target for attack}} ";
	    _.each(targetTokenIDs, function(obj) {
		const targetToken = getObj("graphic", obj);
		if (!targetToken) {
		    log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not found");
		    return null;
		}
		const targetCharId = targetToken.get("represents");
		if (!targetCharId) {
		    log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not linked to a character");
		    return null;
		}
		const targetCharacter = getObj("character", targetCharId);
		if (!targetCharacter) {
		    log(state.UniverseCombat.api_script + " ERROR: targeted character " + targetCharacter + " not found");
		    return null;
		}
		// We use the token name instead of the character name
		// for cases where the players aren't supposed to know
		// whom the token represents.
		const targetCharName = targetToken.get("name");
		// const targetCharName = targetCharacter.get("name");
		selectMenu += "{{[" + targetCharName + "](!closeCombat " + sourceCharId + " " + obj + " " + weaponIdx + " " + hitStrength + " " + usingArmor + ")}} ";
	    });
	    selectMenu += "}}";
	    // log(selectMenu);
	    sendChat("character|" + sourceCharId, selectMenu);
	    // debug("selectZMenu === " + selectMenu);
	},
	
	// The main workhorse function for close combat.
	// IMPORTANT: if you change the parameters here, change them in handleInput as well.
	closeCombat = function(sourceCharId, targetTokenId, weaponIdx, hitStrength, usingArmor) {
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for attacking character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    const targetToken = getObj("graphic", targetTokenId);
	    if (!targetToken) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not found");
		return null;
	    }
	    const targetCharId = targetToken.get("represents");
	    if (!targetCharId) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not linked to a character");
		return null;
	    }
	    const targetCharacter = getObj("character", targetCharId);
	    if (!targetCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: targeted character " + targetCharacter + " not found");
		return null;
	    }
	    // We use the token name instead of the character name
	    // for cases where the players aren't supposed to know
	    // whom the token represents.
	    const targetCharName = targetToken.get("name");
	    // const targetCharName = targetCharacter.get("name");
	    // debug("Close combat, " + sourceCharName + " against " + targetCharName);
	    // We get the target's physical stats for later use in damage determination.
	    var targetAttr = {};
	    targetAttr["ST"] = getAttrByName(targetCharId, "st");
	    targetAttr["EN"] = getAttrByName(targetCharId, "en");
	    targetAttr["DX"] = getAttrByName(targetCharId, "dx");
	    targetAttr["AY"] = getAttrByName(targetCharId, "ay");
	    // In close combat, either the attacker or the defender
	    // may be hurt.  We need to account for both with respect
	    // to armor.
	    var pAttArmorCoverage = [];
	    pAttArmorCoverage[1] =  getAttrByName(sourceCharId, "parmor1");  // used in armor determination
	    pAttArmorCoverage[2] =  getAttrByName(sourceCharId, "parmor2");  // used in armor determination
	    pAttArmorCoverage[3] =  getAttrByName(sourceCharId, "parmor3");  // used in armor determination
	    pAttArmorCoverage[4] =  getAttrByName(sourceCharId, "parmor4");  // used in armor determination
	    pAttArmorCoverage[5] =  getAttrByName(sourceCharId, "parmor5");  // used in armor determination
	    pAttArmorCoverage[6] =  getAttrByName(sourceCharId, "parmor6");  // used in armor determination
	    pAttArmorCoverage[7] =  getAttrByName(sourceCharId, "parmor7");  // used in armor determination
	    pAttArmorCoverage[8] =  getAttrByName(sourceCharId, "parmor8");  // used in armor determination
	    pAttArmorCoverage[9] =  getAttrByName(sourceCharId, "parmor9");  // used in armor determination
	    pAttArmorCoverage[10] = getAttrByName(sourceCharId, "parmor10"); // used in armor determination
	    var bAttArmorCoverage = [];
	    bAttArmorCoverage[1] =  getAttrByName(sourceCharId, "barmor1");  // used in armor determination
	    bAttArmorCoverage[2] =  getAttrByName(sourceCharId, "barmor2");  // used in armor determination
	    bAttArmorCoverage[3] =  getAttrByName(sourceCharId, "barmor3");  // used in armor determination
	    bAttArmorCoverage[4] =  getAttrByName(sourceCharId, "barmor4");  // used in armor determination
	    bAttArmorCoverage[5] =  getAttrByName(sourceCharId, "barmor5");  // used in armor determination
	    bAttArmorCoverage[6] =  getAttrByName(sourceCharId, "barmor6");  // used in armor determination
	    bAttArmorCoverage[7] =  getAttrByName(sourceCharId, "barmor7");  // used in armor determination
	    bAttArmorCoverage[8] =  getAttrByName(sourceCharId, "barmor8");  // used in armor determination
	    bAttArmorCoverage[9] =  getAttrByName(sourceCharId, "barmor9");  // used in armor determination
	    bAttArmorCoverage[10] = getAttrByName(sourceCharId, "barmor10"); // used in armor determination
	    var pDefArmorCoverage = [];
	    pDefArmorCoverage[1] =  getAttrByName(targetCharId, "parmor1");  // used in armor determination
	    pDefArmorCoverage[2] =  getAttrByName(targetCharId, "parmor2");  // used in armor determination
	    pDefArmorCoverage[3] =  getAttrByName(targetCharId, "parmor3");  // used in armor determination
	    pDefArmorCoverage[4] =  getAttrByName(targetCharId, "parmor4");  // used in armor determination
	    pDefArmorCoverage[5] =  getAttrByName(targetCharId, "parmor5");  // used in armor determination
	    pDefArmorCoverage[6] =  getAttrByName(targetCharId, "parmor6");  // used in armor determination
	    pDefArmorCoverage[7] =  getAttrByName(targetCharId, "parmor7");  // used in armor determination
	    pDefArmorCoverage[8] =  getAttrByName(targetCharId, "parmor8");  // used in armor determination
	    pDefArmorCoverage[9] =  getAttrByName(targetCharId, "parmor9");  // used in armor determination
	    pDefArmorCoverage[10] = getAttrByName(targetCharId, "parmor10"); // used in armor determination
	    var bDefArmorCoverage = [];
	    bDefArmorCoverage[1] =  getAttrByName(targetCharId, "barmor1");  // used in armor determination
	    bDefArmorCoverage[2] =  getAttrByName(targetCharId, "barmor2");  // used in armor determination
	    bDefArmorCoverage[3] =  getAttrByName(targetCharId, "barmor3");  // used in armor determination
	    bDefArmorCoverage[4] =  getAttrByName(targetCharId, "barmor4");  // used in armor determination
	    bDefArmorCoverage[5] =  getAttrByName(targetCharId, "barmor5");  // used in armor determination
	    bDefArmorCoverage[6] =  getAttrByName(targetCharId, "barmor6");  // used in armor determination
	    bDefArmorCoverage[7] =  getAttrByName(targetCharId, "barmor7");  // used in armor determination
	    bDefArmorCoverage[8] =  getAttrByName(targetCharId, "barmor8");  // used in armor determination
	    bDefArmorCoverage[9] =  getAttrByName(targetCharId, "barmor9");  // used in armor determination
	    bDefArmorCoverage[10] = getAttrByName(targetCharId, "barmor10"); // used in armor determination
	    var weaponName;
	    if (weaponIdx < 0) { // unarmed combat
		weaponName = "unarmed combat";
	    } else if (usingArmor > 0) {
		weaponName = armorTable[weaponIdx][0];
	    } else {
		weaponName = closeWeaponTable[weaponIdx][1];
	    }
	    // log("attack with " + weaponName);
	    // log("target: " + targetCharId);
	    var defense = getAttrByName(targetCharId, "close_defense");
	    // log("defense of " + targetCharName + " = " + defense);
	    var diff = hitStrength - defense;
	    // log("differential = " + diff);
	    var templateString = "\&{template:default}";
	    templateString += " {{name=Close combat";
	    if (weaponIdx < 0) {
		templateString += " (unarmed)";
	    } else {
		templateString += " with " + weaponName.toLowerCase();
	    }
	    templateString += "}}";
	    templateString += " {{Target=" + targetCharName + "}}";
	    templateString += " {{Attacker=" + hitStrength + "}}";
	    templateString += " {{Defender=" + defense + "}}";
	    var result;
	    let dieRoll = rollD10();
	    // log("Roll: " + dieRoll);
	    // Determine possible Experience Points.
	    var earnedEP = 0;
	    if (weaponIdx < 0 && (dieRoll == 9 || dieRoll == 10)) { // unarmed combat: roll a 9 or a 0
		earnedEP = 1;
	    } else if (dieRoll == 10) { // blades or body armor: roll a 0
		earnedEP = 1;
	    }
	    templateString += " {{Roll=" + dieRoll + "}}";
	    diff += dieRoll;
	    // log("Modified roll: " + diff);
	    templateString += " {{Differential=" + diff + " (" + hitStrength + " - " + defense + " + " + dieRoll + ")}}";
	    var target;
	    if (diff >= 4) {	// hits to defender
		// log("attack: hits to defender");
		result = "Defender suffers hits; ";
	    } else if ((diff >= -3) && (diff <= 3)) { // no effect
		// log("attack: no effect");
		result = "Attack has no effect";
	    } else if (diff <= -4) {		     // hits to attacker
		// log("attack: hits to attacker");
		result = "Attacker suffers hits; ";
	    } else {				     // We should NEVER get here
		log("ERROR in die roll for close combat!");
	    }
	    if ((diff <= -4) || (diff >= 4)) { // some effect
		var dmgRoll = Math.floor(Math.abs(diff)/2);
		var damageResult = hitTableRoll(dmgRoll);
		var damage = damageResult[1];
		var armorResult = damageResult[6]; // close combat always uses "2 fires" column
		// log(damage + " points lost from " + damageResult[2]);
		// See if armor protects the location hit (which is determined by dmgRoll) (30.6).
		var armorProt = 0;
		var applyDamageArgs = [];
		if (diff < 0) {	    // attacker hit
		    armorProt = pAttArmorCoverage[dmgRoll];
		    applyDamageArgs = [targetTokenId];
		} else {	    // defender hit
		    armorProt = pDefArmorCoverage[dmgRoll];
		    applyDamageArgs = [sourceTokenId];
		}
		// log("armorResult == " + armorResult);
		// log("armorProt == " + armorProt);
		// log("raw damage is " + damage);
		if (armorResult > 0 && armorProt > 0) {
		    if (armorResult < armorProt) { // damage less than armor protection
			result += " damage blocked by armor";
			damage = 0;
		    } else if (armorResult == armorProt) { // exactly equal: minor damage to armor
			result += " damage blocked, but armor receives superficial damage (both protection ratings reduced by 1); ";
			damage = 0;
		    } else { // armorResult > armorProt; some damage gets through
			var diff = armorResult - armorProt;
			damage -= armorProt;
			if (diff == 1) {
			    result += "armor receives light damage (both protection ratings reduced by 1); ";
			} else if (diff == 2) {
			    result += "armor receives heavy damage (both protection ratings reduced by 2); ";
			} else if (diff == 3) {
			    result += "armor partially destroyed (both protection ratings reduced by 3); ";
			} else { // diff >= 4
			    result += "armor totally destroyed; ";
			}
		    }
		}
		var applyDamageArgs = [targetTokenId];
		if (damage > 0) {
		    if (damage > targetAttr[damageResult[2]]) { // damage exceeds first attribute
			result += targetAttr[damageResult[2]] + " points lost from " + damageResult[2];
			applyDamageArgs.push(damageResult[2], targetAttr[damageResult[2]]);
			damage -= targetAttr[damageResult[2]];
		    } else {
			result += damage + " points lost from " + damageResult[2];
			applyDamageArgs.push(damageResult[2], damage);
			damage = 0;
		    }
		}
		if (damage > 0) {
		    if (damage > targetAttr[damageResult[3]]) { // remaining damage exceeds second attribute
			result += " and " + targetAttr[damageResult[3]] + " points lost from " + damageResult[3];
			applyDamageArgs.push(damageResult[3], targetAttr[damageResult[3]]);
			damage -= targetAttr[damageResult[3]];
		    }  else {
			result += " and " + damage + " points lost from " + damageResult[3];
			applyDamageArgs.push(damageResult[3], damage);
			damage = 0;
		    }
		}
		if (damage > 0) {
		    // There is no result that doesn't include ST and
		    // EN as potential affected stats.  That means the
		    // target is dead.  So we don't bother checking if
		    // the third affected stat is big enough.
		    result += " and " + damage + " points lost from " + damageResult[4];
		    applyDamageArgs.push(damageResult[4], damage);
		}
		applyDamage(...applyDamageArgs);
		// result += damageResult[1] + " points lost from " + damageResult[2] + " (then " + damageResult[3] + ", then " + damageResult[4] + "); armor result " + damageResult[6];
		if (damageResult[10] > 0) { // some equipment damage
		    result += "; equipment " + ["suffers no damage", "suffers superficial damage", "suffers light damage", "suffers heavy damage", "is partially destroyed", "is totally destroyed"][damageResult[10]];
		}
	    }
	    templateString += " {{Result=" + result + "}}";
	    if (earnedEP) {
		templateString += " {{Experience=1 EP earned}}";
	    }
	    sendChat("character|" + sourceCharId, templateString);
	    // log(templateString);
	},
	
	// The main workhorse function for ranged fire.
	// IMPORTANT: if you change the parameters here, change them in handleInput as well.
	fireWeapon = function(sourceCharId, targetTokenId, weaponIdx, range0strike, range2strike, range4strike, range6strike, range8strike, hitStrength, numFires, modifier) {
	    // log("character " + sourceCharId + " firing " + weaponIdx + " at token " + targetTokenId)
	    // log("numFires == " + numFires);
	    // log("modifier == " + modifier);
	    // If the "weapon" is a grenade, use fireGrenade instead.
	    if ((weaponIdx >= 20) && (weaponIdx <= 23)) {
		fireGrenade(sourceCharId, targetTokenId, weaponIdx, range0strike, range2strike, range4strike, range6strike, range8strike, hitStrength, numFires, modifier);
		return;
	    }
	    var weaponName = rangedWeaponTable[weaponIdx][13];
	    var dmgType = rangedWeaponTable[weaponIdx][12];
	    var rate = rangedWeaponTable[weaponIdx][0];
	    var recoil = rangedWeaponTable[weaponIdx][14];
	    modifier ||= 0;
	    numFires ||= 1;
	    if (numFires > rate) {
		numFires = rate;
	    }
	    // log("hitStrength = " + hitStrength);
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for firing character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    const targetToken = getObj("graphic", targetTokenId);
	    if (!targetToken) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not found");
		return null;
	    }
	    const targetCharId = targetToken.get("represents");
	    if (!targetCharId) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not linked to a character");
		return null;
	    }
	    const targetCharacter = getObj("character", targetCharId);
	    if (!targetCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: targeted character " + targetCharacter + " not found");
		return null;
	    }
	    // We use the token name instead of the character name
	    // for cases where the players aren't supposed to know
	    // whom the token represents.
	    const targetCharName = targetToken.get("name");
	    // const targetCharName = targetCharacter.get("name");
	    // debug("Ranged fire, " + sourceCharName + " firing " + weaponName + " at " + targetCharName + ", " + numFires + " shots");
	    // We get the target's physical stats for later use in damage determination.
	    var targetAttr = {};
	    targetAttr["size"] = getAttrByName(targetCharId, "size");
	    // log("size of target is " + targetAttr["size"]);
	    targetAttr["globEnvTV"] = getAttrByName(targetCharId, "globEnvTV");
	    targetAttr["status_prone"] = getAttrByName(targetCharId, "status_prone");
	    targetAttr["status_immobile"] = getAttrByName(targetCharId, "status_immobile");
	    targetAttr["ST"] = getAttrByName(targetCharId, "st");
	    targetAttr["EN"] = getAttrByName(targetCharId, "en");
	    targetAttr["DX"] = getAttrByName(targetCharId, "dx");
	    targetAttr["AY"] = getAttrByName(targetCharId, "ay");
	    targetAttr["MP"] = getAttrByName(targetCharId, "mp"); // used in stun calculations
	    targetAttr["full_armor"] = getAttrByName(targetCharId, "full_armor"); // used in stun calculations
	    var pArmorCoverage = [];
	    pArmorCoverage[1] =  getAttrByName(targetCharId, "parmor1");  // used in armor determination
	    pArmorCoverage[2] =  getAttrByName(targetCharId, "parmor2");  // used in armor determination
	    pArmorCoverage[3] =  getAttrByName(targetCharId, "parmor3");  // used in armor determination
	    pArmorCoverage[4] =  getAttrByName(targetCharId, "parmor4");  // used in armor determination
	    pArmorCoverage[5] =  getAttrByName(targetCharId, "parmor5");  // used in armor determination
	    pArmorCoverage[6] =  getAttrByName(targetCharId, "parmor6");  // used in armor determination
	    pArmorCoverage[7] =  getAttrByName(targetCharId, "parmor7");  // used in armor determination
	    pArmorCoverage[8] =  getAttrByName(targetCharId, "parmor8");  // used in armor determination
	    pArmorCoverage[9] =  getAttrByName(targetCharId, "parmor9");  // used in armor determination
	    pArmorCoverage[10] = getAttrByName(targetCharId, "parmor10"); // used in armor determination
	    var bArmorCoverage = [];
	    bArmorCoverage[1] =  getAttrByName(targetCharId, "barmor1");  // used in armor determination
	    bArmorCoverage[2] =  getAttrByName(targetCharId, "barmor2");  // used in armor determination
	    bArmorCoverage[3] =  getAttrByName(targetCharId, "barmor3");  // used in armor determination
	    bArmorCoverage[4] =  getAttrByName(targetCharId, "barmor4");  // used in armor determination
	    bArmorCoverage[5] =  getAttrByName(targetCharId, "barmor5");  // used in armor determination
	    bArmorCoverage[6] =  getAttrByName(targetCharId, "barmor6");  // used in armor determination
	    bArmorCoverage[7] =  getAttrByName(targetCharId, "barmor7");  // used in armor determination
	    bArmorCoverage[8] =  getAttrByName(targetCharId, "barmor8");  // used in armor determination
	    bArmorCoverage[9] =  getAttrByName(targetCharId, "barmor9");  // used in armor determination
	    bArmorCoverage[10] = getAttrByName(targetCharId, "barmor10"); // used in armor determination
	    // Compute the range
	    // log("range from " + sourceTokenId + " to " + targetTokenId);
	    const range = tokenDistance(sourceTokenId, targetTokenId);
	    // log("range is " + range);
	    var strikeChance = 0;
	    if (range < 1) {
		strikeChance = range0strike;
	    } else if (range < 5) {
		strikeChance = range2strike;
	    } else if (range < 14) {
		strikeChance = range4strike;
	    } else if (range < 26) {
		strikeChance = range6strike;
	    } else if (range < 41) {
		strikeChance = range8strike;
	    } else {
		strikeChance = 'P';
	    }
	    if ((numFires > 1) && (recoil > 0)) {
		strikeChance -= (numFires - 1) * 5;
		// log("recoil accounted for");
	    }
	    // debug("Chance to hit is " + strikeChance + "%");
	    var templateString = "\&{template:default}";
	    templateString += " {{name=" + capitalizeFirstLetter(weaponName) + " fire}}";
	    templateString += " {{Target=" + targetCharName;
	    if (numFires > 1) {
		templateString += " (" + numFires + " shots)";
	    }
	    templateString += "}}";
	    templateString += " {{Range=" + range + " hexes (" + range*5 + " meters)}}";
	    if (strikeChance === 'P') { // prohibited at this range
		templateString += " {{Result=Fire prohibited at this range}}";
		sendChat("character|" + sourceCharId, templateString);
		return;
	    } else {
		modifier = parseInt(modifier, 10);
		modifier += parseInt(targetAttr["size"], 10);
		// log("modifier for size");
		if (targetAttr["status_prone"] == 1) {
		    modifier -= targetAttr["globEnvTV"];
		    // log("-" + targetAttr["globEnvTV"] + " for terrain (prone)");
		}
		if (targetAttr["status_immobile"] == 1) { // target is immobile
		    modifier += 20;
		    // log("+20 for immobility");
		}
		// log("modifier is " + modifier);
		strikeChance = parseInt(strikeChance, 10) + parseInt(modifier, 10);
		// log("strike chance is " + strikeChance);
		// We're firing numFires shots.  Each one can do one of the following:
		// * Hit the intended target.
		// * Miss completely.
		// * Hit an unintended target in the line of fire.
		// * Hit an unintended target near the line of fire (you were WAY off).
		var targetHits = 0;
		var misses = 0;
		var accidentHits = 0;
		var wayOffHits = 0;
		var earnedEP = 0;

		var allRolls = "";
		for (let shot = 1; shot <= numFires; shot++) {
		    // Percentile roll to hit
		    let tensDie = rollD10();
                    let onesDie = rollD10();
                    
                    // Convert to percentile (treat 10 as 0)
                    let tensValue = (tensDie % 10) * 10;  // 10 → 0, 1 → 10, ... 9 → 90
                    let onesValue = (onesDie % 10);       // 10 → 0, 1 → 1, ... 9 → 9
                    let diceRoll = tensValue + onesValue;
                    
                    // Handle the "00 + 0 = 100" case
                    if (diceRoll === 0) diceRoll = 100;
                    
                    // log(`Tens die: ${tensDie} (${tensValue})`);
                    // log(`Ones die: ${onesDie} (${onesValue})`);
		    // log(`Damage roll: ${dmgRoll}`);
                    // log(`Dice roll result: ${diceRoll}`);
		
		    if (tensDie == 10 || onesDie == 10) {
			earnedEP = 1;
		    }
		    
		    // log("diceRoll = " + diceRoll);
		    if (allRolls != "") {
			allRolls += ", " + diceRoll;
		    } else {
			allRolls += diceRoll;
		    }
		    if (diceRoll <= strikeChance) {
			targetHits++;
		    } else {
			// Arc guns (rangeWeaponTable index 2) never hit
			// unintended targets.  See 19.0, 29.7.
			if (weaponIdx == 2) {
			    if (diceRoll > strikeChance) {
				misses++;
			    }
			} else if (diceRoll - strikeChance <= 30) {
			    misses++;
			} else if (diceRoll - strikeChance <= 50) {
			    accidentHits++;
			} else {
			    wayOffHits++;
			}
		    }
		}
		// log(targetHits + " hits, " + misses + " misses, " + accidentHits + " accidental hits, " + wayOffHits + " way-off hits")
		var result = "";
		if (numFires == 1) {
		    if (targetHits > 0) {
			result += "Hit"
		    } else if (misses > 0) {
			result += "Miss"
		    } else if (accidentHits > 0) {
			result += "Hit unintended target in line of fire";
		    } else if (wayOffHits > 0) {
			result += "Hit unintended target near line of fire";
		    } else { // we should never get here
			result += "WE SHOULD NEVER GET HERE!!";
		    }
		} else { 	// more than one shot
		    if (targetHits > 0) {
			result += targetHits + " hits";
		    }
		    if (misses > 0) {
			if (result != "") {
			    result += "; ";
			}
			result += misses + " misses";
		    }
		    if (accidentHits > 0) {
			if (result != "") {
			    result += "; ";
			}
			result += accidentHits + " hits to line-of-fire targets";
		    }
		    if (wayOffHits > 0) {
			if (result != "") {
			    result += "; ";
			}
			result += wayOffHits + " hits to targets near line of fire";
		    }
		}
		// First we deal with any intentional hits.
		var damage = "";
		if (targetHits > 0) {
		    var dmgRoll = rollD10();
		    var modDmgRoll = parseInt(dmgRoll,10) + parseInt(hitStrength,10) * targetHits;
		    // log("Modified damage roll result: " + modDmgRoll);
		    if (result != "") {
			result += "; ";
		    }
		    if (dmgType == 2) { // stun result
			if (targetAttr["full_armor"] == 1) {
			    modDmgRoll = parseInt(dmgRoll,10) + Math.floor((parseInt(hitStrength,10) * targetHits)/2);
			    // log("full armor, stun attenuated");
			    damage += " " + modDmgRoll + " points of stun to target (attenuated by armor)";
			} else {
			    damage += " " + modDmgRoll + " points of stun to target";
			}
			var enmp = parseInt(targetAttr["EN"],10) + parseInt(targetAttr["MP"],10);
			// log("enmp = " + enmp);
			if (modDmgRoll > enmp) {
			    damage += "; stunned for " + (modDmgRoll - enmp) + " rounds (" + 15*(modDmgRoll - enmp) + " seconds)";
			} else {
			    damage += "; no effect";
			}
			// log("damage: " + damage);
			result += damage;
		    } else {    // actual damage
			// log("hit; determine damage");
			// Something was (or may have been) hit, so we roll for damage.
			var damageResult = hitTableRoll(modDmgRoll);
			damage = damageResult[1];
			var armorResult = 0;
			if (targetHits > 5) {
			    armorResult = damageResult[9];
			} else {
			    armorResult = damageResult[targetHits + 4];
			}
			// See if armor protects the location hit (which is determined by dmgRoll) (30.6).
			var armorProt = 0;
			if (dmgType == 0) { // projectile weapon
			    armorProt = pArmorCoverage[dmgRoll];
			} else if (dmgType == 1) { // beam weapon
			    armorProt = bArmorCoverage[dmgRoll];
			} else {
			    log("ERROR: Unknown damage type " + dmgType);
			}
			// log("armorResult == " + armorResult);
			// log("armorProt == " + armorProt);
			// log("raw damage is " + damage);
			if (armorResult > 0 && armorProt > 0) {
			    if (armorResult < armorProt) { // damage less than armor protection
				result += " damage blocked by armor";
				damage = 0;
			    } else if (armorResult == armorProt) { // exactly equal: minor damage to armor
				result += " damage blocked, but armor receives superficial damage (both protection ratings reduced by 1); ";
				damage = 0;
			    } else { // armorResult > armorProt; some damage gets through
				var diff = armorResult - armorProt;
				damage -= armorProt;
				if (diff == 1) {
				    result += "armor receives light damage (both protection ratings reduced by 1); ";
				} else if (diff == 2) {
				    result += "armor receives heavy damage (both protection ratings reduced by 2); ";
				} else if (diff == 3) {
				    result += "armor partially destroyed (both protection ratings reduced by 3); ";
				} else { // diff >= 4
				    result += "armor totally destroyed; ";
				}
			    }
			}
			var applyDamageArgs = [targetTokenId];
			if (damage > 0) {
			    if (damage > targetAttr[damageResult[2]]) { // damage exceeds first attribute
				result += " " + targetAttr[damageResult[2]] + " points lost from " + damageResult[2];
				applyDamageArgs.push(damageResult[2], targetAttr[damageResult[2]]);
				damage -= targetAttr[damageResult[2]];
			    } else {
				result += damage + " points lost from " + damageResult[2];
				applyDamageArgs.push(damageResult[2], damage);
				damage = 0;
			    }
			}
			if (damage > 0) {
			    if (damage > targetAttr[damageResult[3]]) { // remaining damage exceeds second attribute
				result += " and " + targetAttr[damageResult[3]] + " points lost from " + damageResult[3];
				applyDamageArgs.push(damageResult[3], targetAttr[damageResult[3]]);
				damage -= targetAttr[damageResult[3]];
			    }  else {
				result += " and " + damage + " points lost from " + damageResult[3];
				applyDamageArgs.push(damageResult[3], damage);
				damage = 0;
			    }
			}
			if (damage > 0) {
			    // There is no result that doesn't include ST and
			    // EN as potential affected stats.  That means the
			    // target is dead.  So we don't both checking if
			    // the third affected stat is big enough.
			    result += " and " + damage + " points lost from " + damageResult[4];
			    applyDamageArgs.push(damageResult[4], damage);
			}
		    }
		    if (applyDamageArgs.length > 1) {
			// log("applyDamage args are " + applyDamageArgs);
			applyDamage(...applyDamageArgs);
		    } 		// else no damage
		}
		if (numFires > (parseInt(rate,10)/2.0)) {
		    result += "; character must reload next round";
		    sendChat(state.UniverseCombat.api_script, "!setattr --silent --charid " + sourceCharId + " --set status_reloading|1");
		}
		// For accidental hits, we don't know what targets
		// (if any) have received one or more hits, so for
		// now we just ignore possible damage.
		templateString += " {{Strike chance=" + strikeChance + "}}";
		templateString += " {{Die roll(s)=" + allRolls + "}}";
		// templateString += " {{Dice roll=" + tensDie + onesDie % 10 + "}}";
		templateString += " {{Result=" +  result + "}}";
		// if (damage != "") {
		//     templateString += " {{Damage=" +  damage + "}}";
		// }
		if (earnedEP) {
		    templateString += " {{Experience=1 EP earned}}";
		}
		sendChat("character|" + sourceCharId, templateString);
	    }
	},
	
	// The main workhorse function for thrown grenades.
	// IMPORTANT: if you change the parameters here, change them in handleInput as well.
	fireGrenade = function(sourceCharId, targetTokenId, weaponIdx, range0strike, range2strike, range4strike, range6strike, range8strike, hitStrength, numFires, modifier) {
	    // log("numFires == " + numFires);
	    // log("modifier == " + modifier);
	    var weaponName = rangedWeaponTable[weaponIdx][13];
	    var dmgType = rangedWeaponTable[weaponIdx][12];
	    var rate = rangedWeaponTable[weaponIdx][0];
	    modifier ||= 0;
	    numFires ||= 1;
	    if (numFires > rate) {
		numFires = rate;
	    }
	    // log("hitStrength = " + hitStrength);
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for firing character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    const targetToken = getObj("graphic", targetTokenId);
	    if (!targetToken) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not found");
		return null;
	    }
	    // Because a grenade can be thrown at an empty hex, we
	    // don't assume the "target" is a character.  That way we
	    // can use a dummy token as the target.  The "name" of the
	    // target is the hex coordinates.
	    const coords = tokenCoords(targetTokenId);
	    var targetCharName;
	    const targetCharId = targetToken.get("represents");
	    // If the target is a character/creature, use its name instead.
	    if (!targetCharId) {
		targetCharName = "hex at (" + coords[0].toFixed(2) + ", " + coords[1].toFixed(2) + ")";
	    } else {
		targetCharName = targetToken.get("name");
	    }
	    // debug("Grenade thrown by " + sourceCharName + " at " + targetCharName);
	    var targetAttr = {};
	    if (targetCharId) {
		targetAttr["size"] = getAttrByName(targetCharId, "size");
		targetAttr["globEnvTV"] = getAttrByName(targetCharId, "globEnvTV");
		targetAttr["status_prone"] = getAttrByName(targetCharId, "status_prone");
		targetAttr["status_immobile"] = getAttrByName(targetCharId, "status_immobile");
	    }
	    // Compute the range
	    const range = tokenDistance(sourceTokenId, targetTokenId);
	    // log("range is " + range);
	    var strikeChance = 0;
	    if (range < 1) {
		strikeChance = range0strike;
	    } else if (range < 5) {
		strikeChance = range2strike;
	    } else if (range < 14) {
		strikeChance = range4strike;
	    } else if (range < 26) {
		strikeChance = range6strike;
	    } else if (range < 41) {
		strikeChance = range8strike;
	    } else {
		strikeChance = 'P';
	    }
	    // debug("Chance to hit is " + strikeChance + "%");
	    var templateString = "\&{template:default}";
	    templateString += " {{name=" + capitalizeFirstLetter(weaponName) + " fire}}";
	    templateString += " {{Target=" + targetCharName;
	    templateString += "}}";
	    templateString += " {{Range=" + range + " hexes (" + range*5 + " meters)}}";
	    if (strikeChance === 'P') { // prohibited at this range
		templateString += " {{Result=Fire prohibited at this range}}";
		sendChat("character|" + sourceCharId, templateString);
		return;
	    } else {
		modifier = parseInt(modifier, 10);
		if (state.UniverseCombat.opt_grenade_no_size) { // nothing
		    // log("ignoring effects of size etc.");
		} else {
		    if (targetCharId) {
			modifier += parseInt(targetAttr["size"], 10);
			log("modifier for size");
			if (targetAttr["status_prone"] == 1) {
			    modifier -= targetAttr["globEnvTV"];
			    // log("-" + targetAttr["globEnvTV"] + " for terrain (prone)");
			}
			if (targetAttr["status_immobile"] == 1) { // target is immobile
			    modifier += 20;
			    // log("+20 for immobility");
			}
		    }
		}
		log("modifier is " + modifier);
		strikeChance = parseInt(strikeChance, 10) + parseInt(modifier, 10);
		// We're firing numFires shots.  Each one can do one of the following:
		// * Hit the intended target.
		// * Hit a hex 1+ hex(es) away.
		var targetHits = 0;
		var misses = 0;
		var hexesAway = 0;
		var earnedEP = 0;

		var allRolls = "";
		for (let shot = 1; shot <= numFires; shot++) {
		    // Percentile roll to hit
		    let tensDie = rollD10();
                    let onesDie = rollD10();
                    
                    // Convert to percentile (treat 10 as 0)
                    let tensValue = (tensDie % 10) * 10;  // 10 → 0, 1 → 10, ... 9 → 90
                    let onesValue = (onesDie % 10);       // 10 → 0, 1 → 1, ... 9 → 9
                    let diceRoll = tensValue + onesValue;
                    
                    // Handle the "00 + 0 = 100" case
                    if (diceRoll === 0) diceRoll = 100;
                    
                    // log(`Tens die: ${tensDie} (${tensValue})`);
                    // log(`Ones die: ${onesDie} (${onesValue})`);
		    // log(`Damage roll: ${dmgRoll}`);
                    // log(`Dice roll result: ${diceRoll}`);
		    
		    if (tensDie == 10 || onesDie == 10) {
			earnedEP = 1;
		    }
		    
		    // log("diceRoll = " + diceRoll);
		    if (allRolls != "") {
			allRolls += ", " + diceRoll;
		    } else {
			allRolls += diceRoll;
		    }
		    if (diceRoll <= strikeChance) {
			targetHits++;
		    } else {
			// Grenades land 1 hex away for every 10
			// points (or fraction thereof) over the
			// strike chance.
			misses++;
			hexesAway = Math.ceil((diceRoll - strikeChance)/10);
		    }
		}
		// log(targetHits + " hits, " + misses + " misses");
		var result = "";
		if (numFires == 1) {
		    if (targetHits > 0) {
			result += "Hit"
		    } else if (misses > 0) {
			var direction = rollD12();
			result += "Grenade lands "+ plural(hexesAway, "hex", "hexes") + " away in the " + direction + " o'clock direction";
		    } else { // we should never get here
			result += "WE SHOULD NEVER GET HERE!!";
		    }
		} else { 	// more than one shot; not currently possible with grenades
		    if (targetHits > 0) {
			result += targetHits + " hits";
		    }
		    if (misses > 0) {
			if (result != "") {
			    result += "; ";
			}
			result += misses + " misses";
		    }
		}
		// Because grenades are an area-effect weapon, we
		// can't calculate damage for all targets (or at least
		// choose not to).  So we just compute the hit table
		// roll.
		var damage = "";
//		if (targetHits > 0) {
		    var dmgRoll = rollD10();
		    var modDmgRoll = parseInt(dmgRoll,10) + parseInt(hitStrength,10) * targetHits;
		    // log("Modified damage roll result: " + modDmgRoll);
		    if (result != "") {
			result += "; ";
		    }
		    if (dmgType == 2) { // stun result (there may be stun grenades in the future)
			if (targetAttr["full_armor"] == 1) {
			    modDmgRoll = parseInt(dmgRoll,10) + Math.floor((parseInt(hitStrength,10) * targetHits)/2);
			    // log("full armor, stun attenuated");
			    damage += " " + modDmgRoll + " points of stun to target(s) (attenuated by armor)";
			} else {
			    damage += " " + modDmgRoll + " points of stun to target(s)";
			}
			// log("damage: " + damage);
			result += damage;
		    } else {    // actual damage
			// log("hit; determine damage");
			// Something was (or may have been) hit, so we roll for damage.
			var damageResult = hitTableRoll(modDmgRoll);
			damage = damageResult[1];
			var armorResult = 0;
			// if (targetHits > 5) {
			//     armorResult = damageResult[9];
			// } else {
			//     armorResult = damageResult[targetHits + 4];
			// }
			// Ignore the above.  We roll for damage whether or not there's a hit.
			armorResult = damageResult[5];
			if (damage == 0) {
			    result += damage + " points of damage to target and adjacent hexes; armor result " + armorResult;
 			} else {
			    result += damage + " points of damage to target and adjacent hexes (" + damageResult[2] + "/" + damageResult[3] + "/" + damageResult[4] + "); armor result " + armorResult;
			}
		    }
//		}
		templateString += " {{Strike chance=" + strikeChance + "}}";
		templateString += " {{Die roll(s)=" + allRolls + "}}";
		// templateString += " {{Dice roll=" + tensDie + onesDie % 10 + "}}";
		templateString += " {{Result=" +  result + "}}";
		// if (damage != "") {
		//     templateString += " {{Damage=" +  damage + "}}";
		// }
		if (earnedEP) {
		    templateString += " {{Experience=1 EP earned}}";
		}
		sendChat("character|" + sourceCharId, templateString);
	    }
	},

	shockCheck = function(sourceCharId, mp, statusShock) {
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for firing character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    var templateString = "\&{template:default}";
	    templateString += " {{name=Shock check for " + sourceCharName + "}}";
	    var dieRoll = rollD10();
	    templateString += " {{MP=" + mp + "}} {{Die roll=" + dieRoll + "}}";
	    if (dieRoll <= mp) {
		templateString += " {{Result=No effect}}";
		statusShock = 0;
	    } else {
		templateString += " {{Result=Character in shock; no actions until after following round}}";
		statusShock = 1;
	    }
	    var tokenStatusShock = (statusShock == 1) ? true : false;
	    sendChat("character|" + sourceCharId, templateString);
	    if (state.UniverseCombat.opt_auto_shock) {
		sendChat("GM", "!setattr --silent --charid " + sourceCharId + " --status_shock|" + statusShock);
		sourceToken.set("status_Frightened::7084073", tokenStatusShock);
	    }
	    // sourceCharacter.set("status_shock"', statusShock);
	},

	willpowerCheck = function(sourceCharId, ag, mp) {
	    ag = parseInt(ag, 10);
	    mp = parseInt(mp, 10);
	    const sourceToken = getTokenForCharacter(sourceCharId);
	    if (!sourceToken) {
		log(state.UniverseCombat.api_script + " ERROR: token for firing character " + sourceCharId + " not found");
		return null;
	    }
	    const sourceTokenId = sourceToken.get('_id');
	    const sourceCharacter = getObj("character", sourceCharId);
	    if (!sourceCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: source character " + sourceCharacter + " not found");
		return null;
	    }
	    const sourceCharName = sourceCharacter.get("name");
	    var templateString = "\&{template:default}";
	    templateString += " {{name=Willpower check for " + sourceCharName + "}}";
	    var dieRoll = rollD10();
	    templateString += " {{AG=" + ag + "}} {{MP=" + mp + "}} {{Die roll=" + dieRoll + "}}";
	    var lower = ag - mp;
	    var upper = ag + mp;
	    var statusProne = 0;
	    // templateString += " {{Limits=" + lower + ", " + upper + "}}";
	    if ((dieRoll >= lower) && (dieRoll <= upper)) { // pass
		templateString += " {{Result=Check passed}}";
	    } else { 		// fail
		if (dieRoll < lower) { // rash action
		    templateString += " Result={{Rash action: " + sourceCharName + " must move toward attacker and attack}}";
		} else if (dieRoll > upper) { // cower!
		    templateString += " Result={{Take cover: " + sourceCharName + " must fall prone in current hex or adjacent hex away from line of fire}}";
		    statusProne = 1;
		} else { 	// we should never get here
		    templateString += " {{Result=ERROR!}}";
		}
	    }
	    // templateString += " {{That's all=folks}}";
	    sendChat("character|" + sourceCharId, templateString);
	    var tokenStatusProne = (statusProne == 1) ? true : false;
	    if (state.UniverseCombat.opt_auto_shock) {
		sendChat("GM", "!setattr --silent --charid " + sourceCharId + " --status_prone|" + statusProne);
		sourceToken.set("status_Prone::7084084", tokenStatusProne);
	    }

	},
	applyDamage = function(target, ...args) {
	    var count = args.length;
	    // log(state.UniverseCombat.api_script + ": " + count + " arguments");
	    // log(state.UniverseCombat.api_script + ": arguments: " + args);
	    // I don't know what I'm doing wrong, but the only way I
	    // can work out to make this function is: If the first
	    // argument begins with '-', it's the target ID, so adjust
	    // everything accordingly.
	    //
	    // Yes, I know it's ugly.  JavaScript is a crappy language.
	    // log(state.UniverseCombat.api_script + ": target: " + target);
	    // log(state.UniverseCombat.api_script + ": arg target: " + args[0]);
	    // log(state.UniverseCombat.api_script + ": args: " + args);
	    if (args[0].match(/^-/)) {
		target = args.shift();
	    }
	    // log(state.UniverseCombat.api_script + ": target: " + target);
	    // log(state.UniverseCombat.api_script + ": args: " + args);
	    count = args.length;
	    if (count == 1) {
		log(state.UniverseCombat.api_script + ": usage: " + args[0] + " stat damage [stat damage...]");
		return;
	    }
	    if (count % 2 != 0) { // odd number of arguments (not including command)
		log(state.UniverseCombat.api_script + ": odd number of arguments to applyDamage, aborting");
		return;
	    }
	    // log(state.UniverseCombat.api_script + ": target is " + target);
	    const targetTokenId = target;
	    const targetToken = getObj("graphic", targetTokenId);
	    if (!targetToken) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not found");
		return null;
	    }
	    const targetCharId = targetToken.get("represents");
	    if (!targetCharId) {
		log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not linked to a character");
		return null;
	    }
	    const targetCharacter = getObj("character", targetCharId);
	    if (!targetCharacter) {
		log(state.UniverseCombat.api_script + " ERROR: targeted character " + targetCharacter + " not found");
		return null;
	    }
	    // We use the token name instead of the character name
	    // for cases where the players aren't supposed to know
	    // whom the token represents.
	    const targetCharName = targetToken.get("name");
	    // log(state.UniverseCombat.api_script + ": target is " + targetCharName);
	    // Get each of the physical stats from the character.
	    var targetAttr = {};
	    targetAttr["ST"] = getAttrByName(targetCharId, "st");
	    targetAttr["EN"] = getAttrByName(targetCharId, "en");
	    targetAttr["DX"] = getAttrByName(targetCharId, "dx");
	    targetAttr["AY"] = getAttrByName(targetCharId, "ay");
	    targetAttr["combat"] = getAttrByName(targetCharId, "combat");
	    var sheetTab = getAttrByName(targetCharId, "sheetTab");
	    var damageString = " --mod";
	    // log(state.UniverseCombat.api_script + ": arguments: " + args);
	    // log(state.UniverseCombat.api_script + ": stats ST " + targetAttr["ST"] + ", EN = " + targetAttr["EN"] + ", DX = " + targetAttr["DX"] + ", AY = " + targetAttr["AY"]);
	    for (let i = 0; i < args.length; i += 2) {
		log(state.UniverseCombat.api_script + ": damage to " + args[i] + ": " + args[i+1] + " points");
		// log(state.UniverseCombat.api_script + ": damage to " + args[i].toUpperCase() + ": " + args[i+1] + " points");
		//targetAttr[args[i].toUpperCase()] -= args[i+1];
		// log("!setattr --charid " + targetCharId + " --" + args[i].toLowerCase() + "|-" + args[i+1]);
		if (sheetTab === "southernwild") { // this is a creature; combat is ST and EN both, and AY is AY and DX both
		    switch (args[i]) {
		    case 'ST':
		    case 'EN':
			damageString += " --combat|-" + args[i+1];
			targetAttr["combat"] -= args[i+1];
			break;
		    case 'DX':
		    case 'AY':
			damageString += " --AY|-" + args[i+1];
			targetAttr["AY"] -= args[i+1];
			break;
		    default:
			log(state.UniverseCombat.api_script + " ERROR: something went wrong in applyDamage()");
		    }
		} else {			   // character
		    damageString += " --" + args[i] + "|-" + args[i+1];
		    targetAttr[args[i]] -= args[i+1];
		}
	    }
	    if (state.UniverseCombat.opt_auto_damage) {
		// This section of code depends on sendChat(), which
		// is unfortunately asynchronous.  Results are
		// unpredictable, which is something we really don't
		// want but haven't found a way around yet.
		// log(state.UniverseCombat.api_script + ": damageString " + damageString);
		sendChat("GM", "!setattr --silent --charid " + targetCharId + damageString);
		// I can't seem to get the API scripts to invoke sheet
		// workers, so we modify token markers here.
		if (targetAttr["EN"] <= 0) {	// unconscious, possibly dead
		    if (targetAttr["ST"] <= 0) { // dead
			sendChat(state.UniverseCombat.api_script, " <b>" + targetCharName + "</b> is dead");
			sendChat("GM", "!token-mod --ids " + targetTokenId + " --set statusmarkers|dead layer|map");
		    } else {
			sendChat(state.UniverseCombat.api_script, " <b>" + targetCharName + "</b> is unconscious and falls prone");
			sendChat("GM", "!token-mod --ids " + targetTokenId + " --set statusmarkers|Unconscious::7084089 statusmarkers|Prone::7084084");
			if (targetAttr["DX"] <= 0) {
			    sendChat(state.UniverseCombat.api_script, " <b>" + targetCharName + "</b> drops anything they were holding");
			}
		    }
		}
	    }
	},

	// Usage example: applyAreaDamage(msg, 5, "ay/en/st", 2) --
	// apply 5 damage to AY, with overflow to EN and ST and an
	// armor result of 2.  Works on all selected tokens that
	// represent characters.
	applyAreaDamage = function(msg, allDamage, stats, armorResult) {
	    if (!msg.selected || msg.selected.length === 0) {
		sendChat("UniverseCombat", '/w gm <b>Error:</b> No tokens selected. Please select tokens first.');
		return [];
	    }
	    stats = stats.toUpperCase();
            const selectedTokens = getSelectedTokens(msg);
	    for (var i = 0; i < selectedTokens.length; i++) {
		var damage = allDamage;
		var targetToken = selectedTokens[i];
		var targetTokenId = targetToken.get('_id');
		var targetCharId = targetToken.get("represents");
		if (!targetCharId) {
		    log(state.UniverseCombat.api_script + " ERROR: targeted token " + targetTokenId + " not linked to a character");
		} else {
		    var targetCharacter = getObj('character', targetCharId);
		    var targetTokenName = targetToken.get('name');
		    // log(state.UniverseCombat.api_script + ": token #" + i + ": " + targetTokenName);
		    var targetAttr = {};
		    targetAttr["ST"] = getAttrByName(targetCharId, "st");
		    targetAttr["EN"] = getAttrByName(targetCharId, "en");
		    targetAttr["DX"] = getAttrByName(targetCharId, "dx");
		    targetAttr["AY"] = getAttrByName(targetCharId, "ay");
		    // log("stats for " + targetTokenName + ": " + targetAttr["ST"] + '/' + targetAttr["EN"] + '/' + targetAttr["DX"] + '/' + targetAttr["AY"])
		    targetAttr["full_armor"] = getAttrByName(targetCharId, "full_armor"); // used in stun calculations
		    // For the time being, any grenade blast affects
		    // primarily the torso, so we use armor coverage
		    // for that (hit table roll 4..7).
		    var result = "<b>" + targetTokenName + "</b>: ";
		    var armorProt =  getAttrByName(targetCharId, "parmor5");
		    if (armorResult > 0 && armorProt > 0) {
			if (armorResult < armorProt) { // damage less than armor protection
			    result += " damage blocked by armor";
			    damage = 0;
			} else if (armorResult == armorProt) { // exactly equal: minor damage to armor
			    result += " damage blocked, but armor receives superficial damage (both protection ratings reduced by 1); ";
			    damage = 0;
			} else { // armorResult > armorProt; some damage gets through
			    var diff = armorResult - armorProt;
			    damage -= armorProt;
			    if (diff == 1) {
				result += "armor receives light damage (both protection ratings reduced by 1); ";
			    } else if (diff == 2) {
				result += "armor receives heavy damage (both protection ratings reduced by 2); ";
			    } else if (diff == 3) {
				result += "armor partially destroyed (both protection ratings reduced by 3); ";
			    } else { // diff >= 4
				result += "armor totally destroyed; ";
			    }
			}
		    }
		    // log("damage is now " + damage);
		    var applyDamageArgs = [targetTokenId];
		    var damageStats = stats.split('/');
		    if (damage > 0) {
			if (damage > targetAttr[damageStats[0]]) { // damage exceeds first attribute
			    result += " " + targetAttr[damageStats[0]] + " points lost from " + damageStats[0];
			    applyDamageArgs.push(damageStats[0], targetAttr[damageStats[0]]);
			    damage -= targetAttr[damageStats[0]];
			    // log("damage is now " + damage);
			} else {
			    result += damage + " points lost from " + damageStats[0];
			    applyDamageArgs.push(damageStats[0], damage);
			    damage = 0;
			    // log("damage is now " + damage);
			}
		    }
		    if (damage > 0) {
			if (damage > targetAttr[damageStats[1]]) { // remaining damage exceeds second attribute
			    result += " and " + targetAttr[damageStats[1]] + " points lost from " + damageStats[1];
			    applyDamageArgs.push(damageStats[1], targetAttr[damageStats[1]]);
			    damage -= targetAttr[damageStats[1]];
			    // log("damage is now " + damage);
			}  else {
			    result += " and " + damage + " points lost from " + damageStats[1];
			    applyDamageArgs.push(damageStats[1], damage);
			    damage = 0;
			    // log("damage is now " + damage);
			}
		    }
		    if (damage > 0) {
			// There is no result that doesn't include ST and
			// EN as potential affected stats.  That means the
			// target is dead.  So we don't both checking if
			// the third affected stat is big enough.
			result += " and " + damage + " points lost from " + damageStats[2];
			applyDamageArgs.push(damageStats[2], damage);
		    }
		    sendChat("UniverseCombat", result);
		    // log("applyDamage(" + applyDamageArgs + ")");
		    applyDamage(...applyDamageArgs);
		}
	    }
	},
	
	handleInput = function(msg) {
            var args = msg.content.split(" ");
            
            if (msg.type !== "api") {
		return;
	    }
	    
	    switch(args[0]) {
	    case '!fireWeapon':
		fireWeapon(args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11]);
		break;
	    case '!closeCombatTargetSelect':
		closeCombatTargetSelect(args[1], args[2], args[3], args[4]);
		break;
	    case '!closeCombat':
		closeCombat(args[1], args[2], args[3], args[4], args[5]);
		break;
	    case '!shockCheck':
		shockCheck(args[1], args[2], args[3]);
		break;
	    case '!willpowerCheck':
		willpowerCheck(args[1], args[2], args[3]);
		break;
	    case '!damage':
		// log("args: " + args);
	     	applyDamage(args[0], ...args.slice(1));
		break;
	    case '!damagearea':
		// log("args: " + args);
	     	applyAreaDamage(msg, args[1], args[2], args[3]);
		break;
	    }
	},
	
	checkInstall = function() {
            if(typeof state.UniverseCombat == "undefined"){
		setDefaults();
            }
	    setDefaults();
	    checkDefaults();
	    // sendChat(state.UniverseCombat.api_script,"/w gm DEBUG 343: setting defaults");
	},
	
	registerEventHandlers = function() {
            on('chat:message', handleInput);
	};

    return {
	CheckInstall: checkInstall,
	RegisterEventHandlers: registerEventHandlers
    };
    
}());

var pixelsPerHex = 70;
on("ready",function(){
    'use strict';
    UniverseCombat.CheckInstall();
    UniverseCombat.RegisterEventHandlers();
    log("-=> UniverseCombat $Revision: 1.18 $ <=-");
});
