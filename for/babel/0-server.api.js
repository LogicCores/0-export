

exports.app = function (options) {

    return function (req, res, next) {

        const PATH = require("path");
        const FS = require("fs");
        const BABEL = require("babel");


        var path = PATH.join(options.basePath,  req.params[0]);

        return FS.exists(path, function (exists) {
            if (!exists) return next();

			return BABEL.transformFile(path, {

			}, function (err, result) {
				if (err) return next(err);

                res.writeHead(200, {
                    "Content-Type": "application/javascript"
                });
                res.end(result.code);
                return;
			});
        });
    };
}

