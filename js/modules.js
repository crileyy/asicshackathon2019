$.fn.serializeObject = function() { //quick function for serializing form to key-value pairs
    var o = {};
    var a = this.serializeArray();
    $.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

var remap = function(current_payload, remapped){ //rename input names to those accepted by API
  //IMPORTANT: current_payload is an object and will therefore be mutated below. Objects are treated like references in javascript.
  $.each(current_payload, function(k, v){
    if(remapped[k]){
      current_payload[remapped[k]] = v;
      delete current_payload[k];
    }
    if(remapped.hasOwnProperty("remove") && remapped.remove.indexOf(k)!==-1) //if this key is included in the "remove" array
    {
      delete current_payload[k];
    }
  });
};

var defer_call = function(callback_name, callback){
  if(!config.translate_done) //double-check here if there's existing translate work happening...happens when both locale AND view are passed, like on first load
  {
    config.deferred_calls.after_translation[callback_name] = callback;
  } else { //any time afterwards this can be run on demand
    delete config.deferred_calls.after_translation[callback_name];
    callback();
  }
};

var fix_autofill = function(){ //attempt to fix chrome autofill by applying a valid class so autofill text doesn't overlay placeholder
  try {
    $(":-webkit-autofill").parents(".input_outer_container").addClass("valid");
  } catch(e) {
    console.log("unsupported autofill");
  }
};

// implements functionality to auto-check marketing comm checkbox if the country is GDPR compliant
// to use this: just add data-userchange on a_newsletter that has a country menu dropdown on the same page
var auto_check_marketing_comm = function($elem) {
  // fetching country menu dropdown upon page load
  $elem = (typeof $elem === 'undefined') ? $("[data-fieldid=a_country]", "#" + state.view) : $elem;

  var $newsletter = $('[data-fieldid=a_newsletter][data-userchange]', '#' + state.view);

  // checking if country selected in menu dropdown is in the config prop array of countries that should auto-receive marketing communications
  if ($newsletter.length && !$newsletter.data('userchange')) {
    var checked_val = config.auto_check_country.indexOf($elem.val()) !== -1 ? true : false;
    $("[data-fieldid=a_newsletter]", "#" + state.view).prop("checked", checked_val);
  }
};

//MODULES BELOW

//SWAPPING VISIBLE CONTENT AND PUSHING TO BROWSER HISTORY
//immediately invoked using the config vars for what params to keep from url and the content area this should be used for. can be scaled.
var newview = (function (keep_params, content_box, translate_all, default_params, screens, run_switches, redirects) {
  var url_params = function () { //grab url params to bring along for the ride
    var p = {};
    for (var x = 0; x < keep_params.length; x++) {
        var param = url_param(keep_params[x]);
      if (param) {
        // This will make sure boolean parameters (as strings) are converted to boolean values when parsed from the URL
        // Otherwise we need to make sure to do this everywhere those parameters are used which is uglier...
        p[keep_params[x]] = (param==='true') ? true : (param==='false') ? false : decodeURIComponent(param);
      }
    }
    //TODO: uncomment to use endpoint as view param
    //special case for "view" param since it's the endpoint in the pathname
    /*if(get_endpoint() !== ""){
      p.view = get_endpoint();
    }*/
    return p;
  };

  var clean_params = function (dirty) { //rinse a set of params, only keeping what we want
    var p = {};
    for (var x = 0; x < keep_params.length; x++) {
      // need to check if the parameter is defined (since boolean values could result in false)
      if (dirty[keep_params[x]] || dirty[keep_params[x]] === false) { //don't carry blank params but carry false ones
        p[keep_params[x]] = decodeURIComponent(dirty[keep_params[x]]);
      }
    }
    return p;
  };

    var clear_one_time_use = function(){ //any one_time_use params should be removed after being stored to history state
        for(var x=0; x<one_time_use.length; x++){
            if(state.hasOwnProperty(one_time_use[x]))
            {
                delete state[one_time_use[x]];
            }
        }
    };

  var should_this_run = function(do_this, params) { //look at passed params vs trigger params to see if this functionality should run
    return run_switches[do_this].filter(function(v){return params.hasOwnProperty(v);}).length>0?true:false;
  };

  var run_on_set = function(params){ //run through this during the newview
    if(!params.refresh || (params.refresh&&first_load)) //if we're going to refresh, then don't do any of this yet...make the history state changes, and THEN run through this again on reload and take care of all this...if window.history.state
    {
      if(should_this_run("auto_fb_login", params))
      {
        state.auto_fb_login = true;
      }
      if(should_this_run("auto_google_login", params))
      {
        state.auto_google_login = true;
      }
      if(should_this_run("stylize", params))
      {
        if(stylize.swap(state.style) === false){ state.style = default_params.style; } //dynamic css...if invalid param, then reset it to default
      }
      if (should_this_run("client_config", params) && !first_load) //fetch new client config if this is not the first load and client_id dynamically changes
      {
        client_config.fetch(params); //need to pass params here since client_config uses url_params and url hasn't been changed yet
      }
      if (should_this_run("blockswap", params))
      {
        blockswap.by_selector(translate_all);
      }
      if (should_this_run("translate", params)) //run translate if trigger params are passed
      {
        var translate_opt = {
          selector: translate_all,
          locale: params.locale
        }; //add locale to translate options if provided in params

        //run this callback when translations are done ONLY ON FIRST LOAD - or a non-refresh logout - to prepop the country dropdown based on locale
        if(first_load){
          translate_opt.runwhendone = function(){
            populate.map_params_to_inputs(params);
          };
        }

        translate.by_selector(translate_opt); //translate each section, footer, and modals
      }
      if(should_this_run("dynamic_terms", params)){ defer_call("dynamic_urls", function(){blockswap.dynamic_urls(state.terms_url, "terms");}); } //dynamic tos links
      if(should_this_run("dynamic_pp", params)){ defer_call("dynamic_pp", function(){blockswap.dynamic_urls(state.privacy_url, "pp");}); } //dynamic pp links
      if(should_this_run("body_mod", params)){ blockswap.body_mod(); } //add/remove css classes to body depending on params
      if(should_this_run("error_handler", params)){ action_call.error_handler(state.error, $(".error", "#"+state.view)); } //show error if bounced/logged out to this screen with an error
      if(should_this_run("auto_check", params)) { defer_call("auto_check_marketing_comm", function() { auto_check_marketing_comm(); }); }

      //for showing message
      if(state.hasOwnProperty("message"))
      {
        if($message){ $message.hide(); } //hide any existing messages
        $message = $(".message_"+state.message, "#"+state.view);
        $message.show();
      } else if($message){ $message.hide(); }

      //for showing modal
      if (state.modal) //special param case to launch modal if in initial url, but do not carry this param forward
      {
        var $launch_modal = $(".modal." + state.modal);
        if ($launch_modal.length) {
          $(document).trigger("modal", [$launch_modal]);
        } //launch modal according to param if it exists
      }
    }
  };

  var get_endpoint = function(){
    return location.pathname.split("/").pop();
  };

  //set some initial vars
  var landing_hash = decodeURIComponent(window.location.hash.substring(1)).toLowerCase().replace(/\s+/g, ''); //support "#" links as they are the nonjs fallback and should be treated as the primary (view) param
  var init_params = {};
  var one_time_use = ["modal", "message", "error"]; //remove these from state after single use

  //view param is a special case because it can be a url param, the hash ("#[view]"), or the endpoint in the url pathname
  if (url_param("view")) {
    init_params.view = url_param("view");
  } else if (landing_hash !== "") {
    init_params.view = landing_hash;
  } else if(get_endpoint() !== ""){
    init_params.view = get_endpoint();
  } //add "view" to init_params if it's defined
  $.extend(init_params, {
    modal: url_param("modal"),
    message: url_param("message"),
    error: url_param("error"),
    first_name: url_param("first_name"), //scrub this as it's pii, but keep in state, so don't add to one_time_use
    last_name: url_param("last_name"), //scrub pii, but keep in state
    email: url_param("email"), //scrub pii, but keep in state
    token: url_param("token") //SPECIAL. if a token is passed as per a reset-password url, use that, but DO NOT carry it forward in url.
  }); //use the ?view param or the landing hash as the page param. view param takes precedence.
  var first_load = true; //for use below to set initial params and ensure that the url is replaced on the first load
  var $login_required; //need to login first message
  var $message; //message from url param

  var rewrite_history = function(title){ //for synthetic browser history rewriting
    if (history.pushState && !state.nopush) //ensure browser supports pushState and this isn't a back or forward click
    {
      //prepare to push to browser history object
      if(state.hasOwnProperty("bounce") && (state.view !== screens.complete_profile) && (state.view === state.bounce || screens.logged_in_continue_or_bounce.indexOf(state.view) === -1 || state.bounce==="")){ delete state.bounce; if($login_required){ $login_required.hide();}} //if the view state matches the bounce state, it means we've done bounced son, so delete the property and hide any login required message. Or...if we navigate to a non-bounce-able screen (like forgot password), then remove the bounce param
      var clean_url = $.extend({}, clean_params(state)); //duplicate the params object to allow for manipulation before sending to history object, and rinse
      var url_add = $.param(clean_url) + (landing_hash && landing_hash !== state.view ? "#" + landing_hash : "") + "!new"; //rebuild the query string, taking only what is desired and add "!new" so the browser registers a unique push
      
      //TODO: uncomment to use endpoint as the view param
      //var new_endpoint = (location.pathname).replace(/(.*\/)(.*)$/, "$1"+state.view); //the state view is going to replace the endpoint
      var new_endpoint = location.pathname;
      var push_url = (location.protocol + '//' + location.host + new_endpoint + (url_add !== "" ? "?" + url_add : "")); //rebuild the url using fresh parameterization
      state.title = title; //set the title of the page and save to history params

      if (landing_hash == state.view || first_load) //for a #view hash which is replaced to "?view" or this is a default_show
      {
        history.replaceState(state, title, push_url);
      } else if (!first_load) //if not the first load then proceed with the pushStates to modify the browser history
      {
        history.pushState(state, title, push_url);
      }
    } else if (state.hasOwnProperty("nopush")) {
      delete state.nopush;
    } //remove the nopush as it's only good for one-time use on a back/forward
  };

  //put the set method up here on its own just for readability
  var set = function (params) {
    // store current view, to be updated to state if view changes
    var prev_view = state.view;

    //as pointed out above, params can be built out beyond just the "view" property
    var first_load_params = $.extend({}, default_params, url_params(), init_params); //baseline list of params. defaults + "keeper" url params + non-keeper init params
    var url_and_first_load = first_load ? first_load_params : url_params(); //if this is the first_load, use that. otherwise only use url params.
    params = first_load ? $.extend({}, first_load_params, params) : params; //critical for initial experience: need to merge any passed params into first_load stuff. goal here is for "params" to only include what is changing.

    if(params.view && redirects.hasOwnProperty(params.view)){ params.view = redirects[params.view]; } //for redirecting endpoints

    var hist_params = history.pushState && !!!params.fresh_url ? $.extend({}, url_and_first_load, params) : params; //if browser supports history object and this request wasn't sent with a specific "fresh_url: true" (like during logout), we carry url params with us and rewrite url with them
    state = $.extend(state, hist_params); //merge into state so we have a global truth for this session
    var title = document.title.split(" - ")[0]; //for compiling and rewriting title later

    if (params.view) //"swap screen" functionality. this updates nav, hides everything except the section that matches view param, and sets a new browser window title.
    {
      var $section = (content_box.sections).filter("#" + params.view); //jquery pointer to the area specified in url

      //to scale out and use url params to perform addl actions, then handle those params here
      if ($section.length) //before going forward, ensure there is a matching screen for this param
      {
        if (screens.no_creds.indexOf(params.view) === -1 && !creds.check()) //not-logged-in user tries to view screen that requires creds...send to login page
        {
          if(screens.dont_bounce_to_here.indexOf(params.view) === -1){ params.bounce = state.bounce = params.view; }//add this to url so that user can be redirected after action. But there are some screens we dont want to bounce back to once logged in, like continue as user.
          params.view = state.view = screens.login;
          $section = (content_box.sections).filter("#" + params.view); //have to re-set the section to be un-hidden
        }
        if (screens.logged_in_continue_or_bounce.indexOf(params.view) !== -1 && creds.check() === true) //logged-in user accesses a login page...send to continue as user
        {
          params.view = state.view = screens.continue;
          $section = (content_box.sections).filter("#" + params.view); //have to re-set the section to be un-hidden
        }

        run_on_set(params); //view logic is done. can now run the blockswapping, etc with the updated view param.

        //for showing "must login first" if sent to login/lander/register screen with "bounce" param
        if(!!state.bounce && screens.logged_in_continue_or_bounce.indexOf(params.view) !== -1) //show "must login first" msg if on a bounce-able screen
        {
          if($login_required){ $login_required.hide(); } //hide any messages on other screens
          $login_required = $(".login_required", "#"+state.view); //login required message
          $login_required.show();
        }

        //nav
        var $nav_link = (content_box.nav).find("a[data-show='" + params.view + "']").first(); //jquery pointer to the nav link specified in url (but only first one)
        if (!$nav_link.is(":first-child") && !$nav_link.hasClass("active")) {
          (content_box.nav).addClass("responsive");
        } //if this isn't the first link in the nav AND the nav isnt already active (meaning this is a new page load) then add the responsive class to the nav so it's open on page load
        $(".active", content_box.nav).removeClass("active"); //remove all active links before setting a new active
        $nav_link.addClass("active"); //set current to active
        //end nav

        (content_box.sections).not("#" + params.view).hide(); //hide all sections that are not this one (using id attr)

        if(!params.refresh){
          var deferred_func;
          if(first_load){
            deferred_func = function(){
              $section.fadeIn(300, function(){
                if(screens.auto_scroll_to_top.indexOf(params.view) !== -1)
                {
                  $("html,body").animate({scrollTop: 0},700); //scroll to top when this screen is displayed
                }
                fix_autofill();}); //fix that chrome autofill mess
            };
          } else {
            deferred_func = function(){
              $section.fadeIn(300, function(){
                if(screens.auto_scroll_to_top.indexOf(params.view) !== -1)
                {
                  $("html,body").animate({scrollTop: 0},700); //scroll to top when this screen is displayed
                }
              });
            };
          }

          defer_call("section_fadein", deferred_func); //don't fade in until translations are done
        } //if this has been passed with a refresh param, wait until the location refresh to show, because it will flicker

        //extra trigger stuff
        $("[data-trigger]", $section).each(function () { //trigger anything using the data-trigger attribute
          $(document).trigger($(this).data("trigger"), [$(this)]);
        });
        var title_case = (params.view).replace("-", " ").replace(/\w\S*/g, function(t){return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase();}); //convert to title case using regex
        title += (" - " + title_case); //compile new title
        document.title = title; //set page title using javascript, not supported by most browsers

        // checking if the view changed
        if (state.view != prev_view && !!prev_view) {
          state.prev_view = prev_view;
        }

        analytics.logger({
          "event-name": "oneasics-pageview",
          "prev_view": state.prev_view
        }); //log screen view
        analytics.log_tealium();
      } else {
        newview.set({view: screens.default}); //call recursively and go back to default because this is an invalid view
      }
    } else {
      run_on_set(params);
    }

    rewrite_history(title); //we're rewriting history! well, browser history

    first_load = landing_hash = false; //clear these so we know app has been initialized and history rewriting can commence
    clear_one_time_use();
    $(document).trigger("newview"); //let the dom know we hit newview.set()

    if(params.refresh){window.location.reload();} //full reload
  };

  return {
    set: set,
    clear: function (params) {
      params = params || {};
      config.client_config.AccessToken = ""; //clear accesstoken
      params = params.fresh_url === false ? params : $.extend({}, default_params, params); //only keep all existing params on a clear if fresh_url is set specifically to false
      state = params.refresh === false ? $.extend({}, default_params) : {}; //keep default state props when resetting user flows within the same session
      $(".hide_oauth").show(); //reset flow
      $(".google_create[type=submit], .facebook_create[type=submit]").hide(); //hide third-party-specific signup buttons
      $("form").trigger("reset");
      $("[class^=hide-]").show(); //clear anything that's been hidden as a result of user action
      errors.clear();
      $(".valid, .focus").removeClass("valid focus"); //.invalid class is already taken care of with errors.clear()
      (content_box.sections).hide(); //hide before resetting screen
      this.set(params); //reset using defaults and any manually passed params
      populate.map_params_to_inputs(params); //prepopulate inputs
    }
  };
})(config.keep_params, config.content_area, config.translate_everything, config.defaults, config.screens, config.run_on_this, config.screens.redirects);

//VALIDATION
var errors = (function (unlocked_screens, valid_config) {
  var email_regex = /.+\@.+\..+/; //makes sure characters before the @ are valid, domain name will be verified in the api using a mx lookup.

  // pulled from https://github.com/mathiasbynens/emoji-regex/blob/master/index.js (and then altered because IE10/IE11 was not happy)
  var emoji_regex = /(?:\uD83C\uDFF4)(?:\uDB40\uDC67)(?:\uDB40\uDC62)(?:(?:\uDB40\uDC65)(?:\uDB40\uDC6E)(?:\uDB40\uDC67)|(?:\uDB40\uDC73)(?:\uDB40\uDC63)(?:\uDB40\uDC74)|(?:\uDB40\uDC77)(?:\uDB40\uDC6C)(?:\uDB40\uDC73))(?:\uDB40\uDC7F)|(?:\uD83D\uDC68)(?:(?:\uD83C\uDFFC)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C\uDFFB)|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB1\uDDBC\uDDBD]))|(?:\uD83C\uDFFF)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFE)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB-\uDFFD])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFD)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB\uDFFC])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\u200D(?:\u2764\uFE0F\u200D(?:(?:\uD83D\uDC8B)\u200D)?(?:\uD83D\uDC68)|(?:\uD83D[\uDC68\uDC69])\u200D(?:(?:\uD83D\uDC66)\u200D(?:\uD83D\uDC66)|(?:\uD83D\uDC67)\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83D\uDC66)\u200D(?:\uD83D\uDC66)|(?:\uD83D\uDC67)\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|(?:\uD83D[\uDC66\uDC67])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:(?:\uD83C\uDFFB)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFF)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFE)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFD)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFC)\u200D[\u2695\u2696\u2708])\uFE0F|(?:\uD83C\uDFFB)\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C[\uDFFB-\uDFFF]))|(?:(?:\uD83E\uDDD1)(?:\uD83C\uDFFB)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1)|(?:\uD83D\uDC69)(?:\uD83C\uDFFC)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC69))(?:\uD83C\uDFFB)|(?:\uD83E\uDDD1)(?:(?:\uD83C\uDFFF)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1))|(?:(?:\uD83E\uDDD1)(?:\uD83C\uDFFE)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1)|(?:\uD83D\uDC69)(?:\uD83C\uDFFF)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:(?:\uD83E\uDDD1)(?:\uD83C\uDFFC)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1)|(?:\uD83D\uDC69)(?:\uD83C\uDFFD)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC69))(?:\uD83C[\uDFFB\uDFFC])|(?:\uD83D\uDC69)(?:(?:\uD83C\uDFFE)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFC)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFB)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFC-\uDFFF])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFD)\u200D(?:(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC68)(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\u200D(?:\u2764\uFE0F\u200D(?:(?:\uD83D\uDC8B)\u200D(?:\uD83D[\uDC68\uDC69])|(?:\uD83D[\uDC68\uDC69]))|(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83C\uDFFF)\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC69)\u200D(?:(?:\uD83D\uDC66)\u200D(?:\uD83D\uDC66)|(?:\uD83D\uDC67)\u200D(?:\uD83D[\uDC66\uDC67]))|(?:(?:\uD83E\uDDD1)(?:\uD83C\uDFFD)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83E\uDDD1)|(?:\uD83D\uDC69)(?:\uD83C\uDFFE)\u200D(?:\uD83E\uDD1D)\u200D(?:\uD83D\uDC69))(?:\uD83C[\uDFFB-\uDFFD])|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC66)\u200D(?:\uD83D\uDC66)|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC69)\u200D(?:\uD83D[\uDC66\uDC67])|(?:(?:\uD83D\uDC41)\uFE0F\u200D(?:\uD83D\uDDE8)|(?:\uD83D\uDC69)(?:(?:\uD83C\uDFFF)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFE)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFC)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFB)\u200D[\u2695\u2696\u2708]|(?:\uD83C\uDFFD)\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|(?:\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]))\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|(?:\uD83C\uDFF4)\u200D\u2620)\uFE0F|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC67)\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83C\uDFF3)\uFE0F\u200D(?:\uD83C\uDF08)|(?:\uD83D\uDC15)\u200D(?:\uD83E\uDDBA)|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC66)|(?:\uD83D\uDC69)\u200D(?:\uD83D\uDC67)|(?:\uD83C\uDDFD)(?:\uD83C\uDDF0)|(?:\uD83C\uDDF4)(?:\uD83C\uDDF2)|(?:\uD83C\uDDF6)(?:\uD83C\uDDE6)|[#\*0-9]\uFE0F\u20E3|(?:\uD83C\uDDE7)(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|(?:\uD83C\uDDF9)(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|(?:\uD83C\uDDEA)(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|(?:\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|(?:\uD83C\uDDF7)(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|(?:\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFF])|(?:\uD83C\uDDF2)(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|(?:\uD83C\uDDE6)(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|(?:\uD83C\uDDF0)(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|(?:\uD83C\uDDED)(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|(?:\uD83C\uDDE9)(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|(?:\uD83C\uDDFE)(?:\uD83C[\uDDEA\uDDF9])|(?:\uD83C\uDDEC)(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|(?:\uD83C\uDDF8)(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|(?:\uD83C\uDDEB)(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|(?:\uD83C\uDDF5)(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|(?:\uD83C\uDDFB)(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|(?:\uD83C\uDDF3)(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|(?:\uD83C\uDDE8)(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|(?:\uD83C\uDDF1)(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|(?:\uD83C\uDDFF)(?:\uD83C[\uDDE6\uDDF2\uDDFC])|(?:\uD83C\uDDFC)(?:\uD83C[\uDDEB\uDDF8])|(?:\uD83C\uDDFA)(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|(?:\uD83C\uDDEE)(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|(?:\uD83C\uDDEF)(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;

  var check_valid = function (field, good_vibes_only) { //field param is jQuery
    var valid = true; //by default, this is valid, by will get changed if an invalid conditional is hit
    var empty_field = false; //use this as an override for masking since it contains a placeholder

    if (field.attr("data-errormsg")) //tie data-errormsg to the error msg to be shown
    {
      var ioc = field.closest(".input_outer_container");
      var error_class = "." + field.data("errormsg"); //the selector using the data-errormsg
      var $error_display = ioc.find(".subtext_box");
      var always_show = false; //for "forcing" errors to show in realtime

      if($(".subtext_box .error", ioc).length > 1) //if there's multiple error msgs in the subtext, hide them. logic will dictate which to unhide.
      {
        $(".subtext_box .error", ioc).hide(); //hide any error msgs already shown
      }

      if (field.is("[type=email]")) //cases for email fields
      {
        if (field.val() !== "" && !(email_regex).test(field.val())) {
          valid = false;
        } else if(field.val().length > valid_config.email_max) {
          valid = false;
          always_show = true;
          error_class = ".error_invalid_email_too_long";
        }
      }
      if (field.is("[type=text], [type=tel]")) //cases for text fields
      {
        if (/^\s+$/.test(field.val())) //regex match for only whitespace
        {
          valid = false;
        }
      }
      if((field.is("input[type=password]") && !field.is("[data-validation=empty_password_only]"))|| field.is("[data-validation=password]")) //for password validation
      {
        if(field.val().length < valid_config.pass_min)
        {
          valid = false;
        } else if (field.val().length > valid_config.pass_max) {
          valid = good_vibes_only = false;
          error_class = ".error_invalid_password_too_long";
        }
      }
      else if(field.is("input[type=password]") && field.is("[data-validation=empty_password_only]")) //for empty-only password validation
      {
        if (/^\s+$/.test(field.val())) //regex match for only whitespace
        {
          valid = false;
        } else if (field.val().length > valid_config.pass_max) {
          valid = good_vibes_only = false;
          error_class = ".error_invalid_password_too_long";
        }
      }
      if(field.is("[data-validation=only_katakana]")) //validate phonetic fields for katakana
      {
        if(field.val() !== "" && !config.patterns.katakana_check.test(field.val())) //regex match for allowed katakana
        {
          valid = false;
        }
      }
      if(field.is(".format_date")) //validate date using moment.js to swap formats
      {
        var val = moment(field.val(), config.date_format_display_usable);
        var val_year = val.year();
        var val_month = val.month() + 1; // moment.month() is zero indexed
        var val_day = val.date();
        var age = moment().diff(val, 'years', true);
        
        if (/[a-zA-Z]/.test(field.val()) || field.val() === "") //an invalid value will autoclear, but check for any of the M, D, Y that may still exist
        {
          empty_field = true;
        }
        else if (!moment(val).isValid() || (moment().year()-val_year>118)  || (val_year > moment().year()) || (val_month < 1 || val_month > 12) || (val_day < 1 || val_day > 31)) //118+ year olds are out of, can't be born in the future..., only twelve months in a year, max 31 days in a month
        {
          valid = false;
          always_show = true;
          error_class = ".error_invalid_date"; //date is invalid!
        }
        else if (!isNaN(age) && age < 2)
        {
          valid = false;
          always_show = true;
          error_class = ".error_check_date"; //check your bday toddler!
        }
      }
      if(field.is(".new_password") && $(".old_password", "#"+state.view).length===1) //for comparing old and new passwords and ensuring they don't match
      {
        var old_pass = $(".old_password", "#"+state.view).val();
        if(valid && field.val() === old_pass)
        {
          valid = false;
          always_show = true;
          error_class = ".error_matching_passwords"; //special error msg
        }
      }
      
      //use data-validation=name for special name formatting and length check
      if (field.is("[data-validation=name]") && (field.val().length > 50 || /[.?!]/.test(field.val()))) {
        valid = false;
      }

      //emoji check
      if(emoji_regex.test(field.val())){
        valid = false;
        error_class = ".error_invalid_character";
      }

      //try to find error msg in this field's subtext box, if it's specific to this field. If it's not there, see if it exists in this section.
      var $error_msg_specific = $(error_class, $error_display).length ? $(error_class, $error_display) : $(".error" + error_class, "#" + state.view);
      var $error_msg_all = $error_msg_specific.add($(".error", $error_display)); //need to hide any errors already showing beneath the box

      //GOOD VIBES ONLY. This is used during initialization so that blank fields that are required and prepopulated fields using url params do not show error messages until after clicking "submit".      
      if(good_vibes_only === "prepop" && !empty_field){ //a prepopulated field should APPEAR valid so text doesn't overlap prepopulation...it will be validated again on submit
        ioc.removeClass("invalid").addClass("valid");
        $error_msg_all.hide(); //validated successfully so clear errors
      } else {
        //change input box and do error msg
        if (valid && (field.val() === "" || empty_field)) //restore the default handling if this is a blank value. Remove the valid class. Hide errors.
        {
          ioc.removeClass("invalid").removeClass("valid");
          $error_msg_all.hide(); //validated successfully so clear error in subtext if exists
        } else if (valid) {
          ioc.removeClass("invalid").addClass("valid");
          $error_msg_all.hide(); //validated successfully so clear error in subtext if exists
        } else if(good_vibes_only===false || always_show) { //add invalid class and show error msg
          ioc.removeClass("valid").addClass("invalid").addClass("focus"); //for prepopulation validation
          $error_msg_all.hide();
          $error_msg_specific.show();
        } else if(good_vibes_only===true) {
          ioc.removeClass("invalid").removeClass("valid");
          $error_msg_all.hide(); //back in the invalid space, but don't show the error msg, just the helptext
        }
      }
    }

    return valid;
  };

  var check_required = function (field, good_vibes_only) {
    var valid = true; //by default, this is valid, but will get changed if an invalid conditional is hit
    var empty_field = false;

    if (field.attr("data-errormsg")) //tie to errormsg to be shown
    {
      var ioc = field.closest(".input_outer_container");
      var error_class = "." + field.data("errormsg"); //the selector using the data-errormsg

      //try to find error msg in this field's subtext box, if it's specific to this field. If it's not there, see if it exists in this section.
      var $error_display = ioc.find(".subtext_box");

      if (field.is("select")) //for a required dropdown, ensure is not first value, which is empty string
      {
        if (field.val() === "") //the default (first) value is blank
        {
          valid = false;
        }
      }
      if (field.is("input[type=text], input[type=tel], input[type=email], input[type=password]")) //same as dropdown, but ensure it's not just whitespace
      {
        if (/^\s+$/.test(field.val()) || field.val() === "") //regex match for only whitespace
        {
          valid = false;

          if(field.val() === ""){ empty_field = true; }
          
          if(field.is("[data-validation=name]")){ //name has error_invalid_name as its error msg for validation, so override below
            error_class = ".error_missing_required_field";
          }
        }
        if(field.is("[data-validation=password]")){ //a required password is still validated for being too long
           if(field.val().length > valid_config.pass_max) {
            valid = good_vibes_only = false;
            error_class = ".error_invalid_password_too_long";
           }
        }
      }

      //emoji check
      if(emoji_regex.test(field.val())){
        valid = false;
        error_class = ".error_invalid_character";
      }
      
      var $error_msg_specific = $(error_class, $error_display).length ? $(error_class, $error_display) : $(".error" + error_class, "#" + state.view);
      var $error_msg_all = $error_msg_specific.add($(".error", $error_display)); //need to hide any errors already showing beneath the box
      
      //REQUIRED is binary. Either empty or not. VALIDATE has additional rules and allows empty values.
      //change input box and do error msg
      if(valid && good_vibes_only===true) //a valid "good vibes only" should NOT add the valid class
      {
        ioc.removeClass("invalid");
        $error_msg_all.hide();
      } else if ((valid && good_vibes_only!==true) || (good_vibes_only==="prepop" && !empty_field)) { //a non-empty field (possibly just whitespace) that is prepopulated needs to appear valid so the label doesn't overlap the prepop.
        ioc.removeClass("invalid").addClass("valid");
        $error_msg_all.hide(); //validated successfully so clear error in subtext if exists
      } else if(good_vibes_only==="prepop" && empty_field) { //clear autofill and prepop back to blank so remove valid classes
        ioc.removeClass("invalid").removeClass("valid");
        $error_msg_all.hide();
      }
      else if(!valid && good_vibes_only!==true) {
        ioc.removeClass("valid").addClass("invalid");
        $error_msg_all.hide();
        $error_msg_specific.show();
      }
    }

    return valid;
  };

  var valiquired = function (field, good_vibes_only) {
    if(typeof good_vibes_only == "undefined"){ good_vibes_only = false; } //good_vibes_only will only show that something is VALID. It will not show error messages when something is INVALID.

    //IMPORTANT: in order for check_required() or check_valid() to run, a data-errormsg attribute MUST exist in the field element
    if (field.hasClass("required") && !field.hasClass("validate")) //only checking required
    {
      return check_required(field);
    }
    if (field.hasClass("required") && field.hasClass("validate")) //checking required first, then validating
    {
      return check_required(field, good_vibes_only) && check_valid(field, good_vibes_only);
    }
    if (field.hasClass("validate") && !field.hasClass("required")) //only validating
    {
      return check_valid(field, good_vibes_only);
    }
  };

  return {
    clear: function () { //clear errors everywhere and remove any invalid classes, successes, or login_required messages
      $(".invalid").removeClass("invalid");
      $(".error, .success, .message, .login_required").hide();
    },
    validate: valiquired, //make valiquired publicly accessible, to be used for real-time validation
    is_happy: function (section_selector, good_vibes_only) { //boolean return pass or fail if error exists anywhere
      if(typeof good_vibes_only == "undefined"){ good_vibes_only = false; } //good_vibes_only will only show that something is VALID. It will not show error messages when something is INVALID.

      //first, check creds
      if(unlocked_screens.indexOf(state.view) === -1 && !creds.check()) //run a cred destroy if invalid creds and on a locked screen
      {
        creds.destroy({fresh_url: false}); //same as calling for a logout but will keep existing params. Clear cookies, which also include analytics, and bounce to login.
      } else {
        //run a full validation/required check first...
        $(".required, .validate", $(section_selector)).each(function () {
          valiquired($(this), good_vibes_only); //run each required or validate input through the valiquired func
        });

        //log any errors to analytics based on error_ class
        analytics.log_all_errors();

        var error_free = !$(".error:visible", $(section_selector)).length;

        //scroll to first error
        if(!error_free)
        {
          var $scroll_element = $(".error:visible", $(section_selector)).first();
          var $parent_scroll =  $scroll_element.closest(".input_outer_container"); //get added minus-offset by getting full height of the form field
          if($parent_scroll.length) { $scroll_element = $parent_scroll; } //use the parent container as the scroll-to if it exists
          $("html,body").animate({scrollTop: $scroll_element.offset().top},700); //added 8px as buffer
        }

        //return results based on full check
        return error_free;
      }
    }
  };
})(config.screens.no_creds, config.validation);

