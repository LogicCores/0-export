
const PATH = require("path");
// TODO: Get from `components/Library.NodeJS`
const FS = require("fs-extra");
const BROWSERIFY = require("browserify");


exports.app = function (options) {

    return function (req, res, next) {

        var path = PATH.join(options.distPath, req.params[0]);

		return FS.exists(path, function (exists) {

	        if (exists && /\.dist\./.test(path)) {
	           	// We return a pre-built file if it exists and are being asked for it

				res.writeHead(200, {
					"Content-Type": "application/javascript"
				});
	           	return FS.createReadStream(path).pipe(res);

	        } else {

	           	// We build file, store it and return it

	            path = PATH.join(options.basePath, req.params[0]).replace(/\.dist\./, ".");

				return FS.exists(path, function (exists) {
	
		            if (!exists) return next();

		            console.log("Browserifying '" + path + "' ...");

					var browserify = BROWSERIFY({
						basedir: PATH.dirname(path),
						noParse: [
							'systemjs/dist/system.src.js'
						]
		//				standalone: ''
					});
					browserify.add("./" + PATH.basename(path));
		
					return browserify.bundle(function (err, data) {
						if (err) return next(err);

						function appendGlobalScripts (data, callback) {

							var re = /;\(\{"APPEND_AS_GLOBAL":"([^"]+)"\}\);/g;
							var m = null;
							while ( (m = re.exec(data)) ) {
								data += '\nvar __define = window.define; delete window.define;\n';
								data += FS.readFileSync(
									// TODO: Suppor paths relative to file here once we can get containing
									//       file info from browserify.
									PATH.join(__dirname, "../../../../" + m[1]),
									"utf8"
								);
								data += '\nif (typeof window.define === "undefined") window.define = __define;\n';
							}

							return callback(null, data);
						}

						return appendGlobalScripts(data, function (err, data) {
							if (err) return next(err);

							data = require("../defs").transform(data);
			
					        var distPath = PATH.join(options.distPath, req.params[0]);
					        
					        function ensureDirectory (callback) {
					        	return FS.exists(PATH.dirname(distPath), function(exists) {
					        	   if (exists) return callback(null); 
					        	   return FS.mkdirs(PATH.dirname(distPath), callback);
					        	});
					        }
					        
					        return ensureDirectory(function (err) {
					        	if (err) return next(err);
	
						        return FS.writeFile(distPath, data, "utf8", function (err) {
						        	if (err) return next(err);
				
									res.writeHead(200, {
										"Content-Type": "application/javascript"
									});
									return res.end(data);
						        });
					        });
						});
					});
				});
	        }
        });
    };
}
