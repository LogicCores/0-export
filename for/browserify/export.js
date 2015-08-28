
const PATH = require("path");
const FS = require("fs");
const BROWSERIFY = require("browserify");


exports.app = function (options) {

    return function (req, res, next) {

        var path = PATH.join(options.basePath,  req.params[0]);

        return FS.exists(path, function (exists) {
            if (!exists) return next();


			var browserify = BROWSERIFY({
				basedir: PATH.dirname(path)
//				standalone: ''
			});
			browserify.add("./" + PATH.basename(path));

			return browserify.bundle(function (err, data) {
				if (err) return next(err);

				data = require("../defs").transform(data);

				res.writeHead(200, {
					"Content-Type": "application/javascript"
				});
				return res.end(data);
			});
        });
    };
}
