# (c) 2015 Mark Macdonald

#    DOCGEN (A DOCUMENTATION GENERATOR)
#
#    This command line application takes text files formatted in Markdown and 
#    produces styled, formatted documentation in PDF form and as a static
#    website.
#
#    Author - Mark Macdonald
#    Version:
     docgen_version="1.0.x"
#
#********************************************************************************

#*******************************************************************************
#********************************  INITIALISE  *********************************
#*******************************************************************************

def terminate(optional_message)
 if !optional_message.empty?
  puts
  Log.log_message(optional_message,false)
  Log.log_exception
  exit #exit will throw a final exception
 else
  Log.log_exception
  puts
  abort("DocGen experienced a problem and needs to exit. For technical info, see log.txt")
 end
end

begin
	require_relative 'Resources/Logger.rb'
	Log = Logger.new()
	Log.log_environment(docgen_version)
    Log.log_message("* Loading DocGen (version: "+docgen_version+")",false)
rescue Exception => e
	puts "Error:", $! #the last exception
	abort("DocGen experienced a problem loading the logging tool and needs to exit. ")
end

begin
    Log.log_message("* Loading dependencies",false)
	require 'rubygems'
	require 'fileutils'
	require 'optparse'
	require 'find'
	require 'pathname'
	require 'yaml'
	require 'kramdown'
	require 'date'
	require 'nokogiri'
	require 'kwalify'
	require 'systemu'
	require_relative 'Resources/PDF.rb'
rescue Exception => e
	terminate("")
end

#*******************************************************************************
#*********************************  FUNCTIONS  *********************************
#*******************************************************************************

#Default Ruby sort is an unstable sort (will not retain relative order of records that have the same key).
#Workaround to provide stable sort. See - http://rosettacode.org/wiki/Sort_stability#Ruby
class Array
  def stable_sort
    n = -1
    if block_given?
      collect {|x| n += 1; [x, n]
      }.sort! {|a, b|
        c = yield a[0], b[0]
        if c.nonzero? then c else a[1] <=> b[1] end
      }.collect! {|x| x[0]}
    else
      sort_by {|x| n += 1; [x, n]}
    end
  end
 
  def stable_sort_by
    block_given? or return enum_for(:stable_sort_by)
    n = -1
    sort_by {|x| n += 1; [(yield x), n]}
  end
end

#Function to (over)write any file with string content
def write_file(path,content)
 begin
  f = File.new(path.to_s, "w+")
  f.puts content.to_s
  f.close
 rescue Exception => e
  terminate("DocGen was unable to write to the file: "+path.to_s)
 end
end

