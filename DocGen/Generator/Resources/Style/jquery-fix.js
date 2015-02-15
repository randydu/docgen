/* There is a known bug in jQuery core, where hieght is incorrectly calculated:
http://dev.jquery.com/ticket/4666

The appears as jumpiness in the jQuery slide effect (see links - the first one also has the fix used here).
http://blog.pengoworks.com/index.cfm/2009/4/21/Fixing-jQuerys-slideDown-effect-ie-Jumpy-Animation
http://jqueryfordesigners.com/slidedown-animation-jump-revisited/

Example occurences:
 - table width is 100% and we try to fix cell widths
*/

function fixed_slideToggle(el, bShow){
  var $el = $(el), height = $el.data("originalHeight"), visible = $el.is(":visible");
  // if the bShow isn't present, get the current visibility and reverse it
  if( arguments.length == 1 ) bShow = !visible;
  
  // if the current visiblilty is the same as the requested state, cancel
  if( bShow == visible ) return false;
  
  // get the original height
  if( !height ){
    // get original height
    height = $el.show().height();
    // update the height
    $el.data("originalHeight", height);
    // if the element was hidden, hide it again
    if( !visible ) $el.hide().css({height: 0});
  }

  // expand the knowledge (instead of slideDown/Up, use custom animation which applies fix)
  if( bShow ){
    $el.show().animate({height: height}, {duration: 180});
  } else {
    $el.animate({height: 0}, {duration: 180, complete:function (){
        $el.hide();
      }
    });
  }
}