//PREPOPULATE
//for putting existing data into form inputs that have a specific data-form attribute...so that users can finish completing their profile (and possibly update it in the future)
var populate = (function () {
  var parent_screens = [];
  var set_val = function($elem, dataset){
    var v = $elem.attr("data-userval")&&dataset.hasOwnProperty($elem.data("userval"))?dataset[$elem.data("userval")]:dataset;
    if($elem[0].tagName.toLowerCase() === "select") //for dropdown
    {
      if($("option[value='"+v+"']", $elem).length){ $elem.val(v); } //ensure value exists before selecting it
      else { $elem.val($("option", $elem).first().val()); } //if value does not exist, select the first one
      errors.validate($elem, "prepop"); //run a good_vibes_only validation
    }
    else if($elem.prop("type") && $elem.prop("type").toLowerCase() === "checkbox")
    {
      $elem.prop("checked", v); //checkbox, set checked property with true or false
      errors.validate($elem, "prepop"); //run a good_vibes_only prepop validation
    }
    else if($elem.hasClass("format_date")) //special case for masked dates
    {
      var converted_date = moment(v, config.date_format_stored).format(config.date_format_display_usable);
      if(converted_date == "Invalid date"){converted_date = "";}
      $elem.val(converted_date);
      errors.validate($elem, "prepop"); //run a good_vibes_only prepop validation so labels don't overlay values
    }
    else if($elem[0].tagName.toLowerCase() === "input") //all other inputs...most likely type="text"
    {
      $elem.val(v);
      errors.validate($elem, "prepop"); //run a good_vibes_only prepop validation so labels don't overlay values
    } else { //this is most likely a standard html element, so just replace text
      $elem.text(v);
    }

    if(parent_screens.indexOf("#"+$elem.closest(".screen").attr("id")) == -1){ parent_screens.push("#"+$elem.closest(".screen").attr("id")); } //add whatever screen this input is in to the list to run full error checks on. Put "#" id selector prefix on to join to single string later.
  };

  return {
    by_data_form: function(data_form_inputs, data){
            parent_screens = []; //keep a tab of what screens to run full error checks on
            $("[data-form="+data_form_inputs+"]").each(function(){
                if($(this).attr("data-fieldid") && data.hasOwnProperty($(this).data("fieldid"))) //match up the fieldid with key in data json
                {
                    set_val($(this), data[$(this).data("fieldid")]);
                }
            });
            //run error checks on the prepopulated form screens...this brings attention to what is missing...added in the set_val closure
            //if(parent_screens.length){ errors.is_happy(parent_screens.join(",")); }
        },
    by_selector: function($jelem, data){ //to be run on children of a parent element. Could be a section, a form, or entire page/app. Used in listener for replacing vals with user info.
      $jelem.each(function(){
        set_val($(this), data);
      });
    },
    map_params_to_inputs: function(params){ //for pre-selecting fields based on url params...to be run on "first load"
      var map = {"locale": "[data-fieldid='a_country']", "terms_privacy_country": "[data-fieldid='a_country']"}; //use locale first, but override later with terms_privacy_country if it exists

      $.each(map, function(k, v){
        if(params.hasOwnProperty(k))
        {
          var pop_val = params[k];
          if(k === "locale"){ pop_val = params[k].slice(-2).toUpperCase(); } //special case to split country from locale
          populate.by_selector($(v), pop_val);
        }
      });
    }
  };
})();

