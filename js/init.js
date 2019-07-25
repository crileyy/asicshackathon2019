//constants to be used when invoking and initializing objects/functions
//the screens are set here because some events need to proceed to particular screens based on actions
//extended because initial config props are set in the style config up top
$.extend(config, {
  defaults: {
    locale: "en-GB", // default to the UK for date purposes, since the US is a unique MM-DD-YYYYs
    client_id: "idm", //default
    user: "",
    session_id: Date.now(),
    asics_id: "",
    account_type: "idm",
    style: "",
    privacy_url: "https://www.asics.com/privacy/privacy-policy",
    terms_url: "https://www.asics.com/us/en-us/terms-and-conditions",
    prev_view: "",
    no_analytics: true
  },
  xtm_default: "en-US",
  keep_params: ["style", "client_id", "locale", "bounce", "grant_type", "code_challenge_method", "redirect_uri", "code_challenge", "scope", "state", "utm_campaign", "utm_source", "utm_medium", "utm_term", "utm_content", "no_confirm_email", "send_confirm_email", "callback_url", "terms_privacy_country", "privacy_url", "terms_privacy_version", "terms_url", "webview", "thirdp_auth", "allow_native_fb", "redirect_uri", "triggerGoogleLogin", "triggerFbLogin", "no_analytics", "max_cookie_timeout"], //these params should be carried forward in the url. This DOES NOT mean that other state params will be deleted as the user goes to different screens! Those state params will still be kept DURING THE USER SESSION. However if the page is refreshed, or the user copies/pastes the url to a new session, ONLY THE PARAMS that are in the url will be applied to the new session.
  autofill_params: ["email", "first_name", "last_name"],
  date_format_stored: "YYYY-MM-DD",
  date_format_display: "DD MM YYYY",
  date_format_display_usable: "DD MM YYYY", //this is used because some locales use different letters for YYYY
  content_area: {},
  translate_everything: "main #main_inside section, main #footer, .modal, aside#left_panel",
  screens: {
    login: "login",
    register: "register",
    no_creds: ["lander", "register", "login", "forgot-password", "reset-password", "connect-google", "connect-facebook", "register-confirm", "change-email-confirm"],
    use_lander: "lander",
    no_lander: "register",
    logged_in: "logged-in",
    profile: "profile",
    complete_profile: "complete-profile",
    registration_successful: "register-success",
    change_email: "change-email",
    change_email_done: "change-email-done",
    change_email_confirm: "change-email-confirm",
    logged_in_continue_or_bounce: ["lander", "register", "login"],
    dont_bounce_to_here: ["continue", "complete-profile", "logout"],
    skip_complete_profile: ["delete"], //if requesting these screens, skip the complete profile step
    connect_google: "connect-google",
    connect_facebook: "connect-facebook",
    newsletter_opt_in: "newsletter-opt-in",
    auto_scroll_to_top: "complete-profile", //scroll to top when these screens are displayed
    continue: "continue",
    default: "lander",
    redirects: {"forget-password": "forgot-password", "register-lander": "lander"}
  },
  auto_check_country: ["US"],
  fallback_map: {},
  validation: {
    pass_min: 8,
    pass_max: 72,
    age_gate_min: 13,
    email_max: 116
  },
  deferred_calls: {after_translation: []}, //store an array of functions that are deferred and executed only after a specific trigger
  translate_done: false,
  run_on_this: {auto_check: ["view"], blockswap: ["client_id", "locale", "style", "use_lander", "view", "webview", "account_type"], translate: ["client_id", "style", "locale"], client_config: ["client_id"], stylize: ["style"], dynamic_terms: ["terms_url"], dynamic_pp: ["privacy_url"], body_mod: ["webview"], error_handler: ["error"], auto_fb_login: ['triggerFbLogin'], auto_google_login: ['triggerGoogleLogin']},
  post_auth_redirect_timeout: 0,
  patterns: {
    katakana_check: (/^[\u30A0-\u30FF]+$/)
  },
  third_party_services: ["facebook", "google"]
});

var state = {};

var utag_data = {app_id: "ASICSID"}; //tealium. to be extended later. tealium scripts are fetched using $.getScript

//try to detect device locale and verify it exists with locale select box
var locale_override = window.navigator.userLanguage || window.navigator.language; //get default locale
if(url_param("locale")){locale_override = url_param("locale");} //needed for onetrust stuff, if a url param is passed
if(document.querySelectorAll("select.footer-locale-select option[value='"+locale_override+"']").length) //check if default locale exists in locale select box
{
  config.defaults.locale = locale_override; //override default with device locale
  document.querySelectorAll("html")[0].setAttribute("lang", locale_override); //change html attribute
}

