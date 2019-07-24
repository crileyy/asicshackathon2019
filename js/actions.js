var action_call = (function(endpoints){
  var clear_autofill = function(){
    var cleared_autofill = {};
    for(var x = 0; x<config.autofill_params.length; x++){ //map autofill keys with blank values to pass into newview state and clear autofill params in url. called after login.
      cleared_autofill[config.autofill_params[x]] = "";
    }

    return cleared_autofill;
  };

  // to be used in ajax calls below to log analytics using the data event name from the form-submit button if it exists, otherwise, the state view name is used instead
  var log_analytics = function($button, response_message) {
    var event_title = $button!==false && $button.attr("data-eventname") ? $button.data("eventname") : "oneasics-" + state.view;
    analytics.logger({ "event-name": event_title + response_message });
  };

  var fail_handler = function(result, $response_errors){
    var response = !!result.responseJSON ? result.responseJSON : (typeof result === "string" ? {"error": result} : {"error":true}); //use response object or string val if passed
    var status_code = result.hasOwnProperty("status") ? result.status : 0; //http status code

    if(response.hasOwnProperty("error") || response.hasOwnProperty("Code"))
    {
      var response_code = response.error || response.Code;

      if((status_code == 401 || response_code == "unauthorized") && (response_code != "invalid_email_or_password")) //rhode island error. user no longer authenticated. token may be mismatched, expired, or user may have logged out in a different session. be careful though - some 401's are for screens like change password.
      {
        creds.destroy({view: config.screens.login, revoke_only: true, bounce: state.view}); //kill token and session but bounce user back to current screen after login
      } else {
        var $show_error = $response_errors.filter(".error_"+response_code);

        if(!!$show_error.length) //if there's a specific error for this response, show it
        {
          $show_error.show();
        } else { //not an error for this response, so show error_server as default
          $response_errors.filter(".error_server").show();
        }

        //scroll to top of server error
        var $scroll_element = $response_errors.filter(":visible").first();
        if($scroll_element.length)
        {
          $("html,body").animate({scrollTop: $scroll_element.offset().top - 8},700); //added 8px as buffer
        }
      }
    }
  };

  var success_handler = function($response_success){
    $response_success.show();
    //scroll to top of success message
    $("html,body").animate({scrollTop: $response_success.first().offset().top - 8},700); //added 8px as buffer
  };

  var json_fetch_auth = function(params){
    var args = $.extend({}, {
      method: "POST",
      dataType: "json",
      contentType: "application/json",
      timeout: 20000, //20 second timeout. 15000 is generally recommended but give an extra 5000 for super slow connections.
      xhrFields: { //we'll also be adding an auth header in json_fetch_auth calls for cross-browser compatibility
        withCredentials: true
      }
    }, params);

    return $.ajax(args); //return ajax call and handle elsewhere
  };

  /*
   * Function to handle redirect for the login & complete-profile views.
   * This function exists separately to prevent code duplication as both
   * update_profile_call & login_call need to call it.
   * NOTE: no need to wrap actions in creds.get() since handle_login_bounce() is being called INSIDE of creds.get().always
   */
  var handle_login_bounce = function() {
    // handle oauth2 redirect if applicable for this request
    if (!oauth2_call()) {
      // check if this request just a pitstop on the way to the users request
      if (state.bounce) {
        //bounce to the intended url after login
        newview.set($.extend({view: state.bounce}, clear_autofill()));
      } else { // go on to another site
        if (get_idm_redirect("Login", config.post_auth_redirect_timeout)) {
          // get_user and proceed to other screens in webapp
          newview.set($.extend({view: config.screens.logged_in}, clear_autofill()));
        } else {
          // sticking around, so fetch user data to display during session
          // and proceed to other screens in webapp
          newview.set($.extend({view: config.screens.logged_in}, clear_autofill()));
        }
      }
    }
  };

  var oauth2_call = function(){ //to be used for oauth2 pass-through
    if((state.grant_type === "code" || state.grant_type === "token"))
    {
      var extra_params = (!!state.state?"&state="+state.state:"")+(!!state.scope?"&scope="+state.scope:"")+(!!state.code_challenge?"&code_challenge="+state.code_challenge:"")+(!!state.code_challenge_method?"&code_challenge_method="+state.code_challenge_method:""); //carry these

      var redirect_uri = "";
      if(!!state.redirect_uri) //if redirect_uri specified as url param
      {
        redirect_uri = state.redirect_uri;
      } else if(!!config.client_config.URLs.RedirectURI && config.client_config.URLs.RedirectURI.indexOf(",")===-1) { //check if there's a unique redirect_uri specified in admin config
        redirect_uri = config.client_config.URIs.RedirectURI;
      }
      
      log_analytics(false, "-finish"); //analytics log in oauth2_call will have format "oneasics-[page name, i.e. 'register']-finish"

      var temp = document.createElement("form");
      temp.action = env_config.api_host + '/oauth2/authorize?response_type=' + state.grant_type + '&client_id=' + state.client_id + (!!state.redirect_uri?'&redirect_uri=' + redirect_uri:"") + extra_params;
      temp.method = "post";
      temp.style.display = "none";
      document.body.appendChild(temp);
      temp.submit(); //let the form submittal handle the redirect
      return true;
    } else {
      return false;
    }
  };

  var get_idm_redirect = function(url_key, delay){
    //return false; //TODO: SOFT-LAUNCH remove

    delay = !!delay||delay===0?delay:0; //delay before redirection, if specified

    if(config.client_config.URLs[url_key]) //use the oauth2 logic if necessary
    {
      var redirect_url = config.client_config.URLs[url_key];
      if (config.client_config.requireHttpsRedirect && !(/^https/).test(redirect_url)){ return; } //this client_id requires https and the redirect doesn't have it. quit.

      var carry_params = ["locale", "state"];
      var qs = {};

      $.each(carry_params, function(k, v){ if(state.hasOwnProperty(v)){ qs[v] = state[v]; } }); //create a copy of state object with params that should be carried over to new url
      redirect_url += (redirect_url.indexOf("?") !== -1) ? "&" + $.param(qs) : "?" + $.param(qs); //append "&" or "?" to url and add query params

      setTimeout(function(){ window.location = redirect_url; }, delay); //javascript redirect after 2 seconds
      return true;
    }

    return false;
  };

  var newview_clear = function(params){ //template for clearing the view after a logout revoke, or standalone to clear token and go to a fresh session without a revoke
    params = params || {};
    var newview_params = {
      bounce: "", //clear the bounce param, but keep a few others such as style, locale, client_id
      locale: state.locale,
      style: state.style,
      client_id: state.client_id,
      fresh_url: true,
      refresh: true, //by default, refresh so user gets clean session...unless specified not to in logout_params
    };

    newview.clear($.extend(newview_params, params)); //merge logout_params into newview_params and call clear()
  };

  //param structure: {button: [jquery element for submit button], payload: [parameterized form payload using $.param], response_errors: [jquery element for non-ui errors that come from ajax call]}
  var register_call = function($button, payload, $response_errors){
    json_fetch_auth({
      headers: {
        "client_id": state.client_id
      },
      withCredentials: false,
      url: endpoints.register,
      data: payload,
      beforeSend: function(){
        $button.addClass("in_progress");
      }
    }).done(function (data) { //handle successful api response
      if (!oauth2_call()) { // handle oauth2 redirect if applicable for this request
        if (state.bounce) //this is a pit stop on the way to what the user actually wanted to do, so bounce to the intended url upon registering
        {
          creds.get().always(function () { //get_user and proceed to other screens in webapp
            log_analytics($button, "-finish");
            newview.set($.extend({view: state.bounce}, clear_autofill())); //set new view and make sure to clear autofill url params
          });
        } else {
          if (get_idm_redirect("Register", 100)) { //go on to another site, with a tiny delay in order to send the analytics call when viewing the registration successful screen
            creds.get().always(function () { //need creds to see registration successful screen
              log_analytics($button, "-finish");
              newview.set($.extend({view: config.screens.registration_successful}, clear_autofill())); //set new view and make sure to clear autofill url params
            });
          } else { //sticking around, so fetch user data to display during session
            creds.get().always(function () { //get_user and proceed to other screens in webapp
                log_analytics($button, "-finish");
                newview.set($.extend({view: config.screens.registration_successful}, clear_autofill())); //set new view and make sure to clear autofill url params
            });
          }
        }
      }

      creds.age_gate().clear(); //clear the age gate counter on a successful registration
    }).fail(function (result) { //handle fail response
      if (!!result && !!result.responseJSON && result.responseJSON.error == "ineligible_to_register") {
        creds.age_gate().set(); //log an attempt
        $button.prop("disabled", true); // disable registration for underage user
      }
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress"); //remove call effect
    });
  };

  var login_call = function($button, payload, $response_errors){
    json_fetch_auth({
      data: payload, //send as parameterized string
      url: endpoints.login,
      contentType: "application/x-www-form-urlencoded",
      beforeSend: function(){
        $button.addClass("in_progress"); //call in progress effect
      }
    }).done(function (data) {
      //API CALL RESPONSE
      if(data.hasOwnProperty("access_token"))
      {
        config.client_config.AccessToken = data.access_token; //apply to current session config
      }

      creds.age_gate().clear(); //user has successfully authenticated, meaning they have also registered...clear age_gate attempt count

      creds.get().always(function(){
        log_analytics($button, "-finish");
        if(creds.profile_complete() === false && config.screens.skip_complete_profile.indexOf(state.bounce) === -1){ //user needs to add required profile data before proceeding
          newview.set({
            view: config.screens.complete_profile
          });
        } else { //profile is complete for this client, handle the bounce
          handle_login_bounce();
        }
      });
    }).fail(function (result) {
      if (!!result && !!result.responseJSON && result.responseJSON.error == "wrong_account_type") {
        // User wrongly tried to sign in with Google, so ask if they want to connect these accounts
        if (state.account_type == "google") {
          newview.set({
            view: config.screens.connect_google
          });
        } else if (state.account_type == "facebook") { // User wrongly tried to sign in with Facebook, so ask if they want to connect these accounts
          newview.set({
            view: config.screens.connect_facebook
          });
        } else if (state.account_type == "idm") { // User wrongly tried to sign in with username / password
          // User should login with their Google Account
          if (result.responseJSON.error_description == "google") {
            result.responseJSON.error = "wrong_account_type_google";
          } else if (result.responseJSON.error_description == "facebook") { // User should login with their Facebook Account
            result.responseJSON.error = "wrong_account_type_fb";
          }
          fail_handler(result, $response_errors);
        }
      } else {
        fail_handler(result, $response_errors);
      }
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress");
    });
  };

  //ensure user has completed profile before proceeding to redirection or bounce
  var continue_as_user_call = function() {
    if(creds.profile_complete() === false && config.screens.skip_complete_profile.indexOf(state.bounce) === -1){ //user needs to add required profile data before proceeding
      //user needs to add required profile data before proceeding
      newview.set({
        view: config.screens.complete_profile
      });
    } else {
      if(state.bounce) {
        // this is a pit stop on the way to what the user actually wanted to do,
        // so bounce to the intended url after login
        newview.set({
          view: state.bounce
        });
      } else if (!oauth2_call()) { // handle oauth2 redirect if applicable for this request
        if (get_idm_redirect("Login", config.post_auth_redirect_timeout)) {
          newview.set({
            view: config.screens.logged_in
          });
        } else { //go to default "you're logged in" screen
          newview.set({
            view: config.screens.logged_in
          });
        }
      }
    }
  };

  var logout_call = function(logout_params){
    logout_params = logout_params || {}; //set to empty object if nothing passed
    json_fetch_auth({
      url: endpoints.logout,
      contentType: "application/x-www-form-urlencoded",
      headers: {
        "Authorization": creds.get_user_token()
      }
    }).done(function(data){
      if(data.hasOwnProperty("success") && data.success === true)
      {
        config.client_config.AccessToken = "";
      }
    }).fail(function(error, result, response){
    }).always(function(data){
      if (Cookies.enabled) {
        Cookies.expire("idm_analytics", {
          domain: env_config.cookie_domain
        });
      }

      if (!logout_params.revoke_only && get_idm_redirect("Logout")){
        //redirect if callback url
      } else {
        //when using a data-show and a data-clickaction=logout, the user will not be refreshed because of object prop merging. enables user to go to a screen other than default after logout.
        newview_clear(logout_params);
      }
    });
  };

  var forgot_password_call = function($button, payload, $response_errors, $response_success){
    json_fetch_auth({
      url: endpoints.forgot_password,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token(),
        "client_id": state.client_id
      },
      beforeSend: function(){
        $button.addClass("in_progress"); //call in progress effect
      }
      // .always() and .done() are switched around in order to ensure the in_progress class is removed before the temp_disabled class is added.
    }).always(function(data){
      $button.removeClass("in_progress");
    }).done(function(data){
      if (get_idm_redirect("ForgetPw")){
        //redirect if callback url
      } else {
        $button.addClass("temp_disabled");
        setTimeout(function() {$button.removeClass("temp_disabled");}, 30000);
      }
      log_analytics($button, "-finish");
      success_handler($response_success);
    }).fail(function(result){
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    });
  };

  var change_password_call = function($button, payload, $response_errors, $response_success){
    json_fetch_auth({
      url: endpoints.change_password,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token()
      },
      beforeSend: function(){
        $button.addClass("in_progress"); //call in progress effect
      }
    }).done(function(data){
      if (get_idm_redirect("ChangePw")){
        //redirect if callback url
      } else {
        creds.destroy({view: config.screens.login, message: "password_changed", email: state.user.email, revoke_only: true, refresh: false});
      }
      log_analytics($button, "-finish");
    }).fail(function(result){
      if (!!result && !!result.responseJSON && result.responseJSON.error == "wrong_account_type") {
        //modify error name if using google or facebook to trigger respective message
         if(result.responseJSON.error_description == "google" || result.responseJSON.error_description == "facebook"){ result.responseJSON.error = "wrong_account_type_fb_google"; }
      }

      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(data){
      $button.removeClass("in_progress");
    });
  };

  var reset_password_call = function($button, payload, $response_errors, $response_success){
    json_fetch_auth({
      url: endpoints.reset_password,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token(),
        "client_id": state.client_id
      },
      beforeSend: function(){
        $button.addClass("in_progress"); //call in progress effect
      }
    }).done(function(data){
      if (get_idm_redirect("ResetPw")){
        //redirect if callback url
      } else {
        creds.destroy({view: config.screens.login, message: "password_changed", email: state.user.email, revoke_only: true, refresh: false});
      }
      log_analytics($button, "-finish");
    }).fail(function(result){
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(data){
      $button.removeClass("in_progress");
    });
  };

  //param structure: {button: [jquery element for submit button], payload: [parameterized form payload using $.param], response_errors: [jquery element for non-ui errors that come from ajax call], response_success: [jquery element for displaying 'success' message]}
  var change_email_call = function($button, payload, $response_errors, $response_success) {
    json_fetch_auth({
      url: endpoints.change_email,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token(),
        "client_id": state.client_id
      },
      beforeSend: function(){
        $button.addClass("in_progress");
      }
    }).done(function (data) { //handle successful api response
      state.user.new_email = JSON.parse(payload).email; //keep track of email
      creds.check(true); //get AccessToken and other client data immediately to have a logged-in state
      if (get_idm_redirect("ChangeEmail")){
        //redirect if callback url
      } else {
        newview.set({
          view: config.screens.change_email_done
        });
      }
      log_analytics($button, "-finish");
    }).fail(function (result) { //handle fail response
      if (!!result && !!result.responseJSON && result.responseJSON.error == "wrong_account_type") {
        //modify error name if using google or facebook to trigger respective message
         if(result.responseJSON.error_description == "google" || result.responseJSON.error_description == "facebook"){ result.responseJSON.error = "wrong_account_type_fb_google"; }
      }

      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress"); //remove call effect
    });
  };

  var change_email_confirm_call = function(payload, $response_errors, $response_success) {
    json_fetch_auth({
      url: endpoints.change_email_confirm,
      data: payload
    }).done(function (data) { //handle successful api response
      analytics.logger({ "event-name": "email-changed-confirm" });
      success_handler($response_success);

      if (get_idm_redirect("ChangeEmailConfirmed")){
        //redirect if callback url
      }
    }).fail(function (result) { //handle fail response
      fail_handler(result, $response_errors);
      analytics.log_all_errors();
    }).always(function(){
    });
  };

  var skip_update_profile_call = function() {
    creds.get().always(function(){
      log_analytics($button, "-finish");        
      handle_login_bounce();
    });
  };

  var update_profile_call = function($button, payload, $response_errors, $response_success, bounce_via_login){
    json_fetch_auth({
      url: endpoints.update_profile,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token()
      },
      beforeSend: function(){
        $button.addClass("in_progress");
      }
    }).done(function (data) { //handle successful api response
      log_analytics($button, "-finish");

      //get_user and proceed to other screens in the webapp
      creds.get().always(function(){
        if (!!state.redirect_uri) {
          bounce_via_login = true;
        }
        if (bounce_via_login) { //if this is a complete_profile call, then continue through the flow as if it were a login, to proceed to login redirection
          handle_login_bounce();
        } else {
          success_handler($response_success);
        }
      });
    }).fail(function (result) { //handle fail response
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress"); //remove call effect
    });
  };

  var delete_account_call = function($button, payload, $response_errors, $response_success, $modal){
    json_fetch_auth({
      url: endpoints.delete_account,
      method: "DELETE",
      data: payload,
      headers: {
        "Authorization": creds.get_user_token()
      },
      beforeSend: function(){
        $button.addClass("in_progress");
      }
    }).done(function (data) { //handle successful api response
      log_analytics($button, "-finish");

      $response_success.show();
      if (get_idm_redirect("Delete", config.post_auth_redirect_timeout)){
        //redirect if callback url
      } else {
        setTimeout(function(){
          //$(document).trigger("modal", [$container]); //toggle the modal (close it) if this was a successful in-modal waiver call
          $(document).trigger("start_over"); //can't do a creds.destroy() since we have no creds anymore
        }, 2500); //destroy creds and go to login page
      }
    }).fail(function (result) { //handle fail response
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress"); //remove call effect
    });
  };

  //param structure: {button: [jquery element for submit button], payload: [parameterized form payload using $.param], response_errors: [jquery element for non-ui errors that come from ajax call], response_success: [jquery element for displaying 'success' message]}
  var newsletter_opt_in_call = function($button, payload, $response_errors, $response_success) {
    json_fetch_auth({
      url: endpoints.newsletter_opt_in,
      data: payload,
      headers: {
        "Authorization": creds.get_user_token()
      },
      beforeSend: function(){
        $button.addClass("in_progress");
      }
    }).done(function (data) { //handle successful api response

      creds.get().always(function() {
        // this will always be a complete profile , no  need to actively check for it,
        // I'm also concerned about the UX of asking a user to do a newsletter opt in,
        // but then ask them to fill out this other data
        handle_login_bounce();
      });
      log_analytics($button, "-finish");
    }).fail(function (result) { //handle fail response
      fail_handler(result, $response_errors);
      log_analytics($button, "-fail");
      analytics.log_all_errors();
    }).always(function(){
      $button.removeClass("in_progress"); //remove call effect
    });
  };

  //mapping of "public" methods below to "private" methods above, for readability
  return {
    change_email: change_email_call,
    change_email_confirm: change_email_confirm_call,
    change_password: change_password_call,
    clear_user: newview_clear,
    continue_as_user: continue_as_user_call,
    delete_account: delete_account_call,
    error_handler: fail_handler,
    forgot_password: forgot_password_call,
    json_fetch_auth: json_fetch_auth,
    login: login_call,
    logout: logout_call,
    oauth2: oauth2_call,
    register: register_call,
    reset_password: reset_password_call,
    update_profile: update_profile_call,
    newsletter_opt_in: newsletter_opt_in_call,
    skip_update_profile: skip_update_profile_call
  };
})(env_config.endpoints);