//CREDS
//manages user auth and profile info
var creds = (function (logout_screen, third_party_services) {
  var get_user_info = function(token){
    return JSON.parse(b64utos(token.split('.')[1]));
  };

  var get_user_token = function(){
    var token = config.client_config.AccessToken;

    // for fixing no validate request with empty string on Safari
    if (token === '') {
      token = '-';
    }

    return "Bearer " + token;
  };

  var get_account_type = function(data){
    var data = data || {};
    var account_type = state.account_type; //from user flow
    if(data.hasOwnProperty("account_type")){ //get from user data
      var account_types = data.account_type.split(","); //returned as a comma-delineated string
      var third_parties = account_types.filter(function(v) {return third_party_services.indexOf(v) > -1; }); //search if any third party services are included in account type
      var non_third_parties = account_types.filter(function(v) {return third_party_services.indexOf(v) == -1; }); //get non-third-party types

      //have to figure out if a standard flow or a third party flow was used. if state.account_type is not third party, and user has non-third-party account types, then we can't assume they're using a third-party, so don't switch it. however, if all they have is third parties, but the flow doesn't support that, they may have gone directly to the change email screen, so change the state.account_type.
      if(!non_third_parties.length || non_third_parties.indexOf(account_type) == -1) {
        if(third_parties.length){ //if user has third party account types
          account_type = third_parties.indexOf(account_type) !== -1 ? account_type : third_parties[0]; //use the current account type if it's a third party and included in their services, otherwise use the first array val
        } else { //flow doesn't match what the user has...go back to default
          account_type = config.defaults.account_type;
        }
      }
    }

    return account_type;
  };

  var get_user = function(){
    var attempts = 0;
    return $.ajax({
      url: env_config.endpoints.user_info,
      method: "GET",
      async: false,
      cache: false,
      headers: {
        "Authorization": get_user_token()
      },
      xhrFields: {
        withCredentials: true
      }
    }).done(function(data){
      //replace entire app with user info where needed
      $(document).trigger("user_info", [data]);
      state.user = data;
      state.account_type = get_account_type(data); //set global state account type according to what comes back from user data
    }).fail(function(error, code, response){
      //handled directly in creds check
    });
  };

  var is_idm_account = function() {
    var token = config.client_config.AccessToken;
    if (!token || token.split(".").length != 3) {
      return false;
    }

    var info = get_user_info(token);
    return info.act.split(",").indexOf("idm") != -1;
  };

  var get_user_email = function() {
    var token = config.client_config.AccessToken;
    if (!token || token.split(".").length !== 3) {
      return false;
    }

    var info = get_user_info(token);
    return info.sub;
  };

  var age_gate = function() {
    //max number of allowed invalid age-gate attempts before user is ineligible for registration
    var max_age_gate = 1;

    return {
      get: function(){
        if (Cookies.enabled) {
          return Cookies.get("age_gate") ? Cookies.get("age_gate") : 0;
        }
      },
      set: function(){
        if (Cookies.enabled) {
          var age_gate_counter = isNaN(Cookies.get("age_gate")) ? 0 : Number(Cookies.get("age_gate"));
          age_gate_counter++;
          Cookies.set("age_gate", age_gate_counter, {
            expires: new Date(new Date().setHours(720, 0, 0, 0))
          }); //cookie expires in 30 days. (24 hours x 30 = 720 hours)

          return true;
        } else {
          return false;
        }
      },
      check: function(){
        return this.get() < max_age_gate;
      },
      one_left: function(){
        return max_age_gate - this.get() === 1;
      },
      clear: function(){
        if (Cookies.enabled) {
          Cookies.expire("age_gate", {
            domain: env_config.cookie_domain
          });
        }
      }
    };
  };

  return {
    age_gate: age_gate, //TODO: BUILD OUT. used for age gate check
    get_user_token: get_user_token,
    get: function() {
      //REMEMBER ME AccessToken is returned from client_config.fetch() backend cookie
      if (config.client_config.AccessToken==="") { client_config.fetch(); } //a blank access token may just need another call to the client_config, which is synchronous
      return get_user();
    },
    check: function () {
      var token = config.client_config.AccessToken;
      if (!token || token === "") {
        //no token
        return false;
      } else if (!KJUR.jws.JWS.verifyJWT(token, env_config.jwt_public_key, {alg: ['RS256']})) {
        //token is set but it is not valid.
        config.client_config.AccessToken = ""; //unset bad AccessToken
        return false;
      } else {
        if (state.user === "") {
          var failed_call = false;
          get_user().fail(function(){
            failed_call = true;
          });

          if(!failed_call && state.user === "") //call was successful but did not return any user data
          {
            creds.destroy({view: state.view, fresh_url: false, revoke_only: true, refresh: false, error: "failed_getting_user"}); //problem fetching user data. logout and force user to login again...refresh false must remain because the error property is not added as a url param.
          }

          return !failed_call?creds.check():false; //call a creds.check() to run through token check once more, only if get_user successful

        } else {
          return true;
        }
      }

      config.client_config.AccessToken = ""; //unset client_config.AccessToken if hasn't returned true
      return false;
    },
     // note this function expects a logged in user stored in state.user it will
     // return true if this object does not exist.
    profile_complete: function () {
      if (state.user === undefined || config.required_fields === []) {
        return true;
      }

      var required = {"needed": [], "missing": []}; //just to have a running tally of required vs missing fields
      var user = state.user;
      var profile_complete = true;

      $(".required[data-userval]", "#"+config.screens.complete_profile).each(function(){
        var user_prop = $(this).data("userval");
        required.needed.push(user_prop);
        if(blockswap.is_visible($(this)) && user.hasOwnProperty(user_prop) && user[user_prop] === "")
        {
          required.missing.push(user_prop);
          profile_complete = false;
          return false;
        }
      });

      return profile_complete;
    },
    destroy: function(params){
      params = params || {view: logout_screen, fresh_url: true, refresh: true}; //use passed params or default logout_screen
      action_call.logout(params);
    }
  };
})(config.screens.default, config.third_party_services);

