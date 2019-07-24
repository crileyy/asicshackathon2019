var env_config = {
  cookie_domain: '.asics.com',
  api_host: "https://id.asics.com",
  google_id: "746690278429-i3o1cdfanq31q4rl00epu1hot4p1di3i.apps.googleusercontent.com",
  facebook_id: "745812855551846",
  tealium_env: "prod",
  tealium_utag_script: "//tags.tiqcdn.com/utag/asics/oneasics/prod/utag.js",
  tealium_utag_sync_script: "//tags.tiqcdn.com/utag/asics/oneasics/prod/utag.sync.js",
  tealium_utag_script_apps: "//tags.tiqcdn.com/utag/asics/oneasicsapps/prod/utag.js",
  tealium_utag_sync_script_apps: "//tags.tiqcdn.com/utag/asics/oneasicsapps/prod/utag.sync.js",
  optanon_script: "https://optanon.blob.core.windows.net/langswitch/060563b7-aabc-489d-9a55-aad620cb1222.js",
  jwt_public_key: "-----BEGIN PUBLIC KEY-----\n" +
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvP7s32lTKY5xylntjkZh\n" +
        "pa4/rQeASdpGzVxl/DhV8w96XgxX+TGS6hkXAcVfkmqbCyuTPb6MR65U1n4FcjFY\n" +
        "21LfIeNsRJdvaYMs06QiHpFIIflPiOq+YSADqHtQrNpsC669JD8+Or5U4AEdcOU9\n" +
        "bsqOtUAbG8lcWuojZnziVQpKDqoU1beknLpgDjWZbZonZEJ2dMuhUzESu8FS8Gio\n" +
        "U8BGO/vvUsGOUJdc40FoQnmxNIT5Ry/Q2KZ2+j4ZWwPDTlcq5+MVY+h5KOXc0mmD\n" +
        "+6aSiXA1n5MdobX/ZeugnHIOi1+ekyzkjDIRSrO3JaEpfFmefLjL8jR3m+h0rT+h\n" +
        "OwIDAQAB\n" +
        "-----END PUBLIC KEY-----",
  events_logger: "https://events.asics.digital/events/record"
};

env_config.endpoints = {
  employee_signin: env_config.api_host + "/stores",
  check_user: env_config.api_host + "/accounts",
  customer_info: env_config.api_host + "/accounts",
  client_config: env_config.api_host + "/init",
  login: env_config.api_host + "/oauth2/token/auth",
  logout: env_config.api_host + "/oauth2/token/revoke",
  user_info: env_config.api_host + "/api/v1/users",
  register: env_config.api_host + "/api/v1/users/auth/register",
  register_confirm: env_config.api_host + "/api/v1/users/auth/register-confirm",
  forgot_password: env_config.api_host + "/api/v1/users/auth/forget-password",
  reset_password: env_config.api_host + "/api/v1/users/auth/reset-password",
  change_password: env_config.api_host + "/api/v1/users/update-password",
  update_profile: env_config.api_host + "/api/v1/users/update-profile",
  change_email: env_config.api_host + "/api/v1/users/change-email",
  change_email_confirm: env_config.api_host + "/api/v1/users/auth/change-email-confirm",
  delete_account: env_config.api_host + "/api/v1/users",
  newsletter_opt_in: env_config.api_host + "/api/v1/users/newsletter-opt-in"
};
