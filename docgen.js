
var docgen = require ('./docgen/docgen.js');
var options = require('commander');

options
	.version('2.0.0')
	.option('-i, --input [type]', 'path to input directory (default: pwd)', 'pwd')
	.option('-o, --output [type]', 'path to output directory (default: ./outputs)', './output')
	.option('-p, --pdf [type]', 'create a PDF copy (default: false)', false)
	//.option('-H, --homepage [type]', 'set the homepage filename (default: index.html)', 'index.html')
	//.option('-t, --pagetoc [type]', 'include a page table of contents (default: true)', true)
	.parse(process.argv);

var generator = new docgen(options);
generator.run();
