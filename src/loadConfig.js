module.exports = function(env){
    if(!env) {
        throw new Error("env cannot be null, undefined or an empty string");
    }
    return require(`../config/${env}.config.js`);
};