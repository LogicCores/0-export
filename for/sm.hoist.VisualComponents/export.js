
const PATH = require("path");
const FS = require("fs");
const SPAWN = require("child_process").spawn;
const SM_HOIST_COMMAND_PATH = require.resolve("../../../../lib/sm.hoist.VisualComponents/sm.hoist");


exports.parseForUri = function (configPath, uri, callback) {

	// TODO: Derive dynamically
	var manifestPath = PATH.join(__dirname, "../../../../cache/0/skin/components/hoisted.json");

    // TODO: Add proper cache management instead of just checking if it exists.
	return FS.exists(manifestPath, function (exists) {
	    
	    function returnPageManifest (callback) {
	        return FS.readFile(manifestPath, "utf8", function (err, data) {
                var manifest = JSON.parse(data);
                var pageUri = uri.replace(/(^\/|\.html?)/g, "");
                var page = manifest.pages[pageUri];
                if (!page) {
                    return callback(new Error("No components found in manifest '" + manifestPath + "' for uri '" + pageUri + "'!"));
                }
                return callback(null, page);
            });
	    }
	    
	    if (exists) {
	        return returnPageManifest(callback);
	    }

        var proc = SPAWN(SM_HOIST_COMMAND_PATH, [
            configPath,
            "--build",
            "--uri", uri
        ], {
        	env: process.env
        });
        proc.on("error", function(err) {
        	return callback(err);
        });
        var stdout = [];
        var stderr = [];
        proc.stdout.on('data', function (data) {
        	stdout.push(data.toString());
    		process.stdout.write(data);
        });
        proc.stderr.on('data', function (data) {
        	stderr.push(data.toString());
    		process.stderr.write(data);
        });
        proc.on('close', function (code) {
        	if (code) {
        		var err = new Error("sm.hoist exited with code: " + code);
        		err.code = code;
        		err.stdout = stdout;
        		err.stderr = stderr;
        		return callback(err);
        	}
	        return returnPageManifest(callback);
        });
	});
}

