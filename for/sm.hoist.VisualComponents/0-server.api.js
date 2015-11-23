
const PATH = require("path");
const FS = require("fs");
const URL = require("url");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");

exports.forLib = function (LIB) {

    const CRYPTO = require("crypto");
    const EXPORT = require("./export").forLib(LIB);

    var exports = {};

    exports.app = function (options) {

        var context = options.context();
    
        return function (req, res, next) {

            var uri = (
                req.state.page &&
                req.state.page.lookup &&
                req.state.page.lookup.path
            ) || req.params[0];

            return LIB.Promise.all([
                context.getAdapterAPI("page"),
                context.getAdapterAPI("boundary")
            ]).spread(function (page, boundary) {

                return page.contextForUri(
                    uri
                ).then(function (pageContext) {

                    if (!pageContext) {
                        res.writeHead(404);
                        return res.end("Not Found");
                    }
                    if (
                        pageContext.page.data.path === "/Index.md" &&
                        req.flags &&
                        req.flags["export.sm.hoist.VisualComponents"] &&
                        req.flags["export.sm.hoist.VisualComponents"]["404onRootPage"]
                    ) {
                        res.writeHead(404);
                        return res.end("Not Found");
                    }


                    var distPath = LIB.path.join(options.distPath, pageContext.skin.host.path);
                    if (LIB.VERBOSE) console.log("distPath:", distPath);
                    
                    
                    function serveDistPath() {
                        
                        return LIB.fs.readFileAsync(distPath, "utf8").then(function (html) {



                            var clientContext = pageContext.clientContext || {};
                            if (
                                req.state.page &&
                                req.state.page.clientContext
                            ) {
                                clientContext = LIB._.merge(clientContext, req.state.page.clientContext);
                            }
                            // HACK: Update the hostname and port depending on where asset is being requested from.
                            // TODO: Move this adjustment into a declared plugin so that 'pageContext.clientContext' holds the correct data.
                            if (
                                req.headers.host &&
                                clientContext &&
                                clientContext.page &&
                                clientContext.page.baseUrl
                            ) {
                                clientContext.page.baseUrl = clientContext.page.baseUrl.replace(/^(https?:\/\/)([^\/]+)(\/.+)$/, "$1" + req.headers.host + "$3");
                            }


                            // Replace page variables
        					var re = /{{PAGE\.([^}]+)}}/g;
        					var m;
        					var val;
        					while ( (m = re.exec(html)) ) {
        					    val = LIB.traverse.get({
                                    context: clientContext
                                }, m[1].split("."));
                                if (typeof val === "object") {
                                    val = encodeURIComponent(JSON.stringify(
                                        val
                                    ));
                                }
        						html = html.replace(
        						    new RegExp(LIB.RegExp_Escape(m[0]), "g"),
        						    val
        						);
        					}


                            // TODO: Send all the proper cache headers.
                            res.writeHead(200, {
                                "Content-Type": "text/html",
                                "Cache-Control": "public, max-age=" + (options.clientCacheTTL ? (LIB.ms(options.clientCacheTTL) / 1000) : "0"),
                                "ETag": CRYPTO.createHash("sha1").update(html).digest('hex')
                            });
                            res.end(html);
                            return null;
                        });
/*
                        return LIB.send(req, LIB.path.basename(distPath), {
                    		root: LIB.path.dirname(distPath),
                    		maxAge: options.clientCacheTTL || 0
                    	}).on("error", next).pipe(res);                        
*/
                    }

        			return LIB.fs.exists(distPath, function (exists) {
        
        		        if (
        		        	exists &&
    		        		options.alwaysRebuild === false
        		        ) {
console.log("serve pre-built!");
        		           	// We return a pre-built file if it exists and are being asked for it
        					return serveDistPath();
        		        } else {
        	
        		           	// We build file, store it and return it

                            var baseUrlParts = URL.parse(pageContext.skin.host.baseUrl);
                            var configOverrides = {};
                            LIB._.merge(configOverrides, options.config);
                            LIB._.merge(configOverrides, {
                                "source": {
                                    "server": {
                                        "host": baseUrlParts.host,
                                        "subPath": baseUrlParts.path.replace(/^\/$/, "") + options.sourceBaseSubUrl,
                                        "headers": {
                                            "X-Boundary-Bypass-Token": boundary.bypassToken
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

        
                                        function transform (html) {
                                            if (
                                                !options.transform
                                            ) {
                                                return LIB.Promise.resolve(html);
                                            }
                                            var done = LIB.Promise.resolve();
                                            Object.keys(options.transform).forEach(function (alias) {
                                                done = done.then(function () {
                                                    return options.transform[alias](html).then(function (_html) {
                                                        html = _html
                                                    });
                                                });
                                            });
                                            return done.then(function () {
                                                return html;
                                            });
                                        }
        
        
                                        return transform(html).then(function (html) {
        
            
                                            // Re-base all links, style and script paths.
                                            // TODO: Add option to 'sm.hoist.VisualComponents' to insert variables
                                            //       so we can prefix everything by replacing one variable.
                                            var re = /(<a.+?href="|<img.+?src="|<script.+?src="|<link.+?href=")(\/[^"]*)/g;
                                            var m = null;
                                            var replace = {};
                                            var baseSubPath = URL.parse(pageContext.page.host.baseUrl).pathname.replace(/\/$/, "");
                                            baseSubPath += "/{{PAGE.context.skin.assetBuildRevision}}";
                                            while ( (m = re.exec(html)) ) {
                                                if (m[2].substring(0, baseSubPath.length + 1) === baseSubPath + "/") {
                                                    // Path is already adjusted.
                                                } else {
                                                    replace[m[0]] = m;
                                                }
                                            }
                                            Object.keys(replace).forEach(function (key) {
                                                html = html.replace(
                                                    new RegExp(LIB.RegExp_Escape(replace[key][0]), "g"),
                                                    replace[key][1] + baseSubPath + replace[key][2]
                                                );
                                            });
        
                        					function checkIfChanged () {
                        						return LIB.fs.existsAsync(distPath).then(function (exists) {
                        							if (!exists) return true;
                        							return LIB.fs.readFileAsync(distPath, "utf8").then(function (existingData) {
                        								if (existingData === html) {
                        									return false;
                        								}
                        								return true;
                        							});
                        						});
                        					}
        
                        					return checkIfChanged().then(function (changed) {
                        						if (!changed) return null;
        
                        						if (LIB.VERBOSE) console.log("Writing skin to cache path:", distPath);
        
                        				        return LIB.fs.outputFileAsync(distPath, html, "utf8");
        
                        					}).then(function () {
                        					   
                        					   return serveDistPath();
                        					});

                                        }).catch(next);
                                    });
                                }
                            );
        		        }
        			});
                });
            }).catch(next);
        };
    }

    return exports;
}
