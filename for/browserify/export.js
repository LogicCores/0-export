
const PATH = require("path");
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
						basedir: PATH.dirname(path)
		//				standalone: ''
					});
					browserify.add("./" + PATH.basename(path));
		
					return browserify.bundle(function (err, data) {
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
	        }
        });
    };
}
