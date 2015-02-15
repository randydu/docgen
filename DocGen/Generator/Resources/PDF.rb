# (c) 2015 Mark Macdonald

# A class to manage the generation of PDFs using wkhtmltopdf from a Ruby program
# Hides the awkward wkhtmltopdf argument syntax behind an object interface
# See http://madalgo.au.dk/~jakobt/wkhtmltopdf-0.9.0-doc.html
# Also see http://doc.trolltech.com/4.6/qprinter.html#PageSize-enum for underlying Qt parameters
# Note - does not include all wkhtmltopdf options.
require 'rubygems'
require 'rbconfig'
require 'pathname'
require 'systemu'

class PDF

 def initialize(html_dir_abs,ordered_html_files)
	@html_dir_abs=html_dir_abs
	@ordered_html_files=ordered_html_files #array containing just filenames (not paths), in order
	setup_paths(@html_dir_abs)
	
    #hash to store all the configurable directives that can be passed to wkhtmltopdf
	#Not all wkhtmltopdf options are listed here. Some options depend on version of wkhtmltopdf.
	#remember exactly one space before arguments!
	@options= 
	{
	#General options
	"print_media_css_enabled"=>" --print-media-type", #"" (empty string for disabled)
    "orientation"=>" --orientation portrait", #" --orientation landscape"
	"paper_size"=>" --page-size A4",
	"margin_top"=>" --margin-top 25",
	"margin_right"=>" --margin-right 15",
	"margin_bottom"=>" --margin-bottom 25",
	"margin_left"=>" --margin-left 15",
	
	#Header
	"header-spacing"=>' --header-spacing 5',
	"header"=>' --header-html "'+File.dirname(__FILE__)+'/temp_header.html"', #filename MUST have .html extension or wkhtmltoPDF will crash
	
	#Footer
	"footer-spacing"=>' --footer-spacing 5',
	"footer"=>' --footer-html "'+File.dirname(__FILE__)+'/temp_footer.html"' #filename MUST have .html extension or wkhtmltoPDF will crash
	}

    #fix a scaling issue in PDF on non-Windows platforms.
	o_s = RbConfig::CONFIG['host_os'].to_s
    if(Regexp.compile('darwin').match(o_s) or Regexp.compile('linux').match(o_s) )
	 @options['zoom'] = ' --zoom 0.7297'
	end
	
	if (@wkhtmltopdf_version == "0.10.0" || @wkhtmltopdf_version == "0.11.0") 
     @options['image_quality'] = ' --image-quality 100'
	end
	
    if (@wkhtmltopdf_version == "0.9.9")
	 #version 0.9.0 has issues with links in the PDF. DocGen disables them for this version.
	 #http://code.google.com/p/wkhtmltopdf/issues/detail?id=332
     @options['disable_links'] = ' --disable-external-links'
	end
	
	#Cover page
	if (@wkhtmltopdf_version == "0.9.9") 
	 @options['cover'] = ' --cover "'+File.dirname(__FILE__)+'/temp_cover.html"'
	elsif (@wkhtmltopdf_version == "0.10.0" || @wkhtmltopdf_version == "0.11.0") 
	 @options['cover'] = ' cover "'+File.dirname(__FILE__)+'/temp_cover.html"'
	end
	
	#Table of contents
	if (@wkhtmltopdf_version == "0.9.9")
     @options['TOC'] = " --toc"
	 @options['TOC-depth'] = " --toc-depth 2"
	 @options['TOC-font'] = " --toc-font-name Verdana"
	 @options['TOC-h1-font'] = " --toc-l1-font-size 11"
	 @options['TOC-h2-font'] = " --toc-l2-font-size 9"
	 @options['TOC-header-font-size'] =" --toc-header-font-size 11"
	elsif (@wkhtmltopdf_version == "0.10.0" || @wkhtmltopdf_version == "0.11.0")
	 # Workaround for http://code.google.com/p/wkhtmltopdf/issues/detail?id=460
	 # Issue that causes TOC not to be displayed in Windows only. Workaround (which fixes problem) is to explicitly pass an XSL style sheet for the TOC.
	 #@options['TOC'] = " toc"
	 #@options['TOC-header-text'] = ' --toc-header-text "Table of Contents"'
	 @options['TOC'] = ' toc --xsl-style-sheet "'+File.dirname(__FILE__)+'/PDF-TOC-style.xsl"'
	end
