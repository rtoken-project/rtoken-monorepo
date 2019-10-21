module.exports = {
    root: true,
    extends: "eslint:recommended",
    env: {
        node: true
    },
    parserOptions: {
        ecmaVersion: 2017,
    },
    rules: {
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