(function () {
  jQuery(function ($) {
    config.defaults.view = config.screens.default; //if no view param, show this first
    client_config.init(); //fetch client_config (synchronous) and add style (if necessary)
    config.content_area.nav = $("#topnav nav"); //nav menu
    config.content_area.sections = $("main #main_inside section"); //content area with articles
    config.content_area.sectionsmodals = $("main #main_inside section, .modal"); //to scope events to sections or modals
    (config.content_area.nav).removeClass("responsive").removeClass("nojs"); //remove these classes for "hamburger" menu functionality with javascript
    //some history api assistance for back and forward buttons
    window.onpopstate = function (event) { //"onpopstate" is fired when using the browser back and forward buttons. add a "nopush" property to state when passing to newview so the back and forward actions dont append to state, but instead allow the user to traverse existing state.
      if (event && event.state) {
        clone_state = $.extend({}, event.state); //must do this for IE since it doesn't allow manipulation of event.state object
        if (clone_state.view) {
          clone_state.nopush = true;
        }
        newview.set(clone_state);
      } else if ('state' in window.history) {
        window.location.reload();
      } //reload if using a hard server param like "?param="
    };

    //BINDERS FOR INTERACTIVITY
    $("#main_inside").removeClass("nojs"); //remove nojs class to adjust padding, borders, etc

    //add these binders to content_area.sections or .modals with additional selectors because some of these elements are modified/added/removed when translating. need to keep entire content_area event scope.
    (config.content_area.sectionsmodals).on("focus", (".floating-label, input, select", ".focus_blur"), function (e) { //for moving input text from inside to above the input
      $(this).closest(".input_outer_container").addClass("focus");
    });

    (config.content_area.sectionsmodals).on("blur", (".floating-label, input, select", ".focus_blur"), function (e) { //put text back inside
      $this_field = $(this).is("input, select")?$(this):$("input:visible, select:visible", $(this)).first();
      analytics_props = {
        "event-name": $this_field.data("eventname") + "-entered",
        "field": $this_field.data("fieldid")
      };

      if (!$this_field.is("select")) {
        analytics_props.valid = errors.validate($this_field) ? true : false;
      }

      analytics.logger(analytics_props);

      if (
          ($this_field.is("input[type=text], input[type=tel], input[type=email], input[type=password]") && ($this_field.val() === "" || $(this).closest(".input_outer_container").hasClass("valid"))) || !$this_field.is("input[type=text], input[type=tel], input[type=email], input[type=password]") || ($this_field.is(".masked.format_date") && /[a-zA-Z]/.test($this_field.val())) //only remove focus on input text if not empty or has a valid class assigned to it, and special case for masked date, look for any word char (M, m, D, etc)
      )
      {
        $(this).closest(".input_outer_container").removeClass("focus");
      }
    });

    (config.content_area.sectionsmodals).on("change keyup paste", "input.required, select.required, input.validate, select.validate", function (e) { //validate
      if(!$(this).is(".masked") || ($(this).is(".masked") && $(this).val()==="")) //masked inputs do not need real-time validation because the masking has its own validation rules. but if its cleared, validate it.
      {
        errors.validate($(this), true);
      }
    });

    //when hitting enter, trigger a click to the submit button (if only one exists in this section or modal)
    $(document).on("keypress", config.content_area.sectionsmodals, function (e) {
      var $container = $("body").hasClass("modalin") ? $(e.target).parents(".modal") : "#" + state.view; //if a modal is open, only use the modal as the container. DO NOT fire on anything that is in the backdrop.
      $submit_button = $("[type=submit]:visible", $container); //identify the submit input or button used for this view

      try {
        if (e.which == 13 && $submit_button.length === 1 && !$(e.target).is("textarea") && (!matchMedia("(pointer:coarse)").matches || ($(e.target).is("[type=password]") && state.view==config.screens.login))) { //mobile devices use next/tab as enter key. don't allow that to submit.
          e.preventDefault();
          $submit_button.trigger("click");
        } else if (e.which == 13 && matchMedia("(pointer:coarse)").matches && !$(e.target).is("textarea")) { //dont allow enter key to submit form on mobile
          e.preventDefault();
        }
      } catch(ee) {}
    });

    //EVENT LISTENERS
    //these are triggered/dispatched according to user action, which is generally clicking a button/link (submit, change password, logout, etc)
    $(document).on("login", function (e, $button) {
      e.preventDefault();

      var formname = $button.data("form");
      var payload = $("[data-form='" + formname + "']").not(".excluded").serializeArray(); //convert form data to array

      var remap = {"a_email": "username", "a_password": "password", "a_remember_me": "remember_me"}; //for renaming inputs before shipping off to endpoint

      payload.push({
        name: "language",
        value: (state.locale).split("-")[0],
      }, {
        name: "locale",
        value: state.locale
      }, {
        name: "grant_type",
        value: "password"
      }, {
        name: "client_id",
        value: state.client_id
      }, {
        name: "style",
        value: state.style
      }, {
        name: "max_cookie_timeout",
        value: state.max_cookie_timeout
      }); //add language as the first two letters of the locale, and add locale

      $.each(payload, function(k, v){
        if(remap[v.name]){
          payload.splice(k, 1, {name: remap[v.name], value: v.value}); //rename input names to those accepted by API
        }
      });

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and call is not in progress
      {
        if($("[data-fieldid='a_remember_me'][data-form='" + formname + "']").prop("checked"))
        {
          //TODO: set longer cookie
        }

        action_call.login($button, $.param(payload), $response_errors, $response_success);
      }
    });

    $(document).on("stateval stateuserval", function(e, $elem) { // triggered on both, stateuserval looks into state.user object
      var stateVal = $elem.data("stateval");
      var stateType = (e.type === "stateval") ? state : state.user;
      //element also needs data-stateval and needs to map to state or state.user property
      if($elem.attr("data-stateval") && (stateType.hasOwnProperty(stateVal)))
      {
        populate.by_selector($elem, stateType[stateVal]); //replace element with value from state
      }
    });
    // User has submitted registration
    $(document).on("register register_phonetic", function (e, $button) { //prepare payload and pass to action_call
      e.preventDefault();
      var remapped;

      if(e.type == "register_phonetic") //the jajp phonetic exception means we have to map things a little differently
      {
        remapped = {"a_email": "email", "a_birth": "birth", "a_password": "password", "a_country": "country", "a_newsletter": "receive_news_letter", "a_firstname_jajp": "first_name", "a_lastname_jajp": "last_name", "a_phonetic_firstname": "phonetic_first_name", "a_phonetic_lastname": "phonetic_last_name", "a_gender": "gender"}; //for renaming inputs before shipping off to endpoint
      } else {
        remapped = {"a_email": "email", "a_birth": "birth", "a_password": "password", "a_country": "country", "a_newsletter": "receive_news_letter", "a_firstname": "first_name", "a_lastname": "last_name", "a_phonetic_firstname": "phonetic_first_name", "a_phonetic_lastname": "phonetic_last_name", "a_gender": "gender", remove: ["a_firstname_jajp", "a_lastname_jajp"]}; //for renaming inputs before shipping off to endpoint
      }

      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        account_type: state.account_type,
        language: (state.locale).split("-")[0],
        locale: state.locale,
        client_id: state.client_id,
        agree_country: state.terms_privacy_country,
        agree_version: state.terms_privacy_version,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url,
        state: state.state,
        token: state.token,
        no_confirm_email: state.no_confirm_email,
        send_confirm_email: state.send_confirm_email,
        channel: ([state.client_id, state.style, state.locale, state.utm_campaign]).join(":"),
        style: state.style,
        ineligible_on_next_invalid: creds.age_gate().one_left(),
        max_cookie_timeout: state.max_cookie_timeout
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);
      payload.birth = moment(payload.birth, config.date_format_display_usable).format(config.date_format_stored); //format the birthdate
      if (payload.birth=="Invalid date") { payload.birth=""; } //correction for invalid date
      if (payload.account_type == "google") { payload.password = null; } //correction for password autofill
      payload.receive_news_letter = payload.receive_news_letter === "true"?true:false; //cast as boolean on backend

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) // check if any errors associated with this view and make sure call is not in progress
      {
        if(!creds.age_gate().check()) //don't make register call and disable button if too many age-gated attempts - coppa rules
        {
          $(".error.error_ineligible_to_register", "#" + state.view).show();
          $button.prop("disabled", true);
          errors.is_happy("#" + state.view); //for scroll up
        } else {
          action_call.register($button, JSON.stringify(payload), $response_errors, $response_success); //button, payload, error scope
        }
      }
    });

    $(document).on("update_profile update_profile_phonetic complete_profile complete_profile_phonetic",
      function (e, $button) { //prepare payload and pass to action_call
      e.preventDefault();
      var remapped;

      //the jajp phonetic exception means we have to map things a little differently
      if(e.type === "update_profile_phonetic" || e.type === "complete_profile_phonetic")
      {
        remapped = {"a_birth": "birth", "a_country": "country", "a_newsletter": "receive_news_letter", "a_firstname_jajp": "first_name", "a_lastname_jajp": "last_name", "a_phonetic_firstname": "phonetic_first_name", "a_phonetic_lastname": "phonetic_last_name", "a_gender": "gender"}; //for renaming inputs before shipping off to endpoint
      } else {
        remapped = {"a_birth": "birth", "a_country": "country", "a_newsletter": "receive_news_letter", "a_firstname": "first_name", "a_lastname": "last_name", "a_phonetic_firstname": "phonetic_first_name", "a_phonetic_lastname": "phonetic_last_name", "a_gender": "gender", remove: ["a_firstname_jajp", "a_lastname_jajp"]}; //for renaming inputs before shipping off to endpoint
      }

      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);
      payload.birth = moment(payload.birth, config.date_format_display_usable).format(config.date_format_stored); //format the birthdate
      if(payload.birth=="Invalid date"){ payload.birth=""; } //correction for invalid date
      payload.receive_news_letter = payload.receive_news_letter === "true"?true:false; //cast as boolean on backend

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);
      var bounce_via_login;

      // override response_success action for the instance of complete_profile
      // it is merely a pitstop on the way to the original destination.
      if(e.type === "complete_profile_phonetic" || e.type === "complete_profile")
      {
        bounce_via_login = true;
      } else {
        bounce_via_login = false;
      }

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and make sure call is not in progress
      {
        //button, payload, error scope
        action_call.update_profile($button, JSON.stringify(payload), $response_errors,
          $response_success, bounce_via_login);
      }
    });

    $(document).on("skipfornowclick", function (e) {
      e.preventDefault();
      action_call.skip_update_profile();
    });

    $(document).on("continue_as_user", function (e) {
      action_call.continue_as_user();
        });

    $(document).on("change_email_confirm", function (e) {
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if(!!state.token){ //ensure token is passed in url
        action_call.change_email_confirm(JSON.stringify({token: state.token}), $response_errors, $response_success); //payload, error scope
      }
    });

    $(document).on("logout", function (e, $elem) {
      var logout_params = {};
      if($elem && $elem.attr("data-show")){
        logout_params.revoke_only = true; //will not follow idm redirect
        logout_params.view = $elem.data("show");
        logout_params.refresh = false; //since we're going somewhere after logout, don't do a full refresh
        logout_params.fresh_url = false; //keep existing params
      }

      creds.destroy(logout_params);
    });

    $(document).on("start_over", function (e) { //to be used when token is revoked, such as during delete, and a fresh start needed
      newview.clear({ //use newview.clear to reset fields and clear any errors
        view: config.screens.default,
        locale: state.locale,
        style: state.style,
        client_id: state.client_id,
        fresh_url: true,
        refresh: true
      });
    });

    $(document).on("forgot_password", function(e, $button){
      e.preventDefault();
      if ($button.hasClass("temp_disabled")) {
        // in order to let the page timeout & prevent multiple forgot p/w links to be sent to user within 30 secs
        return;
      }
      var remapped = {"a_email": "email"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        locale: state.locale,
        state: state.state,
        token: state.token,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress") && !$button.hasClass("temp_disabled")) //check if any errors associated with this view and make sure call is not in progress
      {
        action_call.forgot_password($button, JSON.stringify(payload), $response_errors, $response_success);
      }
    });

    $(document).on("reset_password", function(e, $button){
      e.preventDefault();
      var remapped = {"a_password": "password", "a_email": "email"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        locale: state.locale,
        token: state.token,
        email: state.email,
        state: state.state,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and make sure call is not in progress
      {
        action_call.reset_password($button, JSON.stringify(payload), $response_errors, $response_success);
      }
    });

    $(document).on("change_password", function(e, $button){
      e.preventDefault();
      var remapped = {"a_current_password": "old_password", "a_new_password": "new_password"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        locale: state.locale,
        state: state.token,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and make sure call is not in progress
      {
        action_call.change_password($button, JSON.stringify(payload), $response_errors, $response_success);
      }
    });

    $(document).on("change_email", function (e, $button) { //handle email change by confirming password and updating user email
      e.preventDefault();

      var remapped = {"a_email": "email", "a_password": "password"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']:visible").not(".excluded").serializeObject(); //convert form data to JSON, but don't compile password if hidden for third-party service

      var manual_payload = {
        locale: state.locale,
        state: state.state,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and call is not in progress
      {
        action_call.change_email($button, JSON.stringify(payload), $response_errors, $response_success);
      }
    });

    $(document).on("delete_account", function (e, $button) { //handle email change by confirming password and updating user email
      e.preventDefault();
      var $container = $button.parents(".modal"); //this is a special case where the confirm pops up in a modal

      var payload = {
        locale: state.locale,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      $(".error.non_ui, .success", $container).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", $container);
      var $response_success = $(".success", $container);

      if (errors.is_happy($container) && !$button.hasClass("in_progress")) //check if any errors associated with this view and call is not in progress
      {
          action_call.delete_account($button, JSON.stringify(payload), $response_errors, $response_success, $container);
      }
    });

    $(document).on("newsletter_opt_in", function(e, $button){
      e.preventDefault();

      var remapped = {"a_newsletter": "receive_news_letter"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']").not(".excluded").serializeObject(); //convert form data to JSON

      var manual_payload = {
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);
      payload.receive_news_letter = payload.receive_news_letter === "true"?true:false; //cast as boolean on backend

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress"))  //check if any errors associated with this view and make sure call is not in progress
      {
        action_call.newsletter_opt_in($button, JSON.stringify(payload), $response_errors, $response_success);
      }
    });

    //trigger to launch modal
    $(document).on("modal", function (e, modal) {
      modal.toggleClass("modalin");
      $("body").toggleClass("modalin");
      if (modal.hasClass("modalin")) {
        analytics.logger({
          "event-name": modal.data("eventname")
        });
      } //log analytics when modal is displayed
    });

    //just add the "modal-toggle" class to any element to toggle open/close
    $(document).on("click", "a, .modal-toggle, button", function (e) {
      if(!$(this).is("a")){ e.preventDefault(); } //handle anchors later
      if($(this).is("a") && (!$(this).attr("href") || $(this).attr("href") === "")){ e.preventDefault(); } //for links that should be dynamically populated with href, do nothing until population
      if(!$("body").hasClass("modalin") || ($("body").hasClass("modalin") && $(this).parents(".modal").length)) { //only allow to close an open modal if clicking on a .modal-toggle that is inside the modal. Otherwise hitting enter may trigger a click on the toggle behind the modal
        if (($(this).is("a") && $(this).attr("data-modal")) || !$(this).is("a") && $(this).hasClass("modal-toggle")) //anchor and button tags can launch modal using just data-modal attribute. non-links can close their parent modal if they have the modal-toggle attribute.
        {
          e.preventDefault();
          if ($(this).parents('.modal').length) //click anything inside modal (including overlay) that has a .modal-toggle class
          {
            $(document).trigger("modal", [$(this).parents('.modal')]);
          } else if ($(this).attr("data-modal")) //toggle modal using data-modal attribute
          {
            $(document).trigger("modal", [$('.modal.' + $(this).data('modal'))]);
          }
        }
      }
    });

    //intercept nav clicks below to toggle the hamburger menu and to show specific content using the data-show attribute, and fire analytics if attached
    $(document).on("click", "a, [data-show], [data-clickaction], [data-eventname]", function (e) { //intercept anchor clicks and button clicks
      //IMPORTANT: the rules for this are an element can either have a DATA-CLICKACTION or a DATA-SHOW. clickaction takes precedence so that a trigger can use the DATA-SHOW for it's handling and the show action will not be premature.
      if ($(this).hasClass("dropdown")) //the hamburger icon has the dropdown class and will collapse or expand using the responsive class on the nav
      {
        e.preventDefault();
        (config.content_area.nav).toggleClass("responsive");
      } else {
        if ($(this).attr("data-clickaction")) //trigger action based on data-clickaction value, currently only used for logout
        {
          e.preventDefault();
          $(document).trigger($(this).data("clickaction"), [$(this)]);
        } else if ($(this).attr("data-show")) {//pass the data-show active section function below
          e.preventDefault();
          if (!$(this).attr("data-errorcheck") || ($(this).attr("data-errorcheck") && errors.is_happy("#" + state.view))) //if this requires an errorcheck, do it before following the data-show
          {
            newview.set({
              view: $(this).data("show")
            });
          }
        }
      }

      //analytics for clicks
      if ($(this).attr("data-eventname")) {
        //initial analytics props object
        var analytics_props = {
          "event-name": $(this).data("eventname") + "-click",
          "field": $(this).data("fieldid")
        };

        if ($(this).is(":checkbox")) {
          analytics_props.checked = $(this).prop("checked");
        }

        if($(this).parents(".modal").length) { analytics_props.page = $(this).parents(".modal").attr("id"); } //if inside modal, pass the modal as the page name to analytics
        if(analytics_props.page === "modal_liability_waiver"){ analytics_props.waiver_version = $("#a_waiver_version").val(); } //if on the liability_waiver modal, pass the waiver_version to analytics

        analytics.logger(analytics_props);
      } //log click event if data-event attached
    });

    $(document).on("show_pass", function(e, elem)
    {
      var $input = elem.parents(".input_container").find("input");
      var newtype = "password"; //default
      var oldtype = "text"; //default
      if($input.attr("type") === "password")  //toggle between text and password
      {
        newtype = "text";
        oldtype = "password";
      }

      elem.removeClass("eye_"+oldtype).addClass("eye_"+newtype); //use "eye_[type]" as the selector to swap classes
      $input.attr("type", newtype); //swap type
    });

    //populate view with user info upon dispatch of event (happens in get_user ajax call)
    $(document).on("user_info", function(e, data){
      defer_call("populate.by_selector", function(){ populate.by_selector($("[data-userval]", config.translate_everything), data);  }); //defer any user_info call until translations are done
    });

    $(document).on("translate_done", function(e){ //rerun any functions in here every time translations are run
      for(var k in config.deferred_calls.after_translation)
      {
        config.deferred_calls.after_translation[k](); //execute deferred function
      }
    });

    // Facebook asynchronous initialization has completed
    $(document).on("fb_async_init_complete", function(e) {
      // Trigger auto FB login if we're supposed to...
      if (state.auto_fb_login === true && state.auto_fb_login_triggered === false) {
          $(document).trigger("with_facebook", [$(".fb_oauth_button:visible", "#"+state.view)]);
          state.auto_fb_login_triggered = true;
      }
    });

    // Google asynchronous initialization has completed
    $(document).on("google_async_init_complete", function(e) {
      // Trigger auto google login if we're supposed to...
      if (state.auto_google_login === true && state.auto_google_login_triggered === false) {
        var auth2 = gapi.auth2.getAuthInstance();
        var is_logged_in = auth2.isSignedIn.get(); //if user is logged in, trigger oauth flow automatically
        var $button = $(".google_oauth_button:visible", "#"+state.view);

        if(is_logged_in){ //user already logged in, so trigger oauth population
          var googleUser = auth2.currentUser.get();
          var profile = googleUser.getBasicProfile();
          var auth = googleUser.getAuthResponse(true); // by default, getAuthResponse does not return an access_token or scopes

          $(document).trigger("google_oauth", [profile, auth, $button, "google"]); //trigger oauth flow
        } else {
          auth2.signIn().then(function(googleUser) { //launch signin window
              var profile = googleUser.getBasicProfile();
              var auth = googleUser.getAuthResponse(true); // by default, getAuthResponse does not return an access_token or scopes

              $(document).trigger("google_oauth", [profile, auth, $button, "google"]); //trigger oauth population
            }, function(error) {
              console.log(JSON.stringify(error, undefined, 2));
            });
        }
        state.auto_google_login_triggered = true; //make sure to only do this once
      }
    });

      // User has pressed a Facebook OAuth button
    $(document).on("with_facebook", function(e, $button){
      if (state.thirdp_auth !== false || state.allow_native_fb === true) {
        // Check whether the user already logged in
        if (fb_response && fb_response.status === 'connected') {
          FB.api('/me', 'get', { access_token: fb_response.authResponse.accessToken, fields: 'id,first_name,last_name,email' }, function(profile) {
            $(document).trigger("facebook_oauth", [profile, fb_response.authResponse, $button, "facebook"]);
          });
        } else {
          FB.login(function (response) {
            if (response.authResponse) {
              FB.api('/me', 'get', { access_token: response.authResponse.accessToken, fields: 'id,first_name,last_name,email' }, function(profile) {
                $(document).trigger("facebook_oauth", [profile, response.authResponse, $button, "facebook"]);
              });
            } else {
              console.log('User cancelled login or did not fully authorize Facebook.');
            }
          }, {scope: 'email'});
        }
      } else {
        window.location = 'webview://?triggerFbLogin=true';
      }
    });

    // User has pressed a Google OAuth button
    $(document).on("with_google", function(e){
      if (state.thirdp_auth === false) {
        window.location = 'webview://?triggerGoogleLogin=true';
      }
    });

    // User has hit "Sign Up with Email" so remove any third-party oauth flow artifacts
    $(document).on("with_email", function(e){
      if(config.third_party_services.indexOf(state.account_type) !== -1){ //if user has started oauth flow, reset
        newview.clear({
          view: config.screens.register,
          refresh: true,
          fresh_url: false
        }); //clear session of any oauth stuff, etc and refresh
      } else {
        newview.set({view: config.screens.register}); //no need to refresh if account type hasn't been switched to oauth
      }
    });

    // User is trying to authenticate with Google / Facebook
    $(document).on("google_oauth facebook_oauth", function(e, profile, auth, $button, type){
      state.account_type = type; // set the account_type to be a Google / Facebook user

      state.token = (type == "google") ? auth.access_token : auth.accessToken;

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if ($button.data("oauthtype") == "signup") { // user is on lander or register page
        if(state.view != config.screens.register) {
          newview.set({
            view: config.screens.register // switch the user to the registration screen if not already there
          });
        }
        var data = {};
        var first_name = (type == "google") ? profile.getGivenName() : profile.first_name;
        var last_name = (type == "google") ? profile.getFamilyName() : profile.last_name;
        var email = (type == "google") ? profile.getEmail(): profile.email;
        // facebook does not allow you to have a first name and last name from a
        // separate characterset, but google does -- so check both are katakana!
        var fill_phonetic =
          (config.patterns.katakana_check.test(first_name)) &&
          (config.patterns.katakana_check.test(last_name)) ? true : false;
        if(fill_phonetic) {
          data = {
            a_phonetic_firstname: first_name,
            a_firstname: first_name,
            a_phonetic_lastname: last_name,
            a_lastname: last_name,
            a_email: email
          };
        } else {
          data = {
            a_firstname_jajp: first_name,
            a_firstname: first_name,
            a_lastname_jajp: last_name,
            a_lastname: last_name,
            a_email: email
          };
        }

        $(".hide_oauth", "#" + state.view).hide(); // hide password and standard create account button.
        $("[class$=_create][type=submit]").hide(); //to prevent showing both
        $("."+type+"_create[type=submit]").show(); //show third-party-specific signup button

        populate.by_data_form("register", data); // prepopulate the form with firstName, lastName, and country (automatic from set)
        state.token = (type == "google") ? auth.access_token : auth.accessToken; // need to set token after view changes
      } else { // user is on login
        $button = $("[type='submit']", "#"+state.view); // prevents Google and Facebook buttons from flashing
        state.assertion_type = "urn:"+type+".com";
        var payload = {
          assertion: state.token,
          assertion_type: state.assertion_type,
          locale: state.locale,
          link3rd: false,
          grant_type: "assertion",
          client_id: state.client_id
        };
        action_call.login($button, $.param(payload), $response_errors, $response_success);
      }
    });

    // User is connecting a Google or Facebook account to their previous email/password combo
    $(document).on("connect_google connect_facebook", function(e, $button) {
      var remapped = {"a_password": "password"}; //for renaming inputs before shipping off to endpoint
      var payload = $("[data-form='" + $button.data("form") + "']").serializeObject(); //convert form data to JSON

      var manual_payload = {
        assertion: state.token,
        assertion_type: state.assertion_type,
        locale: state.locale,
        link3rd: true,
        grant_type: "assertion",
        client_id: state.client_id,
        access_token: state.token,
        style: state.style,
        privacy_url: state.privacy_url,
        terms_url: state.terms_url
      };

      payload = $.extend({}, manual_payload, payload); //merge payload into manual payload
      remap(payload, remapped);

      $(".error.non_ui, .success", "#" + state.view).hide(); //clear server (non-user validation) errors and any success message
      var $response_errors = $(".error", "#" + state.view);
      var $response_success = $(".success", "#"+state.view);

      if (errors.is_happy("#" + state.view) && !$button.hasClass("in_progress")) //check if any errors associated with this view and call is not in progress
      {
        action_call.login($button, $.param(payload), $response_errors, $response_success);
      }
    });

    //change locale
    $(".footer-locale-select").on("change", function (e) {
      e.preventDefault();
      analytics.logger({
        "event-name": "locale-selected",
        "old-locale": url_param("locale"),
        "new_locale": $(this).val()
      }); //log before changing. necessary to do this here instead of newview because just having locale param in url does not always mean locale was toggled with dropdown
      if(window.history.state){
        newview.set({
          locale: $(this).val(),
          refresh: true
        });
      } else {
        newview.set({ //don't do a refresh for ie9
          locale: $(this).val()
        });
      }
    });

    //DEV STUFF
    $("#topnav .toggle").click(function(){
      $("#topnav nav").toggle();
    });

    // tracking if user manually changed marketing comm preferences
    $('[data-fieldid=a_newsletter]').on("change", function() {
      $(this).data('userchange', 'true');
    });

    // adding default behavior of marketing communications upon user changes for country of residence
    $("[data-fieldid=a_country]").on("change", function() {
      auto_check_marketing_comm($(this));
    });

    fix_autofill(); //run once here and also run when app screen fades in for the first time (to catch any delayed autofill)

    //ONEASICS CAROUSEL
    $(document).on("onorientationchange resizedone newview", function(){ //logic to only initialize carousel if it's being shown, and reinitialize when window is resized
      var carousel = function(carousel_selector){
        $(carousel_selector).each(function(){
            if(blockswap.is_visible($(this))===true) //use this method to check if this carousel is shown or hidden using "show-" or "hide-" classes
            {
              var carousel_props = {dots: true, mobileFirst: true, touchThreshold: 10}; //carousel config, see https://github.com/kenwheeler/slick
              if($(this).is(".slick-initialized")) //if already initialized but this is a screen change or resize, then reinitialize on current slide
              {
                var index = $(this).slick('slickCurrentSlide') || 0;
                $.extend(carousel_props, {initialSlide: index});
                $(this).slick("unslick").slick(carousel_props); //re-initialize carousel
              } else { //not initialized yet
                $(this).slick(carousel_props);
              }
            }
        });
      }(".oneasics_carousel"); //iife
    });

    function debounce(func){ //timer set up to capture resizedone event
      var timer;
      return function(event){
        if(timer) clearTimeout(timer);
        timer = setTimeout(func,300,event);
      };
    }

    window.addEventListener("resize",debounce(function(e){
      $(document).trigger("resizedone"); //trigger resizedone after debounce timeout so we don't run on every resize pixel drag
    }));
    // END ONEASICS CAROUSEL

    //INITIALIZE!
    newview.set(config.init_overrides); //call newview with any override params, in case url param values are unsupported. See client_config object.

    // 3RD PARTY AUTH
    if (state.thirdp_auth !== false) {
      // Load Google OAuth API
      $.getScript( "https://apis.google.com/js/platform.js", function() {
        // Set up Google OAuth button listeners
        googleLoginListener($(".google_oauth_button"));
      });
    }
    
    //tealium analytics, only load if not a no_analytics=true param
    if(state.no_analytics !== true) {
      var tealium_script_src = !!state.webview ? env_config.tealium_utag_script_apps : env_config.tealium_utag_script; //load different script if inside webview (mobile app)
      var tealium_script_sync_src = !!state.webview ? env_config.tealium_utag_sync_script_apps : env_config.tealium_utag_sync_script; //load different script if inside webview (mobile app)
      $.getScript(tealium_script_sync_src, function(){
         (function(a,b,c,d){
           a=tealium_script_src; b=document;c='script';d=b.createElement(c);d.src=a;d.type='text/java'+c;d.async=true;
           a=b.getElementsByTagName(c)[0];a.parentNode.insertBefore(d,a);
         })();
      });
    }    
  });
})();

/* FACEBOOK LOGIN */

if(url_param("thirdp_auth") !== "false")
{
  var fb_response;
  window.fbAsyncInit = function() {
    // FB JavaScript SDK configuration and setup
    FB.init({
      appId    : env_config.facebook_id, // FB App ID
      cookie     : true,  // enable cookies to allow the server to access the session
      xfbml      : false,  // do not parse social plugins on this page
      version    : 'v3.1', // use graph api version 3.1
      status: true
    });

    //store the response so we don't have to fetch it later...also prevents popup from being blocked
    FB.getLoginStatus(function(response) {
      fb_response = response;
    
      $(document).trigger('fb_async_init_complete');
    });
  };

  // Load the JavaScript SDK asynchronously
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
}

/* END FACEBOOK LOGIN */

/* GOOGLE LOGIN */

function googleLoginListener($buttons) {
  var googleUser = {};
  gapi.load('auth2', function() {
    // Retrieve the singleton for the GoogleAuth library and set up the client.
    auth2 = gapi.auth2.init({
      client_id: env_config.google_id,
      cookiepolicy: 'single_host_origin'
    });

    $buttons.each(function(){ //go through each button as specified in selectors and attach handlers
      var $button = $(this);
      auth2.attachClickHandler($button[0], {}, // attach sign in/up flow
        function(googleUser) {
          var profile = googleUser.getBasicProfile();
          var auth = googleUser.getAuthResponse(true /*includeAuthorizationData*/); // by default, getAuthResponse does not return an access_token or scopes

          $(document).trigger("google_oauth", [profile, auth, $button, "google"]);
        }, function(error) {
          console.log(JSON.stringify(error, undefined, 2));
        });
    });

    auth2.then(function(){ //listen for signin state change, which means init complete
      $(document).trigger('google_async_init_complete'); //triggers auto-login for mobile
    });
  });
}

/* END GOOGLE LOGIN */