end

#example getter - put rest in later
 def bin_path
	@html_path
 end

 def html_dir
	@html_dir
 end
 
 def PDF_engine_version
	@wkhtmltopdf_version
 end
 
 def generate(filename)
	properties="" #iterate through all options and return the cmd line string sequence needed by wkhtmltopdf
    @options.each do |key,value|
	 properties+=value
	end	
	
	html_files="" #iterate through all files, in order, and return the cmd line string sequence needed by wkhtmltopdf
    @ordered_html_files.each do |value|
	 html_files+='"'+@html_dir_abs+value+'" '
	end	
	
	output_dir=@html_dir_abs.gsub("file:///","")
	args='"'+@bin_path_abs+'" '+properties+' '+html_files+' '+'"'+output_dir+filename+'"' #remember spaces between arguments!
	
	puts "* Invoking PDF Engine (may take some time)"
	puts
	puts "***********************************************************"

	#print args   #uncomment for debugging
	#system(args) #old direct call to external program (improved replacement below)
	
	done = false
    status, stdout, stderr = systemu args do |pid|    
        while !done
           print "."
           sleep 0.2
        end
        #Process.kill 9, cid     #TODO - add timeout to kill child process?     
    end
    done = true
    
	result = status.to_s.split(" ").last
	if(result != "0") #wkhtmltopdf exited with fail state
	  puts
	  Log.log_message("PDF Engine encountered a problem (PDF was not generated)",false)
	  Log.log_message(stderr,true)
	  terminate
	end
	
	puts
	puts "***********************************************************"
	puts
	puts "* PDF Engine finished - returning to DocGem"
	
 end

end

private

def setup_paths(html_dir_abs)

  #paths behave slightly differently depending on which OS we are on
  html_dir = html_dir_abs
  o_s = RbConfig::CONFIG['host_os'].to_s
  if(o_s == "mswin" or o_s == "windows" or o_s == "mingw32" or o_s == "mingw64" )
     @bin_path_abs='wkhtmltopdf.exe'
     @html_dir_abs='file:///'+html_dir.to_s+'/' #note the the trailing slash
	 arg = '"wkhtmltopdf.exe" --version'
	 status, stdout, stderr = systemu arg

  elsif(Regexp.compile('darwin').match(o_s) or Regexp.compile('linux').match(o_s) )
     @bin_path_abs="wkhtmltopdf" #already in system path
     @html_dir_abs=html_dir.to_s+'/' #note the trailing slash
	 arg = 'wkhtmltopdf --version'
	 status, stdout, stderr = systemu arg
  else
    puts "Your operating system is not supported"
    Process.exit
  end

   version_result = ""
   result = status.to_s.split(" ").last
	if(result != "0") #wkhtmltopdf exited with fail state
	  Log.log_message("Error setting up PDF Engine",false)
	  Log.log_message(stderr,true)
	  terminate
	else 
	  version_result=stdout+stderr
	end

   if(Regexp.compile('0.11.0').match(version_result.to_s))
	   @wkhtmltopdf_version = "0.11.0"  
   elsif(Regexp.compile('0.10.0').match(version_result.to_s))
	   @wkhtmltopdf_version = "0.10.0"
   elsif Regexp.compile('0.9.9').match(version_result.to_s)
	   @wkhtmltopdf_version = "0.9.9"
   else
	  puts "Your version of wkhtmltopdf is not supported"
      Process.exit
   end

 end