var blockswap = (function(blockswap_switches){
  var dynamic_url_classes = {"terms": "dynamic_link_terms", "pp": "dynamic_link_pp"};
  var state_switches = blockswap_switches;
  var current_swaps = {hide: [], show: []}; //keep a tab of current active swaps to quickly check if elements are shown or hidden
  var prefixes = {hide: "hide-", show: "show-"}; //elements with these prefixes will be checked for showing/hiding

  var dynamic_urls = function(href, link_type){
    if(dynamic_url_classes.hasOwnProperty(link_type))
    {
      $("."+dynamic_url_classes[link_type]).attr("href", decodeURIComponent(href)); //map link_type to dynamic_url_classes (above) and replace with passed href param
    }
  };

  var get_swaps = function(selector){
    $("[class*='"+prefixes.hide+"']").show(); //restore to default
    $("[class*='"+prefixes.show+"']").hide(); //restore to default
    for(var x = 0; x < state_switches.length; x++) //cycle through style-controlling state params, defined manually
    {
      var state_key = state_switches[x];
      if(state.hasOwnProperty(state_key) && state[state_key] !== "")
      {
        var hide_class = prefixes.hide+state_key+"-"+state[state_key];
        $("."+hide_class).hide(); //hide whatever should be hidden
        current_swaps.hide.push(hide_class); //add to list of swaps

        var show_class = prefixes.show+state_key+"-"+state[state_key];
        $("."+show_class).show(); //show anything that's called out for this state key and value
        current_swaps.show.push(show_class); //add to list of swaps
      }
    }
  };

  //return whether an element is visible based on if it has any parents that are current show/hide swaps
  var is_visible = function(elem){
    for(var x=0; x<current_swaps.hide.length; x++) //inside of a hide block
    {
      if(elem.parents(current_swaps.hide[x]).length > 0)
      {
        return false;
      }
    }

    if(elem.parents("[class*='"+prefixes.show+"']").length) //this is inside of at least one specific show block
    {
      var visible = false; //prove that I can see you
      $(elem.parents("[class*='"+prefixes.show+"']")).each(function(){ //since it's in one show block, just double check that it's inside all parent show blocks
        visible = false; //prove that I can see you
        var class_list = $(this).attr("class").split(' '); //the class_list includes all class="[classes]"
        $.each(class_list, function(k, v){
          if(v.indexOf(prefixes.show)===0) //check that this class starts with "show-"
          {
            if(current_swaps.show.indexOf(v) !== -1) //this parent show class is part of the active show classes
            {
              visible = true;
            }
          }
        });
        if(!visible) //we went through a show- parent without any matches...this is hidden. return false.
        {
          return false;
        }
      });
      return visible;
    }

    return true;
  };

  //add or remove webview class depending on param
  var add_remove_classes = function(){
    if(state.hasOwnProperty("webview") && state.webview === true && !$("body").is(".webview"))
    {
      $("body").addClass("webview");
    } else if ($("body").is(".webview")) {
      $("body").removeClass("webview");
    }
  };

  return {
    by_selector: function(selector){
      get_swaps(selector);
    },
    dynamic_urls: dynamic_urls,
    body_mod: add_remove_classes,
    is_visible: is_visible
  };
})(config.run_on_this.blockswap);

