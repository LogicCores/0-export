
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
                                    				root: LIB.path.dirname(path)
                                    			}).on("error", next).pipe(res);

                            		        } else {

                                            	const WEBPACK = require("webpack");
                                                const WEBPACK_APP = require("webpack-dev-middleware");
        
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
        /*
                                    						{
                                    							_alias: "css",
                                    							test: /\.css$/,
                                    							loaders: [
                                    								"style-loader",
                                    								"css-loader"
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
        */
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

                                                    // Write generated file to cache.
                                                    var filename = app.getFilenameFromUrl(req.url);
                                        			compiler.outputFileSystem.readFile(filename, function (err, data) {
                                        			    if (err) {
                                        			        console.error(err.stack);
                                        			        return;
                                        			    }
                                        			    return LIB.fs.outputFile(path, data, function (err) {
                                        			        if (err) {
                                            			        console.error(err.stack);
                                            			        return;
                                        			        }
                                        			    });
                                        			});
                                        			return;
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
