
var docgen = require ('./docgen/docgen.js');
var options = require('commander');

var generator = new docgen();

options
	.version(generator.getVersion())
	.option('-i, --input [type]', 'path to input directory (default: pwd)', 'pwd')
	.option('-o, --output [type]', 'path to output directory (default: ./outputs)', './output')
	.option('-p, --pdf [type]', 'create a PDF copy (default: false)', false)
	.option('-r, --redirect [type]', 'create a home redirect page in the parent directory (default: false)', false)
	.option('-v, --verbose [type]', 'verbose output, including detailed errors (default: false)', false)
	//.option('-t, --pagetoc [type]', 'include a page table of contents (default: true)', true)
	.parse(process.argv);

generator.setOptions(options);
generator.run();
