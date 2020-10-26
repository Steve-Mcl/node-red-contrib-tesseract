
/*
 * 
 * TODO
 * Consider giving the UI ability to download the trained data instead of having lang.js do it.
 * 
 */


// var Tesseract = require('tesseract.js');
const { createWorker } = require('tesseract.js');
var request = require('request');
var fs = require('fs');
var path = require("path");

module.exports = function(RED)
{
	function TesseractNode(config)
	{
		RED.nodes.createNode(this, config);
		var node = this;
		node.language = config.language;

		let opts = {lang: node.language};
		if (opts.lang == null) opts.lang = "eng"
		var lang = path.join(__dirname, 'langs')
		node.worker = createWorker({
			// workerPath: path.join(__dirname, "/tesseract.js-overload/worker.js"),
			// langPath: "https://github.com/naptha/tessdata/tree/gh-pages/4.0.0_best/"
			langPath: lang,
			errorHandler: function(e) {
				node.error(e)
			}
		});

	

		// console.log("before tesseract worker init call")

		(async () => {
			try {
				await	node.worker.load();
				await node.worker.loadLanguage(opts.lang);
				await node.worker.initialize(opts.lang);
				// c.log("tesseract worker initialised")

			} catch(e) {
				console.error(e)
				node.error(e)
				node.worker = null;
			}
		})();

		// console.log("after tesseract worker init call")

		node.on('close', function(done) {
			node.worker && node.worker.terminate();
			done && done();
		});
		node.on('input', function(msg)
		{
			// Download URL
			if (/^http(s?):\/\//.test(msg.payload))
			{
				node.status({fill: "blue", shape: "dot", text: "downloading image"});
				request({url:msg.payload, encoding: null}, function(err, res, body)
				{
					if (err)
					{
						node.error("Encountered error while downloading image file. " + err.message);
					}
					msg.payload = body;
					Recognize(msg);
				});
			}
			// Open file on local file system
			else if (typeof msg.payload == "string")
			{
				if (fs.existsSync(msg.payload))
				{
					Recognize(msg);
				}
				else
				{
					node.error("Referenced image file does not exist.");
				}
			}
			// Buffer
			else
			{
				Recognize(msg);
			}
		});
		function Recognize(msg)
		{
			// Update status - Starting
			node.status({fill: "blue", shape: "dot", text: "performing ocr"});
			// // Initiate Tesseract.js
			// var t = new Tesseract.create(
			// {
			// 	workerPath: path.join(__dirname, "/tesseract.js-overload/worker.js"),
			// 	langPath: "https://github.com/naptha/tessdata/raw/gh-pages/3.02/"
			// });
			// Perform OCR
			// let opts = msg.options || {};
			// if (opts.lang == null) opts.lang = "eng"
			// var lang = path.join(__dirname, 'langs')
			// const worker = createWorker({
			// 	// workerPath: path.join(__dirname, "/tesseract.js-overload/worker.js"),
			// 	// langPath: "https://github.com/naptha/tessdata/tree/gh-pages/4.0.0_best/"
			// 	langPath: lang,
			// 	errorHandler: function(e) {
			// 		node.error(e)
			// 	}
			// });

			(async () => {
				try {
					
					if(!node.worker) {
						node.error(new Error("worker is null"),msg);
					}


					// await worker.load();
					// await worker.loadLanguage(opts.lang);
					// await worker.initialize(opts.lang);
					let opts = msg.options || {};
					if (opts.lang == null) opts.lang = "eng"
					await node.worker.setParameters(opts);
					var img = msg.payload;
					const result = await node.worker.recognize(img);
					const resultData = result ? result.data : null;
					if(resultData) {
						msg.payload = resultData.text;
						msg.tesseract = 
						{
							text: resultData.text,
							confidence: resultData.confidence,
							lines: resultData.lines.map(l => l = 
							{
								text: l.text,
								confidence: l.confidence,
								words: l.words.map(w => w = 
								{
									text: w.text,
									confidence: w.confidence
								})
							})
						};
						node.send(msg);
						node.status({});
					} else {
						node.error(new Error("No result data returned"),msg);
						node.status({text:"error"});
					}
					
					// await worker.terminate();
					
				} catch (error) {
					node.error(error,msg);
					node.status({text:"error"});
				}
			})();


			// Tesseract.recognize(msg.payload, opts).then(function(result)
			// {
			// 	msg.payload = result.text;
			// 	msg.tesseract = 
			// 	{
			// 		text: result.text,
			// 		confidence: result.confidence,
			// 		lines: result.lines.map(l => l = 
			// 		{
			// 			text: l.text,
			// 			confidence: l.confidence,
			// 			words: l.words.map(w => w = 
			// 			{
			// 				text: w.text,
			// 				confidence: w.confidence
			// 			})
			// 		})
			// 	};
			// 	t.terminate();
			// 	node.send(msg);
			// 	// Update status - Done
			// 	node.status({});
			// });
		}
	}
	RED.nodes.registerType("tesseract", TesseractNode);
}
