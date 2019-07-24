var env_config = {
  cookie_domain: "id.local.dev.asics.digital",
  api_host: "https://id.local.dev.asics.digital:8443",
  google_id: "945161940755-revgr83ik50fkmvaho8ghvbcubqraccs.apps.googleusercontent.com",
  facebook_id: "2206314156282588",
  tealium_env: "localhost",
  tealium_utag_script: "//tags.tiqcdn.com/utag/asics/oneasics/dev/utag.js",
  tealium_utag_sync_script: "//tags.tiqcdn.com/utag/asics/oneasics/dev/utag.sync.js",
  tealium_utag_script_apps: "//tags.tiqcdn.com/utag/asics/oneasicsapps/dev/utag.js",
  tealium_utag_sync_script_apps: "//tags.tiqcdn.com/utag/asics/oneasicsapps/dev/utag.sync.js",
  optanon_script: "https://optanon.blob.core.windows.net/langswitch/29197d8d-b00f-41ac-b602-b75b5c0e617f.js",
  jwt_public_key: "-----BEGIN PUBLIC KEY-----\n" +
        "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3OSXUrx+wYYTftsQyy/F\n" +
        "B5A3nCg+Pbr23viZo3iCoLcYfYITmvuqhnGJv6DEjL9C3jGdXvoKr5UV9ffwNxEV\n" +
        "2hl5kw30mkPkg3Uk9GLHbmH08s0hjJywfqSKsqLjU1XTjUh9pJ4LgcDSG3Z4KLKv\n" +
        "5reT0DYIEIyqegYLDmEEr0p1Lw/WeDBYQTeQj68GR1pHMAQjALu5KfM7jA59wrAE\n" +
        "yW9Xj45nztWiUjZA9PzxBBaS2bau/yu8A4G9A/+RniofN4F42RHRiiOpkhHjj6UY\n" +
        "Ny7sx8SR6JAcij0yGQwwtMOgOAyBr4VNKOEbOgcOcmyfyCAUfJNpGI5TgAuHbRKr\n" +
        "gQIDAQAB\n" +
        "-----END PUBLIC KEY-----",
  events_logger: "https://events.staging.asics.digital/events/record"
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
