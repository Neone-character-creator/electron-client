module.exports = function(env){
    return require(`../config/${env}.config.js`);
};