//immediately invoke with default_locale
var translate = (function (default_locale, fallback_map, translate_switches, xtm_default) {
  var state_subsets = translate_switches; //array of data subsets that are driven by params or state props. in order of precedence: last overwrites first.
  var class_prefix = "translate-"; //style class prefix when correlating json property to element
  var locale_box = $(".footer-locale-select");
  var translate_strings = {};
  var first_load = true;
  var translation_dir = "data/translations/";
  var translation_file_prefix = "/asicsid-strings";
  var get_lang = function(locale){
    return locale.substring(0,2);
  };

  var get_locale = function (u_locale) { //locale can be passed via param, pulled from url, or uses default
    if (first_load) //on the initial load, grab the locale from the url or use default
    {
      u_locale = url_param("locale") || default_locale;
      u_locale = set_select(u_locale); //while we're grabbing the locale during the first load, populate the select box, and make sure this is a valid locale
      locale_box.show(); //by default the box is hidden so unhide on first_load
      first_load = false;
    } else if (typeof u_locale != 'undefined') { //passed as parameter, used for going back/forward
      u_locale = set_select(u_locale);
    } else { //drive locale using locale select for every subsequent translation
      u_locale = locale_box.val();
    }

    document.querySelectorAll("html")[0].setAttribute("lang", get_lang(u_locale)); //set html lang attribute to locale's language
    return u_locale;
  };

  var get_country = function(){
    return state.locale.slice(-2).toUpperCase();
  };

  var set_select = function (locale) { //set locale selector to be consistent with url. should only need this on initial load.
    if (locale_box.val() != locale && $('option[value="' + locale + '"]', locale_box).length) { //if the locale specified in the url is different from the one selected and it exists in dropdown
      locale_box.val(locale);
      return locale;
    } else if (!$('option[value="' + locale + '"]', locale_box).length && locale != default_locale) { //invalid locale in URL that is not default (avoid infinite loop if something is wrong)
      var fallback_locale = get_fallback_locale(locale); // override the state because this is an invalid locale
      state.locale = fallback_locale.match === true ? locale : fallback_locale.locale; //IMPORTANT: allow state locale and dropdown to be different if EXACT MATCH found - not just a match on language code
      locale_box.val(fallback_locale.locale);
      return fallback_locale.locale; //return the fallback locale for mapping purposes
    }
    return locale;
  };

  var set_fallback_from_json = function() {
    $.ajax({
      url: 'data/fallbacks.json',
      cache: true, //true is default, but calling this out intentionally since it was changed to true after going to akamai
      dataType: 'json',
      method: "GET",
      async: false
    }).done(function (data) {
      fallback_map = data;
    }).fail(function (error) {
      console.log("Retrieving fallbacks failed with error: "+error.responseText);
    });
  };

  var only_values = function(data){ //recursive function to separate value from comment
    if(data.hasOwnProperty("value") && data.hasOwnProperty("comment"))
    {
      return data.value; //separate value from comment
    } else if (data instanceof Object) { //contains nested objects
      for (var k in data){
        if (data.hasOwnProperty(k)){
          data[k] = only_values(data[k]); //go through sub-object
        }
      }
    }

    return data; //deliver final product
  };

  var get_fallback_locale = function (locale) {
    var lang = get_lang(locale); //pull 2-letter language from locale

    if (Object.keys(fallback_map).length === 0) {
      set_fallback_from_json(); //ajax fetch (sync) for fallbacks
    }

    //return match property to dictate whether to allow state.locale and locale dropdown to be separate
    if(lang != locale && fallback_map[locale]){
      return {locale: fallback_map[locale], match: true}; //look for exact fallback match of full 4 letter locale first
    } else if($('option[value="' + fallback_map[lang] + '"]', locale_box).length) {
      return {locale: $('option[value="' + fallback_map[lang] + '"]', locale_box).val(), match: false}; //return two letter match
    } else {
      return {locale: default_locale, match: false};
    }
  };

  //used for alphabetizing object by value and returning sorted object
  var alpha_sort_by_value = function(data){
    var keys_sorted = Object.keys(data).sort(function (a, b) {
      return data[a].localeCompare(data[b]);
    });
    var sorted = {};
    keys_sorted.forEach(function (v) {
        sorted[v] = data[v];
    });
    return sorted;
  };

  var get_strings = function (options) { //return json object of strings for this locale
    var locale = get_locale(options.locale);
    var override = (options.hasOwnProperty("override") && options.override === true) ? true : false;
    var file_prefix = override ? "/asicsid-strings-overrides" : translation_file_prefix; //for fetching override file

    //do a quick check to make sure we have default - backup - strings, and grab those first if not part of this call
    if(locale != xtm_default && !translate_strings.hasOwnProperty(xtm_default))
    {
      get_strings({locale: xtm_default, rerun: function(){
          get_strings({locale: xtm_default, override: true, rerun: function(){
              get_strings(options);
            }
          });
        }
      }); //call recursively (twice) to re-run with initial locale, then override, then with original rerun callback
    } else {
      if (!translate_strings.hasOwnProperty(locale) || override)
      {
        //translations have not been fetched yet for this locale, or we are overriding this locale's translations
        var strings_file = getVersionedFilename(translation_dir + locale + file_prefix + (locale == xtm_default?"":"_"+locale) + ".json"); //the xtm_default locale does NOT have the locale in the filename

        //fetch translation on demand and add to translate_strings object
        $.ajax({
          url: strings_file,
          cache: true, //true is default, but calling this out intentionally since it was changed to true after going to akamai
          method: "GET",
          dataType: "json"
        }).done(function (data) {
            if (override && data.hasOwnProperty(locale.toLowerCase())) { //use toLowerCase because the locale is xx-XX but the json key is xx-xx
              // this is an override call. We want to replace specific locale data.
              $.extend(true, translate_strings[locale], only_values(data[locale.toLowerCase()]));
            } else if(data.hasOwnProperty(locale.toLowerCase())) { //use toLowerCase because the locale is xx-XX but the json key is xx-xx
              // add locale data to module-scoped translate_strings
              translate_strings[locale] = only_values(data[locale.toLowerCase()]);
            } else {
              console.log("incorrect translation format " + locale + (override ? " override" : ""));
            }

            if(options.hasOwnProperty("callback") && translate_strings.hasOwnProperty(locale)) //run callback even if override failed
            {
              options.callback(translate_strings[locale]); //run callback in by_selector() with translate_strings[locale] as data to replace translations
            }
        }).fail(function () {
          if(override && translate_strings.hasOwnProperty(locale) && options.hasOwnProperty("callback")) //problem with override data, still do translation without overrides
          {
            console.log("displaying translated " + locale + " without overrides");
            options.callback(translate_strings[locale]); //failed loading current strings but translate with defaults
          } else if(locale != xtm_default && translate_strings.hasOwnProperty(xtm_default) && options.hasOwnProperty("callback"))
          {
            console.log("failed to load " + locale + ", displaying default " + xtm_default + " strings instead");
            options.callback(translate_strings[xtm_default]); //failed loading current strings but translate with defaults
          }
        }).always(function(){
          if(options.hasOwnProperty("rerun")) //after fetching defaults, rerun with intended locale
          {
            options.rerun();
          }
        });
        } else {
          if(options.hasOwnProperty("callback"))
          {
            options.callback(translate_strings[locale]);  //run callback in by_selector() with translate_strings[locale] as data to replace translations
          }
        }
    }
  };

  var mask_birthdate = function ($parent, old_date_format, data) {
    if(data.hasOwnProperty("format_date") && data.format_date.toUpperCase() == config.date_format_display){ //the config.date_format_display is set when translations are fetched
      $(".format_date", $parent).each(function(){
        var $elem = $(this);
        var corrected_date = moment($elem.val(), old_date_format).format(config.date_format_display_usable); //before masking, convert date to new format. Must be done since some formats are DD-MM-YYYY vs MM-DD-YYYY
        $elem.val(corrected_date);
        
        $(this).inputmask({
          alias: config.date_format_display_usable.toLowerCase(),
          inputFormat: config.date_format_display_usable.toLowerCase(),
          placeholder: config.date_format_display,
          clearIncomplete: true,
          showMaskOnHover: false
        });
      });
    }
  };

  var replace_dropdowns = function ($parent, data) {
    $("select[class*='" + class_prefix + "']", $parent).each(function () { //get select boxes that have a class that includes class_prefix for translating
      var class_no_prefix = (($(this).attr("class")).match(new RegExp(class_prefix + '(\\S+)'))[0]).replace(class_prefix, ''); //regex for separating prefix from classname
      var $dropdown = $(this);
      if (data.hasOwnProperty(class_no_prefix) &&
        (
          (dropdown_not_init = $("option", $dropdown).length <= 1) ||
          (Object.keys(data[class_no_prefix]).length == $("option", $dropdown).length || Object.keys(data[class_no_prefix]).length == ($("option", $dropdown).length - 1)))) //if: there's translations for this dropdown, and the dropdown is either empty or has a single option (has not been initialized) or the number of options match up with the data
      {
        if($dropdown.hasClass("alphabetize")) //should be alphabetized by value (option text)
        {
          data[class_no_prefix] = alpha_sort_by_value(data[class_no_prefix]);
        }

        $.each(data[class_no_prefix], function (k, v) { //iterate through dropdown list
          if (dropdown_not_init) //if this is the first time creating dropdown, create all, otherwise just replace text (so user does not have to re-select)
          {
            $dropdown.append($("<option>", {
              value: k,
              text: v
            })); //apply key-value pairs to option value and text
          } else {
            $("option[value='" + k + "']").text(v);
          }
        });
      }
    });

    if(typeof callback !== 'undefined'){
      callback();
    }
  };

  return {
    get_fallback_locale: get_fallback_locale,
    by_selector: function (options) { //jquery find and replace
      var callback = function (data) {
        if(translate_strings.hasOwnProperty(xtm_default)) //check for default (backup) strings
        {
          data = $.extend(true, {}, translate_strings[xtm_default], data); //merge data into backup data recursively (deep copy) for backup strings
        }
        if (data) {
          config.translate_done = false; //some work needs to be done
          var old_date_format;
          if(data.hasOwnProperty("format_date")){  //update config prop. To be used when unmasking and sending data to backend.
            old_date_format = config.date_format_display;
            config.date_format_display = data.format_date.toUpperCase();
            config.date_format_display_usable = config.date_format_display.replace(/([a-zA-Z])\1{3,}/g, "YYYY").toUpperCase(); //replace AAAA for some locales with YYYY
          }
          $(options.selector).each(function () {
            var k = $(this).attr("id");
            if (k && data.hasOwnProperty(k)) //there's translations for this block in the locale strings
            {
              var after_subsets = $.extend(true, {}, data); //IMPORTANT: javascript object pointers are tricky. Need to make a DEEP COPY otherwise changes to this object will affect the original object
              //this block overwrites existing data with the subset if it exists, based on state params
              for(var x = 0; x < state_subsets.length; x++)
              {
                var subkey = state_subsets[x];
                if(state.hasOwnProperty(subkey) && state[subkey] !== "" && after_subsets[k].hasOwnProperty(state[subkey])) //there's a subset for this block based off a state param
                {
                  $.extend(after_subsets[k], after_subsets[k][state[subkey]]); //move the subset up a level and overwrite
                }
              }

              for (var kk in after_subsets[k]) {
                var newval = after_subsets[k][kk] || translate_strings[xtm_default][k][kk]; //check if backup string is not blank and use that instead

                $element = $("." + class_prefix + kk, $(this));

                if ($element.length) {
                  if ($element.is("input[type=submit], input[type=button], input[type=hidden]")) //submit and hidden inputs need value changed, not html
                  {
                    $element.val(newval);
                  } else if($element.is("img")) //this is an image so just replace the alt property
                  {
                    $element.prop("alt", newval);
                  } else {
                    $element.html(newval);
                  } //replace any child class elements with corresponding locale strings
                }
              }
            }
          });

          //special cases below
          mask_birthdate($(options.selector), old_date_format, data); //mask with date format
          replace_dropdowns($(options.selector), data); //run translations for any dropdowns

          config.translate_done = true; //let the world know translations are done...since this call is ajax then anything checking for this value should be adding functionality to config.deferred_calls.after_translation
          $(document).trigger("translate_done"); //any listeners triggered after translating will run
          if(options.runwhendone){  options.runwhendone(); } //run this when done for prepopulating
          } else {
          console.log("translation unavailable");
        }
      };

      if (options.locale) {
        get_strings({
          locale: options.locale,
          callback: callback,
          rerun: function(){
            get_strings({
              locale: options.locale,
              override: true,
              callback: callback
            });
          }
        });
      } else {
        get_strings({
          callback: callback
        });
      }
    },
    locale: get_locale,
    country: get_country
  };
})(config.defaults.locale, config.fallback_map, config.run_on_this.translate, config.xtm_default);

