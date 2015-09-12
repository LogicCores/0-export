
const PATH = require("path");
const FS = require("fs");
const URL = require("url");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");

exports.forLib = function (LIB) {

    const EXPORT = require("./export").forLib(LIB);

    var exports = {};

    exports.app = function (options) {
    
        return function (req, res, next) {

            var uri = req.params[0];

            return req.context.page.contextForUri(
                uri
            ).then(function (pageContext) {

                if (!pageContext) {
                    res.writeHead(404);
                    return res.end("Not Found");
                }

                var baseUrlParts = URL.parse(pageContext.skin.host.baseUrl);
                var configOverrides = {};
                LIB._.merge(configOverrides, options.config);
                LIB._.merge(configOverrides, {
                    "source": {
                        "server": {
                            "host": baseUrlParts.host,
                            "subPath": baseUrlParts.path.replace(/^\/$/, "") + options.sourceBaseSubUrl,
                            "headers": {
                                "X-Boundary-Bypass-Token": req.context.boundary.bypassToken
                            }
                        }
                    }
                });

                return EXPORT.parseForUri(
                    pageContext.skin.data.componentsPath,
                    pageContext.skin.host.path,
                    configOverrides,
                    function (err, manifest) {
                        if (err) return next(err);

                        if (
                            !manifest.components ||
                            !manifest.components.html ||
                            !manifest.components.html.fsHtmlPath
                        ) {
                            var err = new Error("'html' component not declared in exports for uri '" + uri + "'!");
                            err.code = 404;
                            return next(err);
                        }

                        //return FS.createReadStream(manifest.components.html.fsHtmlPath).pipe(res);
                        // TODO: Do this via output rewrite middleware
                        return FS.readFile(manifest.components.html.fsHtmlPath, "utf8", function (err, html) {
                            if (err) return next(err);


                            html = html.replace(/\{\{PAGE\.context\}\}/g, encodeURIComponent(JSON.stringify(
                                pageContext.clientContext || {}
                            )));


                            res.writeHead(200, {
                                "Content-Type": "text/html"
                            });
                            res.end(html);
                            return html;
                        });
                    }
                );
            }).catch(next);
        };
    }

    return exports;
}
