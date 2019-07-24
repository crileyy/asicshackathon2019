var config = {
  init_overrides: {},
  skins: { //IMPORTANT: ensure these have the pattern "style-"
    default_style: "style-default",
    haglofs: "style-haglofs",
    asics_studio: "style-asics_studio",
    asics_perf_uk: "style-asics_perf_uk",
    asics_perf_marathon: "style-asics_perf_uk",
    asics_perf_jp: "style-asics_perf_jp",
    asics_walking: "style-asics_walking",
    onitsuka_tiger_uk: "style-onitsuka_tiger_uk",
    asics_tiger_uk: "style-asics_tiger_uk",
    runkeeper: "style-runkeeper",
    oasis: "style-asics_perf_uk",
    raceroster_25: "style-raceroster_25",
    aeg_outlet_instore: "style-aeg_outlet_instore",
    asics_outlet_eu: "style-aeg_outlet_instore",
    aeg_outlet_instore_uk_only: "style-aeg_outlet_instore"
  }
}; //all we need for now

//defined and called here so it happens immediately after calling the default styles
var stylize = function(){
  var css_search = "link[href*='style-']"; //format of css override files

  var swap_style = function(style_key){
    if(!style_key){ style_key = "default_style"; }  //empty style, use default

    if(check_styles(style_key) === true)
    {
      remove_styles();
      var new_style_filename = getVersionedFilename("styles/" + config.skins[style_key] + ".css");
      var new_style = document.createElement("link");
      new_style.setAttribute("rel", "stylesheet");
      new_style.setAttribute("type", "text/css");
      new_style.setAttribute("href", new_style_filename);
      document.getElementsByTagName("head")[0].appendChild(new_style);
    } else if(check_styles(style_key) === false) {
      swap_style();
      return false;
    }
  };

  var remove_styles = function(){
    var remove_css = document.querySelectorAll(css_search); //remove any existing skins
    for(var x=0; x<remove_css.length; x++){
      remove_css[x].parentNode.removeChild(remove_css[x]);
    }
  };

  var check_styles = function(style){
    if(config.skins.hasOwnProperty(style)) { //valid style key so check if loaded
      var style_should_be_filename = getVersionedFilename("styles/" + config.skins[style] + ".css");
      var style_should_be = document.querySelectorAll("link[href*='" + style_should_be_filename + ".css']");
      if(!style_should_be.length) //if state's style is not loaded, return true
      {
        return true;
      }
    } else { //invalid style param, so return false
      return false;
    }
  };

  return {
    detect: function(){
      if(swap_style(url_param("style")) === false)
      {
        config.init_overrides.style = ""; //remove unsupported param, takes effect on initial newview.set call
      }
    },
    swap: swap_style
  };
}();


stylize.detect();
