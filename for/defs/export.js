
const DEFS = require("defs");


exports.transform = function (code) {

    var result = DEFS(
        code.toString(),
        {
    		"environments": [
    			"browser"
    		],
    		"loopClosures": "iife",
    		"disallowVars": false,
    		"disallowDuplicated": false,
    		"disallowUnknownReferences": false			
    	}
    );

	if (result.errors) {
	    console.error("result.errors", result.errors);
	    throw new Error("Error running defs!");
	}

	return result.src;
}

