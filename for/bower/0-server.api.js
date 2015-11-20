
exports.forLib = function (LIB) {

	var exports = {};


    var currentlyConcatenating = {};
    exports.concatenate = function (componentsPath, distPath, config) {

        const GRUNT = require("grunt");

        if (currentlyConcatenating[componentsPath]) {
            return currentlyConcatenating[componentsPath];
        }
        return (currentlyConcatenating[componentsPath] = LIB.Promise.promisify(function (callback) {
            
            console.log("Concatenating bower files from '" + componentsPath + "' ...");

            // TODO: Use our own grunt instance instead of global instance.
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
            GRUNT.loadTasks(LIB.path.dirname(require.resolve("grunt-bower-concat/package.json")) + "/tasks");
            GRUNT.registerInitTask('default', function() {
                GRUNT.task.run([
                	"bower_concat"
                ]);
            });

            return GRUNT.tasks(['default'], {
                debug: false,
                verbose: true
            }, callback);
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
