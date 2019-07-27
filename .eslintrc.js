module.exports = {
    "root": true,
    "extends": "eslint:recommended",
    "env": {
        "es6": true,
        "node": true
    },
    "parserOptions": {
        "ecmaVersion": 8,
        "ecmaFeatures": {
            "experimentalObjectRestSpread": true
        }
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};
