
exports.forLib = function (LIB) {
    var ccjson = this;

//    const SERVER = require("./0-server.api").forLib(LIB);

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            const SEND = require("send");


            var Entity = function (instanceConfig) {
                var self = this;

                self.AspectInstance = function (aspectConfig) {

                    var config = {};
                    LIB._.merge(config, defaultConfig);
                    LIB._.merge(config, instanceConfig);
                    LIB._.merge(config, aspectConfig);

                    return LIB.Promise.resolve({
                        app: function () {

                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function (req, res, next) {

                                        var path = LIB.path.join(config.distPath, req.params[0]);

                            			return LIB.fs.exists(path, function (exists) {

                            		        if (
                            		        	exists &&
                            		        	(
                            		        		/\.dist\./.test(path) ||
                            		        		config.alwaysRebuild === false
                            		        	)
                            		        ) {

                            		           	// We return a pre-built file if it exists and are being asked for it
                            		           	return SEND(req, LIB.path.basename(path), {
                                    				root: LIB.path.dirname(path),
                                            		maxAge: config.clientCacheTTL || 0
                                    			}).on("error", next).pipe(res);

                            		        } else {
//console.log("req.url", req.url);
//console.log("req.params", req.params);
//console.log("config", config);
                                                var sourcePath = LIB.path.join(config.basePath, req.params[0]);

                                                return LIB.fs.exists(sourcePath, function (exists) {
                                                    if (!exists) {
                                                        res.writeHead(404);
                                                        res.end("Not Found");
                                                        return;
                                                    }

                                                	const WEBPACK = require("webpack");
                                                    const WEBPACK_APP = require("webpack-dev-middleware");
                                                    
                                                    var baseUri = ("/" + config.subUri).replace(/(^\/+|\/+$)/g, "");
                                                    if (baseUri) baseUri += "/";

                                                    var compilerConfig = {
                                        				debug: false,
                                        				bail: true,
                                        				resolveLoader: {
                                        				    "alias": {
                                            				    "chscript": LIB.path.dirname(require.resolve('../../../../lib/html2chscript-for-webpack/package.json')),
                                            				    "raw": LIB.path.dirname(require.resolve('raw-loader/package.json'))
                                        				    }
                                        				},
                                        				context: config.basePath,
                                        				module: {
                                        					loaders: [
                                                                {
                                                                    test: /\.(png|gif)$/,
                                                                    loader: LIB.path.dirname(require.resolve("url-loader")) + "?limit=100000"
                                                                },
                                                                {
                                                                    test: /\.jpg$/,
                                                                    loader: LIB.path.dirname(require.resolve("file-loader")) + "?name=" + baseUri + "[path][name].[ext]"
                                                                },
                                        						{
                                        							_alias: "css",
                                        							test: /\.css$/,
                                        							loaders: [
                                        								LIB.path.dirname(require.resolve("style-loader")),
                                        								LIB.path.dirname(require.resolve("css-loader"))
                                        							]
                                        						},
                                        						{
                                        							_alias: "less",
                                        							test: /\.less$/,
                                        							loaders: [
                                        								"style",
                                        								"css",
                                        								"less"
                                        							]
                                        						},
                                        						{
                                        							test: /\.chscript\.htm$/,
                                        							loader: LIB.path.dirname(require.resolve('../../../../lib/html2chscript-for-webpack/package.json'))
                                        						}
                                        					]
                                        				},
                                        				plugins: [
                                        					new WEBPACK.optimize.DedupePlugin(),
                                        					new WEBPACK.NoErrorsPlugin()
                                        				],
                                        			    externals: {},
                                        				entry: {
                                        					app: [
                                        					    "." + req.params[0]
                                        					]
                                        				},
                                        				output: {
                                        					path: config.distPath,
                                        					publicPath: "/",
                                        					filename: "." + req.params[0]
                                        				}
                                        			};
    
    //console.log("compilerConfig", JSON.stringify(compilerConfig, null, 4));
    
                                                    try {
        
                                                        var compiler = WEBPACK(compilerConfig);
                
                                                        // @see https://github.com/webpack/webpack-dev-middleware
                                                        var app = WEBPACK_APP(compiler, {
                
                                                            noInfo: true,
                                                            // display no info to console (only warnings and errors)
                                                        
                                                            quiet: true,
                                                            // display nothing to the console
                                                        
                                                            lazy: true,
                                                            // switch into lazy mode
                                                            // that means no watching, but recompilation on every request
                
                                                            publicPath: "/",
                                                            // public path to bind the middleware to
                                                            // use the same as in webpack
                
                                                            stats: {
                                                                colors: true
                                                            }
                                                        });
        
        
                                                        // Act when middleware is done sending.
                                                        var end = res.end;
                                                        res.end = function () {
        
                                                            end.apply(res, arguments);
        
                                                            // Write generated files to cache.
                                                            // Copy files from memory file-system to cache directory.
                                                            var filename = app.getFilenameFromUrl(req.url);
                                                            var baseSourcePath = LIB.path.dirname(filename);
                                                            var baseTargetPath = LIB.path.dirname(path);
                                                            function copyForPath (subpath, callback) {
                                                                var waitfor = LIB.waitfor.parallel(callback);
                                                                var files = compiler.outputFileSystem.readdirSync(LIB.path.join(baseSourcePath, subpath));
                                                                files.forEach(function (file) {
                                                                    waitfor(function (callback) {
                                                                        if (compiler.outputFileSystem.statSync(LIB.path.join(baseSourcePath, subpath, file)).isDirectory()) {
                                                                            return copyForPath(subpath + "/" + file, callback);
                                                                        } else {
                                                                			return compiler.outputFileSystem.readFile(LIB.path.join(baseSourcePath, subpath, file), function (err, data) {
                                                                			    if (err) return callback(err);
                                                                			    return LIB.fs.outputFile(LIB.path.join(baseTargetPath, subpath, file), data, callback);
                                                                			});
                                                                        }
                                                                    });
                                                                });
                                                                return waitfor();
                                                            }
                                                            return copyForPath(".", function (err) {
                                            			        if (err) {
                                                			        console.error(err.stack);
                                                			        return;
                                            			        }
                                                            });
                                                        }
    
                                                        req.url = req.params[0];
                                                        return app(req, res, function (err) {
                                                            if (err) {
                                                                console.error("Error while packing:", err.stack);
                                                                res.writeHead(500);
                                                                res.end("Internal Server Error");
                                                                return;
                                                            }
                                                            res.writeHead(404);
                                                            res.end("Not Found: by webpack config");
                                                            return;
                                                        });
                                                    } catch (err) {
                                                        console.error("Error while packing:", err.stack);
                                                        res.writeHead(500);
                                                        res.end("Internal Server Error");
                                                        return;
                                                    }
                                                });
                            		        }
                            			});
                                    }
                                )
                            );
                        }
                    });
                }
            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}
