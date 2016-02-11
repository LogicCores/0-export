
exports.forLib = function (LIB) {

	var exports = {};


	function getGrunt () {
        if (!getGrunt._GRUNT) {
            getGrunt._GRUNT = LIB.Promise.promisify(function (callback) {
                const GRUNT = require("grunt");
/*
                // And remove all required modules again.
                // TODO: Use a separate process if we can.
                function removeChildrenForModule (module) {
                    Object.keys(module.children).forEach(function (path) {
                        removeChildrenForModule(module.children[path]);
                        delete require.cache[path];
                    });
                }
                removeChildrenForModule(module);

console.log("module.children", module.children);
//console.log("require.cache", require.cache);
*/
                
                try {
                    GRUNT.loadTasks(LIB.path.dirname(require.resolve("grunt-bower-concat/package.json")) + "/tasks");
                    GRUNT.registerInitTask('default', function() {
                        GRUNT.task.run([
                        	"bower_concat"
                        ]);
                    });
                } catch (err) {
                    return callback(err);
                }
                return callback(null, GRUNT);
            })();
        }
        return getGrunt._GRUNT;
	}


    var currentlyConcatenating = {};
    var concatQueue = [];
    function drainQueue () {
        if (concatQueue.length === 0) {
            return;
        }
        var nextConcatenate = concatQueue[0];
        nextConcatenate().then(function () {
            concatQueue.shift();
            drainQueue();
        });
    }
    exports.concatenate = function (componentsPath, distPath, config) {
        if (currentlyConcatenating[componentsPath]) {
            return currentlyConcatenating[componentsPath];
        }
        return (currentlyConcatenating[componentsPath] = LIB.Promise.promisify(function (callback) {

            concatQueue.push(function () {
                return LIB.Promise.try(function () {
                    
                    console.log("Concatenating bower files from '" + componentsPath + "' and writing to '" + distPath + "' ...");
        
                    // TODO: Use our own grunt instance instead of global instance.
                    return getGrunt().then(function (GRUNT) {
    
                        return LIB.Promise.promisify(function (callback) {
                            try {

                    			GRUNT.file.setBase(componentsPath);

                    			var gruntConfig = {
                                    bower_concat: {
                                        all: {
                                            dest: distPath.replace(/\.[^\.]+$/, ".js"),
                    					    cssDest: distPath.replace(/\.[^\.]+$/, ".css"),
                    					    exclude: config.exclude || [],
                    					    dependencies: config.dependencies || {},
                    					    bowerOptions: {
                    					      relative: false
                    					    }
                                        }
                                    }				                
                                };
                                //console.log("gruntConfig", JSON.stringify(gruntConfig, null, 4));
                    			GRUNT.initConfig(gruntConfig);

                                return GRUNT.tasks(['default'], {
                                    debug: false,
                                    verbose: true
                                }, callback);
                            } catch (err) {
                                return callback(err);
                            }
                        })();
                    });
                }).then(function () {
                    callback(null);
                }, callback);
            });

            if (concatQueue.length === 1) {
                drainQueue();
            }

        })()).then(function () {
            delete currentlyConcatenating[componentsPath];
        });
    }


	exports.app = function (options) {
	
	    return function (req, res, next) {

            var params = req.params;
            if (options.match) {
                // TODO: Relocate into generic helper.
                var expression = new RegExp(options.match.replace(/\//g, "\\/"));
                var m = expression.exec(req.params[0]);
                if (!m) return next();
                params = m.slice(1);
            }

	        var componentsPath = options.packagePath;
	        var distPath = LIB.path.join(options.distPath, "bundle." + params[1]);

            function serve () {
                return LIB.send(req, LIB.path.basename(distPath), {
            		root: LIB.path.dirname(distPath),
            		maxAge: options.clientCacheTTL || 0
            	}).on("error", next).pipe(res);
            }

			return LIB.fs.exists(distPath, function (exists) {
		        if (
		            exists &&
		            (
		                params[0] ||
		                options.alwaysRebuild === false
		            )
		        ) {
		           	// We return a pre-built file if it exists and are being asked for it
		           	return serve();
		        } else {
		           	// We build file, store it and return it
                    return exports.concatenate(componentsPath, distPath, options.config).then(function () {
    		           	return serve();
		           	}).catch(next);
		        }
	        });
	    };
	}

	return exports;
}
