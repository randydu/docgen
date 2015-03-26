
$(document).ready( function () {

  //mathematical expressions using katex, if enabled
  $('.katex-math').each(function() {
    var texTxt = $(this).text();

    el = $(this).get(0);
    if(el.tagName == "DIV"){
        addDisp = "\\displaystyle";
    } else {
        addDisp = "";
    }
    try {
        katex.render(addDisp+texTxt, el);
    }
    catch(err) {
        $(this).html("<span class='err'>"+err);
    }
  });

});