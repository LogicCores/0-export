
const PATH = require("path");
const FS = require("fs");
const SPAWN = require("child_process").spawn;
const SM_HOIST_COMMAND_PATH = require.resolve("../../../../lib/sm.hoist.VisualComponents/sm.hoist");


exports.parseForUri = function (configPath, uri, callback) {
    
    try {
    
    	// TODO: Derive dynamically
    	var manifestPath = PATH.join(__dirname, "../../../../cache/0/skin/components/hoisted.json");
    
        // TODO: Add proper cache management instead of just checking if it exists.
    	return FS.exists(manifestPath, function (exists) {
    
    	    function returnPageManifest (callback) {
    
                console.log("manifestPath", manifestPath);

    	        return FS.readFile(manifestPath, "utf8", function (err, data) {
    
                    console.log("data", data);	            
    	            
                    var manifest = JSON.parse(data);
                    var pageUri = uri.replace(/(^\/|\.html?)/g, "");
                    var page = manifest.pages[pageUri];
                    if (!page) {
                        return callback(new Error("No components found in manifest '" + manifestPath + "' for uri '" + pageUri + "'!"));
                    }
    
                    // TODO: Use config adapter to instanciate config.
                    page = JSON.parse(JSON.stringify(page).replace(
                        /\{\{__DIRNAME__\}\}/g,
                        PATH.dirname(manifestPath)
                    ));
    
                    return callback(null, page);
                });
    	    }
    	    
    	    if (exists) {
    //	        return returnPageManifest(callback);
    	    }
    
    	    function runOutOfProcess () {
    
                console.log("Hoist out of process:", uri);
    
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
    	    }
    
    	    function runInProcess (callback) {
    
                console.log("Hoist in process:", uri);
    
    	        const EXPORT = require("../../../../lib/sm.hoist.VisualComponents/lib/export").forLib(
    	            require("../../../../lib/sm.hoist.VisualComponents/lib/lib")
    	        );
    
    	        console.log("configPath", configPath);
    
                return FS.readFile(configPath, "utf8", function (err, config) {
                    if (err) return callback(err);

                    config = config.replace(/\{\{__DIRNAME__\}\}/g, PATH.dirname(configPath));
                    config = config.replace(/\{\{env\.PORT\}\}/g, process.env.PORT);
                    config = JSON.parse(config).config;
    
        	        return EXPORT.export({
        	            build: true,
        	            uri: uri,
        	            config: config["sm.hoist.visualcomponents/0"]
        	        }).then(function () {

        	            return returnPageManifest(callback);
        	        }, callback);
                });
    	    }
    
    	    // If we are in NodeJS 4 we can run it in process.
    	    // Otherwise we have to run it out of process as
    	    // iojs/nodejs >= 4 is required by jsdom used by 'sm.hoist.VisualComponents'.
    	    console.log("NodeJS version:", process.version);
    	    if ( parseInt(process.version.replace(/^v/, "").split(".").shift()) >= 4 ) {
    	        return runInProcess(callback);
    	    } else {
        	    return runOutOfProcess(callback);
    	    }
    	});
    } catch (err) {
        return callback(err);
    }
}

