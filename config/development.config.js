module.exports = {
    features: {
        CLOUD_FEATURES: true
    },
    api: {
        url: 'http://localhost:8080',
        pluginPath: '/plugins/',
        login: {
            google: "/login/google"
        }
    },
    services: {
        auth: {
            google: {
                clientId: "275558456725-6jus1cc4jisj4t1md64oog6q47den271.apps.googleusercontent.com",
                clientSecret: "FiF_ZG4erQZwJZQfjRQ-zXRK",
                apiUrl: "https://people.googleapis.com/v1/people/me"
            }
        },
    }
};