var analytics = (function () {
  var endpoint = env_config.events_logger;
  var analytics_cookie = "oneasics_analytics";
  var source = "ASICS-ID";

  var get_country = function(){
    return state.locale.slice(-2).toUpperCase();
  };

  var get_timestamp = function () {
    return Date.now();
  };

  var get_user = function () {
    return state.user;
  };

  var log_tealium = function(){
    if(state.no_analytics === true){
      return;
    }
    
    try{
      var brand_mapping_prefixes = {"runkeeper": "ID.RK", "haglofs": "ID.HAGLOFS", "asics_perf": "ID.ASICS", "asics_tiger": "ID.AT", "onitsuka_tiger": "ID.OT"};
      // filtering out for brand prefixes without country
      var brand_matches = Object.keys(brand_mapping_prefixes).filter(function(v){ return state.style.indexOf(v) === 0; });
      // returning brand key if found, otherwise default to ID.ASICS
      var brand = brand_matches.length ? brand_mapping_prefixes[brand_matches[0]] : "ID.ASICS";

      var region_map = {"AR": "AAG", "AT": "AEG", "AU": "AOP", "BE": "AEG", "BG": "AEG", "BR": "AAG", "CA": "AAG", "CH": "AEG", "CN": "ACN", "CZ": "AEG", "DE": "AEG", "DK": "AEG", "ES": "AEG", "EW": "AEG", "FI": "AEG", "FR": "AEG", "GB": "AEG", "GR": "AEG", "HK": "ACN", "HU": "AEG", "ID": "AAP", "IE": "AEG", "IN": "AAP", "IT": "AEG", "JP": "AJG", "KR": "AKR", "LT": "AEG", "LV": "AEG", "MX": "AAG", "MY": "AAP", "NL": "AEG", "NO": "AEG", "NZ": "AOP", "PH": "AAP", "PL": "AEG", "PT": "AEG", "RO": "AEG", "RS": "AEG", "RU": "AEG", "SE": "AEG", "SG": "AAP", "SI": "AEG", "SK": "AEG", "TH": "AAP", "TR": "AEG", "TW": "ACN", "US": "AAG", "ZA": "AEG"}; //tealium country -> region mapping
      var region = region_map[get_country()]?region_map[get_country()]:"n/a"; //use value "n/a" if country doesn't map
      var ga_virtual_pathname = get_country().toLowerCase() + "/" + state.locale.toLowerCase() + "/oneasics/" + state.view; //ex: "us/en-us/oneasics/register"

      $.extend(utag_data, {
        "forceSSL": "true", // fixed value
        "hit_source": "tealium",  // fixed value
        "page_category": [], // fixed value
        "page_type": "login", // dynamic value
        "country": get_country(), // dynamic value
        "region": region, // dynamic value
        "brand": brand, // dynamic value
        "user_ip_address": "n/a",
        "is_ecommerce": "yes",  // fixed value
        "site_environment": env_config.tealium_env,
        "ga_virtual_pathname": ga_virtual_pathname,
        "app_client_id": state.client_id  // dynamic value
      }); //merge
      utag.view(utag_data); //junky implementation...yeah. this loads async, from a third party, so we just make the call and pray it works.
    } catch(e) {}
  };

  var log_tealium_error = function(params){
    if(state.no_analytics === true){
      return;
    }
    
    var utag_link = $.extend({}, {
      "gaEventCategory": "Form Error Tracking",
      "gaEventAction": "oneasics " + state.view,
      "gaEventNonInteraction": false
    }, params); //merge in label value from params

    try{
      utag.link(utag_link); //junky implementation...yeah. this loads async, from a third party, so we just make the call and pray it works.
    } catch(e) {}
  };


  var save_to_cookie = function (analytics_obj) { //used for analytics tracking
    if (Cookies.enabled) {
      Cookies.set(analytics_cookie, JSON.stringify(analytics_obj), {
        expires: new Date(new Date().setHours(720, 0, 0, 0))
      }); //cookie expires in 30 days. (24 hours x 30 = 720 hours)
      return true;
    } else {
      alert("Cookies need to be enabled for this web application.");
      return false;
    }
  };

  var fetch_analytics_cookie = function() {
    var cookie_data = {};
    if (Cookies.enabled && Cookies.get(analytics_cookie)) {
      cookie_data = JSON.parse(Cookies.get(analytics_cookie));
    }
    return cookie_data;
  };

  var log_asics = function(params){
    if(state.no_analytics === true){
      return;
    }
    
    var cookie_data = fetch_analytics_cookie();
    if (!params.prev_view && cookie_data.hasOwnProperty("prev_view")) {
      // there is a stored cookie with all analytics props but we are only reusing prev_view property
      params.prev_view = cookie_data.prev_view;
    }

    var asics_id = state.hasOwnProperty("user") ? state.user.id : "";

    var asics_data = $.extend({}, {
      "event-name": "",
      "page": state.view,
      "locale": state.locale,
      "session-id": (state.client_id).replace(/[\W_]/g, "").toLowerCase()+state.session_id, //combine the two for unique session-id. This is NOT saved in cookie, and will be recreated on every refresh.
      "timestamp": get_timestamp(),
      "user-agent": navigator.userAgent,
      "client-id": state.client_id,
      "user": get_user(),
      "asics-id": asics_id,
      "source-id": source,
      "signup-source": state.account_type,
      "prev_view": state.prev_view,
      "style": state.style
    }, params); //overwrite analytics props with params passed via .logger()

    save_to_cookie(asics_data);

    // Make the API call
    $.ajax({
      method: 'POST',
      //dataType: 'json', //until we know what's actually coming back
      url: endpoint,
      data: JSON.stringify(asics_data),
      contentType: "application/json",
      crossDomain: true
    }).done(function (data) {
      //console.log(data);
    }).fail(function (jqXHR, textStatus) {
      //console.log(jsonData);
      //console.log("analytics log failed with " + textStatus);
    });
  };

  return {
    log_all_errors: function() { //searches this view for any .error elements that are visible and logs them
      var analytics_error_prefix = "error_";
      var logger = this.logger; //for using public logger
      $.each($(".error:visible", $("#"+state.view)), function(){
        var error = (($(this).attr("class")).match(new RegExp(analytics_error_prefix + '(\\S+)'))[0]).replace(analytics_error_prefix, ''); //regex for separating prefix from classname
        logger({"event-name": "oneasics-" + state.view + "-error-view", "error": error}); //log to snowflake
        log_tealium_error({"gaEventLabel": error + " | error message: " + $(this).text()}); //log to tealium
      });
    },
    logger: function (params) {
      try{ //analytics should not cripple this application
        log_asics(params);
      } catch(e) {}
    },
    log_tealium: log_tealium, //make tealium separate for now...ideally we drop it.
    log_tealium_error: log_tealium_error //for some reason this requires utag.link instead of utag.view
  };
})();

