

exports.forLib = function (LIB) {

	var exports = {};

	exports.bundleFiles = function (baseDir, files, distPath) {

		const BROWSERIFY = require("browserify");
		const STRINGIFY = require("stringify");

		return LIB.Promise.promisify(function (callback) {

			var browserify = BROWSERIFY({
				basedir: baseDir,
				noParse: [
					'systemjs/dist/system.src.js'
				]
	//				standalone: ''
			});
			browserify.transform(STRINGIFY(['.htm', '.html']));
			
			files.forEach(function (path) {
				browserify.add("./" + path);
			});

			return browserify.bundle(function (err, data) {
				if (err) return callback(err);
	
				function appendGlobalScripts (data, callback) {
	
					var re = /;\(\{"APPEND_AS_GLOBAL":"([^"]+)"\}\);/g;
					var m = null;
					while ( (m = re.exec(data)) ) {
						data += '\nvar __define = window.define; window.define = null;\n';
						data += LIB.fs.readFileSync(
							// TODO: Suppor paths relative to file here once we can get containing
							//       file info from browserify.
							LIB.path.join(__dirname, "../../../../" + m[1]),
							"utf8"
						);
						data += '\nif (typeof window.define === "undefined") window.define = __define;\n';
					}
	
					return callback(null, data);
				}

				return appendGlobalScripts(data, function (err, data) {
					if (err) return callback(err);

					data = require("../defs/export").transform(data);

					function checkIfChanged () {
						return LIB.fs.existsAsync(distPath).then(function (exists) {
							if (!exists) return true;
							return LIB.fs.readFileAsync(distPath, "utf8").then(function (existingData) {
								if (existingData === data) {
									return false;
								}
								return true;
							});
						});
					}
					
					return checkIfChanged().then(function (changed) {
						if (!changed) return callback(null);

				        return LIB.fs.outputFile(distPath, data, "utf8", function (err) {
				        	if (err) return callback(err);
				        	
				        	return callback(null);
				        });
					});
				});
			});
		})();
	}

	exports.app = function (options) {
	
	    return function (req, res, next) {
	    	
	    	var requestedFilename = req.params[0];
	    	var sourceFilename = requestedFilename.replace(/\.dist\./, ".");

	        var sourcePath = LIB.path.join(options.basePath, sourceFilename);
	        var distPath = LIB.path.join(options.distPath, sourceFilename);

	        function returnDistFile () {
                return LIB.send(req, LIB.path.basename(distPath), {
            		root: LIB.path.dirname(distPath),
            		maxAge: options.clientCacheTTL || 0
            	}).on("error", next).pipe(res);
	        }

			return LIB.fs.exists(distPath, function (exists) {

		        if (
		        	exists &&
		        	(
		        		/\.dist\./.test(requestedFilename) ||
		        		options.alwaysRebuild === false
		        	)
		        ) {
		           	// We return a pre-built file if it exists and are being asked for it
					return returnDistFile();
		        } else {
	
		           	// We build file, store it and return it

					return LIB.fs.exists(sourcePath, function (exists) {
		
			            if (!exists) return next();
	
			            console.log("Browserifying '" + sourcePath + "' ...");
	
						return exports.bundleFiles(
							LIB.path.dirname(sourcePath),
							[
								LIB.path.basename(sourcePath)
							],
							distPath
						).then(function () {

							return returnDistFile();
						}).catch(next);
					});
		        }
	        });
	    };
	}

	return exports;
}
