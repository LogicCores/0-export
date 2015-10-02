
exports.transform = function (code) {

	const DEFS = require("defs");


    var result = DEFS(
        code.toString(),
        {
    		"environments": [
    			"browser"
    		],
    		"globals": {
                "console": true,
                "window": false
    		},
    		"loopClosures": "iife",
    		"disallowVars": false,
    		"disallowDuplicated": false,
    		"disallowUnknownReferences": false			
    	}
    );

	if (result.errors) {
	    code.split("\n").forEach(function (line, i) {
	        process.stderr.write((i+1) + ": " + line + "\n");
	    });
	    console.error("result", result);
	    console.error("result.errors", result.errors);
	    throw new Error("Error running defs!");
	}

	return result.src;
}