#Function to recursively copy a directory, with optional regex exclusions (e.g. to exclude certain extensions)
#  -- wraps a workaround for a file copy issue in the Ruby core
def safe_copy_dir(source,destination,ignored_extensions)
begin
 if File.directory?(destination.to_s)
  FileUtils.rm_rf(destination.to_s)
 end
 
  FileUtils.mkdir_p(destination.to_s)
  
  Dir.foreach(source.to_s) do |file|
    exclude = false
	exclude = true if (File.basename(file) == '.' or File.basename(file) == '..')
	ignored_extensions.each do |exclusion|
	  exclude = true if (file.match(/#{exclusion}/i))
	end
    next if exclude

    s = File.join(source.to_s, file)
    d = File.join(destination.to_s, file)

    if File.directory?(s)
      FileUtils.mkdir(d)
      safe_copy_dir s, d, ignored_extensions
    else
	 #********************************************************************************
	 #  ISSUE WORKAROUND - File copy issue in Ruby core
	 #  
	 #  Issue - FileUtils.cp (and its siblings) sometimes create corrupt files in 
	 #    the destination (observed on Windows). Typically occurs when the source
	 #    folder contains directories (not just files) and these directories do not yet
	 #    exist in destination (even despite mkdir creating them above). Occurs only 
	 #    for the first run after destination has been manually deleted through explorer
	 #      - see http://www.ruby-doc.org/stdlib/libdoc/fileutils/rdoc/classes/FileUtils.html
	 #
	 #  Cause - unknown. FileUtils.cp uses the following basic principle:
	 #     IO.copy_stream(source_path, File.open(dest_path, 'wb'))
	 #     When the issue occurs, copy_stream copies 0 bytes. Full diagnosis via Ruby IO C code?
	 #        see - http://www.ruby-doc.org/doxygen/1.8.4/io_8c.html
	 #              http://www.ruby-doc.org/doxygen/1.8.4/io_8c-source.html
	 #     The sysread and syswrite methods used in older ftools copy also exhibit the issue
     #        see - http://stdlib.rubyonrails.org/libdoc/ftools/rdoc/index.html	
	 #  
	 #  Workaround - copy file twice if the sizes don't match after first attempt
	 #
	 #  Todo (mm) - complete diagnosis and submit bug to ruby-core
     begin
       FileUtils.cp(s, d)
	   FileUtils.cp(s, d) if File.size(File.path(d)) != File.size(File.path(s)) #see above
	   if File.size(File.path(d)) != File.size(File.path(s)) #warn user if it still didn't work
	    Log.log_message("Error copying internal files",true)
	    terminate("")
	   end
	 rescue Exception => e
	   Log.log_message("Error copying internal files",true)
	   terminate("")
     end
	 #  End of issue workaround
	 #********************************************************************************
    end
  end
rescue Exception => e
 terminate("DocGen was unable to copy the directory: "+source.to_s)
end
end

#Function to safely open files (including UTF-8 handling)
def safe_open_file(path)
 begin
  file_string = File.open(path.to_s,"r:UTF-8").read
  bom_pattern="\xEF\xBB\xBF".force_encoding("UTF-8")
  file_string.gsub!(bom_pattern,'') #strip out BOM
 rescue Exception => e
  terminate("DocGen was unable to open the file: "+path.to_s)
 end
 return file_string
end

#Function to make sure config YAML is UTF-8 without BOM
def safe_load_YAML(path)
 begin
  yaml_file=safe_open_file(path.to_s)
  safe_yaml=YAML::load(yaml_file)
 rescue Exception => e
  terminate("Error opening YAML file. Check for syntax error in DocGen config files?\n"+path.to_s)
 end
 return safe_yaml
end

#Function to read any HTML template, and substitute the tags with the hash parameters (returns string with substituted HTML)
def prep_html(file_path,parameters)
 html = safe_open_file(file_path.to_s)
 #substitute each config parameter into the file, if found (convention: YAML 'parameter-name' will be <%parameter-name%> in HTML template)
 parameters.each do |name,value|
	 html.gsub!("<%"+name+"%>".force_encoding("UTF-8"),value.to_s)
 end
 return html
end

def generate_TOC(table_of_contents,pdf_filename,src_path_abs,gen_path_abs)
 #also need to build an array with the correct order of the html pages so that the PDF Generator knows which order to put them together
 ordered_html_files=[]
 headings = []
 html_columns = ["","","",""]

 #sort headings by column in the order they appear in table-of-contents.yml
 table_of_contents = table_of_contents.stable_sort_by { |a| a['column'] } 
 
 #Go through each (ordered) heading in turn and find all links
 table_of_contents.each { |h|
  heading=h['heading']
  col=h['column']
  links=h['links']
  html_columns[col-1]<<'<li class="TOC_heading">'+heading+'</li>'
  if (links && !links.empty?) 
    links.each { |link|
    if (Regexp.compile('.html').match(link['url']) ) #(For PDF) - exclude web TOC links to non-html pages
	  if (Regexp.compile('http://').match(link['url']) ) #(For PDF) - exclude HTML pages where link is http://
	    #do nothing at all
	  else
	    #Check that the file mentioned in table_of_contents.yml actually exists
		if File.exists?(Pathname.new(src_path_abs+(link['url'].gsub(".html",".txt"))))
	      ordered_html_files<<link['url']
		else
		  Log.log_message("\nWarning: "+link['url']+" is listed in table_of_contents.yml but no text file exists\n",false)
		end
	  end
    end 
    html_columns[col-1]<<'<li><a href="'+link['url']+'">'+link['title']+'</a></li>'
   }
  end
 }

 html = safe_open_file(gen_path_abs+Pathname.new("Resources/web-TOC.html"))
 html.gsub!("<%column1%>".force_encoding("UTF-8"),html_columns[0])
 html.gsub!("<%column2%>".force_encoding("UTF-8"),html_columns[1])
 html.gsub!("<%column3%>".force_encoding("UTF-8"),html_columns[2])
 html.gsub!("<%column4%>".force_encoding("UTF-8"),html_columns[3])
 html.gsub!("<%PDF_file%>".force_encoding("UTF-8"),pdf_filename.to_s)

 return html, ordered_html_files
end

#*******************************************************************************
#*********************************  MAIN  **************************************
#*******************************************************************************
begin

src_path_abs = Pathname.new("")
out_path_abs = Pathname.new("")
gen_path_abs = Pathname.new(File.dirname(File.expand_path(__FILE__)).to_s) #path to location of THIS SCRIPT FILE
user_working_dir = Pathname.new(Dir.pwd.to_s)

Log.log_message("* Loading configurations",false)
#Read any command-line input arguments
options = {}
opts = OptionParser.new do |opts|
  opts.on("--sourcePath SP", String, "Directory which DocGen should look for the source files in") do |n|
    options['sourcePath'] = n
  end
end
opts.parse! ARGV

#Establish where to read the source files from
if (options.has_key?('sourcePath'))
 sourcePath = Pathname.new(options['sourcePath'])
 if (sourcePath.absolute?)
  src_path_abs=sourcePath
 else
  src_path_abs = user_working_dir+sourcePath
 end
elsif File.exists?(user_working_dir+"doc-parameters.yml")
 src_path_abs=user_working_dir
else
 src_path_abs=user_working_dir+"../Source/"
end

src_path_abs.cleanpath
gen_path_abs.cleanpath

#*******************************************************************************
#load configuration parameters and user options from config files, validate

#load the kwalify schema files and get a validator for each
table_of_contents_schema = safe_load_YAML( gen_path_abs+"Resources/table-of-contents.schema.yml" )
behaviours_schema = safe_load_YAML(gen_path_abs+"Resources/tool-behaviours.schema.yml")
configs_schema = safe_load_YAML(gen_path_abs+"Resources/doc-parameters.schema.yml")

table_of_contents_validator = Kwalify::Validator.new(table_of_contents_schema)
behaviours_validator = Kwalify::Validator.new(behaviours_schema)
configs_validator = Kwalify::Validator.new(configs_schema)

table_of_contents = safe_load_YAML(src_path_abs+"table-of-contents.yml")
behaviours = safe_load_YAML(src_path_abs+"tool-behaviours.yml")
configs = safe_load_YAML(src_path_abs+"doc-parameters.yml")

table_of_contents_errors = table_of_contents_validator.validate(table_of_contents)
behaviours_errors = behaviours_validator.validate(behaviours)
configs_errors = configs_validator.validate(configs)

#terminate DocGen if the validators failed
if (!table_of_contents_errors.empty? || !behaviours_errors.empty? || !configs_errors.empty?)
  puts("DocGen found errors in the config files (please check against the reference):")
  puts
  for error in table_of_contents_errors
    Log.log_message("   "+error.message,false)
  end
  for error in behaviours_errors
    Log.log_message("   "+error.message,false)
  end
  for error in configs_errors
    Log.log_message("   "+error.message,false)
  end
 puts
 exit
end

#put behaviours and parameters into one hash
configs.merge!(behaviours)

configs["date"]=Time.now.strftime("%d/%m/%Y") #add a couple of last-minute system parameters
configs["year"]=Time.now.strftime("%Y")
configs["docgen_version"]=docgen_version.to_s
configs["author_link"]='<a href="mailto:'+configs['email']+'">'+configs['author']+'</a>'

#TODO - confirm that the output file and output dir aren't actually paths
if ( Regexp.compile('\.|\/').match(configs["output_filename"]) || Regexp.compile('\.|\/').match(configs["output_dirname"]) )
  terminate("Config error in tool-behaviours.yml: output_filename and output_dirname must not be paths")
end

#convert all config strings that represent paths into Ruby Pathname objects
configs["output_path"]=Pathname.new(configs["output_path"])
configs["PDF_filename"]=Pathname.new(configs["output_filename"]+".pdf")
configs["HTML_filename"]=Pathname.new(configs["output_filename"]+".html")
configs["output_dirname"]=Pathname.new(configs["output_dirname"])
configs["homepage"]=Pathname.new(configs["homepage"])
configs["redirect"]=configs["output_dirname"]+configs["homepage"]

#Establish where to output files to
if (configs['output_path'].absolute?)
  out_path_abs = Pathname.new(configs['output_path'])
else
  out_path_abs=src_path_abs+Pathname.new(configs['output_path'])
end
out_path_abs.cleanpath

#*******************************************************************************

Log.log_message("* Creating output structure",false)
#Delete the output files (if they exists) to make sure we flush out old files
FileUtils.rm_f(out_path_abs+configs['HTML_filename'])
FileUtils.rm_rf(out_path_abs+configs['output_dirname'])

safe_copy_dir(gen_path_abs+"Resources/Style", out_path_abs+configs['output_dirname']+"Style",[".svn"])
safe_copy_dir(src_path_abs+"Images",out_path_abs+configs['output_dirname']+"Images",[".svn"])
safe_copy_dir(src_path_abs+"Docs",out_path_abs+configs['output_dirname']+"Docs",[".svn"])

#*******************************************************************************

Log.log_message("* Generating HTML content",false)
#put conditional exclusion comments around all scripts if IE ActiveX suppression is enabled
if (configs["suppress_IE_warning"]==true)
 configs["exclude_IE_top"]="<!--[if !IE]>-->"
 configs["exclude_IE_bottom"]="<!--<![endif]-->"
else
 configs["exclude_IE_top"]=""
 configs["exclude_IE_bottom"]=""
end

#substitute user options into the documentation templates
header=prep_html(gen_path_abs+"Resources/header",configs)
footer=prep_html(gen_path_abs+"Resources/footer",configs)
print_cover=prep_html(gen_path_abs+"Resources/print-cover.html",configs)
print_header=prep_html(gen_path_abs+"Resources/print-header.html",configs)
print_footer=prep_html(gen_path_abs+"Resources/print-footer.html",configs)
homepage_link=prep_html(gen_path_abs+"Resources/documentation-link.html",configs)
web_ownership=prep_html(gen_path_abs+"Resources/web-ownership.html",configs)

#dynmically generate the HTML for the table of contents.
html_TOC, file_TOC = generate_TOC(table_of_contents,configs["PDF_filename"],src_path_abs,gen_path_abs)
header.gsub!("<%TOC_html%>".force_encoding("UTF-8"),html_TOC)

#Check source text files *required* by DocGen actually exist
if !File.exists?(Pathname.new(src_path_abs+"change-log.txt"))
  terminate("Required Source file change_log.txt was missing")
end

#convert every markdown (.txt) file into a web page
files = Dir.entries(src_path_abs) #all files in the Source folder
files.each { |filename|
 if (Regexp.compile('.txt').match(filename)) 
    content = safe_open_file(src_path_abs+filename)
	html = Kramdown::Document.new(content).to_html
    write_file(out_path_abs+configs['output_dirname']+filename.gsub!(".txt",".html"),header.force_encoding("UTF-8")+html+footer.force_encoding("UTF-8"))
 end
}
#add in one automatically generated HTML file - the project ownership details
write_file(out_path_abs+configs['output_dirname']+"ownership.html",header+web_ownership+footer)

#temporary HTML for the PDF generator header etc
write_file(gen_path_abs+"Resources/temp_cover.html",print_cover)
write_file(gen_path_abs+"Resources/temp_header.html",print_header)
write_file(gen_path_abs+"Resources/temp_footer.html",print_footer)

OutputPDF=PDF.new((out_path_abs+configs['output_dirname']).to_s,file_TOC)
Log.log_PDF_engine_environment
OutputPDF.generate(configs["PDF_filename"].to_s)

Log.log_message("* Tidying up files",false)
File.delete(gen_path_abs+"Resources/temp_cover.html")
File.delete(gen_path_abs+"Resources/temp_header.html")
File.delete(gen_path_abs+"Resources/temp_footer.html")

#*******************************************************************************
# Optionally go through each web page and create a local page table of contents based on the headings
if (configs["generate_page_TOC"]==true)
 files = Dir.entries(out_path_abs+configs['output_dirname'])
 files.each { |filename|
 if (Regexp.compile('.html').match(filename) && !Regexp.compile('index').match(filename) && !Regexp.compile('ownership').match(filename) && !Regexp.compile('change-log').match(filename)) 
    path = out_path_abs+configs['output_dirname']+filename
	file = File.open(path,"r+:UTF-8")
	html = Nokogiri::HTML(safe_open_file(path))

	pageTOC = Nokogiri::XML::Node.new('ul',html)
	pageTOC['class'] = "pageTOC"

	#issue workaround - html.css('h3,h2').each selects by group, not by source order. Therefore apply a class to all these headings first so we can get all by source order
	#see https://groups.google.com/group/nokogiri-talk/browse_thread/thread/ebde0d08c08f03a8?hl=en
	allheadings = html.css('h2,h3').each do |heading|
	 heading['class']= "content-heading"
	end

    if !html.css('.content-heading').empty?
	 html.css('.content-heading').each do |heading| #TODO - mm fix for html.css('h3,h2') ... currently not ordered by appearance in document
	  anchor = Nokogiri::XML::Node.new('a',html)
	  link = Nokogiri::XML::Node.new('a',html)
	  li = Nokogiri::XML::Node.new('li',html)
	  link['href'] = "#"+heading['id']
	  link.content = heading.content 
	  if heading.name == "h2"
	   li['class'] = "major"
      else
	   li['class'] = "minor"
      end
	  li.add_child(link)

	  pageTOC.add_child(li)
	  anchor['name'] = heading['id']
	  anchor.content = heading.content
	  heading.content = ""
	  heading.add_child(anchor)
	 end

	 pageHeading = html.css('div#content h1').first
	 if (!pageHeading.nil?)
	  pageHeading.add_next_sibling(pageTOC)
	 end
    end

	file.truncate(0)
	file.puts html.to_html
    file.close
 end
 }
end

#*******************************************************************************

#write a homepage in the output_dir root which redirects to the real homepage in output_dir/Docs
#this is just easier for the user - they don't need to browse for the right start page
write_file(out_path_abs+configs["HTML_filename"],homepage_link)
Log.log_message("* DocGen finished successfully",false)

rescue Exception => e
 terminate("")
end