//CLIENT CONFIG
//fetch client config object from IDM
var client_config = (function(config){
  var form_config = function(data){
    var config_required_input_map = {"FirstNameRequired": ["a_firstname", "a_firstname_jajp", "a_phonetic_firstname"], "LastNameRequired": ["a_lastname", "a_lastname_jajp", "a_phonetic_lastname"], "CountryRequired": "a_country", "BirthdayRequired": "a_birth", "GenderRequired": "a_gender"};
    var config_visible_input_map = {"FirstNameVisible": ["a_firstname", "a_firstname_jajp", "a_phonetic_firstname"], "LastNameVisible": ["a_lastname", "a_lastname_jajp", "a_phonetic_lastname"], "CountryVisible": "a_country", "BirthdayVisible": "a_birth", "GenderVisible": "a_gender"};

    var apply_required = function(form_input_required, inputs){
      if(form_input_required === true) //required case
      {
        inputs.addClass("required");
        inputs.parents(".input_container").addClass("required_field"); //this will cause required_mark to show
      } else {
        inputs.removeClass("required");
        inputs.parents(".input_container").removeClass("required_field"); //will hide required_mark
      }
    };

    var apply_excluded = function(form_input_excluded, inputs) {
      if(form_input_excluded === true)
      {
        inputs.addClass("excluded");
        inputs.parents(".input_outer_container").addClass("excluded");
      } else {
        inputs.removeClass("excluded");
        inputs.parents(".input_outer_container").removeClass("excluded");
      }
    };

    $.each(config_required_input_map, function(k, v){
      //loop through depending on how structure is, ex: {"form_name": {"required": ["a_firstname", "a_country", "a_gender"]}}
      if(data.hasOwnProperty(k))
      {
        var form_input_required = data[k];
        var inputs;

        if($.isArray(v))
        {
          for(var x=0; x<v.length; x++) //loop through array of fields
          {
            inputs = $("[data-fieldid='" + v[x] + "']"); //the input that should or should not be required based on client config
            apply_required(form_input_required, inputs);
          }
        } else {
            inputs = $("[data-fieldid='" + v + "']"); //the input that should or should not be required based on client config
            apply_required(form_input_required, inputs);
        }
      }
    });

    $.each(config_visible_input_map, function(k, v){
      //loop through depending on how structure is, ex: {"form_name": {"required": ["a_firstname", "a_country", "a_gender"]}}
      if(data.hasOwnProperty(k))
      {
        //data[k] is true if visible, false if not.
        var form_input_excluded = (data[k] === false);
        var inputs;

        if($.isArray(v))
        {
          for(var x=0; x<v.length; x++) //loop through array of fields
          {
            inputs = $("[data-fieldid='" + v[x] + "']"); //the input that should or should not be required based on client config
            apply_excluded(form_input_excluded, inputs);
          }
        } else {
            inputs = $("[data-fieldid='" + v + "']"); //the input that should or should not be required based on client config
            apply_excluded(form_input_excluded, inputs);
        }
      }
    });    
  };

  var get_client_info = function(override_params){
    var params = $.extend({client_id: url_param("client_id")}, override_params); //use url_param as fallback
    
    config.client_config = {"ClientID":"idm","UseLander":true,"RedirectUri":"https://id.asics.com/app","FirstNameRequired":false,"LastNameRequired":false,"CountryRequired":false,"BirthRequired":true,"GenderRequired":false,"GoogleOauthID":"746690278429-i3o1cdfanq31q4rl00epu1hot4p1di3i.apps.googleusercontent.com","FacebookOauthID":"745812855551846","PrivacyPolicyURL":"","TermsOfUseURL":"","URLs":{"Register":"","RegisterConfirmed":"","Login":"","Logout":"","ChangeEmail":"","ChangeEmailConfirmed":"","Delete":"","ForgetPw":"","ResetPw":"","ChangePw":""},"AccessToken":"","TealiumEnvironment":"prod","AgeGate":false};
    config.defaults.view = config.screens.default = config.screens.register;
    return;

    
    action_call.json_fetch_auth({
      url: env_config.endpoints.client_config,
      cache: false,
      data: $.param(params),
      contentType: "application/json",
      method: "GET",
      async: false,
      beforeSend: function(){
        $(".error.error_initialize").hide();
      }
    }).done(function (data) {
      config.client_config = data;
      config.defaults.view = config.screens.default = !config.client_config.UseLander?config.screens.no_lander:config.screens.use_lander; //set default screen based on client_config use_lander
      state.use_lander = config.client_config.UseLander; //add to state
      if(!state.use_lander){
        config.screens.redirects.lander = config.screens.redirects["register-lander"] = config.screens.no_lander;
      } //if client is set up to not use lander, then redirect lander to the no_lander screen
      if(data.hasOwnProperty("AccessToken") && !!data.AccessToken){ state.token = data.AccessToken; } //special case to make token available in state for REMEMBER ME
      form_config(data);
      
      //client-specific hacks. IMPORTANT: below sets DEFAULTS. will be overwritten by url params if included.
      //suppress sendgrid email for aeg_outlet_instore_reg client_id
      if(params.client_id === "aeg_outlet_instore_reg"){
        state.send_confirm_email = false;
        state.no_confirm_email = true;
        if(config.defaults.locale == "en-US"){ //if locale is detected as en-US, override to en-GB
          config.defaults.locale = "en-GB";
        }
      }
    }).fail(function (error, xhr, code) {
      analytics.log_all_errors();
      var response = error.responseJSON || {"error":true}; //set to empty error object if endpoint returns something wacky

      //if invalid client_id, then override to default client_id and call recursively
      if(response.hasOwnProperty("error") && response.error === "invalid_client_id"){
        config.init_overrides.client_id = config.defaults.client_id; //bring over defaults to init_overrides
        client_config.fetch(config.init_overrides); //rerun with corrected params
      } else {
        $(".error.error_initialize").show();
      }
    }).always(function () {
    });
  };

  return {
    init: function(){
      get_client_info(); //hit client config api
    },
    fetch: get_client_info
  };
})(config);

