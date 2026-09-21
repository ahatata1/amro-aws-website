export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_YtAuS8mee',
      userPoolClientId: '7b9grknlv9tc00il8uhj265krm',

      loginWith: {
        oauth: {
          domain: 'vb-auth-2025.auth.us-east-1.amazoncognito.com',

          scopes: [
            'openid',
            'email'
          ],

          redirectSignIn: [
            'http://localhost:5173/',
            'https://cloudigalaxy.com/',
            'https://www.cloudigalaxy.com/'
          ],

          redirectSignOut: [
            'http://localhost:5173/',
            'https://cloudigalaxy.com/',
            'https://www.cloudigalaxy.com/'
          ],

          responseType: 'code'
        }
      }
    }
  }
};