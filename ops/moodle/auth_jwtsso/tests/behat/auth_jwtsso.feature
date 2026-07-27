@auth @auth_jwtsso
Feature: JWT SSO authentication
  In order to verify SSO login behaviour
  As a Moodle site administrator
  I need to ensure valid and invalid JWTs are handled correctly

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email            |
      | sso1     | Test      | User     | sso1@example.com |
    And the following "auth_jwtsso > jwtsso_configs" exist:
      | name          | value                                 |
      | autocreate    | 1                                     |
      | usernameclaim | email                                 |
      | emailclaim    | email                                 |
      | issuer        | https://reimann-dev.ddns.net/test-idp |
      | audience      | https://reimann-dev.ddns.net/         |

  Scenario: User attempts SSO login with an invalid JWT
    Given I log in as "admin"
    When I visit "/auth/jwtsso/callback.php?token=invalid.jwt.token"
    Then I should see "SSO login failed"

  Scenario: User logs in successfully with a valid JWT
    Given I log in as "admin"
    And I set JWTS SSO public key from fixture "auth/jwtsso/tests/fixtures/public.pem"
    And I have a fresh JWTS SSO token for "behat@example.com"
    When I visit the JWTS SSO callback with the current token
    And I visit "/user/preferences.php"
    Then I should see "Behat User"