//happy easter
var easter = function (egg) {
  var keylogger = "";
  var asics_runners;

  var actions = { //tie key sequence to action
    runner1a6: function () {
      var count = 0;
      if($(".asics_runner_box").first().is(".run")){ //put a stop to this and remove all cloned things
        clearInterval(asics_runners);
        $(".asics_runner, .asics_runner_box").toggleClass("run");
        $(".asics_star").toggleClass("fall");
        $(".cloned").remove();
      } else {
        $(".asics_runner, .asics_runner_box").toggleClass("run");
        $(".asics_star").toggleClass("fall");
        asics_runners = setInterval(function(){
          $(".asics_runner_box").append($(".asics_runner").eq(0).clone().css({"bottom": Math.floor(Math.random() * 90)+"%", "left": Math.floor(Math.random() * 90)+"%"}).addClass("cloned"));
          $(".asics_runner_box").append($(".asics_runner").eq(1).clone().css({"bottom": Math.floor(Math.random() * 90)+"%", "left": Math.floor(Math.random() * 90)+"%"}).addClass("cloned"));
          $(".asics_runner_box").append($(".asics_runner").eq(2).clone().css({"bottom": Math.floor(Math.random() * 90)+"%", "left": Math.floor(Math.random() * 90)+"%"}).addClass("cloned"));
          if(count%3 === 0)
          {
            $(".asics_star").eq(0).after($(".asics_star").eq(0).clone().css({"font-size": Math.floor(Math.random() * 25)+"px", "top": "-"+Math.floor(Math.random() * 50)+"px", "left": Math.floor(Math.random() * 90)+"%"}).addClass("cloned"));
          }
          count++;
        }, 750);
      }
    },
    logout: function () {
      creds.destroy({view: config.screens.default, revoke_only: true});
    }
  };

  $(document).on("keypress", function (e) {
    keylogger = (keylogger + String.fromCharCode(e.keyCode || e.which)).substr( - (egg.length));
    if (keylogger == egg) {
      keylogger = "";
      actions[egg].call(); //perform action tied to this sequence
    }
  });
};

var eggs = {
  "runner1a6": easter("runner1a6"),
  "!!logout": easter("logout")
};
